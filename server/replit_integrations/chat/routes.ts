import type { Express, Request, Response } from "express";
import { chatStorage } from "./storage";

// Ollama's native API is used instead of its OpenAI-compatible endpoint
// because older Ollama versions only accept string content on /v1/chat.
const ollamaBaseUrl = (
  process.env.OLLAMA_BASE_URL || "http://127.0.0.1:11434"
).replace(/\/v1\/?$/, "").replace(/\/+$/, "");

// Rough token estimate: 1 token ≈ 4 chars
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

// Trim conversation history to stay within token budget
// Strategy: always keep the first message (for context) + as many recent messages as fit
function trimHistory(
  messages: any[],
  maxTokens: number
): any[] {
  if (messages.length === 0) return [];

  let total = 0;
  const kept: { role: string; content: string }[] = [];

  // Walk backwards (most recent first), keeping messages that fit
  for (let i = messages.length - 1; i >= 0; i--) {
    const content = typeof messages[i].content === "string"
      ? messages[i].content
      : JSON.stringify(messages[i].content);
    const t = estimateTokens(content) + 4; // +4 for role overhead
    if (total + t > maxTokens && kept.length > 0) break; // always keep at least the latest
    total += t;
    kept.unshift(messages[i]);
  }

  return kept;
}

function toOllamaMessages(messages: any[]) {
  return messages.map((message) => {
    if (!Array.isArray(message.content)) {
      return {
        role: message.role,
        content: typeof message.content === "string" ? message.content : String(message.content ?? ""),
      };
    }

    const textParts: string[] = [];
    const images: string[] = [];
    for (const part of message.content) {
      if (part?.type === "text" && typeof part.text === "string") {
        textParts.push(part.text);
      }
      if (part?.type === "image_url" && typeof part.image_url?.url === "string") {
        const url = part.image_url.url;
        images.push(url.includes(",") ? url.split(",", 2)[1] : url);
      }
    }

    return {
      role: message.role,
      content: textParts.join("\n\n"),
      ...(images.length ? { images } : {}),
    };
  });
}

export function registerChatRoutes(app: Express): void {
  // Get all conversations
  app.get("/api/conversations", async (req: Request, res: Response) => {
    try {
      const conversations = await chatStorage.getAllConversations();
      res.json(conversations);
    } catch (error) {
      console.error("Error fetching conversations:", error);
      res.status(500).json({ error: "Failed to fetch conversations" });
    }
  });

  // Get single conversation with messages
  app.get("/api/conversations/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const conversation = await chatStorage.getConversation(id);
      if (!conversation) {
        return res.status(404).json({ error: "Conversation not found" });
      }
      const messages = await chatStorage.getMessagesByConversation(id);
      res.json({ ...conversation, messages });
    } catch (error) {
      console.error("Error fetching conversation:", error);
      res.status(500).json({ error: "Failed to fetch conversation" });
    }
  });

  // Create new conversation
  app.post("/api/conversations", async (req: Request, res: Response) => {
    try {
      const { title } = req.body;
      const conversation = await chatStorage.createConversation(title || "New Chat");
      res.status(201).json(conversation);
    } catch (error) {
      console.error("Error creating conversation:", error);
      res.status(500).json({ error: "Failed to create conversation" });
    }
  });

  // Delete conversation
  app.delete("/api/conversations/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      await chatStorage.deleteConversation(id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting conversation:", error);
      res.status(500).json({ error: "Failed to delete conversation" });
    }
  });

  // Send message and get AI response (streaming)
  app.post("/api/conversations/:id/messages", async (req: Request, res: Response) => {
    try {
      const conversationId = parseInt(req.params.id);
      const content = typeof req.body.content === "string" ? req.body.content.trim() : "";
      const attachments = Array.isArray(req.body.attachments)
        ? req.body.attachments.slice(0, 10)
        : [];
      const attachmentNames = attachments
        .filter((attachment: any) => typeof attachment?.name === "string")
        .map((attachment: any) => attachment.name);
      const storedContent = [
        content,
        attachmentNames.length ? `Attached files: ${attachmentNames.join(", ")}` : "",
      ].filter(Boolean).join("\n\n") || "Please analyze the attached files.";

      // Read existing history without saving the new message yet. Failed
      // provider requests must not leave a duplicate user message in the DB.
      const existingMessages = await chatStorage.getMessagesByConversation(conversationId);
      const rawHistory: any[] = existingMessages.map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      }));

      // Add the current request only to the provider context. It is persisted
      // after the provider finishes successfully.
      rawHistory.push({
        role: "user",
        content: storedContent,
      });
      const latestUserMessage = rawHistory[rawHistory.length - 1];
      const imageAttachments = attachments.filter((attachment: any) =>
        typeof attachment?.dataUrl === "string" &&
        attachment.dataUrl.startsWith("data:image/"),
      );
      const textAttachments = attachments.filter((attachment: any) =>
        typeof attachment?.textContent === "string",
      );
      if (latestUserMessage?.role === "user" && (imageAttachments.length || textAttachments.length)) {
        const textParts = [
          content || "Please analyze the attached files.",
          ...textAttachments.map((attachment: any) =>
            `\n\n--- ${attachment.name || "Attached text file"} ---\n${attachment.textContent}`,
          ),
        ];
        latestUserMessage.content = [
          { type: "text", text: textParts.join("") },
          ...imageAttachments.map((attachment: any) => ({
            type: "image_url",
            image_url: { url: attachment.dataUrl },
          })),
        ];
      }
      // LLaVA models generally have a smaller context window than hosted
      // frontier models. Image requests also need a shorter context so CPU
      // inference stays responsive.
      const chatMessages = trimHistory(
        rawHistory,
        imageAttachments.length ? 8000 : 24000,
      );

      const systemMessage = {
        role: "system" as const,
        content: `You are TekGPT, a highly capable AI coding assistant operating in FULL IMPLEMENTATION MODE at all times.

## FULL IMPLEMENTATION MODE — ALWAYS ACTIVE

For every coding request, generate complete, implementation-level, runnable code. Never truncate, abbreviate, summarize, or replace any part of the implementation with placeholders.

### FORBIDDEN — Never output these:
- "# ... rest of the code"
- "# same as before" / "# [previous code unchanged]"
- "# ... (remaining methods)" / "# continue similarly"
- "// ... existing code ..." / "..." / "pass  # implement later"
- "omitted for brevity" / "let me know if you want the rest"
- Any phrase that implies code was skipped or left out

### REQUIRED — Always include all of:
1. **All imports and setup** — every import, config, constant, logging, seed setup
2. **Complete class bodies** — every method, property, and helper, fully implemented
3. **Full function bodies** — no stubs, no skeletons, real logic only
4. **Execution flow** — main(), training loops, server startup, CLI handling, if __name__ == "__main__"
5. **Input/output flow** — data loading, processing, saving, inference
6. **Error handling, docstrings, and type hints** where appropriate

### FOR LONG FILES (500–1000+ lines):
- Write every single line — PyTorch models, Transformers fine-tuning scripts, ML pipelines, full-stack apps
- If the implementation is too long for one response, split into clearly labelled parts: **PART 1/N, PART 2/N** etc., and continue automatically without waiting for the user to ask
- Never stop at an intermediate point (e.g. imports only, model definition only, routes without server startup)

### FIX CODE RULE — CRITICAL:
When the user asks you to fix, debug, correct, update, improve, refactor, or modify ANY code they provide:
- Output the COMPLETE updated file — every single line from top to bottom, with the fix applied
- Do NOT output only the fixed section, snippet, or diff
- Do NOT say "here is the fixed function" and show only that function
- Do NOT say "change line X to Y" — output the full file
- If the user pastes 757 lines and asks you to fix one bug, your response must be all 757+ lines with that bug fixed
- The user must be able to copy your entire response and run it immediately without merging anything
- This applies regardless of file length — 100 lines, 500 lines, 1000+ lines — always the full file

### KEYWORDS THAT ACTIVATE STRICT FULL MODE:
"fix", "fix code", "fix this", "fix the bug", "fix the error", "debug", "correct", "update", "improve", "refactor", "modify", "add feature", "full code", "complete code", "end-to-end", "full notebook", "complete project", "all code", "write it fully", "generate it fully", "full implementation"
→ When you see ANY of these, output the entire file with every line included.

### SELF-CHECK before finishing any coding response:
- Did I include ALL requested components?
- Did I output real implementation, not a sketch?
- Did I omit any class / method / loop / route / training section?
- Did I use any forbidden placeholder phrases?
- If the code is long, did I continue in numbered parts rather than truncate?
If any answer is "no" — keep generating.

Use proper markdown code blocks with the correct language tag (e.g. \`\`\`python, \`\`\`typescript).
${imageAttachments.length
  ? "\n\n### IMAGE ANALYSIS MODE\nDescribe the attached image directly and concisely. Do not invent code or produce a long implementation unless the user explicitly asks for it."
  : ""}`,
      };

      // Set up SSE
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");

      let fullResponse = "";
      const ollamaHeaders: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (process.env.OLLAMA_API_KEY) {
        ollamaHeaders.Authorization = `Bearer ${process.env.OLLAMA_API_KEY}`;
      }

      // Use Ollama's native API. Its /v1 compatibility endpoint in older
      // releases rejects multimodal array content; /api/chat expects the
      // image as a base64 string in the message.images field.
      const ollamaResponse = await fetch(`${ollamaBaseUrl}/api/chat`, {
        method: "POST",
        headers: ollamaHeaders,
        body: JSON.stringify({
          model: process.env.OLLAMA_MODEL || "llava",
          messages: toOllamaMessages([systemMessage, ...chatMessages]),
          stream: true,
          options: {
            temperature: 0.1,
            num_predict: imageAttachments.length ? 1024 : 8192,
          },
        }),
      });

      if (!ollamaResponse.ok) {
        const providerError = await ollamaResponse.text();
        const error: any = new Error(providerError || `Ollama request failed with status ${ollamaResponse.status}`);
        error.status = ollamaResponse.status;
        if (ollamaResponse.status === 404) error.code = "model_not_found";
        throw error;
      }
      if (!ollamaResponse.body) {
        throw new Error("Ollama returned no response body");
      }

      const reader = ollamaResponse.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let streamDone = false;

      while (!streamDone) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.trim()) continue;
          const chunk = JSON.parse(line);
          if (chunk.error) throw new Error(chunk.error);
          const chunkContent = chunk.message?.content || "";
          if (chunkContent) {
            fullResponse += chunkContent;
            res.write(`data: ${JSON.stringify({ content: chunkContent })}\n\n`);
          }
          streamDone = Boolean(chunk.done);
        }
      }

      // Persist both messages only after a complete successful response.
      await chatStorage.createMessage(conversationId, "user", storedContent);
      await chatStorage.createMessage(conversationId, "assistant", fullResponse);
      if (existingMessages.length === 0) {
        const titleSource = content || attachmentNames.join(", ") || "Attached files";
        const title = titleSource.slice(0, 50) + (titleSource.length > 50 ? "…" : "");
        await chatStorage.updateConversationTitle(conversationId, title);
      }

      res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
      res.end();
    } catch (error: any) {
      console.error("Error sending message:", error);

      // Build a user-friendly error message
      let userError = "Failed to send message. Please try again.";
      if (error?.status === 413) {
        userError = "Your message is too large. Try splitting it into smaller sections and send each part separately.";
      } else if (error?.status === 404 || error?.code === "model_not_found") {
        userError = `Ollama cannot find the "${process.env.OLLAMA_MODEL || "llava"}" model. Run "ollama pull ${process.env.OLLAMA_MODEL || "llava"}" and try again.`;
      } else if (error?.status === 429 || error?.code === "rate_limit_exceeded") {
        userError = "Ollama is busy. Please wait a moment and try again.";
      } else if (error?.status === 401) {
        userError = "Ollama rejected the request. Check OLLAMA_API_KEY or remove it when using a local Ollama server.";
      } else if (error?.status === 402) {
        userError = "The configured Ollama provider requires an active account or sufficient credits.";
      } else if (
        error?.code === "ECONNREFUSED" ||
        error?.cause?.code === "ECONNREFUSED" ||
        /connect|fetch failed|network/i.test(error?.message || "")
      ) {
        userError = `Cannot connect to Ollama at ${process.env.OLLAMA_BASE_URL || "http://127.0.0.1:11434"}. Start Ollama and run "ollama pull ${process.env.OLLAMA_MODEL || "llava"}", or configure OLLAMA_BASE_URL to a reachable Ollama server.`;
      }

      if (res.headersSent) {
        res.write(`data: ${JSON.stringify({ error: userError })}\n\n`);
        res.end();
      } else {
        res.status(500).json({ error: userError });
      }
    }
  });
}

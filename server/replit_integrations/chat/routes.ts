import type { Express, Request, Response } from "express";
import OpenAI from "openai";
import { chatStorage } from "./storage";

// OpenRouter API — OpenAI-compatible, access to hundreds of models
const openai = new OpenAI({
  apiKey: process.env.OPENROUTER_API_KEY,
  baseURL: "https://openrouter.ai/api/v1",
  defaultHeaders: {
    "HTTP-Referer": "https://tekgpt.replit.app",
    "X-Title": "TekGPT",
  },
});

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

      // Save user message
      await chatStorage.createMessage(conversationId, "user", storedContent);

      // Auto-title on first message
      const allMsgs = await chatStorage.getMessagesByConversation(conversationId);
      if (allMsgs.length === 1) {
        const titleSource = content || attachmentNames.join(", ") || "Attached files";
        const title = titleSource.slice(0, 50) + (titleSource.length > 50 ? "…" : "");
        await chatStorage.updateConversationTitle(conversationId, title);
      }

      // Get conversation history and trim to fit token budget
      // GitHub Models gpt-4o-mini: 128K context window
      // Reserve 16384 for output + ~300 for system prompt = ~110,000 for conversation history
      const messages = await chatStorage.getMessagesByConversation(conversationId);
      const rawHistory: any[] = messages.map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      }));
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
      const chatMessages = trimHistory(rawHistory, 110000);

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

Use proper markdown code blocks with the correct language tag (e.g. \`\`\`python, \`\`\`typescript).`,
      };

      // Set up SSE
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");

      // Use a vision-capable model whenever an image is attached. Text-only
      // chats stay on DeepSeek for strong code generation.
      const stream = await openai.chat.completions.create({
        model: imageAttachments.length ? "google/gemini-2.0-flash-001" : "deepseek/deepseek-chat",
        messages: [systemMessage, ...chatMessages],
        stream: true,
        max_tokens: 32768,
        temperature: 0.1,
      });

      let fullResponse = "";

      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content || "";
        if (content) {
          fullResponse += content;
          res.write(`data: ${JSON.stringify({ content })}\n\n`);
        }
      }

      // Save assistant message
      await chatStorage.createMessage(conversationId, "assistant", fullResponse);

      res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
      res.end();
    } catch (error: any) {
      console.error("Error sending message:", error);

      // Build a user-friendly error message
      let userError = "Failed to send message. Please try again.";
      if (error?.status === 413) {
        userError = "Your message is too large. Try splitting it into smaller sections and send each part separately.";
      } else if (error?.status === 429 || error?.code === "rate_limit_exceeded") {
        userError = "Rate limit reached. Please wait a moment and try again.";
      } else if (error?.status === 401) {
        userError = "OpenRouter API key is invalid or expired. Please update the OPENROUTER_API_KEY secret.";
      } else if (error?.status === 402) {
        userError = "OpenRouter account has insufficient credits. Please top up at openrouter.ai.";
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

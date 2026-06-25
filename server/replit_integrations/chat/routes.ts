import type { Express, Request, Response } from "express";
import OpenAI from "openai";
import { chatStorage } from "./storage";

// DeepSeek via GitHub Models marketplace — OpenAI-compatible
const openai = new OpenAI({
  apiKey: process.env.GITHUB_TOKEN,
  baseURL: "https://models.inference.ai.azure.com",
});

// Rough token estimate: 1 token ≈ 4 chars
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

// Trim conversation history to stay within token budget
// Strategy: always keep the first message (for context) + as many recent messages as fit
function trimHistory(
  messages: { role: string; content: string }[],
  maxTokens: number
): { role: string; content: string }[] {
  if (messages.length === 0) return [];

  let total = 0;
  const kept: { role: string; content: string }[] = [];

  // Walk backwards (most recent first), keeping messages that fit
  for (let i = messages.length - 1; i >= 0; i--) {
    const t = estimateTokens(messages[i].content) + 4; // +4 for role overhead
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
      const { content } = req.body;

      // Save user message
      await chatStorage.createMessage(conversationId, "user", content);

      // Auto-title on first message
      const allMsgs = await chatStorage.getMessagesByConversation(conversationId);
      if (allMsgs.length === 1) {
        const title = content.trim().slice(0, 50) + (content.trim().length > 50 ? "…" : "");
        await chatStorage.updateConversationTitle(conversationId, title);
      }

      // Get conversation history and trim to fit token budget
      // GitHub Models gpt-4o-mini: 128K context window
      // Reserve 16384 for output + ~300 for system prompt = ~110,000 for conversation history
      const messages = await chatStorage.getMessagesByConversation(conversationId);
      const rawHistory = messages.map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      }));
      const chatMessages = trimHistory(rawHistory, 110000);

      const systemMessage = {
        role: "system" as const,
        content: `You are TekGPT, a highly capable AI coding assistant. When writing or fixing code:
- ALWAYS output the COMPLETE code in full — never truncate, abbreviate, or use placeholders like "# ... rest of code ..." or "// same as before"
- If asked to fix or rewrite code, reproduce every line of the original that stays the same, plus your changes
- For long files (500+ lines), still write every single line — do not skip any sections
- Use proper markdown code blocks with language tags
- You can handle files up to 1000+ lines without issue`,
      };

      // Set up SSE
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");

      // DeepSeek-V3 via GitHub Models: excellent for code, large context, fast
      const stream = await openai.chat.completions.create({
        model: "DeepSeek-V3-0324",
        messages: [systemMessage, ...chatMessages],
        stream: true,
        max_tokens: 16384,
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
        userError = "GitHub token is invalid or expired. Please update the GITHUB_TOKEN secret.";
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

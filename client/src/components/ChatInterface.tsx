import { useState, useRef, useEffect } from "react";
import { useSendMessage } from "@/hooks/use-chat";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send, StopCircle, Copy, Check, Code2, ArrowUp } from "lucide-react";
const aiIcon = "/ai-icon.png";
import { cn } from "@/lib/utils";
import ReactMarkdown from "react-markdown";
import { AnimatePresence, motion } from "framer-motion";
import { type Message } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";

interface ChatInterfaceProps {
  conversationId: number;
  initialMessages: Message[];
}

export function ChatInterface({ conversationId, initialMessages }: ChatInterfaceProps) {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [inputValue, setInputValue] = useState("");
  const { sendMessage, isStreaming, cancelStream } = useSendMessage();
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    setMessages(initialMessages);
  }, [initialMessages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isStreaming]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  }, [inputValue]);

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!inputValue.trim() || isStreaming) return;

    const userContent = inputValue.trim();
    setInputValue("");
    if (textareaRef.current) textareaRef.current.style.height = 'auto';

    const userMessage: Message = {
      id: Date.now(),
      conversationId,
      role: "user",
      content: userContent,
      createdAt: new Date(),
    };
    const assistantMessage: Message = {
      id: Date.now() + 1,
      conversationId,
      role: "assistant",
      content: "",
      createdAt: new Date(),
    };

    setMessages(prev => [...prev, userMessage, assistantMessage]);

    try {
      await sendMessage(conversationId, userContent, (chunk) => {
        setMessages(prev => {
          const next = [...prev];
          const last = next[next.length - 1];
          if (last.role === "assistant") last.content += chunk;
          return next;
        });
      });
    } catch {
      toast({ title: "Error", description: "Failed to send message. Please try again.", variant: "destructive" });
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="flex flex-col h-full bg-black">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto py-6 px-4 md:px-8 space-y-2">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center max-w-xl mx-auto px-4 animate-in fade-in zoom-in duration-500">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-6" style={{ background: "#1a1a1a" }}>
              <img src={aiIcon} alt="AI" className="h-16 w-16 object-cover" style={{ filter: "invert(1)" }} />
            </div>
            <h2 className="text-2xl font-semibold mb-2 text-white">How can I help you today?</h2>
            <p className="text-white/40 text-sm leading-relaxed mb-8">
              Ask me anything — code, ideas, analysis, writing.
            </p>
            <div className="grid grid-cols-2 gap-2 w-full max-w-md">
              {["Write a Python script", "Explain quantum computing", "Debug my code", "Draft an email"].map((p) => (
                <button
                  key={p}
                  data-testid={`prompt-${p.toLowerCase().replace(/\s+/g, '-')}`}
                  onClick={() => setInputValue(p)}
                  className="text-xs px-4 py-3 rounded-xl text-left text-white/60 hover:text-white/90 transition-all"
                  style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <AnimatePresence initial={false}>
            {messages.map((msg, index) => (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25, ease: "easeOut" }}
                className={cn(
                  "flex max-w-3xl mx-auto w-full",
                  msg.role === "user" ? "justify-end" : "justify-start gap-3"
                )}
              >
                {/* AI avatar — only for assistant */}
                {msg.role === "assistant" && (
                  <div className="w-7 h-7 rounded-lg shrink-0 mt-1 flex items-center justify-center" style={{ background: "#1a1a1a" }}>
                    <img src={aiIcon} alt="AI" className="h-7 w-7 object-cover" style={{ filter: "invert(1)" }} />
                  </div>
                )}

                {/* Bubble */}
                <div className={cn(
                  "text-sm leading-relaxed",
                  msg.role === "user"
                    ? "max-w-[75%] px-4 py-2.5 rounded-[20px] text-white/90"
                    : "flex-1 text-white/85 prose dark:prose-invert max-w-none pt-1"
                )}
                  style={msg.role === "user" ? { background: "#2f2f2f" } : {}}
                >
                  {msg.role === "user" ? (
                    <span className="whitespace-pre-wrap">{msg.content}</span>
                  ) : (
                    <ReactMarkdown
                      components={{
                        code({ className, children, ...props }: any) {
                          const match = /language-(\w+)/.exec(className || '');
                          if (match) {
                            return (
                              <CodeBlock
                                language={match[1]}
                                code={String(children).replace(/\n$/, '')}
                              />
                            );
                          }
                          return (
                            <code className="bg-white/10 px-1.5 py-0.5 rounded text-xs font-mono text-violet-300" {...props}>
                              {children}
                            </code>
                          );
                        },
                        pre({ children }: any) { return <>{children}</>; },
                      }}
                    >
                      {msg.content || (isStreaming && index === messages.length - 1 ? "▍" : "")}
                    </ReactMarkdown>
                  )}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        )}
        <div ref={bottomRef} className="h-2" />
      </div>

      {/* Input */}
      <div className="px-4 md:px-8 pb-6 pt-2">
        <div className="max-w-3xl mx-auto">
          <div
            className="flex flex-col rounded-2xl overflow-hidden"
            style={{ background: "#1a1a1a", border: "1px solid rgba(255,255,255,0.08)" }}
          >
            <Textarea
              ref={textareaRef}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Message AI..."
              data-testid="input-message"
              rows={1}
              className="min-h-[52px] max-h-[200px] border-none focus-visible:ring-0 shadow-none resize-none px-4 pt-3.5 pb-2 bg-transparent text-sm text-white/90 placeholder:text-white/25 leading-relaxed"
            />
            <div className="flex items-center justify-between px-3 pb-3">
              <span className="text-[10px] text-white/20 hidden md:block">
                Enter to send · Shift+Enter for newline
              </span>
              <Button
                onClick={isStreaming ? cancelStream : () => handleSubmit()}
                size="icon"
                data-testid="button-send"
                disabled={!inputValue.trim() && !isStreaming}
                className={cn(
                  "h-8 w-8 rounded-lg ml-auto transition-all",
                  isStreaming
                    ? "bg-white/20 hover:bg-white/30 text-white"
                    : inputValue.trim()
                      ? "bg-white text-black hover:bg-white/90"
                      : "bg-white/10 text-white/30 cursor-not-allowed"
                )}
              >
                {isStreaming
                  ? <StopCircle className="h-4 w-4" />
                  : <ArrowUp className="h-4 w-4" />
                }
              </Button>
            </div>
          </div>
          <p className="text-center text-[10px] text-white/20 mt-2">
            AI can make mistakes. Consider checking important information.
          </p>
        </div>
      </div>
    </div>
  );
}

const LANG_DISPLAY: Record<string, string> = {
  js: "JavaScript", javascript: "JavaScript", ts: "TypeScript", typescript: "TypeScript",
  py: "Python", python: "Python", rb: "Ruby", ruby: "Ruby", go: "Go", rust: "Rust",
  java: "Java", cpp: "C++", c: "C", cs: "C#", csharp: "C#", php: "PHP", swift: "Swift",
  kt: "Kotlin", kotlin: "Kotlin", html: "HTML", css: "CSS", scss: "SCSS",
  json: "JSON", yaml: "YAML", yml: "YAML", sh: "Shell", bash: "Bash", shell: "Shell",
  sql: "SQL", md: "Markdown", markdown: "Markdown", jsx: "JSX", tsx: "TSX",
};

function CodeBlock({ language, code }: { language: string; code: string }) {
  const [copied, setCopied] = useState(false);
  const displayName = LANG_DISPLAY[language.toLowerCase()] || language.toUpperCase() || "Code";

  const copy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div data-testid="code-block" className="rounded-xl overflow-hidden my-3" style={{ background: "#0d1117", border: "1px solid rgba(255,255,255,0.08)" }}>
      <div className="flex items-center justify-between px-4 py-2.5" style={{ background: "#161b22", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <div className="flex items-center gap-2">
          <Code2 className="h-3.5 w-3.5 text-violet-400" />
          <span className="text-xs font-medium text-white/70 font-mono">{displayName}</span>
        </div>
        <button
          data-testid="button-copy-code"
          onClick={copy}
          className="flex items-center gap-1.5 text-xs text-white/40 hover:text-white/80 transition-colors px-2 py-0.5 rounded"
        >
          {copied
            ? <><Check className="h-3 w-3 text-green-400" /><span className="text-green-400">Copied</span></>
            : <><Copy className="h-3 w-3" /><span>Copy</span></>
          }
        </button>
      </div>
      <SyntaxHighlighter
        language={language || "text"}
        style={oneDark}
        customStyle={{ margin: 0, padding: "1rem 1.25rem", background: "#0d1117", fontSize: "0.8125rem", lineHeight: "1.65", fontFamily: "'JetBrains Mono', monospace" }}
        showLineNumbers={code.split('\n').length > 4}
        lineNumberStyle={{ color: "#3d3d3d", userSelect: "none", minWidth: "2em" }}
      >
        {code}
      </SyntaxHighlighter>
    </div>
  );
}

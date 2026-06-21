import { useState, useRef, useEffect } from "react";
import { useSendMessage } from "@/hooks/use-chat";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send, StopCircle, User, Copy, Check, Code2 } from "lucide-react";
import aiIcon from "@assets/image_1782035573865.png";
import { cn } from "@/lib/utils";
import ReactMarkdown from "react-markdown";
import { AnimatePresence, motion } from "framer-motion";
import { type Message } from "@shared/schema";
import { format } from "date-fns";
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
          const newMessages = [...prev];
          const lastMsg = newMessages[newMessages.length - 1];
          if (lastMsg.role === "assistant") {
            lastMsg.content += chunk;
          }
          return newMessages;
        });
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to send message. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="flex flex-col h-full bg-background relative">
      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-10 space-y-6 md:space-y-8">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center max-w-lg mx-auto p-8 animate-in fade-in zoom-in duration-500">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-tr from-primary/20 to-accent/20 flex items-center justify-center mb-6 shadow-xl shadow-primary/10 border border-white/5">
              <img src={aiIcon} alt="AI" className="h-10 w-10 invert" />
            </div>
            <h2 className="text-3xl font-display font-bold mb-3 tracking-tight text-foreground">How can I help you today?</h2>
            <p className="text-muted-foreground text-lg leading-relaxed">
              I can help you write code, draft emails, analyze data, or just brainstorm ideas.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-10 w-full">
              {["Explain quantum computing", "Write a python script", "Design a logo concept", "Debug my React code"].map((prompt) => (
                <button
                  key={prompt}
                  data-testid={`prompt-${prompt.toLowerCase().replace(/\s+/g, '-')}`}
                  onClick={() => setInputValue(prompt)}
                  className="text-sm p-4 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 hover:border-primary/30 transition-all text-left hover:shadow-md text-foreground/80 hover:text-foreground"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <AnimatePresence initial={false}>
            {messages.map((msg, index) => (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, ease: "easeOut" }}
                className={cn(
                  "flex gap-4 md:gap-6 max-w-4xl mx-auto w-full group",
                  msg.role === "user" ? "flex-row-reverse" : "flex-row"
                )}
              >
                {/* Avatar */}
                <div className={cn(
                  "w-8 h-8 md:w-10 md:h-10 rounded-xl flex items-center justify-center shrink-0 shadow-sm border",
                  msg.role === "user"
                    ? "bg-gradient-to-br from-primary to-accent border-transparent text-primary-foreground"
                    : "bg-white/5 border-white/10 text-foreground"
                )}>
                  {msg.role === "user"
                    ? <User className="h-5 w-5" />
                    : <img src={aiIcon} alt="AI" className="h-5 w-5 invert" />
                  }
                </div>

                {/* Content Bubble */}
                <div className={cn(
                  "flex flex-col gap-1 min-w-0 max-w-[85%] md:max-w-[80%]",
                  msg.role === "user" ? "items-end" : "items-start"
                )}>
                  <div className={cn(
                    "rounded-2xl shadow-sm text-sm md:text-base leading-relaxed break-words",
                    msg.role === "user"
                      ? "px-5 py-3.5 bg-primary text-primary-foreground rounded-tr-sm"
                      : "w-full bg-white/5 border border-white/10 text-foreground rounded-tl-sm prose dark:prose-invert max-w-none px-5 py-4"
                  )}>
                    {msg.role === "user" ? (
                      msg.content
                    ) : (
                      <ReactMarkdown
                        components={{
                          code({ node, className, children, ...props }: any) {
                            const match = /language-(\w+)/.exec(className || '');
                            const language = match ? match[1] : '';
                            const isBlock = !!match;

                            if (isBlock) {
                              return (
                                <CodeBlock
                                  language={language}
                                  code={String(children).replace(/\n$/, '')}
                                />
                              );
                            }
                            return (
                              <code className="bg-white/10 px-1.5 py-0.5 rounded text-sm font-mono text-violet-300" {...props}>
                                {children}
                              </code>
                            );
                          },
                          pre({ children }: any) {
                            return <>{children}</>;
                          },
                        }}
                      >
                        {msg.content || (isStreaming && index === messages.length - 1 ? "Thinking..." : "")}
                      </ReactMarkdown>
                    )}
                  </div>

                  {/* Timestamp */}
                  <span className="text-[11px] text-muted-foreground/50 px-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {msg.createdAt ? format(new Date(msg.createdAt), 'h:mm a') : 'Just now'}
                  </span>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        )}
        <div ref={bottomRef} className="h-4" />
      </div>

      {/* Input Area */}
      <div className="p-4 md:p-6 bg-gradient-to-t from-background via-background to-transparent pt-10">
        <div className="max-w-4xl mx-auto relative group">
          <div className="absolute -inset-0.5 bg-gradient-to-r from-primary/20 to-accent/20 rounded-2xl blur opacity-20 group-hover:opacity-40 transition duration-500"></div>
          <div className="relative bg-white/5 rounded-2xl shadow-xl border border-white/10 flex flex-col gap-2 p-2">
            <Textarea
              ref={textareaRef}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Send a message..."
              data-testid="input-message"
              className="min-h-[50px] max-h-[200px] border-none focus-visible:ring-0 shadow-none resize-none px-4 py-3 bg-transparent text-base text-foreground placeholder:text-muted-foreground/50"
            />

            <div className="flex justify-between items-center px-2 pb-1">
              <span className="text-[10px] text-muted-foreground/40 bg-white/5 px-2 py-1 rounded font-medium hidden md:inline-block border border-white/5">
                Enter to send · Shift+Enter for newline
              </span>

              <Button
                onClick={isStreaming ? cancelStream : () => handleSubmit()}
                size="icon"
                data-testid="button-send"
                disabled={!inputValue.trim() && !isStreaming}
                className={cn(
                  "h-10 w-10 rounded-xl transition-all duration-300 ml-auto",
                  isStreaming
                    ? "bg-red-500/80 text-white hover:bg-red-500"
                    : "bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg shadow-primary/25"
                )}
              >
                {isStreaming ? (
                  <StopCircle className="h-5 w-5 animate-pulse" />
                ) : (
                  <Send className="h-5 w-5 ml-0.5" />
                )}
              </Button>
            </div>
          </div>
          <p className="text-center text-[10px] text-muted-foreground/40 mt-3">
            AI can make mistakes. Consider checking important information.
          </p>
        </div>
      </div>
    </div>
  );
}

// Language display name map
const LANG_DISPLAY: Record<string, string> = {
  js: "JavaScript", javascript: "JavaScript",
  ts: "TypeScript", typescript: "TypeScript",
  py: "Python", python: "Python",
  rb: "Ruby", ruby: "Ruby",
  go: "Go", rust: "Rust",
  java: "Java", cpp: "C++", c: "C",
  cs: "C#", csharp: "C#",
  php: "PHP", swift: "Swift",
  kt: "Kotlin", kotlin: "Kotlin",
  html: "HTML", css: "CSS", scss: "SCSS",
  json: "JSON", yaml: "YAML", yml: "YAML",
  sh: "Shell", bash: "Bash", shell: "Shell",
  sql: "SQL", md: "Markdown", markdown: "Markdown",
  jsx: "JSX", tsx: "TSX",
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
    <div
      data-testid="code-block"
      className="rounded-xl overflow-hidden border border-white/10 my-3"
      style={{ background: "#0d1117" }}
    >
      {/* Header bar */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/10" style={{ background: "#161b22" }}>
        <div className="flex items-center gap-2">
          <Code2 className="h-4 w-4 text-violet-400" />
          <span className="text-sm font-semibold text-slate-200 font-mono">{displayName}</span>
        </div>
        <button
          data-testid="button-copy-code"
          onClick={copy}
          className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 transition-colors bg-white/5 hover:bg-white/10 px-2.5 py-1 rounded-md border border-white/10"
        >
          {copied ? (
            <>
              <Check className="h-3.5 w-3.5 text-green-400" />
              <span className="text-green-400">Copied!</span>
            </>
          ) : (
            <>
              <Copy className="h-3.5 w-3.5" />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>

      {/* Code content */}
      <SyntaxHighlighter
        language={language || "text"}
        style={oneDark}
        customStyle={{
          margin: 0,
          padding: "1.25rem 1.5rem",
          background: "#0d1117",
          fontSize: "0.875rem",
          lineHeight: "1.6",
          fontFamily: "'JetBrains Mono', 'Fira Code', 'Geist Mono', monospace",
        }}
        showLineNumbers={code.split('\n').length > 5}
        lineNumberStyle={{
          color: "#444c56",
          userSelect: "none",
          minWidth: "2.5em",
        }}
        wrapLongLines={false}
      >
        {code}
      </SyntaxHighlighter>
    </div>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const copy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Button
      size="icon"
      variant="secondary"
      className="h-6 w-6 bg-white/10 hover:bg-white/20 border-0"
      onClick={copy}
    >
      {copied ? <Check className="h-3 w-3 text-green-400" /> : <Copy className="h-3 w-3" />}
    </Button>
  );
}

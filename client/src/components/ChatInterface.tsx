import { useState, useRef, useEffect } from "react";
import { useSendMessage, type ChatAttachment } from "@/hooks/use-chat";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { StopCircle, Copy, Check, Code2, ArrowUp, Plus, X, FileText, Image as ImageIcon, FileCode2 } from "lucide-react";
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
  const [attachments, setAttachments] = useState<ChatAttachment[]>([]);
  const [messageAttachments, setMessageAttachments] = useState<Record<number, ChatAttachment[]>>({});
  const { sendMessage, isStreaming, cancelStream } = useSendMessage();
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
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

  const addFiles = async (fileList: FileList | File[]) => {
    const files = Array.from(fileList);
    if (!files.length) return;

    const existingSize = attachments.reduce((total, file) => total + file.size, 0);
    const accepted: ChatAttachment[] = [];
    const MAX_FILE_SIZE = 8 * 1024 * 1024;
    const MAX_TOTAL_SIZE = 15 * 1024 * 1024;
    const textFilePattern = /^(text\/|application\/(json|javascript|xml|yaml|x-yaml|sql)|application\/x-python|application\/x-sh|application\/typescript)/i;
    const codeExtensionPattern = /\.(txt|md|csv|json|js|jsx|ts|tsx|py|java|c|cc|cpp|h|hpp|css|scss|html|sql|yaml|yml|xml|sh|bash|log|env)$/i;

    for (const file of files) {
      if (attachments.some((attachment) => attachment.name === file.name && attachment.size === file.size)) {
        continue;
      }
      if (file.size > MAX_FILE_SIZE) {
        toast({
          title: "File is too large",
          description: `${file.name} is larger than 8 MB. Choose a smaller file.`,
          variant: "destructive",
        });
        continue;
      }
      if (existingSize + accepted.reduce((total, item) => total + item.size, 0) + file.size > MAX_TOTAL_SIZE) {
        toast({
          title: "Attachment limit reached",
          description: "Keep the total attachments under 15 MB.",
          variant: "destructive",
        });
        break;
      }

      const attachment: ChatAttachment = {
        id: `${file.name}-${file.lastModified}-${Math.random().toString(36).slice(2)}`,
        name: file.name,
        type: file.type || "application/octet-stream",
        size: file.size,
      };

      if (file.type.startsWith("image/")) {
        attachment.dataUrl = await readFileAsDataUrl(file);
      } else if (textFilePattern.test(file.type) || codeExtensionPattern.test(file.name)) {
        attachment.textContent = await file.text();
      }

      accepted.push(attachment);
    }

    if (accepted.length) {
      setAttachments((current) => [...current, ...accepted]);
      textareaRef.current?.focus();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) void addFiles(e.target.files);
    e.target.value = "";
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.dataTransfer.files.length) void addFiles(e.dataTransfer.files);
  };

  const removeAttachment = (id: string) => {
    setAttachments((current) => current.filter((attachment) => attachment.id !== id));
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if ((!inputValue.trim() && attachments.length === 0) || isStreaming) return;

    const submittedAttachments = attachments;
    const userContent = inputValue.trim() || "Please analyze the attached files.";
    setInputValue("");
    setAttachments([]);
    if (textareaRef.current) textareaRef.current.style.height = 'auto';

    const userMessageId = Date.now();
    const userMessage: Message = {
      id: userMessageId,
      conversationId,
      role: "user",
      content: userContent,
      createdAt: new Date(),
    };
    const assistantMessage: Message = {
      id: userMessageId + 1,
      conversationId,
      role: "assistant",
      content: "",
      createdAt: new Date(),
    };

    setMessages(prev => [...prev, userMessage, assistantMessage]);
    if (submittedAttachments.length) {
      setMessageAttachments((current) => ({ ...current, [userMessageId]: submittedAttachments }));
    }

    try {
      await sendMessage(conversationId, userContent, (chunk) => {
        setMessages(prev => {
          const next = [...prev];
          const last = next[next.length - 1];
          if (last.role === "assistant") last.content += chunk;
          return next;
        });
      }, submittedAttachments);
    } catch (err: any) {
      // Remove the empty assistant placeholder on error
      setMessages(prev => prev.slice(0, -1));
      setAttachments((current) => [...submittedAttachments, ...current]);
      toast({ title: "Error", description: err?.message || "Failed to send message. Please try again.", variant: "destructive" });
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
                     <div className="space-y-2">
                       {messageAttachments[msg.id]?.length ? (
                         <div className="flex flex-wrap gap-2">
                           {messageAttachments[msg.id].map((attachment) => (
                             <AttachmentPreview key={attachment.id} attachment={attachment} compact />
                           ))}
                         </div>
                       ) : null}
                       <span className="whitespace-pre-wrap">{msg.content}</span>
                     </div>
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
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
            className="flex flex-col rounded-2xl overflow-hidden"
            style={{ background: "#1a1a1a", border: "1px solid rgba(255,255,255,0.08)" }}
          >
            {attachments.length > 0 && (
              <div className="flex gap-2 overflow-x-auto px-3 pt-3 pb-1">
                {attachments.map((attachment) => (
                  <AttachmentPreview
                    key={attachment.id}
                    attachment={attachment}
                    onRemove={() => removeAttachment(attachment.id)}
                  />
                ))}
              </div>
            )}
            <Textarea
              ref={textareaRef}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={attachments.length ? "Add a message about your files..." : "Ask anything"}
              data-testid="input-message"
              rows={1}
              className="min-h-[52px] max-h-[200px] border-none focus-visible:ring-0 shadow-none resize-none px-4 pt-3.5 pb-2 bg-transparent text-sm text-white/90 placeholder:text-white/25 leading-relaxed"
            />
            <div className="flex items-center justify-between px-3 pb-3">
              <div className="flex items-center gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept="image/*,.txt,.md,.csv,.json,.js,.jsx,.ts,.tsx,.py,.java,.c,.cc,.cpp,.h,.hpp,.css,.scss,.html,.sql,.yaml,.yml,.xml,.sh,.bash,.log"
                  onChange={handleFileChange}
                  className="sr-only"
                  data-testid="input-file"
                />
                <div className="relative group">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isStreaming}
                    aria-label="Add files and more"
                    data-testid="button-attach"
                    className="h-9 w-9 rounded-full text-white/70 hover:bg-white/10 hover:text-white"
                  >
                    <Plus className="h-5 w-5" strokeWidth={1.8} />
                  </Button>
                  <div className="pointer-events-none absolute left-0 bottom-full mb-2 hidden whitespace-nowrap rounded-full bg-[#2f2f2f] px-3 py-1.5 text-xs font-medium text-white shadow-lg group-hover:block">
                    Add files and more <span className="ml-1 rounded-full bg-white/20 px-1.5 py-0.5 text-white/70">@</span>
                  </div>
                </div>
                <span className="text-[10px] text-white/20 hidden md:block">
                  Enter to send · Shift+Enter for newline
                </span>
              </div>
              <Button
                onClick={isStreaming ? cancelStream : () => handleSubmit()}
                size="icon"
                data-testid="button-send"
                disabled={(!inputValue.trim() && attachments.length === 0) && !isStreaming}
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

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error("Unable to read file"));
    reader.readAsDataURL(file);
  });
}

function formatFileSize(size: number): string {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function AttachmentPreview({
  attachment,
  onRemove,
  compact = false,
}: {
  attachment: ChatAttachment;
  onRemove?: () => void;
  compact?: boolean;
}) {
  const isImage = attachment.type.startsWith("image/") && attachment.dataUrl;
  const Icon = isImage ? ImageIcon : attachment.textContent !== undefined ? FileCode2 : FileText;

  return (
    <div
      className={cn(
        "relative flex shrink-0 items-center gap-2 rounded-xl border border-white/10 bg-white/[0.06] text-white/75",
        compact ? "max-w-[180px] px-2 py-1.5" : "w-[180px] px-2 py-2",
      )}
      title={attachment.name}
    >
      {isImage ? (
        <img src={attachment.dataUrl} alt={attachment.name} className={cn("shrink-0 rounded-lg object-cover", compact ? "h-8 w-8" : "h-10 w-10")} />
      ) : (
        <span className={cn("flex shrink-0 items-center justify-center rounded-lg bg-white/10 text-violet-300", compact ? "h-8 w-8" : "h-10 w-10")}>
          <Icon className="h-4 w-4" />
        </span>
      )}
      <span className="min-w-0 leading-tight">
        <span className="block truncate text-[11px] font-medium text-white/80">{attachment.name}</span>
        <span className="block text-[10px] text-white/35">{formatFileSize(attachment.size)}</span>
      </span>
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove ${attachment.name}`}
          className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full border border-[#1a1a1a] bg-white/80 text-black transition-colors hover:bg-white"
        >
          <X className="h-3 w-3" />
        </button>
      )}
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

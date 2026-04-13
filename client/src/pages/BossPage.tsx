import { useState, useRef, useEffect, useCallback } from "react";
import { Bot, Send, Plus, MessageSquare, Copy, Check, ChevronLeft, ChevronRight } from "lucide-react";
import ModelSelector from "@/components/ModelSelector";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  createdAt: string;
}

// ─── Markdown renderer (minimal, no deps) ─────────────────────────────────────

function CodeBlock({ code, lang }: { code: string; lang?: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  return (
    <div className="relative group my-3 rounded-lg overflow-hidden border border-border">
      <div className="flex items-center justify-between px-3 py-1.5 bg-muted/60 border-b border-border">
        <span className="text-[11px] text-muted-foreground font-mono">{lang || "code"}</span>
        <button
          onClick={copy}
          className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
        >
          {copied ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className="bg-muted/40 p-3 overflow-x-auto text-sm font-mono text-foreground leading-relaxed">
        <code>{code}</code>
      </pre>
    </div>
  );
}

function renderMarkdown(text: string): JSX.Element {
  const parts: JSX.Element[] = [];
  let key = 0;

  // Split on fenced code blocks first
  const segments = text.split(/(```[\s\S]*?```)/g);

  for (const seg of segments) {
    if (seg.startsWith("```")) {
      const lines = seg.slice(3, -3).split("\n");
      const lang = lines[0].trim();
      const code = lines.slice(lang ? 1 : 0).join("\n").trimEnd();
      parts.push(<CodeBlock key={key++} code={code} lang={lang || undefined} />);
    } else {
      // Process inline markdown line by line
      const lines = seg.split("\n");
      let i = 0;
      while (i < lines.length) {
        const line = lines[i];

        // Bullet list
        if (/^[-*•]\s+/.test(line)) {
          const items: string[] = [];
          while (i < lines.length && /^[-*•]\s+/.test(lines[i])) {
            items.push(lines[i].replace(/^[-*•]\s+/, ""));
            i++;
          }
          parts.push(
            <ul key={key++} className="list-disc list-inside space-y-1 my-2 text-foreground">
              {items.map((item, idx) => (
                <li key={idx} className="text-sm leading-relaxed">
                  {inlineMarkdown(item)}
                </li>
              ))}
            </ul>
          );
          continue;
        }

        // Numbered list
        if (/^\d+\.\s+/.test(line)) {
          const items: string[] = [];
          while (i < lines.length && /^\d+\.\s+/.test(lines[i])) {
            items.push(lines[i].replace(/^\d+\.\s+/, ""));
            i++;
          }
          parts.push(
            <ol key={key++} className="list-decimal list-inside space-y-1 my-2 text-foreground">
              {items.map((item, idx) => (
                <li key={idx} className="text-sm leading-relaxed">
                  {inlineMarkdown(item)}
                </li>
              ))}
            </ol>
          );
          continue;
        }

        // Headings
        if (/^#{1,3}\s/.test(line)) {
          const level = line.match(/^(#{1,3})/)?.[1].length || 1;
          const content = line.replace(/^#{1,3}\s+/, "");
          const Tag = level === 1 ? "h2" : level === 2 ? "h3" : "h4";
          const cls = level === 1
            ? "text-base font-semibold text-foreground mt-4 mb-1"
            : level === 2
            ? "text-sm font-semibold text-foreground mt-3 mb-1"
            : "text-sm font-medium text-foreground mt-2 mb-1";
          parts.push(<Tag key={key++} className={cls}>{inlineMarkdown(content)}</Tag>);
          i++;
          continue;
        }

        // Horizontal rule
        if (/^---+$/.test(line.trim())) {
          parts.push(<hr key={key++} className="border-border my-3" />);
          i++;
          continue;
        }

        // Empty line → spacer
        if (line.trim() === "") {
          parts.push(<div key={key++} className="h-2" />);
          i++;
          continue;
        }

        // Regular paragraph
        parts.push(
          <p key={key++} className="text-sm leading-relaxed text-foreground">
            {inlineMarkdown(line)}
          </p>
        );
        i++;
      }
    }
  }

  return <>{parts}</>;
}

function inlineMarkdown(text: string): (string | JSX.Element)[] {
  // Handle **bold**, *italic*, `code`
  const result: (string | JSX.Element)[] = [];
  const pattern = /(\*\*([^*]+)\*\*|\*([^*]+)\*|`([^`]+)`)/g;
  let last = 0;
  let match;
  let key = 0;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > last) {
      result.push(text.slice(last, match.index));
    }
    if (match[2]) {
      result.push(<strong key={key++} className="font-semibold">{match[2]}</strong>);
    } else if (match[3]) {
      result.push(<em key={key++} className="italic">{match[3]}</em>);
    } else if (match[4]) {
      result.push(
        <code key={key++} className="bg-muted rounded px-1 py-0.5 font-mono text-xs text-foreground">
          {match[4]}
        </code>
      );
    }
    last = match.index + match[0].length;
  }
  if (last < text.length) {
    result.push(text.slice(last));
  }
  return result.length ? result : [text];
}

// ─── Typing indicator ─────────────────────────────────────────────────────────

function TypingDots() {
  return (
    <div className="flex items-center gap-1 px-1 py-0.5">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="w-1.5 h-1.5 rounded-full bg-primary/60 animate-bounce"
          style={{ animationDelay: `${i * 120}ms`, animationDuration: "800ms" }}
        />
      ))}
    </div>
  );
}

// ─── Message bubble ───────────────────────────────────────────────────────────

function MessageBubble({ msg }: { msg: Message }) {
  const isUser = msg.role === "user";
  const [showTime, setShowTime] = useState(false);
  const timeStr = msg.timestamp instanceof Date
    ? msg.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : new Date(msg.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  return (
    <div
      className={`flex gap-3 group ${isUser ? "flex-row-reverse" : "flex-row"}`}
      onMouseEnter={() => setShowTime(true)}
      onMouseLeave={() => setShowTime(false)}
    >
      {/* Avatar */}
      {!isUser && (
        <div className="w-7 h-7 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center flex-shrink-0 mt-0.5">
          <Bot className="w-3.5 h-3.5 text-primary" />
        </div>
      )}

      {/* Bubble */}
      <div
        className={`max-w-[75%] rounded-2xl px-4 py-3 ${
          isUser
            ? "bg-primary/20 border border-primary/30 text-foreground ml-auto"
            : "bg-card border border-border text-foreground w-full max-w-none flex-1"
        }`}
      >
        {isUser ? (
          <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
        ) : (
          <div className="prose-sm">{renderMarkdown(msg.content)}</div>
        )}
      </div>

      {/* Timestamp */}
      <div
        className={`self-end mb-1 text-[10px] text-muted-foreground transition-opacity duration-150 ${
          showTime ? "opacity-100" : "opacity-0"
        }`}
      >
        {timeStr}
      </div>
    </div>
  );
}

// ─── Suggestion chips ─────────────────────────────────────────────────────────

const SUGGESTIONS = [
  "Build me a workflow",
  "Create an AI agent",
  "Analyze my usage",
  "Browse the marketplace",
];

// ─── localStorage helpers ─────────────────────────────────────────────────────

const STORAGE_KEY = "boss_conversations";

function loadConversations(): Conversation[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveConversations(convs: Conversation[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(convs.slice(0, 50)));
  } catch {}
}

function genId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function BossPage() {
  const [conversations, setConversations] = useState<Conversation[]>(() => loadConversations());
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const [selectedModel, setSelectedModel] = useState<{ provider: string; model: string } | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Detect mobile
  useEffect(() => {
    const check = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (mobile) setSidebarOpen(false);
    };
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  // Sync messages to conversations
  useEffect(() => {
    if (!activeId || messages.length === 0) return;
    setConversations((prev) => {
      const updated = prev.map((c) =>
        c.id === activeId ? { ...c, messages } : c
      );
      // If not found, this is a new conversation — add it
      if (!updated.find((c) => c.id === activeId)) {
        const title = messages[0]?.content?.slice(0, 50) || "New conversation";
        const newConv: Conversation = {
          id: activeId,
          title,
          messages,
          createdAt: new Date().toISOString(),
        };
        const withNew = [newConv, ...prev];
        saveConversations(withNew);
        return withNew;
      }
      saveConversations(updated);
      return updated;
    });
  }, [messages, activeId]);

  // Auto-grow textarea
  const adjustTextarea = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    const lineH = 24;
    const maxH = lineH * 6 + 16;
    el.style.height = Math.min(el.scrollHeight, maxH) + "px";
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    adjustTextarea();
  };

  const startNewChat = () => {
    setActiveId(null);
    setMessages([]);
    setInput("");
    setError(null);
    if (isMobile) setSidebarOpen(false);
    setTimeout(() => textareaRef.current?.focus(), 50);
  };

  const loadConversation = (conv: Conversation) => {
    setActiveId(conv.id);
    setMessages(
      conv.messages.map((m) => ({ ...m, timestamp: new Date(m.timestamp) }))
    );
    setError(null);
    if (isMobile) setSidebarOpen(false);
    setTimeout(() => textareaRef.current?.focus(), 50);
  };

  const sendMessage = async (text: string) => {
    if (!text.trim() || isLoading) return;

    const trimmed = text.trim();
    setInput("");
    setError(null);

    // If no active conversation, create one
    let convId = activeId;
    if (!convId) {
      convId = genId();
      setActiveId(convId);
      const title = trimmed.slice(0, 50);
      const newConv: Conversation = {
        id: convId,
        title,
        messages: [],
        createdAt: new Date().toISOString(),
      };
      setConversations((prev) => {
        const updated = [newConv, ...prev];
        saveConversations(updated);
        return updated;
      });
    }

    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }

    const userMsg: Message = {
      id: genId(),
      role: "user",
      content: trimmed,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setIsLoading(true);

    try {
      // Build history from existing messages
      const history = messages.map((m) => ({ role: m.role, content: m.content }));

      const res = await fetch("/api/jarvis/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: trimmed, history }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Server error ${res.status}`);
      }

      const data = await res.json();
      const reply = data.reply || data.message || "I couldn't process that.";

      const assistantMsg: Message = {
        id: genId(),
        role: "assistant",
        content: reply,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err: any) {
      const errMsg: Message = {
        id: genId(),
        role: "assistant",
        content: `Something went wrong: ${err.message || "Unknown error"}. Try again.`,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errMsg]);
      setError(err.message);
    } finally {
      setIsLoading(false);
      setTimeout(() => textareaRef.current?.focus(), 50);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  const isEmpty = messages.length === 0;
  const charCount = input.length;

  return (
    <div className="flex h-full overflow-hidden bg-background">
      {/* ── Sidebar ────────────────────────────────────────────────────────── */}
      <div
        className={`flex-shrink-0 border-r border-border bg-sidebar flex flex-col transition-all duration-200 ${
          sidebarOpen ? "w-56" : "w-0"
        } overflow-hidden`}
      >
        {/* New Chat button */}
        <div className="p-3 border-b border-border">
          <button
            onClick={startNewChat}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary text-sm font-medium transition-colors"
          >
            <Plus className="w-4 h-4 flex-shrink-0" />
            New Chat
          </button>
        </div>

        {/* Conversation list */}
        <nav className="flex-1 overflow-y-auto overscroll-contain px-2 py-2 space-y-0.5">
          {conversations.length === 0 ? (
            <p className="text-[11px] text-muted-foreground px-3 py-2">No conversations yet.</p>
          ) : (
            conversations.map((conv) => (
              <button
                key={conv.id}
                onClick={() => loadConversation(conv)}
                className={`w-full flex items-start gap-2 px-3 py-2 rounded-md text-left text-sm transition-colors ${
                  activeId === conv.id
                    ? "bg-primary/15 text-primary"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                }`}
              >
                <MessageSquare className="w-3.5 h-3.5 flex-shrink-0 mt-0.5 opacity-60" />
                <span className="truncate text-xs leading-relaxed">{conv.title}</span>
              </button>
            ))
          )}
        </nav>
      </div>

      {/* Sidebar toggle button — flush against the sidebar edge */}
      <div className="flex-shrink-0 flex items-center">
        <button
          onClick={() => setSidebarOpen((v) => !v)}
          className="w-4 h-10 flex items-center justify-center bg-border hover:bg-primary/20 text-muted-foreground hover:text-primary rounded-r transition-colors self-center"
          aria-label={sidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
        >
          {sidebarOpen ? (
            <ChevronLeft className="w-3 h-3" />
          ) : (
            <ChevronRight className="w-3 h-3" />
          )}
        </button>
      </div>

      {/* ── Main chat area ─────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {isEmpty ? (
          /* ── Empty state ── */
          <div className="flex-1 flex flex-col items-center justify-center gap-6 px-6 overflow-y-auto">
            {/* Avatar */}
            <div className="relative">
              <div className="w-16 h-16 rounded-2xl bg-primary/15 border border-primary/30 flex items-center justify-center shadow-lg shadow-primary/10">
                <Bot className="w-8 h-8 text-primary" />
              </div>
              <span className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-green-500 border-2 border-background" />
            </div>

            {/* Greeting */}
            <div className="text-center space-y-2">
              <h1 className="text-2xl font-bold text-foreground tracking-tight">
                Hey, I'm The Boss.
              </h1>
              <p className="text-muted-foreground text-sm">
                What are we building today?
              </p>
            </div>

            {/* Suggestion chips */}
            <div className="flex flex-wrap gap-2 justify-center max-w-lg">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => sendMessage(s)}
                  className="px-4 py-2 rounded-xl bg-card border border-border text-sm text-foreground hover:border-primary/50 hover:bg-primary/5 transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          /* ── Messages ── */
          <div className="flex-1 overflow-y-auto overscroll-contain px-4 md:px-8 py-6 space-y-5">
            <div className="max-w-3xl mx-auto space-y-5">
              {messages.map((msg) => (
                <MessageBubble key={msg.id} msg={msg} />
              ))}

              {/* Typing indicator */}
              {isLoading && (
                <div className="flex gap-3">
                  <div className="w-7 h-7 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Bot className="w-3.5 h-3.5 text-primary" />
                  </div>
                  <div className="bg-card border border-border rounded-2xl px-4 py-3">
                    <TypingDots />
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          </div>
        )}

        {/* ── Input area ── */}
        <div className="border-t border-border bg-background px-4 md:px-8 py-4">
          <div className="max-w-3xl mx-auto">
            <div className="flex items-end gap-3 bg-card border border-border rounded-xl px-4 py-3 shadow-sm focus-within:border-primary/50 transition-colors">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                placeholder="Message The Boss..."
                rows={1}
                className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground resize-none outline-none leading-6 min-h-[24px] max-h-[144px]"
                disabled={isLoading}
              />

              {/* Send button */}
              <button
                onClick={() => sendMessage(input)}
                disabled={!input.trim() || isLoading}
                className="flex-shrink-0 w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-primary-foreground disabled:opacity-30 disabled:cursor-not-allowed hover:bg-primary/90 transition-colors"
                aria-label="Send message"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>

            {/* Footer row */}
            <div className="flex items-center justify-between mt-1.5 px-1">
              <p className="text-[10px] text-muted-foreground">
                Enter to send · Shift+Enter for newline
              </p>
              <div className="flex items-center gap-2">
                <ModelSelector value={selectedModel} onChange={setSelectedModel} compact />
                {charCount > 0 && (
                  <p className={`text-[10px] ${charCount > 2000 ? "text-destructive" : "text-muted-foreground"}`}>
                    {charCount.toLocaleString()}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

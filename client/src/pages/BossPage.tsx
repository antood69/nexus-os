import { useState, useRef, useEffect, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bot, Send, Plus, MessageSquare, Copy, Check, ChevronLeft, ChevronRight, Download, FileText, Loader2, ArrowUpRight, Trash2 } from "lucide-react";
import { Link } from "wouter";
import ModelSelector from "@/components/ModelSelector";
import { apiRequest } from "@/lib/queryClient";

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
  createdAt: string;
}

// ─── Export helpers ───────────────────────────────────────────────────────────

function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function getFileExtension(lang: string): string {
  const map: Record<string, string> = {
    python: "py", py: "py", javascript: "js", js: "js", typescript: "ts", ts: "ts",
    tsx: "tsx", jsx: "jsx", html: "html", css: "css", json: "json", sql: "sql",
    bash: "sh", sh: "sh", rust: "rs", go: "go", java: "java", cpp: "cpp", c: "c",
  };
  return map[lang.toLowerCase()] || "txt";
}

// ─── Markdown renderer with export buttons ───────────────────────────────────

function CodeBlock({ code, lang }: { code: string; lang?: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  const download = () => {
    const ext = getFileExtension(lang || "txt");
    downloadFile(code, `code.${ext}`, "text/plain");
  };
  return (
    <div className="relative group my-3 rounded-lg overflow-hidden border border-border">
      <div className="flex items-center justify-between px-3 py-1.5 bg-muted/60 border-b border-border">
        <span className="text-[11px] text-muted-foreground font-mono">{lang || "code"}</span>
        <div className="flex items-center gap-2">
          <button
            onClick={download}
            className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
          >
            <Download className="w-3 h-3" />
            Download
          </button>
          <button
            onClick={copy}
            className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
          >
            {copied ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
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
  const segments = text.split(/(```[\s\S]*?```)/g);

  for (const seg of segments) {
    if (seg.startsWith("```")) {
      const lines = seg.slice(3, -3).split("\n");
      const lang = lines[0].trim();
      const code = lines.slice(lang ? 1 : 0).join("\n").trimEnd();
      parts.push(<CodeBlock key={key++} code={code} lang={lang || undefined} />);
    } else {
      const lines = seg.split("\n");
      let i = 0;
      while (i < lines.length) {
        const line = lines[i];
        if (/^[-*•]\s+/.test(line)) {
          const items: string[] = [];
          while (i < lines.length && /^[-*•]\s+/.test(lines[i])) { items.push(lines[i].replace(/^[-*•]\s+/, "")); i++; }
          parts.push(<ul key={key++} className="list-disc list-inside space-y-1 my-2 text-foreground">{items.map((item, idx) => <li key={idx} className="text-sm leading-relaxed">{inlineMarkdown(item)}</li>)}</ul>);
          continue;
        }
        if (/^\d+\.\s+/.test(line)) {
          const items: string[] = [];
          while (i < lines.length && /^\d+\.\s+/.test(lines[i])) { items.push(lines[i].replace(/^\d+\.\s+/, "")); i++; }
          parts.push(<ol key={key++} className="list-decimal list-inside space-y-1 my-2 text-foreground">{items.map((item, idx) => <li key={idx} className="text-sm leading-relaxed">{inlineMarkdown(item)}</li>)}</ol>);
          continue;
        }
        if (/^#{1,3}\s/.test(line)) {
          const level = line.match(/^(#{1,3})/)?.[1].length || 1;
          const content = line.replace(/^#{1,3}\s+/, "");
          const Tag = level === 1 ? "h2" : level === 2 ? "h3" : "h4";
          const cls = level === 1 ? "text-base font-semibold text-foreground mt-4 mb-1" : level === 2 ? "text-sm font-semibold text-foreground mt-3 mb-1" : "text-sm font-medium text-foreground mt-2 mb-1";
          parts.push(<Tag key={key++} className={cls}>{inlineMarkdown(content)}</Tag>);
          i++; continue;
        }
        if (/^---+$/.test(line.trim())) { parts.push(<hr key={key++} className="border-border my-3" />); i++; continue; }
        if (line.trim() === "") { parts.push(<div key={key++} className="h-2" />); i++; continue; }
        parts.push(<p key={key++} className="text-sm leading-relaxed text-foreground">{inlineMarkdown(line)}</p>);
        i++;
      }
    }
  }
  return <>{parts}</>;
}

function inlineMarkdown(text: string): (string | JSX.Element)[] {
  const result: (string | JSX.Element)[] = [];
  const pattern = /(\*\*([^*]+)\*\*|\*([^*]+)\*|`([^`]+)`)/g;
  let last = 0; let match; let key = 0;
  while ((match = pattern.exec(text)) !== null) {
    if (match.index > last) result.push(text.slice(last, match.index));
    if (match[2]) result.push(<strong key={key++} className="font-semibold">{match[2]}</strong>);
    else if (match[3]) result.push(<em key={key++} className="italic">{match[3]}</em>);
    else if (match[4]) result.push(<code key={key++} className="bg-muted rounded px-1 py-0.5 font-mono text-xs text-foreground">{match[4]}</code>);
    last = match.index + match[0].length;
  }
  if (last < text.length) result.push(text.slice(last));
  return result.length ? result : [text];
}

// ─── Typing indicator ─────────────────────────────────────────────────────────

function TypingDots() {
  return (
    <div className="flex items-center gap-1 px-1 py-0.5">
      {[0, 1, 2].map((i) => (
        <span key={i} className="w-1.5 h-1.5 rounded-full bg-primary/60 animate-bounce" style={{ animationDelay: `${i * 120}ms`, animationDuration: "800ms" }} />
      ))}
    </div>
  );
}

// ─── Message bubble with export ──────────────────────────────────────────────

function MessageBubble({ msg }: { msg: Message }) {
  const isUser = msg.role === "user";
  const [showTime, setShowTime] = useState(false);
  const [mdCopied, setMdCopied] = useState(false);
  const timeStr = msg.timestamp instanceof Date
    ? msg.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : new Date(msg.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  const copyMarkdown = () => {
    navigator.clipboard.writeText(msg.content).then(() => {
      setMdCopied(true);
      setTimeout(() => setMdCopied(false), 2000);
    });
  };

  return (
    <div className={`flex gap-3 group ${isUser ? "flex-row-reverse" : "flex-row"}`} onMouseEnter={() => setShowTime(true)} onMouseLeave={() => setShowTime(false)}>
      {!isUser && (
        <div className="w-7 h-7 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center flex-shrink-0 mt-0.5">
          <Bot className="w-3.5 h-3.5 text-primary" />
        </div>
      )}
      <div className={`max-w-[75%] rounded-2xl px-4 py-3 ${isUser ? "bg-primary/20 border border-primary/30 text-foreground ml-auto" : "bg-card border border-border text-foreground w-full max-w-none flex-1"}`}>
        {isUser ? (
          <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
        ) : (
          <>
            <div className="prose-sm">{renderMarkdown(msg.content)}</div>
            {/* Export buttons for assistant messages */}
            <div className="flex items-center gap-2 mt-2 pt-2 border-t border-border/50">
              <button onClick={copyMarkdown} className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors">
                {mdCopied ? <Check className="w-3 h-3 text-green-400" /> : <FileText className="w-3 h-3" />}
                {mdCopied ? "Copied" : "Copy as Markdown"}
              </button>
            </div>
          </>
        )}
      </div>
      <div className={`self-end mb-1 text-[10px] text-muted-foreground transition-opacity duration-150 ${showTime ? "opacity-100" : "opacity-0"}`}>
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

function genId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

// ─── Rate Limit Banner ───────────────────────────────────────────────────────

function RateLimitBanner({ error }: { error: any }) {
  if (!error?.upgradePath) return null;
  return (
    <div className="mx-4 md:mx-8 mb-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-sm">
      <p className="text-amber-400 font-medium">{error.error || "Daily limit reached"}</p>
      <Link href="/pricing">
        <button className="mt-1 flex items-center gap-1 text-xs text-primary hover:underline">
          Upgrade your plan <ArrowUpRight className="w-3 h-3" />
        </button>
      </Link>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function BossPage() {
  const qc = useQueryClient();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [rateLimitError, setRateLimitError] = useState<any>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const [selectedModel, setSelectedModel] = useState<{ provider: string; model: string } | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Fetch conversations from DB
  const { data: conversations = [], isLoading: convsLoading } = useQuery<Conversation[]>({
    queryKey: ["boss-conversations"],
    queryFn: async () => {
      const res = await fetch("/api/conversations");
      if (!res.ok) return [];
      return res.json();
    },
  });

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

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  // Auto-grow textarea
  const adjustTextarea = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    const maxH = 24 * 6 + 16;
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
    setRateLimitError(null);
    if (isMobile) setSidebarOpen(false);
    setTimeout(() => textareaRef.current?.focus(), 50);
  };

  const loadConversation = async (conv: Conversation) => {
    setActiveId(conv.id);
    setRateLimitError(null);
    if (isMobile) setSidebarOpen(false);
    try {
      const res = await fetch(`/api/conversations/${conv.id}/messages`);
      if (res.ok) {
        const msgs = await res.json();
        setMessages(msgs.map((m: any) => ({ id: String(m.id), role: m.role, content: m.content, timestamp: new Date(m.createdAt) })));
      }
    } catch { /* ignore */ }
    setTimeout(() => textareaRef.current?.focus(), 50);
  };

  const deleteConversation = async (convId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await fetch(`/api/conversations/${convId}`, { method: "DELETE" });
    qc.invalidateQueries({ queryKey: ["boss-conversations"] });
    if (activeId === convId) startNewChat();
  };

  const sendMessage = async (text: string) => {
    if (!text.trim() || isLoading) return;
    const trimmed = text.trim();
    setInput("");
    setRateLimitError(null);

    // Create conversation in DB if new
    let convId = activeId;
    if (!convId) {
      convId = genId();
      setActiveId(convId);
      const title = trimmed.slice(0, 50);
      await fetch("/api/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: convId, title }),
      });
      qc.invalidateQueries({ queryKey: ["boss-conversations"] });
    }

    if (textareaRef.current) textareaRef.current.style.height = "auto";

    const userMsg: Message = { id: genId(), role: "user", content: trimmed, timestamp: new Date() };
    setMessages((prev) => [...prev, userMsg]);
    setIsLoading(true);

    // Persist user message to DB
    fetch(`/api/conversations/${convId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: "user", content: trimmed }),
    }).catch(() => {});

    try {
      const history = messages.map((m) => ({ role: m.role, content: m.content }));
      const res = await fetch("/api/jarvis/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: trimmed, history, ...(selectedModel ? { provider: selectedModel.provider, model: selectedModel.model } : {}) }),
      });

      if (res.status === 429) {
        const errData = await res.json();
        setRateLimitError(errData);
        throw new Error(errData.error || "Rate limit reached");
      }

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Server error ${res.status}`);
      }

      const data = await res.json();
      const reply = data.reply || data.message || "I couldn't process that.";
      const assistantMsg: Message = { id: genId(), role: "assistant", content: reply, timestamp: new Date() };
      setMessages((prev) => [...prev, assistantMsg]);

      // Persist assistant message to DB
      fetch(`/api/conversations/${convId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: "assistant", content: reply }),
      }).catch(() => {});
    } catch (err: any) {
      const errMsg: Message = { id: genId(), role: "assistant", content: `Something went wrong: ${err.message || "Unknown error"}. Try again.`, timestamp: new Date() };
      setMessages((prev) => [...prev, errMsg]);
    } finally {
      setIsLoading(false);
      setTimeout(() => textareaRef.current?.focus(), 50);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(input); }
  };

  const isEmpty = messages.length === 0;
  const charCount = input.length;

  return (
    <div className="flex h-full overflow-hidden bg-background">
      {/* ── Sidebar ── */}
      <div className={`flex-shrink-0 border-r border-border bg-sidebar flex flex-col transition-all duration-200 ${sidebarOpen ? "w-56" : "w-0"} overflow-hidden`}>
        <div className="p-3 border-b border-border">
          <button onClick={startNewChat} className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary text-sm font-medium transition-colors">
            <Plus className="w-4 h-4 flex-shrink-0" /> New Chat
          </button>
        </div>
        <nav className="flex-1 overflow-y-auto overscroll-contain px-2 py-2 space-y-0.5">
          {convsLoading ? (
            <div className="flex items-center justify-center py-8"><Loader2 className="w-4 h-4 animate-spin text-muted-foreground" /></div>
          ) : conversations.length === 0 ? (
            <p className="text-[11px] text-muted-foreground px-3 py-2">No conversations yet.</p>
          ) : (
            conversations.map((conv) => (
              <button
                key={conv.id}
                onClick={() => loadConversation(conv)}
                className={`w-full flex items-center gap-2 px-3 py-2 rounded-md text-left text-sm transition-colors group/item ${activeId === conv.id ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-secondary hover:text-foreground"}`}
              >
                <MessageSquare className="w-3.5 h-3.5 flex-shrink-0 opacity-60" />
                <span className="truncate text-xs leading-relaxed flex-1">{conv.title}</span>
                <button
                  onClick={(e) => deleteConversation(conv.id, e)}
                  className="opacity-0 group-hover/item:opacity-100 p-0.5 hover:text-destructive transition-all"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </button>
            ))
          )}
        </nav>
      </div>

      {/* Sidebar toggle */}
      <div className="flex-shrink-0 flex items-center">
        <button onClick={() => setSidebarOpen((v) => !v)} className="w-4 h-10 flex items-center justify-center bg-border hover:bg-primary/20 text-muted-foreground hover:text-primary rounded-r transition-colors self-center" aria-label={sidebarOpen ? "Collapse sidebar" : "Expand sidebar"}>
          {sidebarOpen ? <ChevronLeft className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
        </button>
      </div>

      {/* ── Main chat area ── */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {isEmpty ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-6 px-6 overflow-y-auto">
            <div className="relative">
              <div className="w-16 h-16 rounded-2xl bg-primary/15 border border-primary/30 flex items-center justify-center shadow-lg shadow-primary/10">
                <Bot className="w-8 h-8 text-primary" />
              </div>
              <span className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-green-500 border-2 border-background" />
            </div>
            <div className="text-center space-y-2">
              <h1 className="text-2xl font-bold text-foreground tracking-tight">Hey, I'm The Boss.</h1>
              <p className="text-muted-foreground text-sm">What are we building today?</p>
            </div>
            <div className="flex flex-wrap gap-2 justify-center max-w-lg">
              {SUGGESTIONS.map((s) => (
                <button key={s} onClick={() => sendMessage(s)} className="px-4 py-2 rounded-xl bg-card border border-border text-sm text-foreground hover:border-primary/50 hover:bg-primary/5 transition-colors">{s}</button>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto overscroll-contain px-4 md:px-8 py-6 space-y-5">
            <div className="max-w-3xl mx-auto space-y-5">
              {messages.map((msg) => <MessageBubble key={msg.id} msg={msg} />)}
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

        {/* Rate limit banner */}
        <RateLimitBanner error={rateLimitError} />

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
              <button onClick={() => sendMessage(input)} disabled={!input.trim() || isLoading} className="flex-shrink-0 w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-primary-foreground disabled:opacity-30 disabled:cursor-not-allowed hover:bg-primary/90 transition-colors" aria-label="Send message">
                {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </button>
            </div>
            <div className="flex items-center justify-between mt-1.5 px-1">
              <p className="text-[10px] text-muted-foreground">Enter to send · Shift+Enter for newline</p>
              <div className="flex items-center gap-2">
                <ModelSelector value={selectedModel} onChange={setSelectedModel} compact />
                {charCount > 0 && <p className={`text-[10px] ${charCount > 2000 ? "text-destructive" : "text-muted-foreground"}`}>{charCount.toLocaleString()}</p>}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

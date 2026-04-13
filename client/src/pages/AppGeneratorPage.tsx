import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Cpu, Plus, Trash2, Download, Sparkles, Code, Globe, LayoutDashboard, Server,
  FolderTree, FileCode, FileJson, FileText, ChevronRight, ChevronDown,
  Play, Send, Terminal, MessageSquare, X, Package, Loader2, Copy, Check,
  Smartphone, Zap, PanelLeft, PanelBottom, Eye, History
} from "lucide-react";
import JSZip from "jszip";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/queryClient";
import ModelSelector from "@/components/ModelSelector";

type GeneratedApp = {
  id: string;
  name: string;
  description: string | null;
  appType: string;
  framework: string;
  generatedCode: string | null;
  previewUrl: string | null;
  status: string;
  createdAt: string;
  versions?: string;
};

// ── File tree types ──────────────────────────────────────────────────────────
type FileNode = {
  name: string;
  type: "file" | "folder";
  content?: string;
  children?: FileNode[];
  language?: string;
};

// ── Constants ────────────────────────────────────────────────────────────────
const APP_TYPES = [
  { value: "web", label: "Web App", icon: Globe, desc: "Full-stack web application" },
  { value: "landing", label: "Landing Page", icon: LayoutDashboard, desc: "Marketing / product page" },
  { value: "dashboard", label: "Dashboard", icon: PanelLeft, desc: "Data-dense admin panel" },
  { value: "api", label: "API Server", icon: Server, desc: "REST / GraphQL backend" },
  { value: "mobile", label: "Mobile App", icon: Smartphone, desc: "React Native cross-platform" },
  { value: "ecommerce", label: "E-commerce", icon: Package, desc: "Online store with cart" },
];

const FRAMEWORKS = [
  { value: "react", label: "React", ext: "tsx" },
  { value: "vue", label: "Vue", ext: "vue" },
  { value: "nextjs", label: "Next.js", ext: "tsx" },
  { value: "html", label: "HTML/CSS/JS", ext: "html" },
  { value: "flask", label: "Python Flask", ext: "py" },
  { value: "express", label: "Node Express", ext: "js" },
];

const TEMPLATES = [
  { name: "SaaS Dashboard", desc: "Analytics dashboard with charts, user management, settings", type: "dashboard", framework: "react" },
  { name: "Landing Page", desc: "Modern marketing page with hero, features, pricing, CTA", type: "landing", framework: "html" },
  { name: "E-commerce Store", desc: "Product catalog, cart, checkout flow", type: "ecommerce", framework: "nextjs" },
  { name: "Blog Platform", desc: "Markdown blog with categories, search, RSS", type: "web", framework: "nextjs" },
  { name: "REST API", desc: "CRUD API with auth, validation, rate limiting", type: "api", framework: "express" },
  { name: "Mobile App", desc: "Cross-platform app with navigation, auth, data sync", type: "mobile", framework: "react" },
];

// ── Parse generated code into file tree ──────────────────────────────────────
function parseCodeToFileTree(code: string, framework: string): FileNode[] {
  // Try to split by file markers like "// === filename.tsx ===" or "/* --- filename.css --- */"
  const filePattern = /(?:\/\/|\/\*|#)\s*={3,}\s*(.+?)\s*={3,}\s*(?:\*\/)?/g;
  const matches: RegExpExecArray[] = [];
  let match: RegExpExecArray | null;
  while ((match = filePattern.exec(code)) !== null) matches.push(match);

  if (matches.length >= 2) {
    const files: FileNode[] = [];
    for (let i = 0; i < matches.length; i++) {
      const filename = matches[i][1].trim();
      const startIdx = (matches[i].index ?? 0) + matches[i][0].length;
      const endIdx = i + 1 < matches.length ? matches[i + 1].index ?? code.length : code.length;
      const content = code.slice(startIdx, endIdx).trim();
      const ext = filename.split(".").pop() || "";
      files.push({ name: filename, type: "file", content, language: getLanguage(ext) });
    }
    return buildTree(files);
  }

  // Single file fallback
  const ext = FRAMEWORKS.find(f => f.value === framework)?.ext || "txt";
  return [{ name: `app.${ext}`, type: "file", content: code, language: getLanguage(ext) }];
}

function getLanguage(ext: string): string {
  const map: Record<string, string> = {
    tsx: "typescript", ts: "typescript", jsx: "javascript", js: "javascript",
    py: "python", html: "html", css: "css", json: "json", vue: "vue",
    md: "markdown", sql: "sql", sh: "bash", yml: "yaml", yaml: "yaml",
  };
  return map[ext] || "text";
}

function buildTree(files: FileNode[]): FileNode[] {
  const root: FileNode[] = [];
  for (const file of files) {
    const parts = file.name.split("/");
    let current = root;
    for (let i = 0; i < parts.length - 1; i++) {
      let folder = current.find(n => n.name === parts[i] && n.type === "folder");
      if (!folder) {
        folder = { name: parts[i], type: "folder", children: [] };
        current.push(folder);
      }
      current = folder.children!;
    }
    current.push({ ...file, name: parts[parts.length - 1] });
  }
  return root;
}

// ── File icon helper ─────────────────────────────────────────────────────────
function FileIcon({ name }: { name: string }) {
  const ext = name.split(".").pop();
  if (ext === "json") return <FileJson className="w-3.5 h-3.5 text-yellow-400 flex-shrink-0" />;
  if (ext === "md" || ext === "txt") return <FileText className="w-3.5 h-3.5 text-blue-300 flex-shrink-0" />;
  return <FileCode className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />;
}

// ── File Tree Component ──────────────────────────────────────────────────────
function FileTreeNode({ node, depth = 0, selected, onSelect }: {
  node: FileNode; depth?: number; selected: string; onSelect: (name: string, content: string) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const isFolder = node.type === "folder";
  const isSelected = !isFolder && selected === node.name;

  return (
    <div>
      <button
        onClick={() => isFolder ? setExpanded(!expanded) : onSelect(node.name, node.content || "")}
        className={`w-full flex items-center gap-1.5 px-2 py-1 text-xs hover:bg-[#2a2d3e] transition-colors rounded ${
          isSelected ? "bg-[#2a2d3e] text-blue-400" : "text-[#ccc]"
        }`}
        style={{ paddingLeft: `${depth * 12 + 8}px` }}
      >
        {isFolder ? (
          expanded ? <ChevronDown className="w-3 h-3 flex-shrink-0 text-[#888]" /> : <ChevronRight className="w-3 h-3 flex-shrink-0 text-[#888]" />
        ) : null}
        {isFolder ? <FolderTree className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" /> : <FileIcon name={node.name} />}
        <span className="truncate">{node.name}</span>
      </button>
      {isFolder && expanded && node.children?.map((child, i) => (
        <FileTreeNode key={i} node={child} depth={depth + 1} selected={selected} onSelect={onSelect} />
      ))}
    </div>
  );
}

// ── Syntax-highlighted code (CSS-based, no library) ──────────────────────────
function highlightCode(code: string, language: string): string {
  let escaped = code.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  // Comments
  escaped = escaped.replace(/(\/\/.*$)/gm, '<span class="text-[#6a9955]">$1</span>');
  escaped = escaped.replace(/(\/\*[\s\S]*?\*\/)/g, '<span class="text-[#6a9955]">$1</span>');
  escaped = escaped.replace(/(#.*$)/gm, '<span class="text-[#6a9955]">$1</span>');

  // Strings
  escaped = escaped.replace(/(&quot;.*?&quot;|'.*?'|`.*?`)/g, '<span class="text-[#ce9178]">$1</span>');

  // Keywords
  const keywords = ["import","export","from","const","let","var","function","return","if","else","for","while","class","extends","new","this","async","await","try","catch","throw","default","switch","case","break","continue","typeof","interface","type","enum","implements","abstract","public","private","protected","static","readonly","def","self","True","False","None","print","pass","raise","except","finally","with","as","lambda","yield","global","nonlocal","assert","del"];
  const kwPattern = new RegExp(`\\b(${keywords.join("|")})\\b`, "g");
  escaped = escaped.replace(kwPattern, '<span class="text-[#569cd6]">$1</span>');

  // Numbers
  escaped = escaped.replace(/\b(\d+\.?\d*)\b/g, '<span class="text-[#b5cea8]">$1</span>');

  // Types / classes (PascalCase words)
  escaped = escaped.replace(/\b([A-Z][a-zA-Z]+)\b/g, '<span class="text-[#4ec9b0]">$1</span>');

  return escaped;
}

// ── Main Component ───────────────────────────────────────────────────────────
export default function AppGeneratorPage() {
  const qc = useQueryClient();
  const [view, setView] = useState<"gallery" | "ide">("gallery");
  const [activeApp, setActiveApp] = useState<GeneratedApp | null>(null);
  const [selectedFile, setSelectedFile] = useState("");
  const [fileContent, setFileContent] = useState("");
  const [fileTree, setFileTree] = useState<FileNode[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: "", description: "", appType: "web", framework: "react" });
  const [chatMessages, setChatMessages] = useState<{ role: string; content: string }[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [terminalLines, setTerminalLines] = useState<string[]>(["$ bunz app-gen ready", "Waiting for commands..."]);
  const [showTerminal, setShowTerminal] = useState(true);
  const [showChat, setShowChat] = useState(true);
  const [copied, setCopied] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [versions, setVersions] = useState<{ code: string; timestamp: string; version: number }[]>([]);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const terminalEndRef = useRef<HTMLDivElement>(null);

  const { data: apps = [] } = useQuery<GeneratedApp[]>({ queryKey: ["/api/generated-apps"] });

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [chatMessages]);
  useEffect(() => { terminalEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [terminalLines]);

  const createApp = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/generated-apps", form);
      return res.json();
    },
    onSuccess: (data: GeneratedApp) => {
      qc.invalidateQueries({ queryKey: ["/api/generated-apps"] });
      setShowCreate(false);
      setForm({ name: "", description: "", appType: "web", framework: "react" });
      openInIDE(data);
    },
  });

  const generateCode = useMutation({
    mutationFn: async (id: string) => {
      setTerminalLines(prev => [...prev, `$ generating code for ${activeApp?.name || "app"}...`, "⏳ AI is writing your code..."]);
      const res = await apiRequest("POST", `/api/generated-apps/${id}/generate`);
      return res.json();
    },
    onSuccess: (data: GeneratedApp) => {
      qc.invalidateQueries({ queryKey: ["/api/generated-apps"] });
      setTerminalLines(prev => [...prev, "✅ Code generation complete", `Generated ${data.generatedCode?.length || 0} characters`]);
      openInIDE(data);
    },
    onError: (err: any) => {
      setTerminalLines(prev => [...prev, `❌ Error: ${err.message}`]);
    },
  });

  const deleteApp = useMutation({
    mutationFn: async (id: string) => { await apiRequest("DELETE", `/api/generated-apps/${id}`); },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/generated-apps"] });
      if (activeApp) { setActiveApp(null); setView("gallery"); }
    },
  });

  function openInIDE(app: GeneratedApp) {
    setActiveApp(app);
    setView("ide");
    if (app.generatedCode) {
      const tree = parseCodeToFileTree(app.generatedCode, app.framework);
      setFileTree(tree);
      // Auto-select first file
      const firstFile = findFirstFile(tree);
      if (firstFile) {
        setSelectedFile(firstFile.name);
        setFileContent(firstFile.content || "");
      }
    } else {
      setFileTree([]);
      setSelectedFile("");
      setFileContent("");
    }
    setChatMessages([{ role: "assistant", content: `Project "${app.name}" loaded. ${app.status === "draft" ? "Click Generate to create the code, or describe what you want." : "You can ask me to modify any file."}` }]);
    // Load versions
    try { setVersions(app.versions ? JSON.parse(app.versions) : []); } catch { setVersions([]); }
    setShowPreview(false);
    setPreviewUrl(null);
  }

  function findFirstFile(nodes: FileNode[]): FileNode | null {
    for (const n of nodes) {
      if (n.type === "file") return n;
      if (n.children) {
        const f = findFirstFile(n.children);
        if (f) return f;
      }
    }
    return null;
  }

  function handleChat() {
    if (!chatInput.trim()) return;
    setChatMessages(prev => [...prev, { role: "user", content: chatInput }]);
    const userMsg = chatInput;
    setChatInput("");
    // Simulate AI response (will be wired to real AI later)
    setTimeout(() => {
      setChatMessages(prev => [...prev, { role: "assistant", content: `I'll update the code based on: "${userMsg}". Use the Generate button to regenerate with this context included.` }]);
    }, 500);
  }

  function handleCopy() {
    navigator.clipboard.writeText(fileContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function downloadAll() {
    if (!activeApp?.generatedCode) return;
    const zip = new JSZip();
    const tree = parseCodeToFileTree(activeApp.generatedCode, activeApp.framework);
    function addToZip(nodes: FileNode[], prefix = "") {
      for (const node of nodes) {
        const path = prefix ? `${prefix}/${node.name}` : node.name;
        if (node.type === "folder" && node.children) {
          addToZip(node.children, path);
        } else if (node.content) {
          zip.file(path, node.content);
        }
      }
    }
    addToZip(tree);
    const blob = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${(activeApp.name || "app").toLowerCase().replace(/\s+/g, "-")}.zip`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function buildPreview() {
    if (!activeApp?.generatedCode) return;
    const tree = parseCodeToFileTree(activeApp.generatedCode, activeApp.framework);
    // Find index.html or build one from the code
    function findFile(nodes: FileNode[], name: string): FileNode | null {
      for (const n of nodes) {
        if (n.type === "file" && n.name.toLowerCase() === name) return n;
        if (n.children) { const f = findFile(n.children, name); if (f) return f; }
      }
      return null;
    }
    const html = findFile(tree, "index.html");
    let previewHtml = "";
    if (html?.content) {
      previewHtml = html.content;
    } else {
      // Wrap all code in a basic HTML page
      const allCode = activeApp.generatedCode;
      previewHtml = `<!DOCTYPE html><html><head><style>body{font-family:system-ui;padding:20px;background:#1e1e2e;color:#cdd6f4;}</style></head><body><pre>${allCode.replace(/</g,"&lt;").replace(/>/g,"&gt;")}</pre></body></html>`;
    }
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    const blob = new Blob([previewHtml], { type: "text/html" });
    setPreviewUrl(URL.createObjectURL(blob));
    setShowPreview(true);
  }

  function loadVersion(v: { code: string; timestamp: string; version: number }) {
    if (!activeApp) return;
    const tree = parseCodeToFileTree(v.code, activeApp.framework);
    setFileTree(tree);
    const first = findFirstFile(tree);
    if (first) { setSelectedFile(first.name); setFileContent(first.content || ""); }
  }

  // ── Gallery View ───────────────────────────────────────────────────────────
  if (view === "gallery") {
    return (
      <div className="p-6 space-y-6 max-w-6xl mx-auto">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
              <Cpu className="w-5 h-5 text-primary" /> App Generator
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">Describe your app. AI builds it.</p>
          </div>
          <div className="flex items-center gap-2">
            <ModelSelector compact />
            <Button onClick={() => setShowCreate(true)} className="gap-1.5" size="sm">
              <Plus className="w-4 h-4" /> New Project
            </Button>
          </div>
        </div>

        {/* Template Gallery */}
        <div>
          <h2 className="text-sm font-semibold text-foreground mb-3 uppercase tracking-wide">Templates</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {TEMPLATES.map(t => (
              <button
                key={t.name}
                onClick={() => { setForm({ name: t.name, description: t.desc, appType: t.type, framework: t.framework }); setShowCreate(true); }}
                className="text-left bg-card border border-border rounded-lg p-4 hover:border-primary/40 transition-colors group"
              >
                <div className="flex items-center gap-2 mb-1.5">
                  <Zap className="w-4 h-4 text-primary group-hover:text-primary" />
                  <span className="text-sm font-medium text-foreground">{t.name}</span>
                </div>
                <p className="text-xs text-muted-foreground">{t.desc}</p>
                <span className="text-[10px] text-primary/60 mt-2 inline-block">{t.framework}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Create Dialog */}
        {showCreate && (
          <div className="bg-card border border-border rounded-lg p-5 space-y-4">
            <h2 className="font-semibold text-foreground text-sm">New Project</h2>
            <div>
              <label className="text-xs text-muted-foreground">App Name</label>
              <input className="w-full mt-1 px-3 py-2 bg-background border border-border rounded-md text-sm text-foreground" placeholder="My Awesome App" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Describe what it should do</label>
              <textarea className="w-full mt-1 px-3 py-2 bg-background border border-border rounded-md text-sm text-foreground min-h-[80px]" placeholder="A dashboard that shows real-time crypto prices with portfolio tracking..." value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-muted-foreground">App Type</label>
                <div className="grid grid-cols-2 gap-1.5 mt-1">
                  {APP_TYPES.map(t => (
                    <button key={t.value} onClick={() => setForm({ ...form, appType: t.value })}
                      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded border text-xs ${form.appType === t.value ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-secondary"}`}>
                      <t.icon className="w-3.5 h-3.5" /> {t.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Framework</label>
                <div className="grid grid-cols-2 gap-1.5 mt-1">
                  {FRAMEWORKS.map(f => (
                    <button key={f.value} onClick={() => setForm({ ...form, framework: f.value })}
                      className={`px-2.5 py-1.5 rounded border text-xs ${form.framework === f.value ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-secondary"}`}>
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={() => createApp.mutate()} disabled={!form.name}>Create &amp; Open IDE</Button>
              <Button size="sm" variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
            </div>
          </div>
        )}

        {/* Your Projects */}
        {apps.length > 0 && (
          <div>
            <h2 className="text-sm font-semibold text-foreground mb-3 uppercase tracking-wide">Your Projects</h2>
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {apps.map(app => (
                <div key={app.id} className="bg-card border border-border rounded-lg p-4 cursor-pointer hover:border-primary/30 transition-colors" onClick={() => openInIDE(app)}>
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <h3 className="text-sm font-semibold text-foreground">{app.name}</h3>
                      <span className="text-[10px] text-muted-foreground">{app.framework} &middot; {app.appType}</span>
                    </div>
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${app.status === "generated" ? "bg-emerald-500/10 text-emerald-400" : "bg-yellow-500/10 text-yellow-400"}`}>{app.status}</span>
                  </div>
                  {app.description && <p className="text-xs text-muted-foreground line-clamp-2 mb-3">{app.description}</p>}
                  <div className="flex gap-1.5">
                    <Button size="sm" variant="outline" className="text-xs h-7 gap-1">
                      <Code className="w-3 h-3" /> Open IDE
                    </Button>
                    <Button size="sm" variant="ghost" className="h-7" onClick={e => { e.stopPropagation(); deleteApp.mutate(app.id); }}>
                      <Trash2 className="w-3 h-3 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {apps.length === 0 && !showCreate && (
          <div className="text-center py-16 text-muted-foreground">
            <Cpu className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="text-sm">No projects yet. Pick a template or create from scratch.</p>
          </div>
        )}
      </div>
    );
  }

  // ── IDE View ───────────────────────────────────────────────────────────────
  const lang = fileTree.length > 0 ? (getLanguage(selectedFile.split(".").pop() || "") || "text") : "text";

  return (
    <div className="flex flex-col h-full bg-[#1e1e2e] text-[#cdd6f4] overflow-hidden">
      {/* Top Bar */}
      <div className="flex items-center justify-between h-10 px-3 bg-[#181825] border-b border-[#313244] flex-shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={() => setView("gallery")} className="text-xs text-[#a6adc8] hover:text-[#cdd6f4] flex items-center gap-1">
            <ChevronRight className="w-3 h-3 rotate-180" /> Back
          </button>
          <span className="text-xs font-medium text-[#cdd6f4]">{activeApp?.name}</span>
          <span className="text-[10px] text-[#6c7086] px-1.5 py-0.5 rounded bg-[#313244]">{activeApp?.framework}</span>
        </div>
        <div className="flex items-center gap-1.5">
          {activeApp?.status === "draft" && (
            <Button size="sm" className="h-7 text-xs gap-1 bg-[#89b4fa] text-[#1e1e2e] hover:bg-[#74c7ec]"
              onClick={() => activeApp && generateCode.mutate(activeApp.id)} disabled={generateCode.isPending}>
              {generateCode.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
              Generate
            </Button>
          )}
          {activeApp?.status === "generated" && (
            <Button size="sm" className="h-7 text-xs gap-1 bg-[#a6e3a1] text-[#1e1e2e] hover:bg-[#94e2d5]"
              onClick={() => activeApp && generateCode.mutate(activeApp.id)} disabled={generateCode.isPending}>
              {generateCode.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
              Regenerate
            </Button>
          )}
          {activeApp?.status === "generated" && (
            <button onClick={buildPreview} className={`p-1.5 rounded hover:bg-[#313244] ${showPreview ? "text-[#89b4fa]" : "text-[#a6adc8]"}`} title="Preview">
              <Eye className="w-3.5 h-3.5" />
            </button>
          )}
          {versions.length > 0 && (
            <div className="relative group">
              <button className="p-1.5 rounded hover:bg-[#313244] text-[#a6adc8] flex items-center gap-1" title="Versions">
                <History className="w-3.5 h-3.5" />
                <span className="text-[10px]">v{versions.length}</span>
              </button>
              <div className="absolute right-0 top-8 bg-[#181825] border border-[#313244] rounded-lg shadow-xl z-50 min-w-[180px] hidden group-hover:block">
                {versions.map(v => (
                  <button key={v.version} onClick={() => loadVersion(v)}
                    className="w-full text-left px-3 py-2 text-xs text-[#cdd6f4] hover:bg-[#313244] flex justify-between">
                    <span>Version {v.version}</span>
                    <span className="text-[#6c7086]">{new Date(v.timestamp).toLocaleDateString()}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
          <button onClick={downloadAll} className="p-1.5 rounded hover:bg-[#313244] text-[#a6adc8]" title="Download ZIP">
            <Download className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => setShowTerminal(!showTerminal)} className={`p-1.5 rounded hover:bg-[#313244] ${showTerminal ? "text-[#89b4fa]" : "text-[#a6adc8]"}`} title="Terminal">
            <PanelBottom className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => setShowChat(!showChat)} className={`p-1.5 rounded hover:bg-[#313244] ${showChat ? "text-[#89b4fa]" : "text-[#a6adc8]"}`} title="AI Chat">
            <MessageSquare className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Main IDE Area */}
      <div className="flex flex-1 overflow-hidden">
        {/* File Explorer */}
        <div className="w-52 bg-[#181825] border-r border-[#313244] flex-shrink-0 overflow-y-auto">
          <div className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-[#6c7086]">Explorer</div>
          {fileTree.length > 0 ? (
            fileTree.map((node, i) => (
              <FileTreeNode key={i} node={node} selected={selectedFile} onSelect={(name, content) => { setSelectedFile(name); setFileContent(content); }} />
            ))
          ) : (
            <div className="px-3 py-8 text-center">
              <Code className="w-8 h-8 text-[#45475a] mx-auto mb-2" />
              <p className="text-[10px] text-[#6c7086]">No files yet. Generate code to start.</p>
            </div>
          )}
        </div>

        {/* Code Editor + Terminal */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Editor Tabs */}
          {selectedFile && (
            <div className="flex items-center h-8 bg-[#181825] border-b border-[#313244] px-2 flex-shrink-0">
              <div className="flex items-center gap-1.5 px-2 py-1 bg-[#1e1e2e] rounded-t text-xs text-[#cdd6f4] border border-[#313244] border-b-0">
                <FileIcon name={selectedFile} />
                <span>{selectedFile}</span>
              </div>
              <div className="ml-auto flex items-center gap-1">
                <button onClick={handleCopy} className="p-1 rounded hover:bg-[#313244] text-[#6c7086]" title="Copy">
                  {copied ? <Check className="w-3 h-3 text-[#a6e3a1]" /> : <Copy className="w-3 h-3" />}
                </button>
              </div>
            </div>
          )}

          {/* Code Area */}
          <div className="flex-1 overflow-auto font-mono text-[13px] leading-[1.6]">
            {fileContent ? (
              <div className="flex">
                {/* Line numbers */}
                <div className="flex-shrink-0 py-3 pl-4 pr-3 text-right text-[#45475a] select-none text-xs leading-[1.6]">
                  {fileContent.split("\n").map((_, i) => (
                    <div key={i}>{i + 1}</div>
                  ))}
                </div>
                {/* Code */}
                <pre className="flex-1 py-3 pr-4 overflow-x-auto whitespace-pre" dangerouslySetInnerHTML={{ __html: highlightCode(fileContent, lang) }} />
              </div>
            ) : (
              <div className="flex items-center justify-center h-full text-[#45475a]">
                <div className="text-center">
                  <Cpu className="w-16 h-16 mx-auto mb-4 opacity-20" />
                  <p className="text-sm">Select a file or generate code to begin</p>
                </div>
              </div>
            )}
          </div>

          {/* Live Preview */}
          {showPreview && previewUrl && (
            <div className="h-64 bg-white border-t border-[#313244] flex-shrink-0 overflow-hidden flex flex-col">
              <div className="flex items-center justify-between h-7 px-3 bg-[#181825] border-b border-[#313244] flex-shrink-0">
                <div className="flex items-center gap-1.5 text-[10px] text-[#a6adc8]">
                  <Eye className="w-3 h-3" /> Preview
                </div>
                <button onClick={() => setShowPreview(false)} className="p-0.5 hover:bg-[#313244] rounded">
                  <X className="w-3 h-3 text-[#6c7086]" />
                </button>
              </div>
              <iframe src={previewUrl} className="flex-1 w-full bg-white" sandbox="allow-scripts allow-same-origin" title="App Preview" />
            </div>
          )}

          {/* Terminal */}
          {showTerminal && (
            <div className="h-36 bg-[#11111b] border-t border-[#313244] flex-shrink-0 overflow-hidden flex flex-col">
              <div className="flex items-center justify-between h-7 px-3 bg-[#181825] border-b border-[#313244] flex-shrink-0">
                <div className="flex items-center gap-1.5 text-[10px] text-[#a6adc8]">
                  <Terminal className="w-3 h-3" /> Terminal
                </div>
                <button onClick={() => setShowTerminal(false)} className="p-0.5 hover:bg-[#313244] rounded">
                  <X className="w-3 h-3 text-[#6c7086]" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-2 font-mono text-[11px] text-[#a6adc8]">
                {terminalLines.map((line, i) => (
                  <div key={i} className={line.startsWith("✅") ? "text-[#a6e3a1]" : line.startsWith("❌") ? "text-[#f38ba8]" : line.startsWith("⏳") ? "text-[#fab387]" : ""}>{line}</div>
                ))}
                <div ref={terminalEndRef} />
              </div>
            </div>
          )}
        </div>

        {/* AI Chat Panel */}
        {showChat && (
          <div className="w-72 bg-[#181825] border-l border-[#313244] flex-shrink-0 flex flex-col overflow-hidden">
            <div className="flex items-center justify-between h-8 px-3 border-b border-[#313244] flex-shrink-0">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-[#6c7086]">AI Assistant</span>
              <button onClick={() => setShowChat(false)} className="p-0.5 hover:bg-[#313244] rounded">
                <X className="w-3 h-3 text-[#6c7086]" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-3">
              {chatMessages.map((msg, i) => (
                <div key={i} className={`text-xs leading-relaxed ${msg.role === "user" ? "bg-[#313244] text-[#cdd6f4] rounded-lg px-3 py-2 ml-4" : "text-[#a6adc8]"}`}>
                  {msg.role === "assistant" && <span className="text-[10px] text-[#89b4fa] font-medium block mb-0.5">Bunz AI</span>}
                  {msg.content}
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>
            <div className="p-2 border-t border-[#313244] flex-shrink-0">
              <div className="flex items-center gap-1.5 bg-[#1e1e2e] border border-[#313244] rounded-lg px-2">
                <input
                  className="flex-1 bg-transparent py-2 text-xs text-[#cdd6f4] placeholder:text-[#45475a] outline-none"
                  placeholder="Ask AI to modify code..."
                  value={chatInput}
                  onChange={e => setChatInput(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && handleChat()}
                />
                <button onClick={handleChat} className="p-1 hover:bg-[#313244] rounded text-[#89b4fa]">
                  <Send className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

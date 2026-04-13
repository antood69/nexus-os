import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Cpu, Plus, Trash2, Download, Sparkles, Code, Globe, LayoutDashboard, Server } from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/queryClient";

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
};

const APP_TYPES = [
  { value: "web", label: "Web App", icon: Globe },
  { value: "landing", label: "Landing Page", icon: LayoutDashboard },
  { value: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { value: "api", label: "API", icon: Server },
];

const FRAMEWORKS = [
  { value: "react", label: "React" },
  { value: "vue", label: "Vue" },
  { value: "html", label: "HTML/CSS/JS" },
];

export default function AppGeneratorPage() {
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [viewApp, setViewApp] = useState<GeneratedApp | null>(null);
  const [form, setForm] = useState({ name: "", description: "", appType: "web", framework: "react" });

  const { data: apps = [] } = useQuery<GeneratedApp[]>({ queryKey: ["/api/generated-apps"] });

  const createApp = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/generated-apps", form);
      return res.json();
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["/api/generated-apps"] });
      setShowCreate(false);
      setForm({ name: "", description: "", appType: "web", framework: "react" });
      setViewApp(data);
    },
  });

  const generateCode = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("POST", `/api/generated-apps/${id}/generate`);
      return res.json();
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["/api/generated-apps"] });
      setViewApp(data);
    },
  });

  const deleteApp = useMutation({
    mutationFn: async (id: string) => { await apiRequest("DELETE", `/api/generated-apps/${id}`); },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/generated-apps"] });
      if (viewApp) setViewApp(null);
    },
  });

  const downloadCode = (app: GeneratedApp) => {
    if (!app.generatedCode) return;
    const blob = new Blob([app.generatedCode], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${app.name.toLowerCase().replace(/\s+/g, "-")}.${app.framework === "html" ? "html" : "tsx"}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Cpu className="w-6 h-6 text-primary" /> App Generator
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Describe your app in plain English. AI generates the code.</p>
        </div>
        <Button onClick={() => setShowCreate(true)} className="gap-1">
          <Plus className="w-4 h-4" /> New App
        </Button>
      </div>

      {showCreate && (
        <div className="bg-card border border-border rounded-lg p-5 space-y-4">
          <h2 className="font-semibold text-foreground">Create New App</h2>
          <div>
            <label className="text-sm text-muted-foreground">App Name</label>
            <input className="w-full mt-1 px-3 py-2 bg-background border border-border rounded-md text-sm text-foreground" placeholder="My Awesome App" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
          </div>
          <div>
            <label className="text-sm text-muted-foreground">Description</label>
            <textarea className="w-full mt-1 px-3 py-2 bg-background border border-border rounded-md text-sm text-foreground min-h-[100px]" placeholder="Describe what your app should do..." value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm text-muted-foreground">App Type</label>
              <div className="grid grid-cols-2 gap-2 mt-1">
                {APP_TYPES.map(t => (
                  <button
                    key={t.value}
                    onClick={() => setForm({ ...form, appType: t.value })}
                    className={`flex items-center gap-2 px-3 py-2 rounded-md border text-sm ${
                      form.appType === t.value ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-secondary"
                    }`}
                  >
                    <t.icon className="w-4 h-4" /> {t.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-sm text-muted-foreground">Framework</label>
              <div className="flex flex-col gap-2 mt-1">
                {FRAMEWORKS.map(f => (
                  <button
                    key={f.value}
                    onClick={() => setForm({ ...form, framework: f.value })}
                    className={`px-3 py-2 rounded-md border text-sm text-left ${
                      form.framework === f.value ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-secondary"
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => createApp.mutate()} disabled={!form.name}>Create App</Button>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
          </div>
        </div>
      )}

      {/* App Gallery */}
      {apps.length === 0 && !showCreate && (
        <div className="text-center py-16 text-muted-foreground">
          <Cpu className="w-12 h-12 mx-auto mb-3 opacity-40" />
          <p>No apps generated yet. Create one to get started.</p>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {apps.map(app => (
          <div key={app.id} className="bg-card border border-border rounded-lg p-4 space-y-3 cursor-pointer hover:border-primary/30 transition-colors" onClick={() => setViewApp(app)}>
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-semibold text-foreground">{app.name}</h3>
                <span className="text-xs text-muted-foreground">{app.framework} &middot; {app.appType}</span>
              </div>
              <span className={`px-2 py-0.5 rounded text-xs ${
                app.status === "generated" ? "bg-emerald-500/10 text-emerald-400" : "bg-yellow-500/10 text-yellow-400"
              }`}>{app.status}</span>
            </div>
            {app.description && <p className="text-sm text-muted-foreground line-clamp-2">{app.description}</p>}
            <div className="flex gap-2">
              {app.status === "draft" && (
                <Button size="sm" variant="outline" className="gap-1" onClick={e => { e.stopPropagation(); generateCode.mutate(app.id); }}>
                  <Sparkles className="w-3 h-3" /> Generate
                </Button>
              )}
              {app.generatedCode && (
                <Button size="sm" variant="outline" className="gap-1" onClick={e => { e.stopPropagation(); downloadCode(app); }}>
                  <Download className="w-3 h-3" /> Download
                </Button>
              )}
              <Button size="sm" variant="ghost" onClick={e => { e.stopPropagation(); deleteApp.mutate(app.id); }}>
                <Trash2 className="w-3 h-3 text-destructive" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      {/* Code Preview Modal */}
      {viewApp && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setViewApp(null)}>
          <div className="bg-card border border-border rounded-lg p-6 max-w-4xl w-full max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-semibold text-lg text-foreground">{viewApp.name}</h3>
                <span className="text-sm text-muted-foreground">{viewApp.framework} &middot; {viewApp.appType}</span>
              </div>
              <div className="flex gap-2">
                {viewApp.status === "draft" && (
                  <Button size="sm" className="gap-1" onClick={() => generateCode.mutate(viewApp.id)}>
                    <Sparkles className="w-3 h-3" /> Generate Code
                  </Button>
                )}
                {viewApp.generatedCode && (
                  <Button size="sm" variant="outline" className="gap-1" onClick={() => downloadCode(viewApp)}>
                    <Download className="w-3 h-3" /> Download
                  </Button>
                )}
              </div>
            </div>
            {viewApp.description && <p className="text-sm text-muted-foreground mb-4">{viewApp.description}</p>}
            {viewApp.generatedCode ? (
              <pre className="bg-background border border-border rounded-lg p-4 text-xs text-foreground overflow-x-auto whitespace-pre-wrap font-mono">
                {viewApp.generatedCode}
              </pre>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <Code className="w-12 h-12 mx-auto mb-3 opacity-40" />
                <p>Click "Generate Code" to create the app.</p>
              </div>
            )}
            <div className="flex justify-end mt-4">
              <Button variant="outline" onClick={() => setViewApp(null)}>Close</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

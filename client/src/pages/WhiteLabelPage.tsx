import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Building2, Plus, Trash2, Eye, Globe, Users, Palette } from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/queryClient";

type WhiteLabelConfig = {
  id: string;
  brandName: string;
  logoUrl: string | null;
  primaryColor: string;
  secondaryColor: string;
  customDomain: string | null;
  features: string | null;
  maxUsers: number;
  status: string;
  createdAt: string;
};

const AVAILABLE_FEATURES = [
  "Dashboard", "Workflows", "Agents", "Marketplace", "Trade Journal",
  "Bot Challenge", "Tools", "Fiverr", "App Generator",
];

export default function WhiteLabelPage() {
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [preview, setPreview] = useState<WhiteLabelConfig | null>(null);
  const [form, setForm] = useState({
    brandName: "", logoUrl: "", primaryColor: "#6366f1", secondaryColor: "#8b5cf6",
    customDomain: "", maxUsers: 10, features: AVAILABLE_FEATURES,
  });

  const { data: configs = [] } = useQuery<WhiteLabelConfig[]>({ queryKey: ["/api/white-label-configs"] });

  const createConfig = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/white-label-configs", {
        ...form,
        features: JSON.stringify(form.features),
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/white-label-configs"] });
      setShowCreate(false);
      setForm({ brandName: "", logoUrl: "", primaryColor: "#6366f1", secondaryColor: "#8b5cf6", customDomain: "", maxUsers: 10, features: AVAILABLE_FEATURES });
    },
  });

  const deleteConfig = useMutation({
    mutationFn: async (id: string) => { await apiRequest("DELETE", `/api/white-label-configs/${id}`); },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/white-label-configs"] }),
  });

  const parseFeatures = (json: string | null): string[] => {
    try { return json ? JSON.parse(json) : []; } catch { return []; }
  };

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Building2 className="w-6 h-6 text-primary" /> White Label
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Create branded instances of the platform for your clients.</p>
        </div>
        <Button onClick={() => setShowCreate(true)} className="gap-1">
          <Plus className="w-4 h-4" /> New Config
        </Button>
      </div>

      {/* Enterprise notice */}
      <div className="bg-gradient-to-r from-primary/10 to-purple-500/10 border border-primary/20 rounded-lg p-4">
        <p className="text-sm text-foreground font-medium">Enterprise Feature</p>
        <p className="text-xs text-muted-foreground mt-1">White-label requires an Enterprise tier subscription. Configs created in draft mode can be activated after upgrade.</p>
      </div>

      {showCreate && (
        <div className="bg-card border border-border rounded-lg p-5 space-y-4">
          <h2 className="font-semibold text-foreground">Configuration Wizard</h2>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm text-muted-foreground">Brand Name</label>
              <input className="w-full mt-1 px-3 py-2 bg-background border border-border rounded-md text-sm text-foreground" placeholder="Your Brand" value={form.brandName} onChange={e => setForm({ ...form, brandName: e.target.value })} />
            </div>
            <div>
              <label className="text-sm text-muted-foreground">Logo URL</label>
              <input className="w-full mt-1 px-3 py-2 bg-background border border-border rounded-md text-sm text-foreground" placeholder="https://..." value={form.logoUrl} onChange={e => setForm({ ...form, logoUrl: e.target.value })} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm text-muted-foreground flex items-center gap-1"><Palette className="w-3 h-3" /> Primary Color</label>
              <div className="flex items-center gap-2 mt-1">
                <input type="color" value={form.primaryColor} onChange={e => setForm({ ...form, primaryColor: e.target.value })} className="w-10 h-10 rounded border border-border cursor-pointer" />
                <input className="flex-1 px-3 py-2 bg-background border border-border rounded-md text-sm text-foreground" value={form.primaryColor} onChange={e => setForm({ ...form, primaryColor: e.target.value })} />
              </div>
            </div>
            <div>
              <label className="text-sm text-muted-foreground flex items-center gap-1"><Palette className="w-3 h-3" /> Secondary Color</label>
              <div className="flex items-center gap-2 mt-1">
                <input type="color" value={form.secondaryColor} onChange={e => setForm({ ...form, secondaryColor: e.target.value })} className="w-10 h-10 rounded border border-border cursor-pointer" />
                <input className="flex-1 px-3 py-2 bg-background border border-border rounded-md text-sm text-foreground" value={form.secondaryColor} onChange={e => setForm({ ...form, secondaryColor: e.target.value })} />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm text-muted-foreground flex items-center gap-1"><Globe className="w-3 h-3" /> Custom Domain</label>
              <input className="w-full mt-1 px-3 py-2 bg-background border border-border rounded-md text-sm text-foreground" placeholder="app.yourbrand.com" value={form.customDomain} onChange={e => setForm({ ...form, customDomain: e.target.value })} />
            </div>
            <div>
              <label className="text-sm text-muted-foreground flex items-center gap-1"><Users className="w-3 h-3" /> Max Users</label>
              <input type="range" min={1} max={100} value={form.maxUsers} onChange={e => setForm({ ...form, maxUsers: Number(e.target.value) })} className="w-full mt-3" />
              <span className="text-xs text-muted-foreground">{form.maxUsers} users</span>
            </div>
          </div>

          <div>
            <label className="text-sm text-muted-foreground">Features to Include</label>
            <div className="flex flex-wrap gap-2 mt-2">
              {AVAILABLE_FEATURES.map(f => (
                <button
                  key={f}
                  onClick={() => {
                    if (form.features.includes(f)) setForm({ ...form, features: form.features.filter(x => x !== f) });
                    else setForm({ ...form, features: [...form.features, f] });
                  }}
                  className={`px-3 py-1 rounded-full text-xs border ${
                    form.features.includes(f) ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground"
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>

          {/* Preview */}
          <div className="bg-background border border-border rounded-lg p-4">
            <p className="text-xs text-muted-foreground mb-2">Preview</p>
            <div className="flex items-center gap-3 p-3 rounded-md" style={{ backgroundColor: form.primaryColor + '15' }}>
              <div className="w-8 h-8 rounded-md flex items-center justify-center text-white font-bold text-sm" style={{ backgroundColor: form.primaryColor }}>
                {(form.brandName || "B")[0].toUpperCase()}
              </div>
              <span className="font-semibold" style={{ color: form.primaryColor }}>{form.brandName || "Your Brand"}</span>
            </div>
          </div>

          <div className="flex gap-2">
            <Button onClick={() => createConfig.mutate()} disabled={!form.brandName}>Create Config</Button>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
          </div>
        </div>
      )}

      {configs.length === 0 && !showCreate && (
        <div className="text-center py-16 text-muted-foreground">
          <Building2 className="w-12 h-12 mx-auto mb-3 opacity-40" />
          <p>No white-label configs. Create one to get started.</p>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {configs.map(config => {
          const features = parseFeatures(config.features);
          return (
            <div key={config.id} className="bg-card border border-border rounded-lg p-4 space-y-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-md flex items-center justify-center text-white font-bold" style={{ backgroundColor: config.primaryColor }}>
                    {config.brandName[0].toUpperCase()}
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground">{config.brandName}</h3>
                    {config.customDomain && <span className="text-xs text-muted-foreground">{config.customDomain}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <span className={`px-2 py-0.5 rounded text-xs ${config.status === 'active' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-yellow-500/10 text-yellow-400'}`}>
                    {config.status}
                  </span>
                  <Button variant="ghost" size="sm" onClick={() => deleteConfig.mutate(config.id)}>
                    <Trash2 className="w-3.5 h-3.5 text-destructive" />
                  </Button>
                </div>
              </div>
              <div className="flex gap-2">
                <div className="w-5 h-5 rounded border border-border" style={{ backgroundColor: config.primaryColor }} title="Primary" />
                <div className="w-5 h-5 rounded border border-border" style={{ backgroundColor: config.secondaryColor }} title="Secondary" />
                <span className="text-xs text-muted-foreground ml-2">{config.maxUsers} max users</span>
              </div>
              {features.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {features.slice(0, 5).map(f => (
                    <span key={f} className="px-2 py-0.5 rounded-full text-[10px] bg-secondary text-muted-foreground">{f}</span>
                  ))}
                  {features.length > 5 && <span className="text-[10px] text-muted-foreground">+{features.length - 5} more</span>}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

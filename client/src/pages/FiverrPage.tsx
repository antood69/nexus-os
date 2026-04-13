import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Briefcase, Plus, Trash2, Eye, Sparkles, DollarSign, Package, CheckCircle,
  ArrowRight, BarChart2, FileText, Image, PenTool, Globe, Search, Zap,
  ChevronRight, Clock, Send,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/queryClient";
import ModelSelector from "@/components/ModelSelector";
import AIChatPanel from "@/components/AIChatPanel";

type FiverrGig = {
  id: string;
  title: string;
  category: string | null;
  description: string | null;
  priceTiers: string | null;
  autoResponse: string | null;
  aiModel: string;
  isActive: number;
  totalOrders: number;
  totalRevenue: number;
};

type FiverrOrder = {
  id: string;
  gigId: string;
  buyerName: string | null;
  requirements: string | null;
  aiDraft: string | null;
  status: string;
  amount: number;
  createdAt: string;
  completedAt: string | null;
};

// Pipeline stages
const STAGES = [
  { key: "intake", label: "Order Intake", icon: Package, color: "text-blue-400 bg-blue-500/10" },
  { key: "generation", label: "AI Generation", icon: Sparkles, color: "text-violet-400 bg-violet-500/10" },
  { key: "quality_check", label: "Quality Check", icon: Eye, color: "text-amber-400 bg-amber-500/10" },
  { key: "delivery", label: "Delivery", icon: Send, color: "text-emerald-400 bg-emerald-500/10" },
  { key: "completed", label: "Completed", icon: CheckCircle, color: "text-green-400 bg-green-500/10" },
];

// Gig templates
const GIG_TEMPLATES = [
  { name: "Logo Design", icon: Image, prompt: "Create a professional logo based on the brand name and style preferences", checklist: ["Color palette", "3 concepts", "Source files", "Revisions"] },
  { name: "Social Media Posts", icon: Globe, prompt: "Design engaging social media posts for the specified platform", checklist: ["Platform sizing", "Brand consistency", "Call-to-action", "Hashtags"] },
  { name: "Blog Writing", icon: PenTool, prompt: "Write an SEO-optimized blog article on the given topic", checklist: ["Keyword research", "H-tag structure", "Meta description", "Internal links"] },
  { name: "Video Editing Brief", icon: FileText, prompt: "Create a detailed video editing brief from raw footage requirements", checklist: ["Scene outline", "Transitions", "Music suggestions", "Color grading notes"] },
  { name: "Website Copy", icon: Globe, prompt: "Write compelling website copy for the specified pages", checklist: ["Hero section", "Features/benefits", "CTA copy", "SEO keywords"] },
  { name: "SEO Optimization", icon: Search, prompt: "Perform an SEO audit and provide optimization recommendations", checklist: ["Meta tags", "Content analysis", "Backlink strategy", "Technical SEO"] },
];

export default function FiverrPage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<"pipeline" | "gigs" | "templates" | "revenue">("pipeline");
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ title: "", category: "", description: "", basicPrice: "25", standardPrice: "50", premiumPrice: "100" });
  const [viewOrder, setViewOrder] = useState<FiverrOrder | null>(null);

  const { data: gigs = [] } = useQuery<FiverrGig[]>({ queryKey: ["/api/fiverr-gigs"] });
  const { data: orders = [] } = useQuery<FiverrOrder[]>({ queryKey: ["/api/fiverr-orders"] });
  const { data: stats } = useQuery<any>({
    queryKey: ["/api/fiverr/stats"],
    queryFn: async () => { const res = await apiRequest("GET", "/api/fiverr/stats"); return res.json(); },
  });

  const createGig = useMutation({
    mutationFn: async () => {
      const priceTiers = JSON.stringify({ basic: Number(form.basicPrice), standard: Number(form.standardPrice), premium: Number(form.premiumPrice) });
      await apiRequest("POST", "/api/fiverr-gigs", { title: form.title, category: form.category, description: form.description, priceTiers });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/fiverr-gigs"] });
      setShowCreate(false);
      setForm({ title: "", category: "", description: "", basicPrice: "25", standardPrice: "50", premiumPrice: "100" });
    },
  });

  const deleteGig = useMutation({
    mutationFn: async (id: string) => { await apiRequest("DELETE", `/api/fiverr-gigs/${id}`); },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/fiverr-gigs"] }),
  });

  const advanceOrder = useMutation({
    mutationFn: async ({ id, stage }: { id: string; stage: string }) => {
      const res = await apiRequest("POST", `/api/fiverr-orders/${id}/advance`, { stage });
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/fiverr-orders"] });
      qc.invalidateQueries({ queryKey: ["/api/fiverr/stats"] });
    },
  });

  const generateDraft = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("POST", `/api/fiverr-orders/${id}/generate`);
      return res.json();
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["/api/fiverr-orders"] });
      setViewOrder(data);
    },
  });

  // Categorize orders by pipeline stage
  const ordersByStage: Record<string, FiverrOrder[]> = {};
  STAGES.forEach(s => { ordersByStage[s.key] = []; });
  orders.forEach(o => {
    const stage = o.status || "intake";
    // Map old statuses
    const mapped = stage === "pending" ? "intake" : stage === "draft_ready" ? "quality_check" : stage;
    if (ordersByStage[mapped]) ordersByStage[mapped].push(o);
    else if (ordersByStage.intake) ordersByStage.intake.push(o);
  });

  const parseTiers = (json: string | null) => {
    try { return json ? JSON.parse(json) : {}; } catch { return {}; }
  };

  const createFromTemplate = (tmpl: typeof GIG_TEMPLATES[0]) => {
    setForm({ title: tmpl.name, category: tmpl.name.toLowerCase().replace(/\s+/g, "-"), description: tmpl.prompt, basicPrice: "25", standardPrice: "50", premiumPrice: "100" });
    setShowCreate(true);
    setTab("gigs");
  };

  const getNextStage = (current: string) => {
    const idx = STAGES.findIndex(s => s.key === current);
    if (idx >= 0 && idx < STAGES.length - 1) return STAGES[idx + 1].key;
    return null;
  };

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Briefcase className="w-6 h-6 text-primary" /> Fiverr Automation
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Manage gigs, pipeline orders, auto-generate deliverables.</p>
        </div>
        <ModelSelector />
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-card border border-border rounded-lg p-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground"><Package className="w-3.5 h-3.5" /> Total Orders</div>
          <p className="text-xl font-bold text-foreground mt-1">{stats?.totalOrders ?? orders.length}</p>
        </div>
        <div className="bg-card border border-border rounded-lg p-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground"><DollarSign className="w-3.5 h-3.5" /> Revenue</div>
          <p className="text-xl font-bold text-emerald-400 mt-1">${(stats?.totalRevenue ?? 0).toFixed(2)}</p>
        </div>
        <div className="bg-card border border-border rounded-lg p-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground"><BarChart2 className="w-3.5 h-3.5" /> Avg Order</div>
          <p className="text-xl font-bold text-foreground mt-1">${(stats?.avgOrderValue ?? 0).toFixed(2)}</p>
        </div>
        <div className="bg-card border border-border rounded-lg p-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground"><CheckCircle className="w-3.5 h-3.5" /> Completed</div>
          <p className="text-xl font-bold text-foreground mt-1">{stats?.completedOrders ?? 0}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border">
        {(["pipeline", "gigs", "templates", "revenue"] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors capitalize ${
              tab === t ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Pipeline View (Kanban) */}
      {tab === "pipeline" && (
        <div className="flex gap-3 overflow-x-auto pb-4">
          {STAGES.map(stage => {
            const stageOrders = ordersByStage[stage.key] || [];
            const Icon = stage.icon;
            return (
              <div key={stage.key} className="flex-shrink-0 w-64 bg-card/50 border border-border rounded-lg">
                <div className="p-3 border-b border-border flex items-center gap-2">
                  <div className={`p-1 rounded ${stage.color}`}>
                    <Icon className="w-3.5 h-3.5" />
                  </div>
                  <span className="text-sm font-medium">{stage.label}</span>
                  <span className="ml-auto text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{stageOrders.length}</span>
                </div>
                <div className="p-2 space-y-2 min-h-[200px]">
                  {stageOrders.map(order => (
                    <div key={order.id} className="bg-card border border-border rounded-lg p-3 space-y-2">
                      <div className="flex items-start justify-between">
                        <span className="text-sm font-medium text-foreground">{order.buyerName || "Client"}</span>
                        <span className="text-xs text-emerald-400 font-medium">${(order.amount || 0).toFixed(0)}</span>
                      </div>
                      {order.requirements && (
                        <p className="text-xs text-muted-foreground line-clamp-2">{order.requirements}</p>
                      )}
                      <div className="flex items-center gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 text-[10px] px-2"
                          onClick={() => setViewOrder(order)}
                        >
                          <Eye className="w-3 h-3 mr-0.5" /> View
                        </Button>
                        {getNextStage(stage.key) && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-6 text-[10px] px-2"
                            onClick={() => advanceOrder.mutate({ id: order.id, stage: getNextStage(stage.key)! })}
                            disabled={advanceOrder.isPending}
                          >
                            <ArrowRight className="w-3 h-3 mr-0.5" />
                            {stage.key === "intake" ? "Generate" : stage.key === "quality_check" ? "Deliver" : "Next"}
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                  {stageOrders.length === 0 && (
                    <div className="text-center py-6 text-xs text-muted-foreground">No orders</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Gigs Tab */}
      {tab === "gigs" && (
        <div className="space-y-4">
          <Button onClick={() => setShowCreate(true)} className="gap-1"><Plus className="w-4 h-4" /> Create Gig</Button>

          {showCreate && (
            <div className="bg-card border border-border rounded-lg p-5 space-y-3">
              <h3 className="font-semibold text-foreground">New Gig</h3>
              <input className="w-full px-3 py-2 bg-background border border-border rounded-md text-sm text-foreground" placeholder="Gig title" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
              <input className="w-full px-3 py-2 bg-background border border-border rounded-md text-sm text-foreground" placeholder="Category" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} />
              <textarea className="w-full px-3 py-2 bg-background border border-border rounded-md text-sm text-foreground min-h-[80px]" placeholder="Description" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
              <div className="grid grid-cols-3 gap-3">
                <div><label className="text-xs text-muted-foreground">Basic ($)</label><input type="number" className="w-full mt-1 px-3 py-2 bg-background border border-border rounded-md text-sm text-foreground" value={form.basicPrice} onChange={e => setForm({ ...form, basicPrice: e.target.value })} /></div>
                <div><label className="text-xs text-muted-foreground">Standard ($)</label><input type="number" className="w-full mt-1 px-3 py-2 bg-background border border-border rounded-md text-sm text-foreground" value={form.standardPrice} onChange={e => setForm({ ...form, standardPrice: e.target.value })} /></div>
                <div><label className="text-xs text-muted-foreground">Premium ($)</label><input type="number" className="w-full mt-1 px-3 py-2 bg-background border border-border rounded-md text-sm text-foreground" value={form.premiumPrice} onChange={e => setForm({ ...form, premiumPrice: e.target.value })} /></div>
              </div>
              <div className="flex gap-2">
                <Button onClick={() => createGig.mutate()} disabled={!form.title}>Create</Button>
                <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
              </div>
            </div>
          )}

          {gigs.length === 0 && !showCreate && (
            <div className="text-center py-16 text-muted-foreground">
              <Briefcase className="w-12 h-12 mx-auto mb-3 opacity-40" />
              <p>No gigs yet. Create one or use a template.</p>
            </div>
          )}

          <div className="grid gap-4 md:grid-cols-2">
            {gigs.map(gig => {
              const tiers = parseTiers(gig.priceTiers);
              return (
                <div key={gig.id} className="bg-card border border-border rounded-lg p-4 space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-semibold text-foreground">{gig.title}</h3>
                      {gig.category && <span className="text-xs text-muted-foreground">{gig.category}</span>}
                    </div>
                    <div className="flex items-center gap-1">
                      <span className={`px-2 py-0.5 rounded text-xs ${gig.isActive ? 'bg-emerald-500/10 text-emerald-400' : 'bg-zinc-500/10 text-zinc-400'}`}>
                        {gig.isActive ? 'Active' : 'Paused'}
                      </span>
                      <Button variant="ghost" size="sm" onClick={() => deleteGig.mutate(gig.id)}>
                        <Trash2 className="w-3.5 h-3.5 text-destructive" />
                      </Button>
                    </div>
                  </div>
                  {gig.description && <p className="text-sm text-muted-foreground line-clamp-2">{gig.description}</p>}
                  <div className="flex gap-3 text-xs text-muted-foreground">
                    {tiers.basic && <span>Basic: ${tiers.basic}</span>}
                    {tiers.standard && <span>Standard: ${tiers.standard}</span>}
                    {tiers.premium && <span>Premium: ${tiers.premium}</span>}
                  </div>
                  <div className="flex gap-4 text-xs text-muted-foreground pt-2 border-t border-border">
                    <span>{gig.totalOrders} orders</span>
                    <span>${gig.totalRevenue.toFixed(2)} revenue</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Templates Tab */}
      {tab === "templates" && (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">Pre-built gig templates with AI prompts, quality checklists, and delivery formats.</p>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {GIG_TEMPLATES.map(tmpl => {
              const Icon = tmpl.icon;
              return (
                <div key={tmpl.name} className="bg-card border border-border rounded-lg p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-md bg-primary/10">
                      <Icon className="w-4 h-4 text-primary" />
                    </div>
                    <h3 className="font-semibold text-foreground text-sm">{tmpl.name}</h3>
                  </div>
                  <p className="text-xs text-muted-foreground">{tmpl.prompt}</p>
                  <div>
                    <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Quality Checklist</span>
                    <div className="mt-1 space-y-1">
                      {tmpl.checklist.map(item => (
                        <div key={item} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <CheckCircle className="w-3 h-3 text-emerald-400" />
                          {item}
                        </div>
                      ))}
                    </div>
                  </div>
                  <Button size="sm" variant="outline" className="w-full text-xs" onClick={() => createFromTemplate(tmpl)}>
                    <Plus className="w-3 h-3 mr-1" /> Use Template
                  </Button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Revenue Dashboard */}
      {tab === "revenue" && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-card border border-border rounded-lg p-5">
              <h3 className="text-sm font-semibold text-foreground mb-3">Revenue Overview</h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Total Revenue</span>
                  <span className="text-lg font-bold text-emerald-400">${(stats?.totalRevenue ?? 0).toFixed(2)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Completed Orders</span>
                  <span className="text-sm font-medium">{stats?.completedOrders ?? 0}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Average Order Value</span>
                  <span className="text-sm font-medium">${(stats?.avgOrderValue ?? 0).toFixed(2)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Total Orders</span>
                  <span className="text-sm font-medium">{stats?.totalOrders ?? 0}</span>
                </div>
              </div>
            </div>

            <div className="bg-card border border-border rounded-lg p-5">
              <h3 className="text-sm font-semibold text-foreground mb-3">Orders by Status</h3>
              <div className="space-y-2">
                {stats?.byStatus && Object.entries(stats.byStatus).map(([status, count]: [string, any]) => {
                  const stage = STAGES.find(s => s.key === status);
                  return (
                    <div key={status} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${stage ? stage.color.split(" ")[1] : "bg-muted"}`} />
                        <span className="text-sm text-muted-foreground capitalize">{status.replace(/_/g, " ")}</span>
                      </div>
                      <span className="text-sm font-medium">{count}</span>
                    </div>
                  );
                })}
                {(!stats?.byStatus || Object.keys(stats.byStatus).length === 0) && (
                  <p className="text-sm text-muted-foreground">No order data yet</p>
                )}
              </div>
            </div>
          </div>

          {/* Revenue by gig */}
          <div className="bg-card border border-border rounded-lg p-5">
            <h3 className="text-sm font-semibold text-foreground mb-3">Revenue by Gig</h3>
            {gigs.length === 0 ? (
              <p className="text-sm text-muted-foreground">No gigs created yet</p>
            ) : (
              <div className="space-y-2">
                {gigs.sort((a, b) => b.totalRevenue - a.totalRevenue).map(gig => {
                  const maxRevenue = Math.max(...gigs.map(g => g.totalRevenue), 1);
                  const pct = (gig.totalRevenue / maxRevenue) * 100;
                  return (
                    <div key={gig.id}>
                      <div className="flex items-center justify-between text-sm mb-1">
                        <span className="text-foreground">{gig.title}</span>
                        <span className="text-emerald-400 font-medium">${gig.totalRevenue.toFixed(2)}</span>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div className="h-full bg-emerald-500/60 rounded-full transition-all" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Order detail modal */}
      {viewOrder && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setViewOrder(null)}>
          <div className="bg-card border border-border rounded-lg p-6 max-w-2xl w-full max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <h3 className="font-semibold text-lg text-foreground mb-3">Order Detail</h3>
            <div className="space-y-3 text-sm">
              <div><span className="text-muted-foreground">Buyer:</span> <span className="text-foreground">{viewOrder.buyerName || 'Anonymous'}</span></div>
              <div><span className="text-muted-foreground">Status:</span> <span className="text-foreground">{viewOrder.status}</span></div>
              <div><span className="text-muted-foreground">Amount:</span> <span className="text-foreground">${(viewOrder.amount || 0).toFixed(2)}</span></div>
              {viewOrder.requirements && (
                <div>
                  <span className="text-muted-foreground">Requirements:</span>
                  <p className="text-foreground mt-1 bg-background p-3 rounded-md">{viewOrder.requirements}</p>
                </div>
              )}
              {viewOrder.aiDraft && (
                <div>
                  <span className="text-muted-foreground">AI Draft:</span>
                  <pre className="text-foreground mt-1 bg-background p-3 rounded-md whitespace-pre-wrap text-xs">{viewOrder.aiDraft}</pre>
                </div>
              )}
            </div>
            <div className="flex justify-end gap-2 mt-4">
              {viewOrder.status !== "completed" && viewOrder.status !== "delivered" && (
                <Button
                  size="sm"
                  onClick={() => {
                    const next = getNextStage(viewOrder.status === "pending" ? "intake" : viewOrder.status === "draft_ready" ? "quality_check" : viewOrder.status);
                    if (next) advanceOrder.mutate({ id: viewOrder.id, stage: next });
                    setViewOrder(null);
                  }}
                >
                  <ArrowRight className="w-4 h-4 mr-1" /> Advance
                </Button>
              )}
              <Button variant="outline" onClick={() => setViewOrder(null)}>Close</Button>
            </div>
          </div>
        </div>
      )}

      <AIChatPanel
        systemPrompt="You are an expert freelance service consultant. Help the user design their gig offering. Ask about their skills, target market, pricing, and deliverables. Suggest gig titles, descriptions, and package tiers."
        placeholder="Describe your gig idea..."
        pageContext="fiverr"
      />
    </div>
  );
}

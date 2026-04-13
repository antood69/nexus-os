import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Briefcase, Plus, Trash2, Eye, Sparkles, DollarSign, Package, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/queryClient";
import ModelSelector from "@/components/ModelSelector";

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

export default function FiverrPage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<"gigs" | "orders">("gigs");
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ title: "", category: "", description: "", basicPrice: "25", standardPrice: "50", premiumPrice: "100" });
  const [viewOrder, setViewOrder] = useState<FiverrOrder | null>(null);

  const { data: gigs = [] } = useQuery<FiverrGig[]>({ queryKey: ["/api/fiverr-gigs"] });
  const { data: orders = [] } = useQuery<FiverrOrder[]>({ queryKey: ["/api/fiverr-orders"] });

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

  const totalRevenue = gigs.reduce((s, g) => s + g.totalRevenue, 0);
  const totalOrders = gigs.reduce((s, g) => s + g.totalOrders, 0);
  const pendingOrders = orders.filter(o => o.status === "pending").length;

  const parseTiers = (json: string | null) => {
    try { return json ? JSON.parse(json) : {}; } catch { return {}; }
  };

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Briefcase className="w-6 h-6 text-primary" /> Fiverr Automation
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Manage gigs, auto-generate deliverables with AI.</p>
        </div>
        <ModelSelector />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-card border border-border rounded-lg p-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground"><Package className="w-4 h-4" /> Total Orders</div>
          <p className="text-2xl font-bold text-foreground mt-1">{totalOrders}</p>
        </div>
        <div className="bg-card border border-border rounded-lg p-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground"><DollarSign className="w-4 h-4" /> Revenue</div>
          <p className="text-2xl font-bold text-emerald-400 mt-1">${totalRevenue.toFixed(2)}</p>
        </div>
        <div className="bg-card border border-border rounded-lg p-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground"><Sparkles className="w-4 h-4" /> Pending</div>
          <p className="text-2xl font-bold text-yellow-400 mt-1">{pendingOrders}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-border">
        {(["gigs", "orders"] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              tab === t ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {t === "gigs" ? "My Gigs" : "Orders"}
          </button>
        ))}
      </div>

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
              <p>No gigs yet. Create one to start automating.</p>
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

      {tab === "orders" && (
        <div className="space-y-4">
          {orders.length === 0 && (
            <div className="text-center py-16 text-muted-foreground">
              <Package className="w-12 h-12 mx-auto mb-3 opacity-40" />
              <p>No orders yet.</p>
            </div>
          )}
          {orders.map(order => (
            <div key={order.id} className="bg-card border border-border rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-medium text-foreground">{order.buyerName || 'Anonymous'}</span>
                  <span className={`ml-2 px-2 py-0.5 rounded text-xs ${
                    order.status === 'pending' ? 'bg-yellow-500/10 text-yellow-400' :
                    order.status === 'draft_ready' ? 'bg-blue-500/10 text-blue-400' :
                    order.status === 'completed' ? 'bg-emerald-500/10 text-emerald-400' :
                    'bg-zinc-500/10 text-zinc-400'
                  }`}>{order.status}</span>
                </div>
                <div className="flex gap-2">
                  <span className="text-sm font-medium text-foreground">${order.amount.toFixed(2)}</span>
                  {order.status === 'pending' && (
                    <Button size="sm" variant="outline" className="gap-1" onClick={() => generateDraft.mutate(order.id)}>
                      <Sparkles className="w-3 h-3" /> Generate
                    </Button>
                  )}
                  <Button size="sm" variant="ghost" onClick={() => setViewOrder(order)}>
                    <Eye className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
              {order.requirements && <p className="text-sm text-muted-foreground mt-2 line-clamp-2">{order.requirements}</p>}
            </div>
          ))}
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
              <div><span className="text-muted-foreground">Amount:</span> <span className="text-foreground">${viewOrder.amount.toFixed(2)}</span></div>
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
            <div className="flex justify-end mt-4">
              <Button variant="outline" onClick={() => setViewOrder(null)}>Close</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

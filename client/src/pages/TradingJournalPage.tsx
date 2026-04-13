import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, TrendingUp, TrendingDown, BarChart2, Sparkles, ChevronDown, ChevronUp, X } from "lucide-react";
import { Button } from "@/components/ui/button";

type TradeEntry = {
  id: number;
  firm: string;
  instrument: string;
  direction: string;
  entryPrice: string;
  exitPrice?: string;
  pnl?: string;
  riskReward?: string;
  entryReason?: string;
  aiAnalysis?: string;
  tags?: string;
  status: string;
  openedAt: string;
  closedAt?: string;
  createdAt: string;
};

const FIRMS = ["Apex", "Topstep", "FTMO", "TradeDay", "MyFundedFutures", "E8 Markets", "FundingPips", "Other"];

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="bg-card border border-border rounded-xl px-5 py-4">
      <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">{label}</p>
      <p className="text-2xl font-bold text-foreground mt-1">{value}</p>
      {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  );
}

function DirectionBadge({ direction }: { direction: string }) {
  const isLong = direction === "long";
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
        isLong ? "bg-emerald-500/15 text-emerald-400" : "bg-rose-500/15 text-rose-400"
      }`}
    >
      {isLong ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
      {isLong ? "Long" : "Short"}
    </span>
  );
}

function FirmBadge({ firm }: { firm: string }) {
  return (
    <span className="inline-flex px-2 py-0.5 rounded-md bg-indigo-500/15 text-indigo-400 text-xs font-medium">
      {firm}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const isOpen = status === "open";
  return (
    <span
      className={`inline-flex px-2 py-0.5 rounded-md text-xs font-medium ${
        isOpen ? "bg-amber-500/15 text-amber-400" : "bg-secondary text-muted-foreground"
      }`}
    >
      {status}
    </span>
  );
}

function AddTradeForm({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    firm: "Apex",
    instrument: "",
    direction: "long",
    entryPrice: "",
    exitPrice: "",
    entryReason: "",
    tags: "",
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof form) => {
      const res = await fetch("/api/trade-journal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...data,
          exitPrice: data.exitPrice || undefined,
          status: data.exitPrice ? "closed" : "open",
          openedAt: new Date().toISOString(),
          closedAt: data.exitPrice ? new Date().toISOString() : undefined,
        }),
      });
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/trade-journal"] });
      onClose();
    },
  });

  const set = (k: string, v: string) => setForm((p) => ({ ...p, [k]: v }));

  return (
    <div className="bg-card border border-border rounded-xl p-6 mb-6">
      <div className="flex items-center justify-between mb-5">
        <h3 className="font-semibold text-foreground">Log New Trade</h3>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
          <X className="w-4 h-4" />
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* Firm */}
        <div>
          <label className="text-xs text-muted-foreground font-medium block mb-1.5">Firm</label>
          <select
            className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground outline-none focus:border-primary/60"
            value={form.firm}
            onChange={(e) => set("firm", e.target.value)}
          >
            {FIRMS.map((f) => (
              <option key={f} value={f}>{f}</option>
            ))}
          </select>
        </div>

        {/* Instrument */}
        <div>
          <label className="text-xs text-muted-foreground font-medium block mb-1.5">Instrument</label>
          <input
            type="text"
            placeholder="ES, NQ, EUR/USD..."
            className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/60"
            value={form.instrument}
            onChange={(e) => set("instrument", e.target.value)}
          />
        </div>

        {/* Direction */}
        <div>
          <label className="text-xs text-muted-foreground font-medium block mb-1.5">Direction</label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => set("direction", "long")}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors border ${
                form.direction === "long"
                  ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-400"
                  : "bg-background border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              Long
            </button>
            <button
              type="button"
              onClick={() => set("direction", "short")}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors border ${
                form.direction === "short"
                  ? "bg-rose-500/20 border-rose-500/40 text-rose-400"
                  : "bg-background border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              Short
            </button>
          </div>
        </div>

        {/* Entry Price */}
        <div>
          <label className="text-xs text-muted-foreground font-medium block mb-1.5">Entry Price</label>
          <input
            type="text"
            placeholder="4500.25"
            className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/60"
            value={form.entryPrice}
            onChange={(e) => set("entryPrice", e.target.value)}
          />
        </div>

        {/* Exit Price */}
        <div>
          <label className="text-xs text-muted-foreground font-medium block mb-1.5">Exit Price <span className="text-muted-foreground/60">(optional)</span></label>
          <input
            type="text"
            placeholder="4510.00"
            className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/60"
            value={form.exitPrice}
            onChange={(e) => set("exitPrice", e.target.value)}
          />
        </div>

        {/* Tags */}
        <div>
          <label className="text-xs text-muted-foreground font-medium block mb-1.5">Tags <span className="text-muted-foreground/60">(comma-separated)</span></label>
          <input
            type="text"
            placeholder="breakout, VWAP, morning-session"
            className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/60"
            value={form.tags}
            onChange={(e) => set("tags", e.target.value)}
          />
        </div>

        {/* Entry Reason */}
        <div className="col-span-2">
          <label className="text-xs text-muted-foreground font-medium block mb-1.5">Entry Reason / Notes</label>
          <textarea
            rows={3}
            placeholder="Describe your setup, confluence, and reasoning..."
            className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/60 resize-none"
            value={form.entryReason}
            onChange={(e) => set("entryReason", e.target.value)}
          />
        </div>
      </div>

      <div className="flex justify-end gap-3 mt-4">
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button
          className="bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-600 hover:to-violet-700 text-foreground"
          onClick={() => createMutation.mutate(form)}
          disabled={!form.instrument || !form.entryPrice || createMutation.isPending}
        >
          {createMutation.isPending ? "Saving..." : "Log Trade"}
        </Button>
      </div>
    </div>
  );
}

export default function TradingJournalPage() {
  const [showForm, setShowForm] = useState(false);
  const { data: trades = [], isLoading } = useQuery<TradeEntry[]>({
    queryKey: ["/api/trade-journal"],
    queryFn: () => fetch("/api/trade-journal").then((r) => r.json()),
  });

  // Computed stats
  const closedTrades = trades.filter((t) => t.status === "closed" && t.pnl);
  const totalPnl = closedTrades.reduce((sum, t) => sum + parseFloat(t.pnl || "0"), 0);
  const winningTrades = closedTrades.filter((t) => parseFloat(t.pnl || "0") > 0);
  const winRate = closedTrades.length > 0 ? ((winningTrades.length / closedTrades.length) * 100).toFixed(1) : "0";
  const avgRR = closedTrades.length > 0
    ? (closedTrades.reduce((sum, t) => sum + parseFloat(t.riskReward || "0"), 0) / closedTrades.length).toFixed(2)
    : "N/A";

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Trading Journal</h1>
          <p className="text-sm text-muted-foreground mt-0.5">AI-Powered Post-Trade Analysis</p>
        </div>
        <Button
          onClick={() => setShowForm((p) => !p)}
          className="bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-600 hover:to-violet-700 text-foreground"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Trade
        </Button>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <StatCard label="Total Trades" value={trades.length} />
        <StatCard label="Win Rate" value={`${winRate}%`} sub={`${winningTrades.length} / ${closedTrades.length} closed`} />
        <StatCard
          label="Total P&L"
          value={`${totalPnl >= 0 ? "+" : ""}${totalPnl.toFixed(2)}`}
          sub="closed trades"
        />
        <StatCard label="Avg R:R" value={avgRR} sub="closed trades" />
      </div>

      {/* Add Trade Form */}
      {showForm && <AddTradeForm onClose={() => setShowForm(false)} />}

      {/* Trade List */}
      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground text-sm">Loading trades...</div>
      ) : trades.length === 0 ? (
        <div className="text-center py-16 border border-dashed border-border rounded-xl">
          <BarChart2 className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-muted-foreground font-medium">No trades logged yet</p>
          <p className="text-xs text-muted-foreground/60 mt-1">Click "Add Trade" to start tracking your performance</p>
        </div>
      ) : (
        <div className="space-y-3">
          {trades.map((trade) => (
            <TradeRow key={trade.id} trade={trade} />
          ))}
        </div>
      )}
    </div>
  );
}

function TradeRow({ trade }: { trade: TradeEntry }) {
  const [expanded, setExpanded] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<string | null>(trade.aiAnalysis || null);

  const pnlNum = parseFloat(trade.pnl || "0");
  const pnlPositive = pnlNum > 0;

  const runAnalysis = async () => {
    setAnalyzing(true);
    // Placeholder — real endpoint to be wired when Claude credits are available
    await new Promise((r) => setTimeout(r, 1000));
    setAnalysisResult("AI analysis will run when Claude API credits are available.");
    setAnalyzing(false);
  };

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="flex items-center gap-4 px-5 py-4">
        <FirmBadge firm={trade.firm} />
        <span className="font-semibold text-foreground text-sm">{trade.instrument}</span>
        <DirectionBadge direction={trade.direction} />

        <div className="flex-1 flex items-center gap-6 text-sm text-muted-foreground">
          <span>Entry: <span className="text-foreground font-medium">{trade.entryPrice}</span></span>
          {trade.exitPrice && (
            <span>Exit: <span className="text-foreground font-medium">{trade.exitPrice}</span></span>
          )}
          {trade.pnl && (
            <span className={`font-semibold ${pnlPositive ? "text-emerald-400" : "text-rose-400"}`}>
              {pnlPositive ? "+" : ""}{trade.pnl}
            </span>
          )}
        </div>

        <StatusBadge status={trade.status} />

        <button
          onClick={runAnalysis}
          disabled={analyzing}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/20 transition-colors"
        >
          <Sparkles className="w-3.5 h-3.5" />
          {analyzing ? "Analyzing..." : "AI Analysis"}
        </button>

        <button
          onClick={() => setExpanded((p) => !p)}
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
      </div>

      {expanded && (
        <div className="px-5 pb-4 pt-0 border-t border-border space-y-3">
          {trade.entryReason && (
            <div>
              <p className="text-xs text-muted-foreground font-medium mb-1">Entry Reason</p>
              <p className="text-sm text-foreground">{trade.entryReason}</p>
            </div>
          )}
          {analysisResult && (
            <div className="bg-indigo-500/5 border border-indigo-500/20 rounded-lg p-3">
              <div className="flex items-center gap-1.5 mb-1.5">
                <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                <p className="text-xs text-indigo-400 font-medium">AI Analysis</p>
              </div>
              <p className="text-sm text-foreground">{analysisResult}</p>
            </div>
          )}
          {trade.tags && (
            <div className="flex flex-wrap gap-1.5">
              {trade.tags.split(",").map((tag) => (
                <span key={tag} className="px-2 py-0.5 bg-secondary text-muted-foreground text-xs rounded-md">
                  {tag.trim()}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

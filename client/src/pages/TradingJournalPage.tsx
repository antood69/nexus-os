import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Plus,
  TrendingUp,
  TrendingDown,
  BarChart2,
  ChevronDown,
  ChevronUp,
  X,
  Trash2,
  Edit2,
  CheckCircle,
  Upload,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

// ── Types ──────────────────────────────────────────────────────────────────────
type Trade = {
  id: string;
  userId: number;
  symbol: string;
  direction: string;
  entryPrice: number;
  exitPrice: number | null;
  quantity: number;
  entryTime: string;
  exitTime: string | null;
  grossPnl: number | null;
  fees: number;
  netPnl: number | null;
  strategyTag: string | null;
  notes: string | null;
  screenshotUrl: string | null;
  importSource: string;
  createdAt: string;
};

type TradingStats = {
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  avgWin: number;
  avgLoss: number;
  profitFactor: number;
  grossPnl: number;
  netPnl: number;
  bestTrade: number;
  worstTrade: number;
  avgRR: number;
  currentWinStreak: number;
  currentLossStreak: number;
  bestWinStreak: number;
};

// ── Helpers ────────────────────────────────────────────────────────────────────
const fmt = (n: number | null | undefined, prefix = true): string => {
  if (n == null) return "—";
  const s = Math.abs(n).toFixed(2);
  if (!prefix) return s;
  return n >= 0 ? `+$${s}` : `-$${s}`;
};

const fmtPct = (n: number) => `${n.toFixed(1)}%`;
const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

// ── Sub-components ─────────────────────────────────────────────────────────────
function StatCard({
  label,
  value,
  sub,
  color,
}: {
  label: string;
  value: string | number;
  sub?: string;
  color?: "green" | "red" | "neutral";
}) {
  const valueColor =
    color === "green"
      ? "text-emerald-400"
      : color === "red"
      ? "text-rose-400"
      : "text-foreground";
  return (
    <div className="bg-card border border-border rounded-xl px-5 py-4">
      <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">{label}</p>
      <p className={`text-2xl font-bold mt-1 ${valueColor}`}>{value}</p>
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

// ── Close Trade Modal ──────────────────────────────────────────────────────────
function CloseTradeModal({
  trade,
  onClose,
}: {
  trade: Trade;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [exitPrice, setExitPrice] = useState("");
  const [fees, setFees] = useState("");

  const mutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/trades/${trade.id}/close`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          exitPrice: parseFloat(exitPrice),
          exitTime: new Date().toISOString(),
          fees: parseFloat(fees) || 0,
        }),
      });
      if (!res.ok) throw new Error("Failed to close trade");
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/trades"] });
      qc.invalidateQueries({ queryKey: ["/api/trades/stats"] });
      qc.invalidateQueries({ queryKey: ["/api/trades/equity-curve"] });
      onClose();
    },
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-card border border-border rounded-xl p-6 w-full max-w-sm shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-foreground">Close {trade.symbol}</h3>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-muted-foreground font-medium block mb-1.5">Exit Price</label>
            <input
              type="number"
              step="0.01"
              placeholder="Exit price"
              className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/60"
              value={exitPrice}
              onChange={(e) => setExitPrice(e.target.value)}
              autoFocus
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground font-medium block mb-1.5">
              Fees <span className="text-muted-foreground/60">(optional)</span>
            </label>
            <input
              type="number"
              step="0.01"
              placeholder="0.00"
              className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/60"
              value={fees}
              onChange={(e) => setFees(e.target.value)}
            />
          </div>
        </div>
        <div className="flex justify-end gap-3 mt-5">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            className="bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-600 hover:to-violet-700 text-white"
            onClick={() => mutation.mutate()}
            disabled={!exitPrice || mutation.isPending}
          >
            {mutation.isPending ? "Closing..." : "Close Trade"}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Add/Edit Trade Form ────────────────────────────────────────────────────────
type TradeFormData = {
  symbol: string;
  direction: string;
  entryPrice: string;
  exitPrice: string;
  quantity: string;
  fees: string;
  entryTime: string;
  strategyTag: string;
  notes: string;
};

function TradeForm({
  initial,
  tradeId,
  onClose,
}: {
  initial?: Partial<TradeFormData>;
  tradeId?: string;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const isEdit = !!tradeId;
  const [form, setForm] = useState<TradeFormData>({
    symbol: initial?.symbol ?? "",
    direction: initial?.direction ?? "long",
    entryPrice: initial?.entryPrice ?? "",
    exitPrice: initial?.exitPrice ?? "",
    quantity: initial?.quantity ?? "1",
    fees: initial?.fees ?? "0",
    entryTime: initial?.entryTime ?? new Date().toISOString().slice(0, 16),
    strategyTag: initial?.strategyTag ?? "",
    notes: initial?.notes ?? "",
  });

  const set = (k: keyof TradeFormData, v: string) => setForm((p) => ({ ...p, [k]: v }));

  const mutation = useMutation({
    mutationFn: async (data: TradeFormData) => {
      const payload = {
        symbol: data.symbol.toUpperCase().trim(),
        direction: data.direction,
        entryPrice: parseFloat(data.entryPrice),
        exitPrice: data.exitPrice ? parseFloat(data.exitPrice) : null,
        quantity: parseFloat(data.quantity) || 1,
        fees: parseFloat(data.fees) || 0,
        entryTime: new Date(data.entryTime).toISOString(),
        strategyTag: data.strategyTag || null,
        notes: data.notes || null,
      };
      const url = isEdit ? `/api/trades/${tradeId}` : "/api/trades";
      const method = isEdit ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Failed to save trade");
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/trades"] });
      qc.invalidateQueries({ queryKey: ["/api/trades/stats"] });
      qc.invalidateQueries({ queryKey: ["/api/trades/equity-curve"] });
      onClose();
    },
  });

  return (
    <div className="bg-card border border-border rounded-xl p-6 mb-6">
      <div className="flex items-center justify-between mb-5">
        <h3 className="font-semibold text-foreground">{isEdit ? "Edit Trade" : "Log New Trade"}</h3>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
          <X className="w-4 h-4" />
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* Symbol */}
        <div>
          <label className="text-xs text-muted-foreground font-medium block mb-1.5">Symbol</label>
          <input
            type="text"
            placeholder="ES, NQ, AAPL..."
            className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/60 uppercase"
            value={form.symbol}
            onChange={(e) => set("symbol", e.target.value)}
          />
        </div>

        {/* Strategy Tag */}
        <div>
          <label className="text-xs text-muted-foreground font-medium block mb-1.5">
            Strategy Tag <span className="text-muted-foreground/60">(optional)</span>
          </label>
          <input
            type="text"
            placeholder="breakout, VWAP..."
            className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/60"
            value={form.strategyTag}
            onChange={(e) => set("strategyTag", e.target.value)}
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

        {/* Entry Time */}
        <div>
          <label className="text-xs text-muted-foreground font-medium block mb-1.5">Entry Time</label>
          <input
            type="datetime-local"
            className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground outline-none focus:border-primary/60"
            value={form.entryTime}
            onChange={(e) => set("entryTime", e.target.value)}
          />
        </div>

        {/* Entry Price */}
        <div>
          <label className="text-xs text-muted-foreground font-medium block mb-1.5">Entry Price</label>
          <input
            type="number"
            step="0.01"
            placeholder="4500.25"
            className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/60"
            value={form.entryPrice}
            onChange={(e) => set("entryPrice", e.target.value)}
          />
        </div>

        {/* Exit Price */}
        <div>
          <label className="text-xs text-muted-foreground font-medium block mb-1.5">
            Exit Price <span className="text-muted-foreground/60">(optional)</span>
          </label>
          <input
            type="number"
            step="0.01"
            placeholder="4510.00"
            className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/60"
            value={form.exitPrice}
            onChange={(e) => set("exitPrice", e.target.value)}
          />
        </div>

        {/* Quantity */}
        <div>
          <label className="text-xs text-muted-foreground font-medium block mb-1.5">Quantity</label>
          <input
            type="number"
            step="0.01"
            placeholder="1"
            className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/60"
            value={form.quantity}
            onChange={(e) => set("quantity", e.target.value)}
          />
        </div>

        {/* Fees */}
        <div>
          <label className="text-xs text-muted-foreground font-medium block mb-1.5">
            Fees <span className="text-muted-foreground/60">(optional)</span>
          </label>
          <input
            type="number"
            step="0.01"
            placeholder="0.00"
            className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/60"
            value={form.fees}
            onChange={(e) => set("fees", e.target.value)}
          />
        </div>

        {/* Notes */}
        <div className="col-span-2">
          <label className="text-xs text-muted-foreground font-medium block mb-1.5">
            Notes <span className="text-muted-foreground/60">(optional)</span>
          </label>
          <textarea
            rows={2}
            placeholder="Setup description, confluence, post-trade thoughts..."
            className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/60 resize-none"
            value={form.notes}
            onChange={(e) => set("notes", e.target.value)}
          />
        </div>
      </div>

      <div className="flex justify-end gap-3 mt-4">
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button
          className="bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-600 hover:to-violet-700 text-white"
          onClick={() => mutation.mutate(form)}
          disabled={!form.symbol || !form.entryPrice || mutation.isPending}
        >
          {mutation.isPending ? "Saving..." : isEdit ? "Update Trade" : "Log Trade"}
        </Button>
      </div>
    </div>
  );
}

// ── Trade Row ──────────────────────────────────────────────────────────────────
function TradeRow({ trade }: { trade: Trade }) {
  const qc = useQueryClient();
  const [expanded, setExpanded] = useState(false);
  const [showClose, setShowClose] = useState(false);
  const [showEdit, setShowEdit] = useState(false);

  const isOpen = trade.exitPrice === null;
  const pnl = trade.netPnl;
  const pnlPositive = (pnl ?? 0) >= 0;

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/trades/${trade.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Delete failed");
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/trades"] });
      qc.invalidateQueries({ queryKey: ["/api/trades/stats"] });
      qc.invalidateQueries({ queryKey: ["/api/trades/equity-curve"] });
    },
  });

  return (
    <>
      {showClose && <CloseTradeModal trade={trade} onClose={() => setShowClose(false)} />}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        {showEdit && (
          <div className="border-b border-border">
            <TradeForm
              tradeId={trade.id}
              initial={{
                symbol: trade.symbol,
                direction: trade.direction,
                entryPrice: String(trade.entryPrice),
                exitPrice: trade.exitPrice != null ? String(trade.exitPrice) : "",
                quantity: String(trade.quantity),
                fees: String(trade.fees),
                entryTime: trade.entryTime.slice(0, 16),
                strategyTag: trade.strategyTag ?? "",
                notes: trade.notes ?? "",
              }}
              onClose={() => setShowEdit(false)}
            />
          </div>
        )}

        <div className="flex items-center gap-3 px-5 py-3.5 flex-wrap">
          {/* Symbol + direction */}
          <span className="font-bold text-foreground text-sm min-w-[60px]">{trade.symbol}</span>
          <DirectionBadge direction={trade.direction} />

          {/* Prices */}
          <div className="flex-1 flex items-center gap-4 text-sm text-muted-foreground flex-wrap">
            <span>
              Entry: <span className="text-foreground font-medium">{trade.entryPrice}</span>
            </span>
            {trade.exitPrice != null && (
              <span>
                Exit: <span className="text-foreground font-medium">{trade.exitPrice}</span>
              </span>
            )}
            <span>
              Qty: <span className="text-foreground font-medium">{trade.quantity}</span>
            </span>
            {trade.strategyTag && (
              <span className="px-2 py-0.5 bg-secondary text-muted-foreground text-xs rounded-md">
                {trade.strategyTag}
              </span>
            )}
          </div>

          {/* P&L */}
          {pnl != null ? (
            <span
              className={`font-bold text-sm min-w-[80px] text-right ${
                pnlPositive ? "text-emerald-400" : "text-rose-400"
              }`}
            >
              {fmt(pnl)}
            </span>
          ) : (
            <span className="text-xs text-amber-400 font-medium min-w-[60px] text-right">Open</span>
          )}

          {/* Date */}
          <span className="text-xs text-muted-foreground">{fmtDate(trade.entryTime)}</span>

          {/* Actions */}
          <div className="flex items-center gap-1">
            {isOpen && (
              <button
                onClick={() => setShowClose(true)}
                title="Close trade"
                className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-lg bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition-colors"
              >
                <CheckCircle className="w-3.5 h-3.5" />
                Close
              </button>
            )}
            <button
              onClick={() => setShowEdit((p) => !p)}
              title="Edit"
              className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
            >
              <Edit2 className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => {
                if (confirm("Delete this trade?")) deleteMutation.mutate();
              }}
              title="Delete"
              className="p-1.5 rounded-lg text-muted-foreground hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setExpanded((p) => !p)}
              className="p-1.5 text-muted-foreground hover:text-foreground transition-colors"
            >
              {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {expanded && (
          <div className="px-5 pb-4 pt-3 border-t border-border space-y-2">
            <div className="grid grid-cols-3 gap-3 text-sm">
              <div>
                <span className="text-xs text-muted-foreground">Gross P&L</span>
                <p
                  className={`font-medium ${
                    (trade.grossPnl ?? 0) >= 0 ? "text-emerald-400" : "text-rose-400"
                  }`}
                >
                  {fmt(trade.grossPnl)}
                </p>
              </div>
              <div>
                <span className="text-xs text-muted-foreground">Fees</span>
                <p className="text-foreground font-medium">${trade.fees.toFixed(2)}</p>
              </div>
              <div>
                <span className="text-xs text-muted-foreground">Net P&L</span>
                <p
                  className={`font-medium ${
                    (trade.netPnl ?? 0) >= 0 ? "text-emerald-400" : "text-rose-400"
                  }`}
                >
                  {fmt(trade.netPnl)}
                </p>
              </div>
            </div>
            {trade.notes && (
              <div>
                <p className="text-xs text-muted-foreground font-medium mb-1">Notes</p>
                <p className="text-sm text-foreground">{trade.notes}</p>
              </div>
            )}
            <div className="text-xs text-muted-foreground">
              Import: <span className="text-foreground">{trade.importSource}</span>
              {trade.exitTime && (
                <>
                  {" "}· Closed: <span className="text-foreground">{fmtDate(trade.exitTime)}</span>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
}

// ── Equity Curve Chart ─────────────────────────────────────────────────────────
function EquityCurveChart() {
  const { data = [] } = useQuery<{ date: string; cumulativePnl: number }[]>({
    queryKey: ["/api/trades/equity-curve"],
    queryFn: () => fetch("/api/trades/equity-curve").then((r) => r.json()),
  });

  if (data.length < 2) return null;

  const positive = (data[data.length - 1]?.cumulativePnl ?? 0) >= 0;

  return (
    <div className="bg-card border border-border rounded-xl p-5 mb-6">
      <h3 className="text-sm font-semibold text-foreground mb-4">Equity Curve</h3>
      <ResponsiveContainer width="100%" height={180}>
        <AreaChart data={data}>
          <defs>
            <linearGradient id="pnlGrad" x1="0" y1="0" x2="0" y2="1">
              <stop
                offset="5%"
                stopColor={positive ? "#10b981" : "#f43f5e"}
                stopOpacity={0.25}
              />
              <stop
                offset="95%"
                stopColor={positive ? "#10b981" : "#f43f5e"}
                stopOpacity={0}
              />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 11, fill: "rgba(255,255,255,0.4)" }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            tick={{ fontSize: 11, fill: "rgba(255,255,255,0.4)" }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v) => `$${v}`}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "hsl(var(--card))",
              border: "1px solid hsl(var(--border))",
              borderRadius: "8px",
              fontSize: "12px",
            }}
            formatter={(v: number) => [`$${v.toFixed(2)}`, "Cumulative P&L"]}
          />
          <Area
            type="monotone"
            dataKey="cumulativePnl"
            stroke={positive ? "#10b981" : "#f43f5e"}
            strokeWidth={2}
            fill="url(#pnlGrad)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────
export default function TradingJournalPage() {
  const [showForm, setShowForm] = useState(false);
  const [filterDirection, setFilterDirection] = useState<string>("");
  const [filterSymbol, setFilterSymbol] = useState<string>("");

  const params = new URLSearchParams();
  if (filterDirection) params.set("direction", filterDirection);
  if (filterSymbol) params.set("symbol", filterSymbol.toUpperCase());

  const { data: trades = [], isLoading: tradesLoading } = useQuery<Trade[]>({
    queryKey: ["/api/trades", filterDirection, filterSymbol],
    queryFn: () =>
      fetch(`/api/trades?${params.toString()}`).then((r) => r.json()),
  });

  const { data: stats } = useQuery<TradingStats>({
    queryKey: ["/api/trades/stats"],
    queryFn: () => fetch("/api/trades/stats").then((r) => r.json()),
  });

  const netPnl = stats?.netPnl ?? 0;

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Trading Journal</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Track, analyze, and improve your trading performance</p>
        </div>
        <Button
          onClick={() => setShowForm((p) => !p)}
          className="bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-600 hover:to-violet-700 text-white"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Trade
        </Button>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-3 gap-4 mb-4 sm:grid-cols-6">
        <StatCard
          label="Total Trades"
          value={stats?.totalTrades ?? 0}
          sub={`${stats?.winningTrades ?? 0}W / ${stats?.losingTrades ?? 0}L`}
        />
        <StatCard
          label="Win Rate"
          value={stats ? fmtPct(stats.winRate) : "—"}
          sub={`${stats?.winningTrades ?? 0} winners`}
          color={stats && stats.winRate >= 50 ? "green" : "red"}
        />
        <StatCard
          label="Profit Factor"
          value={stats ? stats.profitFactor.toFixed(2) : "—"}
          sub="gross / loss"
          color={stats && stats.profitFactor >= 1 ? "green" : "red"}
        />
        <StatCard
          label="Net P&L"
          value={stats ? fmt(stats.netPnl) : "—"}
          sub="closed trades"
          color={netPnl >= 0 ? "green" : "red"}
        />
        <StatCard
          label="Best Trade"
          value={stats ? fmt(stats.bestTrade) : "—"}
          color="green"
        />
        <StatCard
          label="Worst Trade"
          value={stats ? fmt(stats.worstTrade) : "—"}
          color="red"
        />
      </div>

      {/* Secondary stats */}
      {stats && (
        <div className="grid grid-cols-4 gap-3 mb-6 text-xs">
          <div className="bg-card border border-border rounded-lg px-4 py-3">
            <p className="text-muted-foreground">Avg Win</p>
            <p className="font-semibold text-emerald-400 mt-0.5">{fmt(stats.avgWin)}</p>
          </div>
          <div className="bg-card border border-border rounded-lg px-4 py-3">
            <p className="text-muted-foreground">Avg Loss</p>
            <p className="font-semibold text-rose-400 mt-0.5">-{fmt(stats.avgLoss, false)}</p>
          </div>
          <div className="bg-card border border-border rounded-lg px-4 py-3">
            <p className="text-muted-foreground">Win Streak</p>
            <p className="font-semibold text-foreground mt-0.5">
              {stats.currentWinStreak} <span className="text-muted-foreground">(best: {stats.bestWinStreak})</span>
            </p>
          </div>
          <div className="bg-card border border-border rounded-lg px-4 py-3">
            <p className="text-muted-foreground">Loss Streak</p>
            <p className="font-semibold text-foreground mt-0.5">{stats.currentLossStreak}</p>
          </div>
        </div>
      )}

      {/* Equity Curve */}
      <EquityCurveChart />

      {/* Add Trade Form */}
      {showForm && <TradeForm onClose={() => setShowForm(false)} />}

      {/* Filters */}
      <div className="flex items-center gap-3 mb-4">
        <input
          type="text"
          placeholder="Filter by symbol..."
          className="bg-background border border-border rounded-lg px-3 py-1.5 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/60 w-40"
          value={filterSymbol}
          onChange={(e) => setFilterSymbol(e.target.value)}
        />
        <div className="flex gap-1.5">
          {["", "long", "short"].map((d) => (
            <button
              key={d}
              onClick={() => setFilterDirection(d)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border ${
                filterDirection === d
                  ? "bg-primary/20 border-primary/40 text-primary"
                  : "bg-background border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              {d === "" ? "All" : d.charAt(0).toUpperCase() + d.slice(1)}
            </button>
          ))}
        </div>
        <span className="text-xs text-muted-foreground ml-auto">{trades.length} trades</span>
      </div>

      {/* Trade List */}
      {tradesLoading ? (
        <div className="text-center py-12 text-muted-foreground text-sm">Loading trades...</div>
      ) : trades.length === 0 ? (
        <div className="text-center py-16 border border-dashed border-border rounded-xl">
          <BarChart2 className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-muted-foreground font-medium">No trades logged yet</p>
          <p className="text-xs text-muted-foreground/60 mt-1">
            Click "Add Trade" to start tracking your performance
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {trades.map((trade) => (
            <TradeRow key={trade.id} trade={trade} />
          ))}
        </div>
      )}
    </div>
  );
}

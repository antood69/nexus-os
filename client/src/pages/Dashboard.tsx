import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  Users, Activity, Shield, Zap, TrendingUp, AlertOctagon, BookOpen, Cpu,
  FileText, Settings, BarChart2, Bell, Coins, Bot, Briefcase, Globe,
  Plus, ArrowRight, Wifi, WifiOff, CheckCircle,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/queryClient";

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return String(n);
}

// ── SVG Sparkline ─────────────────────────────────────────────────────────
function Sparkline({ data, color = "#10b981" }: { data: number[]; color?: string }) {
  if (!data.length) return null;
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;
  const w = 200;
  const h = 40;
  const points = data.map((v, i) => `${(i / (data.length - 1)) * w},${h - ((v - min) / range) * h}`).join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-10" preserveAspectRatio="none">
      <polyline fill="none" stroke={color} strokeWidth="2" points={points} />
      <polyline fill={`${color}20`} stroke="none" points={`0,${h} ${points} ${w},${h}`} />
    </svg>
  );
}

// ── KPI Card ──────────────────────────────────────────────────────────────
function KpiCard({ icon: Icon, label, value, sub, color }: {
  icon: React.ElementType; label: string; value: string | number; sub: string; color: string;
}) {
  const bgMap: Record<string, string> = {
    indigo: "bg-indigo-500/10 text-indigo-400",
    violet: "bg-violet-500/10 text-violet-400",
    emerald: "bg-emerald-500/10 text-emerald-400",
    sky: "bg-sky-500/10 text-sky-400",
    amber: "bg-amber-500/10 text-amber-400",
    red: "bg-red-500/10 text-red-400",
    blue: "bg-blue-500/10 text-blue-400",
  };
  return (
    <Card className="bg-card border border-border hover:border-border/80 transition-colors">
      <CardContent className="pt-5 pb-4 px-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs text-muted-foreground mb-1">{label}</p>
            <p className="text-2xl font-bold text-foreground">{value}</p>
            <p className="text-xs text-muted-foreground/70 mt-1">{sub}</p>
          </div>
          <div className={`p-2 rounded-lg ${bgMap[color] ?? bgMap.indigo}`}>
            <Icon size={18} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Quick Action Button ───────────────────────────────────────────────────
function QuickAction({ href, icon: Icon, label, color }: {
  href: string; icon: React.ElementType; label: string; color: string;
}) {
  const cMap: Record<string, string> = {
    indigo: "bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/20",
    violet: "bg-violet-500/10 text-violet-400 hover:bg-violet-500/20",
    emerald: "bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20",
    sky: "bg-sky-500/10 text-sky-400 hover:bg-sky-500/20",
  };
  return (
    <Link href={href}>
      <button className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${cMap[color] ?? cMap.indigo}`}>
        <Icon className="w-4 h-4" />
        {label}
      </button>
    </Link>
  );
}

// ── Main Dashboard ────────────────────────────────────────────────────────
export default function Dashboard() {
  const { data: tokenStatus } = useQuery<{ plan: { tokensUsed: number; monthlyTokens: number; tier: string; tokensRemaining: number } }>({
    queryKey: ["token-status"],
    queryFn: async () => {
      const res = await fetch("/api/tokens/status");
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });

  const { data: feed } = useQuery<{
    recentTrades: any[];
    activeBots: number;
    openOrders: number;
    totalApps: number;
    activeDeployments: number;
    connectedProviders: number;
    connectedBrokers: number;
    totalBots: number;
  }>({
    queryKey: ["activity-feed"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/activity-feed");
      return res.json();
    },
  });

  const { data: escalations = [] } = useQuery<any[]>({
    queryKey: ["escalations"],
    queryFn: async () => {
      const res = await fetch("/api/escalations");
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });

  const pendingEscalations = escalations.filter(e => e.status !== "resolved").length;

  // Build P&L sparkline data from recent trades
  const pnlData = (feed?.recentTrades || []).map((t: any) => t.pnl ?? 0);
  const totalPnl = pnlData.reduce((s: number, v: number) => s + v, 0);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground tracking-tight">Dashboard</h1>
            <p className="text-muted-foreground text-sm mt-1">Bunz command center — what's cooking</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <QuickAction href="/boss" icon={Bot} label="New Chat" color="indigo" />
            <QuickAction href="/bot-challenge" icon={Cpu} label="Create Bot" color="violet" />
            <QuickAction href="/app-generator" icon={Globe} label="Generate App" color="emerald" />
            <QuickAction href="/fiverr" icon={Briefcase} label="New Gig" color="sky" />
          </div>
        </div>

        {/* Quick Stats Grid */}
        <section>
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Platform Stats</h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard
              icon={Coins}
              label="Token Usage"
              value={tokenStatus ? formatTokens(tokenStatus.plan.tokensUsed) : "—"}
              sub={tokenStatus ? `of ${formatTokens(tokenStatus.plan.monthlyTokens)} ${tokenStatus.plan.tier}` : "loading..."}
              color="amber"
            />
            <KpiCard
              icon={Cpu}
              label="Active Bots"
              value={feed?.activeBots ?? 0}
              sub={`${feed?.totalBots ?? 0} total`}
              color="violet"
            />
            <KpiCard
              icon={Briefcase}
              label="Open Orders"
              value={feed?.openOrders ?? 0}
              sub="Fiverr orders"
              color="sky"
            />
            <KpiCard
              icon={Globe}
              label="Generated Apps"
              value={feed?.totalApps ?? 0}
              sub={`${feed?.activeDeployments ?? 0} deployed`}
              color="emerald"
            />
          </div>
        </section>

        {/* P&L Sparkline + Escalations */}
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card className="bg-card border border-border">
            <CardContent className="pt-5 pb-4 px-5">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-xs text-muted-foreground">Trading P&L</p>
                  <p className={`text-xl font-bold ${totalPnl >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                    {totalPnl >= 0 ? "+" : ""}${totalPnl.toFixed(2)}
                  </p>
                </div>
                <TrendingUp className={`w-5 h-5 ${totalPnl >= 0 ? "text-emerald-400" : "text-red-400"}`} />
              </div>
              {pnlData.length > 1 ? (
                <Sparkline data={pnlData} color={totalPnl >= 0 ? "#10b981" : "#ef4444"} />
              ) : (
                <div className="h-10 flex items-center justify-center text-xs text-muted-foreground">No trade data yet</div>
              )}
            </CardContent>
          </Card>

          <Card className="bg-card border border-border">
            <CardContent className="pt-5 pb-4 px-5">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-xs text-muted-foreground">Escalations</p>
                  <p className="text-xl font-bold text-foreground">{pendingEscalations}</p>
                </div>
                <AlertOctagon className={`w-5 h-5 ${pendingEscalations > 0 ? "text-red-400" : "text-muted-foreground"}`} />
              </div>
              <div className="space-y-2">
                {escalations.slice(0, 3).map((e: any) => (
                  <div key={e.id} className="flex items-center justify-between text-xs">
                    <span className="text-foreground truncate flex-1">{e.reason || "Escalation"}</span>
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                      e.status === "resolved" ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-400"
                    }`}>{e.status}</span>
                  </div>
                ))}
                {escalations.length === 0 && <p className="text-xs text-muted-foreground">All clear</p>}
              </div>
            </CardContent>
          </Card>
        </section>

        {/* System Status */}
        <section>
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">System Status</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-card border border-border rounded-lg p-4 flex items-center gap-3">
              {(feed?.connectedProviders ?? 0) > 0 ? <Wifi className="w-4 h-4 text-emerald-400" /> : <WifiOff className="w-4 h-4 text-muted-foreground" />}
              <div>
                <p className="text-sm font-medium text-foreground">{feed?.connectedProviders ?? 0} AI Providers</p>
                <p className="text-[10px] text-muted-foreground">API keys connected</p>
              </div>
            </div>
            <div className="bg-card border border-border rounded-lg p-4 flex items-center gap-3">
              {(feed?.connectedBrokers ?? 0) > 0 ? <CheckCircle className="w-4 h-4 text-emerald-400" /> : <WifiOff className="w-4 h-4 text-muted-foreground" />}
              <div>
                <p className="text-sm font-medium text-foreground">{feed?.connectedBrokers ?? 0} Brokers</p>
                <p className="text-[10px] text-muted-foreground">Trading connections</p>
              </div>
            </div>
            <div className="bg-card border border-border rounded-lg p-4 flex items-center gap-3">
              <Activity className={`w-4 h-4 ${(feed?.activeDeployments ?? 0) > 0 ? "text-emerald-400" : "text-muted-foreground"}`} />
              <div>
                <p className="text-sm font-medium text-foreground">{feed?.activeDeployments ?? 0} Deployments</p>
                <p className="text-[10px] text-muted-foreground">Bots running</p>
              </div>
            </div>
            <div className="bg-card border border-border rounded-lg p-4 flex items-center gap-3">
              <Shield className="w-4 h-4 text-sky-400" />
              <div>
                <p className="text-sm font-medium text-foreground">{tokenStatus?.plan.tier || "free"}</p>
                <p className="text-[10px] text-muted-foreground">Current plan</p>
              </div>
            </div>
          </div>
        </section>

        {/* Activity Feed */}
        <section>
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Recent Trades</h2>
          {(feed?.recentTrades?.length ?? 0) > 0 ? (
            <div className="bg-card border border-border rounded-lg divide-y divide-border">
              {feed!.recentTrades.map((t: any, i: number) => (
                <div key={i} className="px-4 py-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded ${t.side === "buy" || t.side === "long" ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-400"}`}>
                      {t.side?.toUpperCase() || "TRADE"}
                    </span>
                    <span className="text-sm text-foreground font-medium">{t.symbol || "—"}</span>
                    <span className="text-xs text-muted-foreground">{t.quantity ?? 0} @ ${t.entryPrice ?? 0}</span>
                  </div>
                  <span className={`text-sm font-semibold ${(t.pnl ?? 0) >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                    {(t.pnl ?? 0) >= 0 ? "+" : ""}${(t.pnl ?? 0).toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-card border border-border rounded-lg p-6 text-center text-sm text-muted-foreground">
              No recent trades. Start trading to see activity here.
            </div>
          )}
        </section>

        {/* Quick Access */}
        <section>
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Quick Access</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { href: "/agents", icon: Cpu, title: "Agents", desc: "Manage AI agents", color: "text-indigo-400" },
              { href: "/journal", icon: BookOpen, title: "Trade Journal", desc: "Log trades", color: "text-emerald-400" },
              { href: "/usage", icon: Coins, title: "Token Usage", desc: "Monitor & buy tokens", color: "text-amber-400" },
              { href: "/settings", icon: Settings, title: "Settings", desc: "Account settings", color: "text-sky-400" },
            ].map(item => (
              <Link key={item.href} href={item.href}>
                <Card className="bg-card border border-border hover:border-primary/40 transition-all cursor-pointer">
                  <CardContent className="pt-4 pb-3 px-4 flex items-center gap-3">
                    <item.icon className={`w-5 h-5 ${item.color}`} />
                    <div>
                      <p className="text-sm font-medium text-foreground">{item.title}</p>
                      <p className="text-[10px] text-muted-foreground">{item.desc}</p>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  Users,
  Activity,
  Shield,
  Zap,
  TrendingUp,
  AlertOctagon,
  BookOpen,
  Cpu,
  FileText,
  Settings,
  BarChart2,
  Bell,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface Escalation {
  id: number | string;
  agent?: string;
  reason?: string;
  status?: string;
}

// ---------------------------------------------------------------------------
// KPI Card
// ---------------------------------------------------------------------------
interface KpiCardProps {
  icon: React.ElementType;
  label: string;
  value: string | number;
  sub: string;
  color: string;
}

function KpiCard({ icon: Icon, label, value, sub, color }: KpiCardProps) {
  const bgMap: Record<string, string> = {
    indigo: "bg-indigo-500/10 text-indigo-400",
    violet: "bg-violet-500/10 text-violet-400",
    emerald: "bg-emerald-500/10 text-emerald-400",
    sky: "bg-sky-500/10 text-sky-400",
    amber: "bg-amber-500/10 text-amber-400",
    red: "bg-red-500/10 text-red-400",
  };
  const iconClass = bgMap[color] ?? bgMap.indigo;

  return (
    <Card className="bg-[#0f1629] border border-white/10 hover:border-white/20 transition-colors">
      <CardContent className="pt-5 pb-4 px-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs text-slate-400 mb-1">{label}</p>
            <p className="text-2xl font-bold text-white">{value}</p>
            <p className="text-xs text-slate-500 mt-1">{sub}</p>
          </div>
          <div className={`p-2 rounded-lg ${iconClass}`}>
            <Icon size={18} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Quick Link Card
// ---------------------------------------------------------------------------
interface QuickLinkProps {
  href: string;
  icon: React.ElementType;
  title: string;
  description: string;
  color: string;
}

function QuickLinkCard({ href, icon: Icon, title, description, color }: QuickLinkProps) {
  const colorMap: Record<string, string> = {
    indigo: "text-indigo-400 group-hover:text-indigo-300",
    violet: "text-violet-400 group-hover:text-violet-300",
    emerald: "text-emerald-400 group-hover:text-emerald-300",
    sky: "text-sky-400 group-hover:text-sky-300",
    amber: "text-amber-400 group-hover:text-amber-300",
    red: "text-red-400 group-hover:text-red-300",
  };

  return (
    <Link href={href}>
      <a className="group block">
        <Card className="bg-[#0f1629] border border-white/10 hover:border-indigo-500/40 hover:bg-[#111827] transition-all cursor-pointer h-full">
          <CardContent className="pt-5 pb-4 px-5 flex items-center gap-4">
            <div className={`${colorMap[color] ?? colorMap.indigo} transition-colors`}>
              <Icon size={22} />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-200 group-hover:text-white transition-colors">
                {title}
              </p>
              <p className="text-xs text-slate-500">{description}</p>
            </div>
          </CardContent>
        </Card>
      </a>
    </Link>
  );
}

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------
export default function Dashboard() {
  const { data: escalations = [] } = useQuery<Escalation[]>({
    queryKey: ["escalations"],
    queryFn: async () => {
      const res = await fetch("/api/escalations");
      if (!res.ok) throw new Error("Failed to fetch escalations");
      return res.json();
    },
  });

  const pendingEscalations = escalations.filter(
    (e) => e.status !== "resolved"
  ).length;

  return (
    <div className="min-h-screen bg-[#080d1a] text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">

        {/* Page header */}
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            Dashboard
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            NEXUS OS — operational overview
          </p>
        </div>

        {/* ── Row 1: Core KPIs ── */}
        <section>
          <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
            Core Metrics
          </h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard
              icon={Users}
              label="Active Agents"
              value={0}
              sub="agents online"
              color="indigo"
            />
            <KpiCard
              icon={Activity}
              label="Jobs Today"
              value={0}
              sub="tasks completed"
              color="violet"
            />
            <KpiCard
              icon={Shield}
              label="Compliance Score"
              value="--"
              sub="last audit"
              color="sky"
            />
            <KpiCard
              icon={Zap}
              label="Automations"
              value={0}
              sub="running workflows"
              color="amber"
            />
          </div>
        </section>

        {/* ── Row 2: Trading & Escalations KPIs ── */}
        <section>
          <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
            Trading &amp; Escalations
          </h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard
              icon={TrendingUp}
              label="Trading"
              value="--"
              sub="firms connected"
              color="emerald"
            />
            <KpiCard
              icon={AlertOctagon}
              label="Escalations"
              value={pendingEscalations}
              sub="need review"
              color="red"
            />
          </div>
        </section>

        {/* ── Quick Links ── */}
        <section>
          <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
            Quick Access
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <QuickLinkCard
              href="/agents"
              icon={Cpu}
              title="Agents"
              description="Manage and monitor AI agents"
              color="indigo"
            />
            <QuickLinkCard
              href="/analytics"
              icon={BarChart2}
              title="Analytics"
              description="Trading & agent performance"
              color="violet"
            />
            <QuickLinkCard
              href="/documents"
              icon={FileText}
              title="Documents"
              description="Contracts, reports & files"
              color="sky"
            />
            <QuickLinkCard
              href="/notifications"
              icon={Bell}
              title="Notifications"
              description="Alerts & system messages"
              color="amber"
            />
            <QuickLinkCard
              href="/settings"
              icon={Settings}
              title="Settings"
              description="Project & account settings"
              color="indigo"
            />
            {/* ── New quick links ── */}
            <QuickLinkCard
              href="/journal"
              icon={BookOpen}
              title="Trade Journal"
              description="Log and review your trades"
              color="emerald"
            />
            <QuickLinkCard
              href="/bot-challenge"
              icon={Zap}
              title="Bot Challenge"
              description="Run automated trading challenges"
              color="red"
            />
          </div>
        </section>
      </div>
    </div>
  );
}

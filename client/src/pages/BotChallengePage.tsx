import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Play, Trophy, AlertTriangle, Activity, Target, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";

type BotChallenge = {
  id: number;
  name: string;
  firm: string;
  accountSize: number;
  profitTarget: string;
  maxDrawdown: string;
  dailyDrawdown: string;
  consistencyRule?: string;
  status: string;
  currentPnl: string;
  peakBalance?: string;
  botConfig?: string;
  startedAt: string;
  endedAt?: string;
  createdAt: string;
};

type FirmPreset = {
  firm: string;
  accountSize: number;
  profitTarget: string;
  maxDrawdown: string;
  dailyDrawdown: string;
  consistencyRule?: string;
  description: string;
  color: string;
};

const FIRM_PRESETS: FirmPreset[] = [
  {
    firm: "FTMO",
    accountSize: 10000,
    profitTarget: "10",
    maxDrawdown: "10",
    dailyDrawdown: "5",
    consistencyRule: "No single day > 30% of profits",
    description: "$10K challenge · 10% profit target · 5% daily / 10% max DD",
    color: "from-blue-500/20 to-indigo-500/20 border-blue-500/30",
  },
  {
    firm: "Apex",
    accountSize: 50000,
    profitTarget: "9",
    maxDrawdown: "6",
    dailyDrawdown: "6",
    description: "$50K · 9% profit target · 6% trailing DD",
    color: "from-violet-500/20 to-purple-500/20 border-violet-500/30",
  },
  {
    firm: "Topstep",
    accountSize: 50000,
    profitTarget: "6",
    maxDrawdown: "5",
    dailyDrawdown: "5",
    description: "$50K · 6% profit target · 5% daily DD",
    color: "from-emerald-500/20 to-teal-500/20 border-emerald-500/30",
  },
  {
    firm: "TradeDay",
    accountSize: 50000,
    profitTarget: "6",
    maxDrawdown: "5",
    dailyDrawdown: "5",
    description: "$50K · 6% profit target · 5% daily DD",
    color: "from-amber-500/20 to-orange-500/20 border-amber-500/30",
  },
];

const ORDER_FLOW_PRESET = {
  name: "Order Flow Bot v1",
  firm: "Custom",
  accountSize: 50000,
  profitTarget: "8",
  maxDrawdown: "5",
  dailyDrawdown: "3",
  consistencyRule: "No single day > 25% of profits",
  botConfig: JSON.stringify({
    strategy: "order_flow",
    signals: ["CVD divergence", "delta imbalance", "VWAP levels"],
    sizing: "dynamic",
    hft: false,
    maxPositionSize: 2,
  }),
};

function PnlBar({
  current,
  target,
  label,
  danger = false,
}: {
  current: number;
  target: number;
  label: string;
  danger?: boolean;
}) {
  const pct = Math.min(Math.abs(current / target) * 100, 100);
  const isDanger = danger && pct > 70;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{label}</span>
        <span className={isDanger ? "text-rose-400 font-medium" : ""}>{pct.toFixed(1)}%</span>
      </div>
      <div className="h-2 bg-secondary rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${
            isDanger
              ? "bg-rose-500"
              : danger
              ? "bg-amber-500"
              : "bg-gradient-to-r from-indigo-500 to-violet-500"
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    running: "bg-amber-500/15 text-amber-400",
    passed: "bg-emerald-500/15 text-emerald-400",
    failed: "bg-rose-500/15 text-rose-400",
  };
  return (
    <span className={`inline-flex px-2 py-0.5 rounded-md text-xs font-medium ${map[status] || "bg-secondary text-muted-foreground"}`}>
      {status === "running" && <Activity className="w-3 h-3 mr-1" />}
      {status === "passed" && <Trophy className="w-3 h-3 mr-1" />}
      {status === "failed" && <AlertTriangle className="w-3 h-3 mr-1" />}
      {status}
    </span>
  );
}

function ActiveChallengeCard({ challenge }: { challenge: BotChallenge }) {
  const currentPnl = parseFloat(challenge.currentPnl || "0");
  const profitTargetAmt = (challenge.accountSize * parseFloat(challenge.profitTarget)) / 100;
  const maxDrawAmt = (challenge.accountSize * parseFloat(challenge.maxDrawdown)) / 100;
  const dailyDrawAmt = (challenge.accountSize * parseFloat(challenge.dailyDrawdown)) / 100;
  const pnlPositive = currentPnl >= 0;

  return (
    <div className="bg-card border border-border rounded-xl p-5 space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="font-semibold text-foreground text-sm">{challenge.name}</span>
            <span className="text-xs px-2 py-0.5 rounded-md bg-indigo-500/15 text-indigo-400 font-medium">{challenge.firm}</span>
          </div>
          <p className="text-xs text-muted-foreground">
            ${challenge.accountSize.toLocaleString()} · Started {new Date(challenge.startedAt).toLocaleDateString()}
          </p>
        </div>
        <StatusBadge status={challenge.status} />
      </div>

      <div className="flex items-center gap-1.5">
        <span className="text-xs text-muted-foreground">Current P&L:</span>
        <span className={`font-semibold text-sm ${pnlPositive ? "text-emerald-400" : "text-rose-400"}`}>
          {pnlPositive ? "+" : ""}${currentPnl.toFixed(2)}
        </span>
      </div>

      <div className="space-y-3">
        <PnlBar
          current={Math.max(currentPnl, 0)}
          target={profitTargetAmt}
          label={`Profit Target ($${profitTargetAmt.toLocaleString()})`}
        />
        <PnlBar
          current={Math.min(currentPnl, 0)}
          target={-maxDrawAmt}
          label={`Max Drawdown ($${maxDrawAmt.toLocaleString()})`}
          danger
        />
        <PnlBar
          current={Math.min(currentPnl, 0)}
          target={-dailyDrawAmt}
          label={`Daily Drawdown ($${dailyDrawAmt.toLocaleString()})`}
          danger
        />
      </div>

      {challenge.status !== "running" && (
        <div
          className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium ${
            challenge.status === "passed"
              ? "bg-emerald-500/10 border border-emerald-500/30 text-emerald-400"
              : "bg-rose-500/10 border border-rose-500/30 text-rose-400"
          }`}
        >
          {challenge.status === "passed" ? (
            <><Trophy className="w-4 h-4" /> Challenge PASSED — well done!</>
          ) : (
            <><AlertTriangle className="w-4 h-4" /> Challenge FAILED — drawdown exceeded</>
          )}
        </div>
      )}
    </div>
  );
}

export default function BotChallengePage() {
  const qc = useQueryClient();
  const { data: challenges = [], isLoading } = useQuery<BotChallenge[]>({
    queryKey: ["/api/bot-challenges"],
    queryFn: () => fetch("/api/bot-challenges").then((r) => r.json()),
  });

  const startChallenge = useMutation({
    mutationFn: async (preset: Partial<BotChallenge> & { name: string }) => {
      const res = await fetch("/api/bot-challenges", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...preset,
          status: "running",
          currentPnl: "0",
          startedAt: new Date().toISOString(),
        }),
      });
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/bot-challenges"] });
    },
  });

  const loadOrderFlowPreset = () => {
    startChallenge.mutate({
      ...ORDER_FLOW_PRESET,
    } as any);
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Bot Challenge Simulator</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Test your bot against real prop firm rules before paying
        </p>
      </div>

      {/* Your Order Flow Preset — featured card */}
      <div className="mb-8 bg-gradient-to-r from-indigo-500/10 via-violet-500/10 to-purple-500/10 border border-indigo-500/30 rounded-xl p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center">
                <Zap className="w-3.5 h-3.5 text-white" />
              </div>
              <span className="font-bold text-foreground">Your Order Flow Preset</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 font-medium">Recommended</span>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed max-w-xl">
              Pre-configured order flow bot: CVD divergence + delta imbalance + VWAP levels. Prop-firm compliant, no HFT, dynamic position sizing.
            </p>
            <div className="flex flex-wrap gap-2 mt-3">
              {["CVD Divergence", "Delta Imbalance", "VWAP Levels", "Dynamic Sizing", "No HFT"].map((tag) => (
                <span key={tag} className="text-xs px-2 py-0.5 rounded-md bg-indigo-500/15 text-indigo-300">
                  {tag}
                </span>
              ))}
            </div>
          </div>
          <Button
            onClick={loadOrderFlowPreset}
            disabled={startChallenge.isPending}
            className="bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-600 hover:to-violet-700 text-white flex-shrink-0"
          >
            <Play className="w-4 h-4 mr-2" />
            Load Preset
          </Button>
        </div>
      </div>

      {/* Firm Presets Grid */}
      <div className="mb-8">
        <h2 className="text-sm font-semibold text-foreground mb-3 uppercase tracking-wide">Firm Presets</h2>
        <div className="grid grid-cols-2 gap-4">
          {FIRM_PRESETS.map((preset) => (
            <div
              key={preset.firm}
              className={`bg-gradient-to-br ${preset.color} border rounded-xl p-4`}
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="font-bold text-foreground">{preset.firm}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{preset.description}</p>
                </div>
                <Target className="w-5 h-5 text-muted-foreground/60 flex-shrink-0" />
              </div>

              <div className="grid grid-cols-3 gap-2 mb-4 text-center">
                <div className="bg-background/40 rounded-lg py-1.5">
                  <p className="text-xs text-muted-foreground">Profit</p>
                  <p className="text-sm font-bold text-emerald-400">{preset.profitTarget}%</p>
                </div>
                <div className="bg-background/40 rounded-lg py-1.5">
                  <p className="text-xs text-muted-foreground">Max DD</p>
                  <p className="text-sm font-bold text-rose-400">{preset.maxDrawdown}%</p>
                </div>
                <div className="bg-background/40 rounded-lg py-1.5">
                  <p className="text-xs text-muted-foreground">Daily DD</p>
                  <p className="text-sm font-bold text-amber-400">{preset.dailyDrawdown}%</p>
                </div>
              </div>

              <Button
                size="sm"
                variant="secondary"
                className="w-full text-xs"
                disabled={startChallenge.isPending}
                onClick={() =>
                  startChallenge.mutate({
                    name: `${preset.firm} ${preset.accountSize / 1000}K Challenge`,
                    firm: preset.firm,
                    accountSize: preset.accountSize,
                    profitTarget: preset.profitTarget,
                    maxDrawdown: preset.maxDrawdown,
                    dailyDrawdown: preset.dailyDrawdown,
                    consistencyRule: preset.consistencyRule,
                  })
                }
              >
                <Play className="w-3 h-3 mr-1.5" />
                Start Simulation
              </Button>
            </div>
          ))}
        </div>
      </div>

      {/* Active Challenges */}
      <div>
        <h2 className="text-sm font-semibold text-foreground mb-3 uppercase tracking-wide">Active Challenges</h2>
        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground text-sm">Loading challenges...</div>
        ) : challenges.length === 0 ? (
          <div className="text-center py-12 border border-dashed border-border rounded-xl">
            <Target className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-muted-foreground font-medium">No active challenges</p>
            <p className="text-xs text-muted-foreground/60 mt-1">Click "Start Simulation" on a firm preset above</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            {challenges.map((c) => (
              <ActiveChallengeCard key={c.id} challenge={c} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

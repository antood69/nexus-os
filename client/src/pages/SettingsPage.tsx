import { useTheme } from "../contexts/ThemeContext";
import { useQuery } from "@tanstack/react-query";
import { Sun, Moon, CreditCard, Coins, ArrowRight } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface TokenStatus {
  plan: {
    tier: string;
    monthlyTokens: number;
    tokensUsed: number;
    tokensRemaining: number;
    bonusTokens: number;
    periodEnd: string;
  };
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return String(n);
}

export default function SettingsPage() {
  const { theme, setTheme } = useTheme();

  const { data: status } = useQuery<TokenStatus>({
    queryKey: ["token-status"],
    queryFn: async () => {
      const res = await fetch("/api/tokens/status");
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });

  const plan = status?.plan;
  const pct = plan ? Math.min((plan.tokensUsed / plan.monthlyTokens) * 100, 100) : 0;

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">Manage your Bunz preferences</p>
      </div>

      <div className="border border-border rounded-lg divide-y divide-border">
        {/* Appearance */}
        <div className="p-5">
          <h2 className="text-sm font-semibold text-foreground mb-4">Appearance</h2>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-foreground">Theme</p>
              <p className="text-xs text-muted-foreground mt-0.5">Switch between light and dark mode</p>
            </div>
            <div className="flex items-center gap-1 bg-secondary rounded-lg p-1">
              <button
                onClick={() => setTheme("light")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                  theme === "light"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Sun className="w-3.5 h-3.5" />
                Light
              </button>
              <button
                onClick={() => setTheme("dark")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                  theme === "dark"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Moon className="w-3.5 h-3.5" />
                Dark
              </button>
            </div>
          </div>
        </div>

        {/* Billing & Subscription */}
        <div className="p-5">
          <h2 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
            <CreditCard className="w-4 h-4" />
            Billing &amp; Subscription
          </h2>

          {plan && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-foreground">Current Plan</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Your active subscription tier</p>
                </div>
                <Badge variant="outline" className="capitalize text-primary border-primary/40">
                  {plan.tier}
                </Badge>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                    <Coins className="w-3 h-3" />
                    Token Usage
                  </span>
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {formatTokens(plan.tokensUsed)} / {formatTokens(plan.monthlyTokens)}
                  </span>
                </div>
                <div className="h-2 rounded-full bg-secondary overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${pct >= 80 ? "bg-orange-400" : "bg-primary"}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <p className="text-[11px] text-muted-foreground mt-1">
                  Resets {plan.periodEnd ? new Date(plan.periodEnd).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "monthly"}
                </p>
              </div>

              <div className="flex gap-3 pt-1">
                <Link href="/pricing">
                  <Button variant="outline" size="sm" className="text-xs">
                    Manage Subscription <ArrowRight className="w-3 h-3 ml-1" />
                  </Button>
                </Link>
                <Link href="/usage">
                  <Button variant="default" size="sm" className="text-xs">
                    <Coins className="w-3 h-3 mr-1" />
                    Buy More Tokens
                  </Button>
                </Link>
              </div>
            </div>
          )}

          {!plan && (
            <p className="text-xs text-muted-foreground">Loading billing information...</p>
          )}
        </div>
      </div>
    </div>
  );
}

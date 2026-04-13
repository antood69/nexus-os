import { useState } from "react";
import { Check, Zap, Building2, Sparkles, ArrowRight, ChevronDown, ChevronUp, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

const tiers = [
  {
    id: "free",
    name: "Free",
    price: { monthly: 0, annual: 0 },
    description: "Get started with AI agent orchestration",
    icon: Sparkles,
    color: "text-muted-foreground",
    accent: "border-border",
    badgeVariant: null as null,
    limits: {
      agents: 2,
      workflows: 1,
      models: ["GPT-4o"],
      storage: "100MB",
      jobsPerMonth: 50,
    },
    features: [
      "2 AI agents",
      "1 active workflow",
      "GPT-4o model access",
      "50 jobs / month",
      "Agent chat interface",
      "Basic audit reviews",
      "100MB storage",
      "Community support",
    ],
    cta: "Current Plan",
    current: true,
  },
  {
    id: "pro",
    name: "Pro",
    price: { monthly: 29, annual: 23 },
    description: "Scale your AI workforce without limits",
    icon: Zap,
    color: "text-primary",
    accent: "border-primary",
    badgeVariant: "default" as "default",
    limits: {
      agents: 10,
      workflows: 10,
      models: ["Claude Sonnet", "Claude Opus", "GPT-4o", "Perplexity Sonar"],
      storage: "10GB",
      jobsPerMonth: 2000,
    },
    features: [
      "10 AI agents",
      "10 active workflows",
      "All 4 AI models",
      "2,000 jobs / month",
      "Priority job queue",
      "Advanced audit AI",
      "Workflow activity feed",
      "10GB storage",
      "Email support",
    ],
    cta: "Upgrade to Pro",
    current: false,
  },
  {
    id: "agency",
    name: "Agency",
    price: { monthly: 99, annual: 79 },
    description: "Unlimited power for teams & white-label",
    icon: Building2,
    color: "text-violet-400",
    accent: "border-violet-500",
    badgeVariant: null as null,
    limits: {
      agents: Infinity,
      workflows: Infinity,
      models: ["Claude Sonnet", "Claude Opus", "GPT-4o", "Perplexity Sonar"],
      storage: "Unlimited",
      jobsPerMonth: Infinity,
    },
    features: [
      "Unlimited agents",
      "Unlimited workflows",
      "All 4 AI models",
      "Unlimited jobs",
      "White-label branding",
      "Custom domain",
      "Team seats (up to 10)",
      "Priority API access",
      "Unlimited storage",
      "Dedicated Slack support",
    ],
    cta: "Go Agency",
    current: false,
  },
];

const faqs = [
  {
    q: "Can I switch plans at any time?",
    a: "Yes — upgrades take effect immediately and you're billed the prorated difference. Downgrades apply at the end of your billing cycle.",
  },
  {
    q: "What happens when I hit my agent or job limit?",
    a: "You'll see a clear in-app warning before you hit limits. Jobs queue and won't be lost — upgrade to unblock them instantly.",
  },
  {
    q: "Do unused jobs carry over?",
    a: "Monthly job credits reset each billing cycle. Annual plan holders get a small rollover buffer (up to 10% of monthly allowance).",
  },
  {
    q: "What's white-label?",
    a: "Agency plan lets you remove NEXUS OS branding and replace it with your own logo and colors — great for client deployments.",
  },
  {
    q: "Is there a free trial for Pro?",
    a: "Yes — start a 14-day Pro trial with no credit card required. Full access, no limits during trial.",
  },
];

function FAQ() {
  const [open, setOpen] = useState<number | null>(null);
  return (
    <div className="mt-16 max-w-2xl mx-auto">
      <h2 className="text-lg font-semibold text-foreground text-center mb-6">Frequently asked questions</h2>
      <div className="space-y-2">
        {faqs.map((faq, i) => (
          <div
            key={i}
            className="border border-border rounded-lg overflow-hidden"
            data-testid={`faq-item-${i}`}
          >
            <button
              className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-foreground hover:bg-secondary/50 transition-colors text-left"
              onClick={() => setOpen(open === i ? null : i)}
              data-testid={`faq-toggle-${i}`}
            >
              {faq.q}
              {open === i ? (
                <ChevronUp className="w-4 h-4 text-muted-foreground flex-shrink-0 ml-3" />
              ) : (
                <ChevronDown className="w-4 h-4 text-muted-foreground flex-shrink-0 ml-3" />
              )}
            </button>
            {open === i && (
              <div className="px-4 pb-4 text-sm text-muted-foreground leading-relaxed">
                {faq.a}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function PricingPage() {
  const [annual, setAnnual] = useState(false);
  const [loadingTier, setLoadingTier] = useState<string | null>(null);
  const { toast } = useToast();

  // Check for Stripe redirect results in URL params
  const params = new URLSearchParams(window.location.search);
  const checkoutSuccess = params.get("success") === "1";
  const checkoutCanceled = params.get("canceled") === "1";

  async function handleUpgrade(tierId: string) {
    if (tierId === "free") return;

    const billing = annual ? "annual" : "monthly";
    setLoadingTier(tierId);

    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tier: tierId, billing }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Checkout failed");
      }

      // Redirect to Stripe Checkout
      window.location.href = data.url;
    } catch (err: any) {
      toast({
        title: "Checkout error",
        description: err.message || "Something went wrong. Please try again.",
        variant: "destructive",
      });
      setLoadingTier(null);
    }
  }

  return (
    <div className="min-h-full px-6 py-10 pb-20 max-w-5xl mx-auto" data-testid="pricing-page">

      {/* Success / Cancel banners */}
      {checkoutSuccess && (
        <div className="mb-6 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-400 text-center">
          🎉 Subscription activated! Welcome to NEXUS OS {annual ? "Annual" : "Monthly"}.
        </div>
      )}
      {checkoutCanceled && (
        <div className="mb-6 rounded-lg border border-orange-500/40 bg-orange-500/10 px-4 py-3 text-sm text-orange-400 text-center">
          Checkout was canceled — no charge was made. Upgrade whenever you're ready.
        </div>
      )}

      {/* Header */}
      <div className="text-center mb-10">
        <Badge variant="outline" className="mb-3 text-primary border-primary/40 bg-primary/5">
          SaaS Subscriptions
        </Badge>
        <h1 className="text-xl font-bold text-foreground mb-2">Simple, transparent pricing</h1>
        <p className="text-sm text-muted-foreground max-w-md mx-auto">
          Start free. Scale as your AI workforce grows. No hidden fees.
        </p>

        {/* Billing toggle */}
        <div className="inline-flex items-center gap-3 mt-5 bg-secondary/60 rounded-full px-4 py-2 border border-border">
          <button
            className={`text-sm font-medium transition-colors ${!annual ? "text-foreground" : "text-muted-foreground"}`}
            onClick={() => setAnnual(false)}
            data-testid="billing-monthly"
          >
            Monthly
          </button>
          <button
            role="switch"
            aria-checked={annual}
            onClick={() => setAnnual(!annual)}
            data-testid="billing-toggle"
            className={`relative w-10 h-5 rounded-full transition-colors ${annual ? "bg-primary" : "bg-border"}`}
          >
            <span
              className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${annual ? "translate-x-5" : "translate-x-0"}`}
            />
          </button>
          <button
            className={`text-sm font-medium transition-colors flex items-center gap-1.5 ${annual ? "text-foreground" : "text-muted-foreground"}`}
            onClick={() => setAnnual(true)}
            data-testid="billing-annual"
          >
            Annual
            <span className="text-[11px] font-semibold text-emerald-400 bg-emerald-400/10 px-1.5 py-0.5 rounded-full">
              Save 20%
            </span>
          </button>
        </div>
      </div>

      {/* Tier cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {tiers.map((tier) => {
          const Icon = tier.icon;
          const price = annual ? tier.price.annual : tier.price.monthly;
          const isLoading = loadingTier === tier.id;

          return (
            <div
              key={tier.id}
              data-testid={`tier-card-${tier.id}`}
              className={`relative rounded-xl border-2 ${tier.accent} bg-card p-5 flex flex-col transition-shadow hover:shadow-lg hover:shadow-primary/5 ${
                tier.id === "pro" ? "ring-1 ring-primary/20" : ""
              }`}
            >
              {tier.id === "pro" && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <Badge className="bg-primary text-primary-foreground text-[11px] px-2.5 py-0.5 shadow-md">
                    Most Popular
                  </Badge>
                </div>
              )}

              {/* Tier header */}
              <div className="flex items-center gap-2 mb-3">
                <div className={`p-1.5 rounded-md ${tier.id === "pro" ? "bg-primary/15" : tier.id === "agency" ? "bg-violet-500/15" : "bg-secondary"}`}>
                  <Icon className={`w-4 h-4 ${tier.color}`} />
                </div>
                <span className="font-semibold text-sm text-foreground">{tier.name}</span>
              </div>

              {/* Price */}
              <div className="mb-1">
                <span className="text-3xl font-bold text-foreground tabular-nums">
                  ${price}
                </span>
                {price > 0 && (
                  <span className="text-muted-foreground text-sm ml-1">/mo</span>
                )}
              </div>
              {price > 0 && annual && (
                <p className="text-[11px] text-muted-foreground mb-3">
                  Billed ${price * 12}/yr · saves ${(tier.price.monthly - price) * 12}/yr
                </p>
              )}
              <p className="text-xs text-muted-foreground mb-4 mt-1">{tier.description}</p>

              {/* CTA */}
              <Button
                data-testid={`cta-${tier.id}`}
                variant={tier.current ? "outline" : tier.id === "pro" ? "default" : "secondary"}
                className={`w-full mb-5 text-sm ${tier.id === "agency" ? "bg-violet-600 hover:bg-violet-700 text-foreground border-0" : ""}`}
                disabled={tier.current || isLoading}
                onClick={() => handleUpgrade(tier.id)}
              >
                {tier.current ? (
                  tier.cta
                ) : isLoading ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                    Redirecting...
                  </>
                ) : (
                  <>
                    {tier.cta}
                    <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
                  </>
                )}
              </Button>

              {/* Divider */}
              <div className="border-t border-border mb-4" />

              {/* Feature list */}
              <ul className="space-y-2 flex-1">
                {tier.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-xs text-muted-foreground">
                    <Check className={`w-3.5 h-3.5 mt-0.5 flex-shrink-0 ${tier.id === "pro" ? "text-primary" : tier.id === "agency" ? "text-violet-400" : "text-muted-foreground"}`} />
                    {f}
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>

      {/* Usage meters callout */}
      <div className="mt-8 rounded-xl border border-border bg-card px-6 py-5 flex flex-col md:flex-row items-start md:items-center gap-4 md:gap-8">
        <div className="flex-1">
          <p className="text-sm font-medium text-foreground mb-0.5">Your current usage</p>
          <p className="text-xs text-muted-foreground">Free tier — tracked against your plan limits in real time</p>
        </div>
        <div className="flex flex-wrap gap-6">
          {[
            { label: "Agents", used: 2, limit: 2 },
            { label: "Workflows", used: 1, limit: 1 },
            { label: "Jobs this month", used: 12, limit: 50 },
          ].map((meter) => {
            const pct = Math.min((meter.used / meter.limit) * 100, 100);
            const danger = pct >= 90;
            return (
              <div key={meter.label} className="min-w-[120px]" data-testid={`meter-${meter.label.toLowerCase().replace(/ /g, '-')}`}>
                <div className="flex justify-between text-[11px] mb-1">
                  <span className="text-muted-foreground">{meter.label}</span>
                  <span className={`font-medium tabular-nums ${danger ? "text-orange-400" : "text-foreground"}`}>
                    {meter.used}/{meter.limit}
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${danger ? "bg-orange-400" : "bg-primary"}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
        <Button variant="default" size="sm" className="text-xs flex-shrink-0" onClick={() => handleUpgrade("pro")} data-testid="usage-upgrade-btn">
          Upgrade <ArrowRight className="w-3 h-3 ml-1" />
        </Button>
      </div>

      {/* FAQ */}
      <FAQ />
    </div>
  );
}

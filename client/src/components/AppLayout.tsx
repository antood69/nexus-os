import { Link, useLocation } from "wouter";
import { LayoutDashboard, GitBranch, Bot, ShieldCheck, CreditCard, Zap, BookOpen, Target, Settings, Coins } from "lucide-react";
import TokenCounter from "./TokenCounter";

const navItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/workflows", label: "Workflows", icon: GitBranch },
  { href: "/agents", label: "Agents", icon: Bot },
  { href: "/audit", label: "Auditor", icon: ShieldCheck },
  { href: "/journal", label: "Trade Journal", icon: BookOpen },
  { href: "/bot-challenge", label: "Bot Challenge", icon: Target },
  { href: "/pricing", label: "Pricing", icon: CreditCard },
  { href: "/usage", label: "Usage", icon: Coins },
  { href: "/settings", label: "Settings", icon: Settings },
];

function NexusLogo() {
  return (
    <svg width="28" height="28" viewBox="0 0 32 32" fill="none" aria-label="NEXUS OS">
      <rect x="2" y="2" width="28" height="28" rx="6" stroke="hsl(239 84% 67%)" strokeWidth="2" />
      <path d="M10 22V10l6 8 6-8v12" stroke="hsl(263 70% 58%)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Sidebar */}
      <aside className="w-56 flex-shrink-0 border-r border-border bg-sidebar flex flex-col">
        <div className="flex items-center gap-2.5 px-4 h-14 border-b border-border">
          <NexusLogo />
          <span className="font-semibold text-sm tracking-tight text-foreground">NEXUS OS</span>
        </div>

        <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto overscroll-contain">
          {navItems.map((item) => {
            const isActive = location === item.href || (item.href !== "/" && location.startsWith(item.href));
            return (
              <Link key={item.href} href={item.href}>
                <div
                  data-testid={`nav-${item.label.toLowerCase().replace(/\s+/g, "-")}`}
                  className={`flex items-center gap-2.5 px-3 py-2 rounded-md text-sm cursor-pointer transition-colors ${
                    isActive
                      ? "bg-primary/15 text-primary font-medium"
                      : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                  }`}
                >
                  <item.icon className="w-4 h-4 flex-shrink-0" />
                  {item.label}
                </div>
              </Link>
            );
          })}
        </nav>

        <TokenCounter />

        <div className="px-3 py-3 border-t border-border">
          <Link href="/pricing">
            <div className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-secondary cursor-pointer transition-colors group" data-testid="sidebar-plan-badge">
              <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center text-xs font-medium text-primary flex-shrink-0">
                N
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-foreground truncate">Free Tier</p>
                <p className="text-[11px] text-muted-foreground">2 / 2 agents used</p>
              </div>
              <Zap className="w-3 h-3 text-primary opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
            </div>
          </Link>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto overscroll-contain">
        {children}
      </main>
    </div>
  );
}

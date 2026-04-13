import { Link, useLocation } from "wouter";
import {
  LayoutDashboard,
  GitBranch,
  Bot,
  ShieldCheck,
  CreditCard,
  Zap,
  BookOpen,
  Target,
  Settings,
  Coins,
  LogOut,
  ShieldAlert,
  Store,
  MessageSquare,
  Wrench,
} from "lucide-react";
import TokenCounter from "./TokenCounter";
import NotificationBell from "./NotificationBell";
import { useAuth } from "@/hooks/useAuth";
import { useEffect } from "react";

const navItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/boss", label: "The Boss", icon: MessageSquare },
  { href: "/workflows", label: "Workflows", icon: GitBranch },
  { href: "/agents", label: "Agents", icon: Bot },
  { href: "/marketplace", label: "Marketplace", icon: Store },
  { href: "/tools", label: "Tools", icon: Wrench },
  { href: "/audit", label: "Auditor", icon: ShieldCheck },
  { href: "/journal", label: "Trade Journal", icon: BookOpen },
  { href: "/bot-challenge", label: "Bot Challenge", icon: Target },
  { href: "/pricing", label: "Pricing", icon: CreditCard },
  { href: "/usage", label: "Usage", icon: Coins },
  { href: "/settings", label: "Settings", icon: Settings },
];

function BunzLogo() {
  return (
    <svg width="28" height="28" viewBox="0 0 32 32" fill="none" aria-label="Bunz">
      <rect x="2" y="2" width="28" height="28" rx="6" stroke="hsl(239 84% 67%)" strokeWidth="2" />
      <path d="M10 22V10l6 8 6-8v12" stroke="hsl(263 70% 58%)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function UserAvatar({ name, email }: { name?: string; email?: string }) {
  const initial = (name ?? email ?? "?")[0].toUpperCase();
  return (
    <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center text-xs font-semibold text-primary flex-shrink-0 select-none">
      {initial}
    </div>
  );
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { user, isLoading, isAuthenticated, isOwner, logout } = useAuth();

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      window.location.href = "/#/login";
    }
  }, [isLoading, isAuthenticated]);

  // While loading auth, show nothing to prevent flash
  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // If not authenticated, render nothing (redirect is in progress)
  if (!isAuthenticated) {
    return null;
  }

  const displayLabel = user?.displayName ?? user?.email ?? "User";

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Sidebar */}
      <aside className="w-56 flex-shrink-0 border-r border-border bg-sidebar flex flex-col">
        {/* Logo */}
        <div className="flex items-center gap-2.5 px-4 h-14 border-b border-border">
          <BunzLogo />
          <span className="font-semibold text-sm tracking-tight text-foreground">Bunz</span>
        </div>

        {/* User info */}
        <div className="px-3 py-3 border-b border-border">
          <div className="flex items-center gap-2 px-2 py-1.5 rounded-md">
            <UserAvatar name={user?.displayName} email={user?.email} />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-foreground truncate">{displayLabel}</p>
              {isOwner && (
                <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-primary">
                  <ShieldAlert className="w-2.5 h-2.5" />
                  Owner
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto overscroll-contain">
          {navItems.map((item) => {
            const isActive =
              location === item.href ||
              (item.href !== "/" && location.startsWith(item.href));
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

          {/* Admin link — owner only */}
          {isOwner && (
            <Link href="/admin">
              <div
                data-testid="nav-admin"
                className={`flex items-center gap-2.5 px-3 py-2 rounded-md text-sm cursor-pointer transition-colors ${
                  location === "/admin"
                    ? "bg-primary/15 text-primary font-medium"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                }`}
              >
                <ShieldAlert className="w-4 h-4 flex-shrink-0" />
                Admin
              </div>
            </Link>
          )}
        </nav>

        <TokenCounter />

        {/* Bottom section: plan + logout */}
        <div className="px-3 py-3 border-t border-border space-y-1">
          <Link href="/pricing">
            <div
              className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-secondary cursor-pointer transition-colors group"
              data-testid="sidebar-plan-badge"
            >
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

          <button
            onClick={logout}
            data-testid="sidebar-logout"
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-sm text-muted-foreground hover:bg-secondary hover:text-foreground cursor-pointer transition-colors"
          >
            <LogOut className="w-4 h-4 flex-shrink-0" />
            Logout
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar with notification bell */}
        <div className="h-12 border-b border-border bg-card flex items-center justify-end px-4 gap-3 shrink-0">
          <NotificationBell />
          <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center text-xs font-semibold text-primary">
            {(user?.displayName || user?.email || "U").charAt(0).toUpperCase()}
          </div>
        </div>
        <main className="flex-1 overflow-y-auto overscroll-contain">
          {children}
        </main>
      </div>
    </div>
  );
}

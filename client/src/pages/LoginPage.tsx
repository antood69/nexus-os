import { useState } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";

// ---------------------------------------------------------------------------
// NEXUS Logo SVG (matches AppLayout)
// ---------------------------------------------------------------------------
function NexusLogo({ size = 48 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="NEXUS OS logo"
    >
      <rect width="40" height="40" rx="8" fill="url(#nexus-grad)" />
      {/* N-shape path */}
      <path
        d="M10 30V10L20 26V10M20 26V10L30 30V10"
        stroke="white"
        strokeWidth="2.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <defs>
        <linearGradient
          id="nexus-grad"
          x1="0"
          y1="0"
          x2="40"
          y2="40"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#6366f1" />
          <stop offset="1" stopColor="#7c3aed" />
        </linearGradient>
      </defs>
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
type Mode = "signin" | "register";

// ---------------------------------------------------------------------------
// LoginPage
// ---------------------------------------------------------------------------
export default function LoginPage() {
  const [, setLocation] = useLocation();
  const [mode, setMode] = useState<Mode>("signin");

  // Form state
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // UI state
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Switch modes, clearing errors and fields
  function switchMode(next: Mode) {
    setMode(next);
    setError(null);
    setUsername("");
    setPassword("");
    setConfirmPassword("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!username.trim()) {
      setError("Username is required.");
      return;
    }
    if (!password) {
      setError("Password is required.");
      return;
    }
    if (mode === "register") {
      if (password !== confirmPassword) {
        setError("Passwords do not match.");
        return;
      }
      if (password.length < 6) {
        setError("Password must be at least 6 characters.");
        return;
      }
    }

    setLoading(true);
    try {
      const endpoint =
        mode === "signin" ? "/api/auth/login" : "/api/auth/register";

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim(), password }),
      });

      if (!res.ok) {
        let message = mode === "signin" ? "Invalid credentials." : "Registration failed.";
        try {
          const data = await res.json();
          if (data?.message || data?.error) {
            message = data.message ?? data.error;
          }
        } catch {
          // ignore parse errors
        }
        setError(message);
        return;
      }

      // Success → navigate to app root
      setLocation("/");
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4">
      {/* Background glow */}
      <div
        className="pointer-events-none fixed inset-0 -z-10"
        aria-hidden="true"
      >
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-indigo-600/10 blur-3xl" />
        <div className="absolute top-2/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] rounded-full bg-violet-700/10 blur-3xl" />
      </div>

      <div className="w-full max-w-md">
        {/* Logo + branding */}
        <div className="flex flex-col items-center mb-8 gap-3">
          <NexusLogo size={52} />
          <div className="text-center">
            <h1 className="text-2xl font-bold text-foreground tracking-tight">
              NEXUS OS
            </h1>
            <p className="text-muted-foreground text-sm mt-0.5">
              Intelligent operations platform
            </p>
          </div>
        </div>

        {/* Card */}
        <Card className="bg-card border border-border shadow-xl shadow-black/40">
          {/* Mode toggle tabs */}
          <CardHeader className="pb-0 pt-6 px-6">
            <div className="flex bg-background rounded-lg p-1 gap-1">
              <button
                type="button"
                onClick={() => switchMode("signin")}
                className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${
                  mode === "signin"
                    ? "bg-indigo-600 text-foreground shadow"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => switchMode("register")}
                className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${
                  mode === "register"
                    ? "bg-indigo-600 text-foreground shadow"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Create Account
              </button>
            </div>
          </CardHeader>

          <CardContent className="px-6 pt-5 pb-6">
            <form onSubmit={handleSubmit} noValidate className="space-y-4">
              {/* Error alert */}
              {error && (
                <Alert
                  variant="destructive"
                  className="bg-red-500/10 border-red-500/30 text-red-400"
                >
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              {/* Username */}
              <div className="space-y-1.5">
                <Label
                  htmlFor="username"
                  className="text-foreground/80 text-sm"
                >
                  Username
                </Label>
                <Input
                  id="username"
                  type="text"
                  autoComplete="username"
                  placeholder="your_username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  disabled={loading}
                  className="bg-background border-border text-foreground placeholder-muted-foreground focus:border-indigo-500 focus:ring-indigo-500/30"
                />
              </div>

              {/* Password */}
              <div className="space-y-1.5">
                <Label
                  htmlFor="password"
                  className="text-foreground/80 text-sm"
                >
                  Password
                </Label>
                <Input
                  id="password"
                  type="password"
                  autoComplete={
                    mode === "signin" ? "current-password" : "new-password"
                  }
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading}
                  className="bg-background border-border text-foreground placeholder-muted-foreground focus:border-indigo-500 focus:ring-indigo-500/30"
                />
              </div>

              {/* Confirm password (register only) */}
              {mode === "register" && (
                <div className="space-y-1.5">
                  <Label
                    htmlFor="confirm-password"
                    className="text-foreground/80 text-sm"
                  >
                    Confirm Password
                  </Label>
                  <Input
                    id="confirm-password"
                    type="password"
                    autoComplete="new-password"
                    placeholder="••••••••"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    disabled={loading}
                    className="bg-background border-border text-foreground placeholder-muted-foreground focus:border-indigo-500 focus:ring-indigo-500/30"
                  />
                </div>
              )}

              {/* Submit */}
              <Button
                type="submit"
                disabled={loading}
                className="w-full bg-indigo-600 hover:bg-indigo-500 text-foreground font-semibold mt-2 disabled:opacity-60"
              >
                {loading
                  ? mode === "signin"
                    ? "Signing in…"
                    : "Creating account…"
                  : mode === "signin"
                  ? "Sign In"
                  : "Create Account"}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Footer */}
        <p className="text-center text-xs text-muted-foreground mt-6">
          Powered by{" "}
          <span className="text-indigo-500 font-medium">NEXUS OS</span>
        </p>
      </div>
    </div>
  );
}

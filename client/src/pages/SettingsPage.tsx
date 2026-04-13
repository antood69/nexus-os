import { useState } from "react";
import { useTheme } from "../contexts/ThemeContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Sun, Moon, CreditCard, Coins, ArrowRight, Key, Plus, Trash2, CheckCircle, XCircle, TestTube, Loader2, Cpu, Globe } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { apiRequest } from "@/lib/queryClient";

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

interface UserApiKey {
  id: string;
  provider: string;
  apiKey: string | null;
  endpointUrl: string | null;
  defaultModel: string | null;
  isDefault: number;
  isActive: number;
  createdAt: string;
}

const PROVIDERS = [
  { id: "openai", name: "OpenAI", icon: "🟢", models: ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo", "gpt-3.5-turbo", "o1-preview", "o1-mini"] },
  { id: "anthropic", name: "Anthropic", icon: "🟠", models: ["claude-3.5-sonnet", "claude-3-opus", "claude-3-sonnet", "claude-3-haiku"] },
  { id: "google", name: "Google AI", icon: "🔵", models: ["gemini-2.0-flash", "gemini-1.5-pro", "gemini-1.5-flash"] },
  { id: "mistral", name: "Mistral", icon: "🟣", models: ["mistral-large", "mistral-medium", "mistral-small", "mixtral-8x7b"] },
  { id: "groq", name: "Groq", icon: "⚡", models: ["llama-3.1-70b", "llama-3.1-8b", "mixtral-8x7b", "gemma2-9b"] },
  { id: "ollama", name: "Ollama (Local)", icon: "🏠", models: ["llama3.1", "codellama", "mistral", "phi3", "gemma2"] },
];

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return String(n);
}

export default function SettingsPage() {
  const { theme, setTheme } = useTheme();
  const qc = useQueryClient();
  const [tab, setTab] = useState<"general" | "ai-providers">("general");
  const [showAddKey, setShowAddKey] = useState(false);
  const [addForm, setAddForm] = useState({ provider: "openai", apiKey: "", endpointUrl: "", defaultModel: "", isDefault: false });
  const [testingId, setTestingId] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ id: string; success: boolean } | null>(null);

  const { data: status } = useQuery<TokenStatus>({
    queryKey: ["token-status"],
    queryFn: async () => {
      const res = await fetch("/api/tokens/status");
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });

  const { data: apiKeys = [] } = useQuery<UserApiKey[]>({
    queryKey: ["/api/user-api-keys"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/user-api-keys");
      return res.json();
    },
  });

  const addKeyMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/user-api-keys", {
        provider: addForm.provider,
        apiKey: addForm.apiKey || undefined,
        endpointUrl: addForm.endpointUrl || undefined,
        defaultModel: addForm.defaultModel || undefined,
        isDefault: addForm.isDefault,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/user-api-keys"] });
      setShowAddKey(false);
      setAddForm({ provider: "openai", apiKey: "", endpointUrl: "", defaultModel: "", isDefault: false });
    },
  });

  const deleteKeyMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/user-api-keys/${id}`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/user-api-keys"] }),
  });

  const toggleDefaultMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("PATCH", `/api/user-api-keys/${id}`, { isDefault: true });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/user-api-keys"] }),
  });

  const testKey = async (id: string) => {
    setTestingId(id);
    setTestResult(null);
    try {
      const res = await apiRequest("POST", `/api/user-api-keys/${id}/test`);
      const data = await res.json();
      setTestResult({ id, success: data.success });
    } catch {
      setTestResult({ id, success: false });
    } finally {
      setTestingId(null);
    }
  };

  const plan = status?.plan;
  const pct = plan ? Math.min((plan.tokensUsed / plan.monthlyTokens) * 100, 100) : 0;
  const selectedProvider = PROVIDERS.find(p => p.id === addForm.provider);

  const TABS = [
    { id: "general" as const, label: "General" },
    { id: "ai-providers" as const, label: "AI Providers" },
  ];

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">Manage your Bunz preferences</p>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 bg-secondary rounded-lg p-1">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
              tab === t.id ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "general" && (
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
      )}

      {tab === "ai-providers" && (
        <div className="space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Key className="w-4 h-4" />
                Your API Keys
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Add your own API keys to use your preferred models across Boss, Bot Builder, App Generator, and Fiverr
              </p>
            </div>
            <Button size="sm" variant="outline" className="text-xs" onClick={() => setShowAddKey(true)}>
              <Plus className="w-3 h-3 mr-1" /> Add Key
            </Button>
          </div>

          {/* Add Key Form */}
          {showAddKey && (
            <div className="border border-primary/30 rounded-lg p-4 bg-primary/5 space-y-3">
              <h3 className="text-xs font-semibold text-foreground">Add API Key</h3>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] text-muted-foreground mb-1 block">Provider</label>
                  <select
                    value={addForm.provider}
                    onChange={e => setAddForm(f => ({ ...f, provider: e.target.value, defaultModel: "" }))}
                    className="w-full bg-background border border-border rounded-md px-2 py-1.5 text-xs text-foreground"
                  >
                    {PROVIDERS.map(p => (
                      <option key={p.id} value={p.id}>{p.icon} {p.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[11px] text-muted-foreground mb-1 block">Default Model</label>
                  <select
                    value={addForm.defaultModel}
                    onChange={e => setAddForm(f => ({ ...f, defaultModel: e.target.value }))}
                    className="w-full bg-background border border-border rounded-md px-2 py-1.5 text-xs text-foreground"
                  >
                    <option value="">Auto</option>
                    {selectedProvider?.models.map(m => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-[11px] text-muted-foreground mb-1 block">
                  {addForm.provider === "ollama" ? "Endpoint URL" : "API Key"}
                </label>
                {addForm.provider === "ollama" ? (
                  <input
                    type="text"
                    placeholder="http://localhost:11434"
                    value={addForm.endpointUrl}
                    onChange={e => setAddForm(f => ({ ...f, endpointUrl: e.target.value }))}
                    className="w-full bg-background border border-border rounded-md px-2 py-1.5 text-xs text-foreground font-mono"
                  />
                ) : (
                  <input
                    type="password"
                    placeholder="sk-..."
                    value={addForm.apiKey}
                    onChange={e => setAddForm(f => ({ ...f, apiKey: e.target.value }))}
                    className="w-full bg-background border border-border rounded-md px-2 py-1.5 text-xs text-foreground font-mono"
                  />
                )}
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="isDefault"
                  checked={addForm.isDefault}
                  onChange={e => setAddForm(f => ({ ...f, isDefault: e.target.checked }))}
                  className="rounded border-border"
                />
                <label htmlFor="isDefault" className="text-xs text-muted-foreground">Set as default provider</label>
              </div>

              <div className="flex gap-2 pt-1">
                <Button size="sm" className="text-xs" onClick={() => addKeyMutation.mutate()} disabled={addKeyMutation.isPending}>
                  {addKeyMutation.isPending ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Plus className="w-3 h-3 mr-1" />}
                  Save Key
                </Button>
                <Button size="sm" variant="ghost" className="text-xs" onClick={() => setShowAddKey(false)}>Cancel</Button>
              </div>
            </div>
          )}

          {/* Key List */}
          {apiKeys.length === 0 && !showAddKey && (
            <div className="border border-border rounded-lg p-8 text-center">
              <Cpu className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm text-foreground font-medium">No API keys configured</p>
              <p className="text-xs text-muted-foreground mt-1">
                Add your own API keys to use GPT-4, Claude, Gemini, or run models locally with Ollama
              </p>
              <Button size="sm" variant="outline" className="mt-3 text-xs" onClick={() => setShowAddKey(true)}>
                <Plus className="w-3 h-3 mr-1" /> Add Your First Key
              </Button>
            </div>
          )}

          {apiKeys.map(key => {
            const provider = PROVIDERS.find(p => p.id === key.provider);
            const isTesting = testingId === key.id;
            const result = testResult?.id === key.id ? testResult : null;

            return (
              <div key={key.id} className="border border-border rounded-lg p-4 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-lg">{provider?.icon || "🔑"}</span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-foreground">{provider?.name || key.provider}</p>
                      {key.isDefault ? (
                        <Badge variant="default" className="text-[10px] px-1.5 py-0">Default</Badge>
                      ) : null}
                      {key.isActive ? (
                        <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                      ) : (
                        <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground font-mono truncate">
                      {key.provider === "ollama" ? (key.endpointUrl || "localhost:11434") : (key.apiKey || "No key set")}
                      {key.defaultModel && <span className="ml-2 text-primary">· {key.defaultModel}</span>}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1 flex-shrink-0">
                  {/* Test */}
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 w-7 p-0"
                    onClick={() => testKey(key.id)}
                    disabled={isTesting}
                    title="Test connection"
                  >
                    {isTesting ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : result ? (
                      result.success ? <CheckCircle className="w-3.5 h-3.5 text-green-500" /> : <XCircle className="w-3.5 h-3.5 text-red-500" />
                    ) : (
                      <TestTube className="w-3.5 h-3.5" />
                    )}
                  </Button>

                  {/* Set default */}
                  {!key.isDefault && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2 text-[10px]"
                      onClick={() => toggleDefaultMutation.mutate(key.id)}
                    >
                      Set Default
                    </Button>
                  )}

                  {/* Delete */}
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                    onClick={() => deleteKeyMutation.mutate(key.id)}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            );
          })}

          {/* Info box */}
          <div className="border border-border rounded-lg p-4 bg-muted/30">
            <h3 className="text-xs font-semibold text-foreground flex items-center gap-2 mb-2">
              <Globe className="w-3.5 h-3.5" />
              How BYOK Works
            </h3>
            <ul className="text-[11px] text-muted-foreground space-y-1.5">
              <li>• Your API keys are encrypted and stored securely — never shared</li>
              <li>• Use the model selector dropdown in Boss, Bot Builder, App Generator, and Fiverr to pick your model</li>
              <li>• Ollama lets you run models locally — no API key needed, just set your endpoint URL</li>
              <li>• If no key is configured, Bunz uses its built-in API (uses your token balance)</li>
              <li>• Set a default provider to use it automatically across all features</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}

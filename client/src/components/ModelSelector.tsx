import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Cpu, ChevronDown, Zap, Key } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { AI_PROVIDERS, getProvider } from "@/lib/ai-providers";

interface UserApiKey {
  id: string;
  provider: string;
  apiKey: string | null;
  endpointUrl: string | null;
  defaultModel: string | null;
  isDefault: number;
  isActive: number;
}

interface ModelSelectorProps {
  value?: { provider: string; model: string } | null;
  onChange?: (val: { provider: string; model: string } | null) => void;
  compact?: boolean;
}

export default function ModelSelector({ value, onChange, compact }: ModelSelectorProps) {
  const [open, setOpen] = useState(false);

  const { data: apiKeys = [] } = useQuery<UserApiKey[]>({
    queryKey: ["/api/user-api-keys"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/user-api-keys");
      return res.json();
    },
  });

  const activeProviders = apiKeys.filter(k => k.isActive);
  const defaultKey = apiKeys.find(k => k.isDefault);

  useEffect(() => {
    if (!value && defaultKey && onChange) {
      const provInfo = getProvider(defaultKey.provider);
      onChange({
        provider: defaultKey.provider,
        model: defaultKey.defaultModel || provInfo?.models[0]?.id || "",
      });
    }
  }, [defaultKey]);

  const currentProvider = value?.provider ? getProvider(value.provider) : null;
  const currentModel = currentProvider?.models.find(m => m.id === value?.model);
  const displayLabel = value
    ? `${currentProvider?.icon || "🤖"} ${currentModel?.name || value.model || currentProvider?.name || value.provider}`
    : "Bunz Default";

  if (activeProviders.length === 0) {
    return (
      <div className={`flex items-center gap-1.5 text-muted-foreground ${compact ? "text-[10px]" : "text-xs"}`}>
        <Cpu className="w-3 h-3" />
        <span>Bunz AI</span>
      </div>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className={`flex items-center gap-1.5 px-2 py-1 rounded-md border border-border bg-background hover:bg-secondary transition-colors ${
          compact ? "text-[10px]" : "text-xs"
        } text-foreground`}
      >
        <span className="truncate max-w-[140px]">{displayLabel}</span>
        <ChevronDown className={`w-3 h-3 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1 z-50 w-64 bg-card border border-border rounded-lg shadow-lg overflow-hidden max-h-[400px] overflow-y-auto">
            {/* Bunz Default option */}
            <button
              onClick={() => { onChange?.(null); setOpen(false); }}
              className={`w-full flex items-center gap-2 px-3 py-2 text-xs text-left hover:bg-secondary transition-colors ${
                !value ? "bg-primary/10 text-primary" : "text-foreground"
              }`}
            >
              <Zap className="w-3 h-3" />
              <span>Bunz Default (uses tokens)</span>
            </button>

            <div className="h-px bg-border" />

            {/* User providers with full model lists */}
            {activeProviders.map(key => {
              const provInfo = getProvider(key.provider);
              if (!provInfo) return null;

              // Group models by tier
              const flagship = provInfo.models.filter(m => m.tier === "flagship");
              const standard = provInfo.models.filter(m => m.tier === "standard");
              const fast = provInfo.models.filter(m => m.tier === "fast");
              const legacy = provInfo.models.filter(m => m.tier === "legacy");
              const groups = [
                { label: null, models: flagship },
                { label: null, models: standard },
                { label: "Fast", models: fast },
                { label: "Legacy", models: legacy },
              ].filter(g => g.models.length > 0);

              return (
                <div key={key.id}>
                  <div className="px-3 py-1.5 text-[10px] font-semibold text-muted-foreground flex items-center gap-1.5 bg-muted/30 sticky top-0">
                    <span>{provInfo.icon}</span>
                    <span>{provInfo.name}</span>
                    {key.isDefault && <span className="text-primary">(default)</span>}
                    <Key className="w-2.5 h-2.5 ml-auto text-muted-foreground/50" />
                  </div>
                  {groups.map((group, gi) => (
                    <div key={gi}>
                      {group.label && (
                        <div className="px-3 py-0.5 text-[9px] uppercase tracking-wider text-muted-foreground/50 pl-7">
                          {group.label}
                        </div>
                      )}
                      {group.models.map(model => (
                        <button
                          key={model.id}
                          onClick={() => {
                            onChange?.({ provider: key.provider, model: model.id });
                            setOpen(false);
                          }}
                          className={`w-full flex items-center justify-between gap-2 px-3 py-1.5 text-xs text-left hover:bg-secondary transition-colors ${
                            value?.provider === key.provider && value?.model === model.id ? "bg-primary/10 text-primary" : "text-foreground"
                          }`}
                        >
                          <span className="pl-4 truncate">{model.name}</span>
                          {model.context && (
                            <span className="text-[9px] text-muted-foreground/60 flex-shrink-0">{model.context}</span>
                          )}
                        </button>
                      ))}
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

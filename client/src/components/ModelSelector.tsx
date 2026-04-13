import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Cpu, ChevronDown, Zap, Key } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

interface UserApiKey {
  id: string;
  provider: string;
  apiKey: string | null;
  endpointUrl: string | null;
  defaultModel: string | null;
  isDefault: number;
  isActive: number;
}

const PROVIDER_MODELS: Record<string, { name: string; icon: string; models: string[] }> = {
  openai: { name: "OpenAI", icon: "🟢", models: ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo", "gpt-3.5-turbo", "o1-preview", "o1-mini"] },
  anthropic: { name: "Anthropic", icon: "🟠", models: ["claude-3.5-sonnet", "claude-3-opus", "claude-3-sonnet", "claude-3-haiku"] },
  google: { name: "Google AI", icon: "🔵", models: ["gemini-2.0-flash", "gemini-1.5-pro", "gemini-1.5-flash"] },
  mistral: { name: "Mistral", icon: "🟣", models: ["mistral-large", "mistral-medium", "mistral-small", "mixtral-8x7b"] },
  groq: { name: "Groq", icon: "⚡", models: ["llama-3.1-70b", "llama-3.1-8b", "mixtral-8x7b", "gemma2-9b"] },
  ollama: { name: "Ollama", icon: "🏠", models: ["llama3.1", "codellama", "mistral", "phi3", "gemma2"] },
};

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

  // Find active providers (ones user has keys for)
  const activeProviders = apiKeys.filter(k => k.isActive);
  const defaultKey = apiKeys.find(k => k.isDefault);

  // Auto-select default if no value set
  useEffect(() => {
    if (!value && defaultKey && onChange) {
      onChange({
        provider: defaultKey.provider,
        model: defaultKey.defaultModel || PROVIDER_MODELS[defaultKey.provider]?.models[0] || "",
      });
    }
  }, [defaultKey]);

  const currentProvider = value?.provider ? PROVIDER_MODELS[value.provider] : null;
  const displayLabel = value
    ? `${currentProvider?.icon || "🤖"} ${value.model || currentProvider?.name || value.provider}`
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
        <span className="truncate max-w-[120px]">{displayLabel}</span>
        <ChevronDown className={`w-3 h-3 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1 z-50 w-56 bg-card border border-border rounded-lg shadow-lg overflow-hidden">
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

            {/* User providers */}
            {activeProviders.map(key => {
              const provInfo = PROVIDER_MODELS[key.provider];
              if (!provInfo) return null;

              return (
                <div key={key.id}>
                  <div className="px-3 py-1.5 text-[10px] font-semibold text-muted-foreground flex items-center gap-1.5 bg-muted/30">
                    <span>{provInfo.icon}</span>
                    <span>{provInfo.name}</span>
                    {key.isDefault && <span className="text-primary">(default)</span>}
                    <Key className="w-2.5 h-2.5 ml-auto text-muted-foreground/50" />
                  </div>
                  {provInfo.models.map(model => (
                    <button
                      key={model}
                      onClick={() => {
                        onChange?.({ provider: key.provider, model });
                        setOpen(false);
                      }}
                      className={`w-full flex items-center gap-2 px-3 py-1.5 text-xs text-left hover:bg-secondary transition-colors ${
                        value?.provider === key.provider && value?.model === model ? "bg-primary/10 text-primary" : "text-foreground"
                      }`}
                    >
                      <span className="pl-4">{model}</span>
                    </button>
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

// ── AI Provider & Model Registry ─────────────────────────────────────────────
// Single source of truth for all BYOK providers and their available models.
// Used by ModelSelector, SettingsPage, and any page needing provider info.

export interface AIModel {
  id: string;
  name: string;
  context?: string;  // e.g. "128K", "1M"
  tier?: "flagship" | "standard" | "fast" | "legacy";
}

export interface AIProvider {
  id: string;
  name: string;
  icon: string;
  description: string;
  keyPlaceholder: string;
  models: AIModel[];
}

export const AI_PROVIDERS: AIProvider[] = [
  {
    id: "openai",
    name: "OpenAI",
    icon: "🟢",
    description: "GPT-5, GPT-4.1, and reasoning models",
    keyPlaceholder: "sk-...",
    models: [
      // GPT-5 family
      { id: "gpt-5", name: "GPT-5", context: "128K", tier: "flagship" },
      { id: "gpt-5-mini", name: "GPT-5 Mini", context: "128K", tier: "standard" },
      { id: "gpt-5-nano", name: "GPT-5 Nano", context: "128K", tier: "fast" },
      // GPT-5.4 family
      { id: "gpt-5.4", name: "GPT-5.4", context: "128K", tier: "flagship" },
      { id: "gpt-5.4-mini", name: "GPT-5.4 Mini", context: "128K", tier: "standard" },
      { id: "gpt-5.4-nano", name: "GPT-5.4 Nano", context: "128K", tier: "fast" },
      // GPT-4.1 family
      { id: "gpt-4.1", name: "GPT-4.1", context: "1M", tier: "standard" },
      { id: "gpt-4.1-mini", name: "GPT-4.1 Mini", context: "1M", tier: "fast" },
      { id: "gpt-4.1-nano", name: "GPT-4.1 Nano", context: "1M", tier: "fast" },
      // Multimodal / Audio
      { id: "gpt-4o", name: "GPT-4o (Audio)", context: "128K", tier: "legacy" },
      { id: "gpt-4o-mini", name: "GPT-4o Mini (Audio)", context: "128K", tier: "legacy" },
      // Open-weight
      { id: "gpt-oss-120b", name: "GPT-OSS 120B (Open)", context: "128K", tier: "standard" },
      { id: "gpt-oss-20b", name: "GPT-OSS 20B (Open)", context: "128K", tier: "fast" },
    ],
  },
  {
    id: "anthropic",
    name: "Anthropic",
    icon: "🟠",
    description: "Claude Opus, Sonnet, and Haiku models",
    keyPlaceholder: "sk-ant-...",
    models: [
      // Claude 4.6
      { id: "claude-opus-4-6", name: "Claude Opus 4.6", context: "1M", tier: "flagship" },
      { id: "claude-sonnet-4-6", name: "Claude Sonnet 4.6", context: "1M", tier: "flagship" },
      // Claude 4.5
      { id: "claude-opus-4-5", name: "Claude Opus 4.5", context: "200K", tier: "standard" },
      { id: "claude-sonnet-4-5", name: "Claude Sonnet 4.5", context: "200K", tier: "standard" },
      { id: "claude-haiku-4-5", name: "Claude Haiku 4.5", context: "200K", tier: "fast" },
      // Claude 4.1
      { id: "claude-opus-4-1", name: "Claude Opus 4.1", context: "200K", tier: "legacy" },
      // Claude 4
      { id: "claude-sonnet-4", name: "Claude Sonnet 4", context: "200K", tier: "legacy" },
      // Claude 3.7
      { id: "claude-sonnet-3-7", name: "Claude Sonnet 3.7", context: "200K", tier: "legacy" },
    ],
  },
  {
    id: "google",
    name: "Google AI",
    icon: "🔵",
    description: "Gemini 3, 2.5, and Gemma open models",
    keyPlaceholder: "AIza...",
    models: [
      // Gemini 3 family (Preview)
      { id: "gemini-3-flash", name: "Gemini 3 Flash", context: "1M", tier: "flagship" },
      { id: "gemini-3-1-flash-lite", name: "Gemini 3.1 Flash-Lite", context: "1M", tier: "fast" },
      { id: "gemini-3-1-pro", name: "Gemini 3.1 Pro", context: "1M", tier: "flagship" },
      // Gemini 2.5 family (GA)
      { id: "gemini-2.5-pro", name: "Gemini 2.5 Pro", context: "1M", tier: "flagship" },
      { id: "gemini-2.5-flash", name: "Gemini 2.5 Flash", context: "1M", tier: "standard" },
      { id: "gemini-2.5-flash-lite", name: "Gemini 2.5 Flash-Lite", context: "1M", tier: "fast" },
      // Gemini 2.0 family
      { id: "gemini-2.0-flash", name: "Gemini 2.0 Flash", context: "1M", tier: "standard" },
      { id: "gemini-2.0-flash-lite", name: "Gemini 2.0 Flash-Lite", context: "1M", tier: "fast" },
      // Gemma open models
      { id: "gemma-4", name: "Gemma 4 (Open)", context: "128K", tier: "standard" },
      { id: "gemma-3", name: "Gemma 3 (Open)", context: "128K", tier: "fast" },
      { id: "gemma-3n", name: "Gemma 3n (Edge)", context: "128K", tier: "fast" },
    ],
  },
  {
    id: "mistral",
    name: "Mistral",
    icon: "🟣",
    description: "Mistral Large 3, Small 4, Codestral, Ministral",
    keyPlaceholder: "...",
    models: [
      // Flagship
      { id: "mistral-large-latest", name: "Mistral Large 3", context: "256K", tier: "flagship" },
      { id: "mistral-small-latest", name: "Mistral Small 4", context: "256K", tier: "standard" },
      { id: "mistral-medium-latest", name: "Mistral Medium", context: "256K", tier: "standard" },
      // Code
      { id: "codestral-latest", name: "Codestral", context: "256K", tier: "flagship" },
      { id: "devstral-latest", name: "Devstral (Agents)", context: "256K", tier: "standard" },
      // Edge / Ministral
      { id: "ministral-14b", name: "Ministral 14B", context: "128K", tier: "fast" },
      { id: "ministral-8b", name: "Ministral 8B", context: "128K", tier: "fast" },
      { id: "ministral-3b", name: "Ministral 3B", context: "128K", tier: "fast" },
      // Nemo
      { id: "open-mistral-nemo", name: "Mistral Nemo (Open)", context: "128K", tier: "fast" },
    ],
  },
  {
    id: "groq",
    name: "Groq",
    icon: "⚡",
    description: "Ultra-fast inference — Llama, GPT-OSS, Qwen",
    keyPlaceholder: "gsk_...",
    models: [
      { id: "llama-3.3-70b-versatile", name: "Llama 3.3 70B", context: "128K", tier: "flagship" },
      { id: "llama-3.1-8b-instant", name: "Llama 3.1 8B Instant", context: "128K", tier: "fast" },
      { id: "meta-llama/llama-4-scout-17b-16e-instruct", name: "Llama 4 Scout 17B", context: "128K", tier: "standard" },
      { id: "openai/gpt-oss-120b", name: "GPT-OSS 120B", context: "128K", tier: "flagship" },
      { id: "openai/gpt-oss-20b", name: "GPT-OSS 20B", context: "128K", tier: "standard" },
      { id: "qwen/qwen3-32b", name: "Qwen 3 32B", context: "128K", tier: "standard" },
      { id: "groq/compound", name: "Compound (Agentic)", context: "128K", tier: "flagship" },
      { id: "groq/compound-mini", name: "Compound Mini", context: "128K", tier: "fast" },
    ],
  },
  {
    id: "ollama",
    name: "Ollama (Local)",
    icon: "🏠",
    description: "Run models locally — no API key needed",
    keyPlaceholder: "http://localhost:11434",
    models: [
      // Qwen family
      { id: "qwen3.5:27b", name: "Qwen 3.5 27B", context: "128K", tier: "flagship" },
      { id: "qwen3.5:9b", name: "Qwen 3.5 9B", context: "128K", tier: "standard" },
      { id: "qwen3:32b", name: "Qwen 3 32B", context: "128K", tier: "flagship" },
      { id: "qwen3:8b", name: "Qwen 3 8B", context: "128K", tier: "fast" },
      { id: "qwen2.5-coder:7b", name: "Qwen 2.5 Coder 7B", context: "128K", tier: "standard" },
      // Llama family
      { id: "llama3.1:70b", name: "Llama 3.1 70B", context: "128K", tier: "flagship" },
      { id: "llama3.1:8b", name: "Llama 3.1 8B", context: "128K", tier: "standard" },
      { id: "llama3.2:3b", name: "Llama 3.2 3B", context: "128K", tier: "fast" },
      // Gemma
      { id: "gemma2:27b", name: "Gemma 2 27B", context: "128K", tier: "standard" },
      { id: "gemma2:9b", name: "Gemma 2 9B", context: "128K", tier: "fast" },
      // Code
      { id: "codellama:34b", name: "Code Llama 34B", context: "128K", tier: "standard" },
      { id: "codellama:7b", name: "Code Llama 7B", context: "128K", tier: "fast" },
      // Mistral
      { id: "mistral:7b", name: "Mistral 7B", context: "128K", tier: "fast" },
      // DeepSeek
      { id: "deepseek-r1:8b", name: "DeepSeek R1 8B", context: "128K", tier: "standard" },
      // Phi
      { id: "phi3:14b", name: "Phi-3 14B", context: "128K", tier: "standard" },
      { id: "phi3:mini", name: "Phi-3 Mini", context: "128K", tier: "fast" },
    ],
  },
];

// Helper to get a flat list of model IDs for a provider
export function getModelsForProvider(providerId: string): string[] {
  const provider = AI_PROVIDERS.find(p => p.id === providerId);
  return provider ? provider.models.map(m => m.id) : [];
}

// Helper to get provider by ID
export function getProvider(providerId: string): AIProvider | undefined {
  return AI_PROVIDERS.find(p => p.id === providerId);
}

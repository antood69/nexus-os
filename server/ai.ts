// dotenv loaded in server/index.ts before this module runs
import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface AiResponse {
  reply: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}

const SYSTEM_DEFAULT =
  "You are a focused AI agent inside Bunz, an AI orchestration platform. Be concise, action-oriented, and helpful.";

function claudeClient() {
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
}

function openaiClient() {
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

function perplexityClient() {
  return new OpenAI({
    apiKey: process.env.PERPLEXITY_API_KEY,
    baseURL: "https://api.perplexity.ai",
  });
}

/**
 * Route a chat request to Claude, GPT-4o, or Perplexity based on the agent's model.
 * Returns an AiResponse with the reply text and token usage counts.
 */
export async function runAgentChat(
  model: string,
  systemPrompt: string | null | undefined,
  history: ChatMessage[],
  userMessage: string
): Promise<AiResponse> {
  const system = systemPrompt?.trim() || SYSTEM_DEFAULT;

  const msgs: ChatMessage[] = [
    ...history.slice(-20),
    { role: "user", content: userMessage },
  ];

  // ── Claude Sonnet / Opus ────────────────────────────────────────────────
  if (model === "claude-sonnet" || model === "claude-opus") {
    const claudeModel =
      model === "claude-opus" ? "claude-opus-4-5" : "claude-sonnet-4-5";

    const response = await claudeClient().messages.create({
      model: claudeModel,
      max_tokens: 1024,
      system,
      messages: msgs.map((m) => ({ role: m.role, content: m.content })),
    });

    const block = response.content[0];
    const reply = block.type === "text" ? block.text : "[No response]";
    return {
      reply,
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
      totalTokens: response.usage.input_tokens + response.usage.output_tokens,
    };
  }

  // ── GPT-4o ─────────────────────────────────────────────────────────────
  if (model === "gpt-4o") {
    const response = await openaiClient().chat.completions.create({
      model: "gpt-4o",
      max_tokens: 1024,
      messages: [
        { role: "system", content: system },
        ...msgs.map((m) => ({ role: m.role, content: m.content })),
      ],
    });
    return {
      reply: response.choices[0]?.message?.content ?? "[No response]",
      inputTokens: response.usage?.prompt_tokens ?? 0,
      outputTokens: response.usage?.completion_tokens ?? 0,
      totalTokens: (response.usage?.prompt_tokens ?? 0) + (response.usage?.completion_tokens ?? 0),
    };
  }

  // ── Perplexity (sonar — real-time web search built in) ──────────────────
  // Perplexity enforces strict user/assistant alternation — deduplicate
  if (model === "perplexity") {
    const dedupedMsgs: ChatMessage[] = [];
    for (const m of msgs) {
      const last = dedupedMsgs[dedupedMsgs.length - 1];
      if (last && last.role === m.role) {
        // Merge consecutive same-role messages
        last.content += "\n" + m.content;
      } else {
        dedupedMsgs.push({ ...m });
      }
    }
    // Must start with user
    if (dedupedMsgs[0]?.role === "assistant") dedupedMsgs.shift();

    const response = await perplexityClient().chat.completions.create({
      model: "sonar",
      max_tokens: 1024,
      messages: [
        { role: "system", content: system },
        ...dedupedMsgs.map((m) => ({ role: m.role, content: m.content })),
      ],
    } as any);
    return {
      reply: (response as any).choices[0]?.message?.content ?? "[No response]",
      inputTokens: (response as any).usage?.prompt_tokens ?? 0,
      outputTokens: (response as any).usage?.completion_tokens ?? 0,
      totalTokens: ((response as any).usage?.prompt_tokens ?? 0) + ((response as any).usage?.completion_tokens ?? 0),
    };
  }

  return { reply: `[${model}] Model not configured.`, inputTokens: 0, outputTokens: 0, totalTokens: 0 };
}

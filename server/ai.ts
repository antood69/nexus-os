// dotenv loaded in server/index.ts before this module runs
import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

const SYSTEM_DEFAULT =
  "You are a focused AI agent inside NEXUS OS, an AI orchestration platform. Be concise, action-oriented, and helpful.";

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
 * Returns the assistant reply as a string.
 */
export async function runAgentChat(
  model: string,
  systemPrompt: string | null | undefined,
  history: ChatMessage[],
  userMessage: string
): Promise<string> {
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
    return block.type === "text" ? block.text : "[No response]";
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
    return response.choices[0]?.message?.content ?? "[No response]";
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
    return (response as any).choices[0]?.message?.content ?? "[No response]";
  }

  return `[${model}] Model not configured.`;
}

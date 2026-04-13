# Bunz Full Send Spec — Complete All Features

## CRITICAL RULES
- All code exists at `/home/user/workspace/nexus-fresh`
- DO NOT re-scaffold or overwrite working features — ADD to them or FIX broken parts
- Use `apiRequest` from `@/lib/queryClient` for ALL fetch calls in frontend
- SQLite columns use snake_case, TypeScript interfaces use camelCase
- Use raw SQLite with `sqlite.prepare()` for new tables (like existing patterns in storage.ts)
- Use `safeAlter()` pattern for DB migrations
- The app uses wouter with useHashLocation — routes are hash-based
- Use lucide-react for icons
- Server AI module is at `server/ai.ts` — uses `runAgentChat(model, systemPrompt, history, userMessage)`
- Provider model config is at `client/src/lib/ai-providers.ts`
- ModelSelector component is at `client/src/components/ModelSelector.tsx`

## TASK 1: Fix Marketplace Grey Screen
**File: `client/src/pages/MarketplacePage.tsx`**

The frontend sends `sort` and `price` params but the backend (`server/marketplace.ts`) expects `sortBy` and `priceType`. Also the backend returns `{ listings, total }` but the frontend query expects a raw array.

Fix in MarketplacePage.tsx:
- Change `params.set("sort", sort)` → `params.set("sortBy", sort)`
- Change `params.set("price", priceFilter)` → `params.set("priceType", priceFilter === "free" ? "free" : priceFilter === "paid" ? "one_time" : undefined)`
- Parse response: the queryFn should extract `.listings` from the JSON response

Also the `categoriesQuery` endpoint — check that `/api/marketplace/categories` exists in marketplace.ts and returns the right format.

## TASK 2: Wire BYOK Keys Into AI Endpoints
**File: `server/ai.ts`**

Current `runAgentChat()` only supports hardcoded `claude-sonnet`, `claude-opus`, `gpt-4o`, `perplexity`. Need to add BYOK support.

Add a new function `runAgentChatWithUserKey()` that:
1. Takes an optional `userApiKeyId` parameter
2. If provided, looks up the key from storage (import storage from "./storage")
3. Creates a provider-specific client using the USER's API key instead of the server env var
4. Supports all 6 providers: openai, anthropic, google, mistral, groq, ollama
5. Falls back to existing `runAgentChat()` if no user key provided

For each provider:
- **OpenAI**: Use `openai` npm package with user's key
- **Anthropic**: Use `@anthropic-ai/sdk` with user's key
- **Google**: Use `@google/generative-ai` (install it) with user's key
- **Mistral**: Use OpenAI-compatible endpoint at `https://api.mistral.ai/v1` with user's key
- **Groq**: Use OpenAI-compatible endpoint at `https://api.groq.com/openai/v1` with user's key
- **Ollama**: Use OpenAI-compatible endpoint at user's `endpointUrl` (default `http://localhost:11434/v1`)

**Files: `server/routes.ts`**

Update these endpoints to accept optional `provider` and `model` from request body, and look up user's key:

1. `POST /api/jarvis/chat` (line ~339) — add `provider`, `model` to body destructuring. If provided, look up user's default key for that provider and use `runAgentChatWithUserKey()`
2. `POST /api/trading-bots/:id/generate` (line ~1035) — same pattern
3. `POST /api/fiverr-orders/:id/generate` (line ~1148) — same pattern  
4. `POST /api/generated-apps/:id/generate` (line ~1220) — same pattern

Pattern for each endpoint:
```typescript
const { provider, model } = req.body;
let aiModel = "claude-sonnet";
let userKeyId: string | undefined;
if (provider && model) {
  const userId = req.user?.id || 1;
  const keys = await storage.getUserApiKeys(userId);
  const key = keys.find(k => k.provider === provider && k.isActive);
  if (key) {
    userKeyId = key.id;
    aiModel = model;
  }
}
// Then use: runAgentChatWithUserKey(aiModel, systemPrompt, history, message, userKeyId)
```

**Frontend changes:**
The Boss page (`BossPage.tsx`) already has `selectedModel` state. Update the `sendMessage` function to include `provider` and `model` in the POST body to `/api/jarvis/chat`.

## TASK 3: App Generator Upgrades  
**File: `client/src/pages/AppGeneratorPage.tsx`**

Add these features to the existing IDE view:

### Live Preview
Add an iframe panel that renders the generated HTML/JS/CSS. When a user has generated code:
- Parse the generated code for an index.html file
- Create a blob URL and render it in an iframe
- Add a "Preview" toggle button in the IDE toolbar
- The preview panel sits to the right of the code editor (or below on mobile)

### Version Snapshots
Add version tracking:
- When code is generated, save a snapshot with timestamp
- Add a "Versions" dropdown in the toolbar showing previous generations
- Clicking a version loads that code into the editor
- Store versions in a `generatedCode` JSON array on the app record (or as separate field `versions TEXT` in the generated_apps table)

### Real ZIP Export
Replace the current blob download with a proper ZIP:
- Install JSZip (it's a client-side library): `import JSZip from 'jszip'`
- Parse the generated code's file tree
- Create a real ZIP with proper file structure
- Download as `appname.zip`

Add to storage.ts: `safeAlter("generated_apps", "versions", "TEXT")` for version tracking.

## TASK 4: Jarvis TTS/STT
**File: `server/routes.ts` (lines ~1166-1182)**

Wire up real TTS using OpenAI's TTS API (it's already imported as `openai` in ai.ts):

### TTS endpoint (`POST /api/jarvis/tts`):
```typescript
app.post("/api/jarvis/tts", async (req, res) => {
  const { text, voice } = req.body;
  if (!text) return res.status(400).json({ error: "text required" });
  
  // Map Bunz voice names to OpenAI voice IDs
  const voiceMap: Record<string, string> = {
    jarvis: "onyx",    // deep male
    nova: "nova",      // professional female
    echo: "echo",      // casual male
    sage: "shimmer",   // warm female
    atlas: "fable",    // authoritative male
  };
  
  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const mp3 = await openai.audio.speech.create({
      model: "tts-1",
      voice: voiceMap[voice || "jarvis"] || "onyx",
      input: text,
    });
    const buffer = Buffer.from(await mp3.arrayBuffer());
    res.set({ "Content-Type": "audio/mpeg", "Content-Length": buffer.length });
    res.send(buffer);
  } catch (err: any) {
    // If no OpenAI key, return placeholder
    res.json({ audioUrl: null, error: err.message });
  }
});
```

### STT endpoint (`POST /api/jarvis/stt`):
```typescript
app.post("/api/jarvis/stt", async (req, res) => {
  // Accept audio as base64 in body
  const { audio } = req.body; // base64 encoded audio
  if (!audio) return res.status(400).json({ error: "audio required" });
  
  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const buffer = Buffer.from(audio, "base64");
    const file = new File([buffer], "audio.webm", { type: "audio/webm" });
    const transcription = await openai.audio.transcriptions.create({
      model: "whisper-1",
      file: file,
    });
    res.json({ transcript: transcription.text });
  } catch (err: any) {
    res.json({ transcript: null, error: err.message });
  }
});
```

**File: `client/src/pages/JarvisPage.tsx`**
Update to actually use TTS/STT:
- After getting AI response, POST to `/api/jarvis/tts` with the reply text and selected voice
- Play the returned audio using `new Audio(URL.createObjectURL(blob))`
- Add a "Push to Talk" mode using MediaRecorder API to record audio → base64 → POST to `/api/jarvis/stt`
- Show real waveform visualization while speaking (use AudioContext analyser)

## TASK 5: Dashboard Upgrade
**File: `client/src/pages/Dashboard.tsx`**

Upgrade from basic dashboard to a real command center with:

1. **Activity Feed** — Recent actions across the platform (last 10 trades, bot signals, gig orders, app generations). Query `/api/activity-feed` endpoint.
2. **Quick Stats Grid** — 4 cards: Total Token Usage, Active Bots, Open Orders, Generated Apps count
3. **P&L Chart** — Small sparkline showing trading P&L over time (use a simple SVG-based chart, no heavy library)
4. **Quick Actions** — Buttons for: New Chat, Create Bot, Generate App, New Gig
5. **System Status** — Show connected providers (from user_api_keys), broker connections, active deployments

Add backend endpoint:
```typescript
app.get("/api/activity-feed", async (req, res) => {
  const userId = req.user?.id || 1;
  // Gather recent activity from multiple tables
  const trades = await storage.getTrades(userId, 5);
  const bots = await storage.getTradingBots(userId);
  const orders = await storage.getFiverrOrders(userId);
  const apps = await storage.getGeneratedApps(userId);
  const deployments = await storage.getBotDeployments(userId);
  
  res.json({
    recentTrades: trades.slice(0, 5),
    activeBots: bots.filter(b => b.status === 'generated' || b.status === 'running').length,
    openOrders: orders.filter(o => o.status === 'pending').length,
    totalApps: apps.length,
    activeDeployments: deployments.filter(d => d.status === 'running').length,
  });
});
```

## TASK 6: White Label Rendering Engine  
**File: `client/src/pages/WhiteLabelPage.tsx`**

Upgrade from a config form to include:
- **Live Preview Panel**: Show a mini mockup of the branded Bunz instance using the configured colors, brand name, and logo
- **Feature Toggle Grid**: Checkboxes for each Bunz feature (Boss, Workflows, Agents, Trading, Bot Challenge, Fiverr, App Gen, Jarvis)
- **Theme Preview**: Apply the selected colors to a mini sidebar + header mockup in real-time
- **Export Config**: Button to download the white-label config as JSON
- **Deployment Status**: Show "Ready to Deploy" / "Draft" status with a progress checklist

## TASK 7: Prop Trading Enhancements
**File: `client/src/pages/PropTradingPage.tsx`**

Upgrade with:
- **Drawdown Alerts**: Visual warning bars that change color as drawdown approaches limits (green → yellow → red)
- **Payout Tracker**: Section for funded accounts showing payouts received, next payout date, total earnings
- **Phase Progress**: Visual progress bar showing evaluation → funded → payout stages
- **Aggregate Stats**: Cross-account totals at the top (total balance, total P&L, accounts by status)
- **Auto-calculate fields**: When user enters trades, auto-update current_pnl, check drawdown limits

## TASK 8: Account Stacking Execution Engine
**File: `client/src/pages/AccountStacksPage.tsx` + `server/routes.ts`**

Upgrade with:
- **Copy Status Dashboard**: For each stack, show leader trades and which followers have copied
- **Execution Log**: Table showing copy events with timestamps, trade details, fill status
- **Real-time sync indicator**: Show "Synced" / "Pending" / "Error" per follower
- Add backend endpoint `POST /api/account-stacks/:id/execute` that simulates a copy event
- Add `stack_execution_log` table to track copy events

## TASK 9: Polish Pass
- Ensure all pages have consistent dark mode support
- Mobile check: sidebar collapses, pages stack vertically
- Add error boundaries to catch and display errors gracefully

## GIT
After ALL changes: `git add -A && git commit -m "feat: full send — BYOK wiring, marketplace fix, Jarvis TTS/STT, dashboard upgrade, white label engine, prop trading alerts, account stacking engine, app gen preview/versions/zip"`

Do NOT push — the parent will handle push.

## INSTALL
Run `npm install jszip @google/generative-ai` before building.

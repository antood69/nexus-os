# Bunz — Big Picture Status (April 13, 2026)

## What's Built & Live

### Core Platform (Phases 1-9) ✅
| Feature | Page | Status |
|---------|------|--------|
| Dashboard | `/` | ✅ Live |
| The Boss (AI Chat) | `/boss` | ✅ Live + Model Selector |
| Workflows | `/workflows` | ✅ Live |
| Agents | `/agents` | ✅ Live |
| Auditor | `/audit` | ✅ Live |
| Marketplace | `/marketplace` | ⚠️ Grey screen bug (FIXLIST) |
| Tools | `/tools` | ✅ Live |
| Pricing + Stripe | `/pricing` | ✅ Live |
| Token Usage | `/usage` | ✅ Live |
| Settings | `/settings` | ✅ Live + AI Providers tab |
| Customization | `/customize` | ✅ Live |
| Login + Auth | `/login` | ✅ Live (GitHub OAuth) |
| Admin Panel | `/admin` | ✅ Live (owner-only) |

### Trading Suite ✅
| Feature | Page | Status |
|---------|------|--------|
| Trade Journal (3 tabs: Trades, Calendar, Prop Deals) | `/journal` | ✅ Live |
| Bot Challenge Simulator | `/bot-challenge` | ✅ Live + Model Selector |
| AI Bot Builder (inside Bot Challenge) | `/bot-challenge` → Builder tab | ✅ Live |
| Account Stacking (Multi-account copier) | `/stacks` | ✅ Live |
| Prop Trading Dashboard | `/prop-trading` | ✅ Live |

### AI & Automation ✅
| Feature | Page | Status |
|---------|------|--------|
| Fiverr Automation | `/fiverr` | ✅ Live + Model Selector |
| App Generator (VS Code-like IDE) | `/app-generator` | ✅ Live + Model Selector |
| Jarvis Voice Interface | `/jarvis` | ✅ Live (UI only, TTS/STT placeholder) |
| Jarvis Widget (global floating button) | All pages | ✅ Live |
| White Label Config | `/white-label` | ✅ Live |

### BYOK System ✅
| Component | Status |
|-----------|--------|
| `user_api_keys` table + CRUD | ✅ Done |
| API routes (`/api/user-api-keys`) + test endpoint | ✅ Done |
| Settings > AI Providers tab | ✅ Done |
| Shared `ai-providers.ts` registry | ✅ Done |
| ModelSelector dropdown (Boss, Bot Builder, App Gen, Fiverr) | ✅ Done |
| Full model lists (OpenAI, Anthropic, Google, Mistral, Groq, Ollama) | ✅ Done |

---

## Fix Queue (idris items)
1. **Marketplace grey screen** — flashes then blank

---

## What's NOT Done Yet / Needs Work

### High Priority — Functionality Gaps
1. **AI actually using BYOK keys** — The model selector UI is there, but Boss/Bot Builder/App Gen/Fiverr still call the server's built-in Anthropic key. Need to wire the selected provider+model+user's key into the actual AI chat/generation endpoints.
2. **Jarvis TTS/STT** — Full UI exists but voice is placeholder. Need real text-to-speech (ElevenLabs/OpenAI TTS) and speech-to-text (Whisper) integration.
3. **Bot Deployments → Live Trading** — Table and spec exist but no live connection to broker APIs for automated execution. Currently just a tracking UI.
4. **Marketplace grey screen** — Bug, needs fix.
5. **App Generator live preview** — IDE is built with file tree, syntax highlighting, terminal, AI chat. Missing: actual live preview iframe, version snapshots, real ZIP export (currently just blob download of raw code).

### Medium Priority — Polish & Depth
6. **White Label** — Config page exists but no actual white-label rendering engine. It's a form that saves settings — doesn't actually produce a branded instance.
7. **Prop Trading** — Dashboard exists but no real API connections to prop firms (FTMO, Apex, Topstep etc.). Currently manual entry only.
8. **Account Stacking** — UI for creating stacks exists but no actual trade copy execution engine. It's config-only.
9. **Fiverr** — Gig management and order tracking work. AI draft generation calls the server. Could add real Fiverr API integration later.
10. **Forex Calendar** — Works (proxies Forex Factory JSON). Could add push notifications for high-impact events.

### Low Priority — Nice to Have
11. **Voice models in Jarvis** — UI has voice selector (Jarvis, Nova, Echo, Sage, Atlas) but no actual different voice profiles.
12. **Dashboard widgets** — Dashboard exists but could be more dynamic with real-time stats, charts, activity feed.
13. **Mobile optimization** — MobileTabBar exists, but some pages may not be fully responsive.
14. **Dark/Light mode consistency** — Most pages support it, but some newer pages may have missed spots.

---

## Architecture Summary
- **Frontend:** React + Vite + Tailwind + shadcn/ui + wouter (hash routing)
- **Backend:** Express + SQLite (better-sqlite3) + Drizzle-style raw SQL
- **AI:** Anthropic Claude (server key) + BYOK system ready for multi-provider
- **Auth:** GitHub OAuth + owner detection (reederb46@gmail.com)
- **Payments:** Stripe (4 tiers: Free/Starter/Pro/Agency)
- **Deploy:** Railway (auto-deploy from GitHub)
- **Domain:** bunz.io → Railway

## Pages: 22 total
Dashboard, Boss, Workflows, Workflow Detail, Agents, Agent Chat, Audit, Pricing, Trade Journal, Bot Challenge, Settings, Token Usage, Admin, Marketplace, Marketplace Detail, My Listings, Tools, Customization, Account Stacks, Fiverr, Jarvis, App Generator, White Label, Prop Trading

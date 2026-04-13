# NEXUS OS — Master Plan

## What It Is
NEXUS OS is an AI Agent Orchestrator — a multi-agent platform where one "Boss" AI manages a fleet of specialized worker AIs. Users build workflows, launch agents, and automate complex tasks (Fiverr fulfillment, app generation, trading, content creation) through a clean, professional UI. It's a subscription SaaS with built-in monetization.

---

## Current State (What's Built & Live)

**Live URL:** https://nexus-os-production-50a1.up.railway.app  
**Stack:** Express + Vite + React + Tailwind + shadcn + Drizzle ORM  
**Infra:** Railway (auto-deploy via GraphQL mutation), GitHub (antood69/nexus-os)

### Working Features
- **Dashboard** — KPI cards, workflow overview, agent status, recent activity
- **Jarvis AI Assistant** — Floating orb with idle animation, slide-up overlay with blurred backdrop, Claude API chat, Inter font
- **Workflow Management** — CRUD workflows, workflow detail view with agent pipeline
- **Agent Management** — Create/edit/delete agents, assign to workflows
- **Audit Panel** — Review agent outputs, approve/reject
- **Analytics Page** — Charts and metrics overview
- **Trading Journal** — Trade logging and tracking
- **Bot Challenge Page** — Agent testing sandbox
- **Pricing Page** — Stripe-integrated with Pro/Agency tiers (monthly + annual)
- **Auth** — Login page with session management
- **Theme System** — TradingView-style light/dark toggle in Settings (just fixed — CSS now survives build)
- **Settings Page** — Theme toggle, accessible from sidebar

### Backend
- Full REST API for workflows, agents, jobs, messages, audit reviews
- Stripe integration (checkout, webhooks, portal, subscription management)
- Claude API integration for Jarvis chat
- SQLite storage with Drizzle ORM

---

## The Big Plan — All Phases

### Phase 1: Foundation (DONE)
- [x] Stripe + Auth integration
- [x] Subscription billing (Pro $29/mo, Agency $79/mo)
- [x] Dashboard with KPI metrics
- [x] Basic workflow + agent CRUD
- [x] Jarvis AI assistant (Claude-powered)
- [x] Light/Dark theme system
- [x] Railway deployment pipeline

---

### Phase 2: Token Economy & Usage Billing
**Goal:** Monetize API usage beyond subscriptions. Users get a token allowance per plan, can buy more with a markup.

#### Token Tracking System
- Track tokens per user per request (input + output tokens from Claude/other models)
- Real-time token counter visible in the UI (top bar or sidebar widget)
- Usage history page — daily/weekly/monthly breakdown with charts
- Per-workflow and per-agent token attribution so users see what costs what

#### Plan Limits
| Plan | Monthly Token Allowance | Overage Rate |
|------|------------------------|--------------|
| Free (if added) | 50K tokens | Blocked — must upgrade |
| Pro ($29/mo) | 2M tokens | Buy more at markup |
| Agency ($79/mo) | 10M tokens | Buy more at markup |

- Soft limit warnings at 80% and 95% usage
- Hard limit option (stop agents) or soft limit (allow overage, bill later)
- Dashboard widget showing tokens used / remaining with progress bar

#### "Buy More" Top-Up System
- One-click token packs: 500K / 2M / 5M tokens
- Small markup over our actual API cost (e.g., we pay ~$3/M tokens, charge $5-8/M)
- Stripe one-time payment for packs (not subscription)
- Auto-refill option: "When I hit 90%, auto-buy 1M more"
- Token packs never expire (roll over month to month)
- Clear, friendly pricing — no hidden fees, show $/token so users feel in control

#### Why This Matters for Users
- Predictable costs — they know exactly what they're paying
- No surprise bills — soft warnings before limits
- Feels generous — included tokens are substantial
- Power users can scale without switching plans

---

### Phase 3: Orchestrator Core (Multi-Agent Engine)
**Goal:** The real brain — Boss agent routes tasks to specialized workers.

- **Boss Agent** — Claude-powered planner that analyzes tasks, creates subtasks, picks worker agents, sets execution order, synthesizes final results
- **Worker Agent Types:**
  - Researcher — web search, data gathering, competitive analysis
  - Coder — code generation, debugging, refactoring
  - Writer — content creation, copywriting, documentation
  - Art Generator — image generation (DALL-E, Stable Diffusion, Flux)
  - Reviewer — quality checks, code review, fact-checking
  - Data Analyst — number crunching, chart generation, insights
  - Browser Agent — web automation, form filling, data extraction
- **Shared Workspace** — all agents read/write to a common state layer so they see each other's work in real time
- **Agent-to-Agent Communication** — direct message passing and artifact handoff between agents
- **Human-in-the-Loop (HITL) Gates** — configurable checkpoints where a human must approve before the workflow continues (critical for anything touching money or public-facing outputs)
- **Execution Modes:**
  - Sequential — agents run one after another
  - Parallel — independent agents run simultaneously
  - Conditional — branching based on agent output
- **Cost Controls** — per-workflow budget caps, per-agent token limits, kill switch

---

### Phase 4: n8n-Style Visual Workflow Editor
**Goal:** Full drag-and-drop workflow builder — users click into a workflow and get a visual canvas like n8n.

- **Visual Canvas** — drag-and-drop nodes connected by wires, zoom/pan, minimap
- **Node Types:**
  - Trigger nodes (webhook, schedule, manual, event-based)
  - Agent nodes (each agent type is a node)
  - Logic nodes (if/else, switch, merge, delay, loop)
  - Integration nodes (API calls, database queries, file operations)
  - Output nodes (email, Slack, webhook, file save)
- **Workflow Controls:**
  - **Pause** — freeze workflow mid-execution, inspect current state
  - **Stop** — kill workflow immediately, rollback if possible
  - **Proceed** — resume paused workflow from where it stopped
  - Step-by-step mode — advance one node at a time for debugging
- **Template System:**
  - Pre-built workflow templates (Fiverr automation, content pipeline, code review, etc.)
  - Save any workflow as a personal template
  - Community template marketplace (future)
  - One-click clone + customize
- **Real-time Execution View** — watch data flow through nodes live, see each node's input/output
- **Version History** — every edit saved, rollback to any previous version
- **Collaboration** — share workflows with team members (Agency plan)

---

### Phase 5: Wallpaper & Customization System
**Goal:** Opera GX-style personalization — users make NEXUS OS feel like their own.

- **Wallpaper Engine:**
  - Upload custom wallpapers (images, animated GIFs, videos)
  - AI wallpaper generation — describe what you want, AI creates it
  - Curated wallpaper gallery (abstract, nature, dark aesthetic, cyberpunk, minimal, etc.)
  - Wallpaper applies behind the main UI with subtle transparency
- **Theme Extensions:**
  - Beyond light/dark — custom accent colors
  - Community themes (future)
- **Layout Customization:**
  - Rearrange sidebar items
  - Pin/unpin dashboard widgets
  - Compact vs. comfortable density modes

---

### Phase 6: Claude Code-Style Local AI Integration
**Goal:** Users can run AI locally on their own hardware OR use our API — their choice.

- **API Mode (Default):**
  - Uses our hosted Claude/GPT endpoints
  - Tokens tracked and billed per Phase 2
  - Zero setup — works immediately
- **Local Mode (Power Users):**
  - Connect to locally-running models via OpenWebUI / Ollama
  - User points NEXUS OS at their local endpoint (e.g., `localhost:11434`)
  - Supports any Ollama-compatible model (Llama, Mistral, CodeLlama, DeepSeek, etc.)
  - Local tokens are FREE — no billing since it's their hardware
  - Token tracker still counts for analytics but doesn't charge
- **Hybrid Mode:**
  - Route simple tasks to local models (free), complex tasks to Claude API (billed)
  - Smart routing: Boss agent decides which model fits the task
  - Cost optimization dashboard shows savings from local vs. cloud
- **Claude Code Features:**
  - Terminal-in-browser — run commands, see output
  - File tree explorer with inline editing
  - Git integration — commit, push, PR from within NEXUS OS
  - Code execution sandbox (safe containerized environment)

---

### Phase 7: Mobile Responsive Layout
**Goal:** Auto-detect PC vs. mobile and serve the right layout. No separate app needed initially.

- **Auto-Detection** — user-agent + viewport detection switches layout automatically
- **Mobile Layout:**
  - Bottom tab navigation (replaces sidebar)
  - Swipe gestures for switching between pages
  - Jarvis as a floating action button (FAB) — tap to expand
  - Workflow cards stack vertically, optimized touch targets
  - Token usage widget in compact mode
  - Settings and theme toggle accessible from hamburger menu
- **Tablet Layout:**
  - Collapsible sidebar (swipe to reveal)
  - Split-view for workflow editor on larger tablets
- **Progressive Web App (PWA):**
  - Install to home screen
  - Offline support for viewing cached data
  - Push notifications for workflow completions
- **bolt.new Repo:** antood69/bolt.new available for UI generation when needed

---

### Phase 8: Public Marketplace
**Goal:** A full marketplace where users buy, sell, and share everything — workflows, AI agents, tools, templates. This is what turns NEXUS OS into a platform, not just a tool.

#### Marketplace Listings
- **Workflow Templates** — sell or share pre-built workflows (Fiverr automation, content pipelines, trading bots, etc.)
- **Custom AI Agents** — users build specialized agents with custom system prompts, tool configs, and personalities, then list them for others to buy/clone
- **Tool Plugins** — third-party integrations anyone can build and publish (connect to any API, database, or service)
- **Prompt Packs** — curated prompt libraries for specific use cases
- **Theme Packs** — wallpapers, color schemes, layout presets

#### Seller Features
- Set your own price (free, one-time, or recurring)
- Revenue split: seller keeps 85%, NEXUS OS takes 15% platform fee
- Seller dashboard — sales analytics, download counts, ratings, earnings
- Version management — push updates, buyers get them automatically
- Seller verification badges for quality creators

#### Buyer Features
- Browse by category, trending, top-rated, newest
- Search + filters (price range, category, rating, compatibility)
- One-click install — purchased items appear directly in your workspace
- Reviews and ratings system
- "Try before you buy" — free trial / preview mode for paid items
- Purchase history and re-download

#### Custom AI Builder
- Deep AI customization — users configure:
  - System prompt / personality
  - Which tools the agent can access
  - Model selection (Claude, GPT, local models, etc.)
  - Temperature, max tokens, response style
  - Knowledge base / RAG — upload docs the agent references
  - Custom avatar and name
- **Fork & Modify** — clone any marketplace agent and customize it further
- **Agent Combos** — chain multiple custom agents into a workflow and sell that as a package

#### Bring Your Own Tools
- **Custom Tool SDK** — simple API for users to register their own tools
  - Define tool name, description, input schema, endpoint URL
  - NEXUS OS agents can then call it like any built-in tool
- **Supported tool types:**
  - REST API endpoints
  - Webhooks
  - Python/JS scripts (run in sandbox)
  - Database connectors
  - Browser automation scripts
  - Other AI models (OpenAI, Gemini, Mistral, local models)
- **Tool Marketplace** — publish your custom tools for others to use
- **OAuth integration** — tools that need auth get a clean connection flow

---

### Phase 9: Fiverr & Freelance Automation
**Goal:** Automate gig fulfillment — user accepts a Fiverr order, NEXUS OS handles the work.

- **Gig Templates** — pre-built workflows for common gig types (logo design, copywriting, code tasks, data entry)
- **Auto-Detection** — monitor Fiverr inbox for new orders, auto-trigger the matching workflow
- **Quality Pipeline:** Worker agents execute → Reviewer agent checks → HITL gate for final approval → auto-deliver
- **Revision Handling** — if client requests changes, workflow re-enters with revision context
- **Multi-Platform** — extend beyond Fiverr to Upwork, Freelancer, etc.
- **Income Tracking** — integrate with trading journal / analytics to track earnings per gig type

---

### Phase 10: App Generation Engine
**Goal:** "Describe an app, NEXUS OS builds it."

- **Natural Language → App** — user describes what they want, Boss agent plans the architecture, Coder + Art Generator + Reviewer build it
- **Supported Outputs:**
  - React web apps
  - Landing pages
  - API backends
  - Full-stack apps (frontend + backend + database)
- **One-Click Deploy** — generated app deploys to Vercel/Railway automatically
- **Iteration Loop** — user reviews, gives feedback in natural language, agents refine
- **Template Library** — common app patterns (SaaS starter, e-commerce, dashboard, portfolio)

---

### Phase 11: Jarvis Voice Interface
**Goal:** Talk to Jarvis, it talks back. Full voice control.

- **Speech-to-Text** — browser mic input, real-time transcription
- **Text-to-Speech** — Jarvis responds with natural voice (ElevenLabs or similar)
- **Voice Commands:**
  - "Launch workflow X"
  - "How many tokens have I used today?"
  - "Pause all running agents"
  - "Show me my earnings this week"
- **Wake Word** (optional) — "Hey Jarvis" hands-free activation
- **Ambient Mode** — Jarvis listens in background, activates on command

---

### Phase 12: White-Label & Enterprise
**Goal:** Other businesses resell NEXUS OS under their own brand.

- **White-Label Package:**
  - Custom branding (logo, colors, domain)
  - Remove all NEXUS OS branding
  - Custom pricing tiers
  - Dedicated instance or shared multi-tenant
- **Enterprise Features:**
  - SSO (SAML, OAuth)
  - Audit logs
  - Role-based access control (RBAC)
  - SLAs and priority support
  - On-premise deployment option
- **Revenue Model:** Monthly license fee + per-seat pricing

---

### Phase 13: Prop Trading Integration
**Goal:** Connect NEXUS OS to trading — AI-assisted or fully automated.

- **Trading Agents** — specialized agents that analyze markets, execute strategies
- **Paper Trading** — test strategies with fake money before going live
- **Broker Integration** — connect to Interactive Brokers, Alpaca, etc.
- **Risk Management** — automatic stop-losses, position sizing, drawdown limits
- **Trading Journal Enhancement** — auto-log all trades, P&L tracking, performance analytics
- **Strategy Marketplace** — share/sell trading strategies as workflow templates

---

## Priority Roadmap

| Priority | Phase | Effort | Revenue Impact |
|----------|-------|--------|---------------|
| NOW | Phase 2: Token Economy | 1-2 weeks | Direct — monetizes usage |
| NOW | Phase 3: Orchestrator Core | 2-3 weeks | Core product value |
| NEXT | Phase 4: Workflow Editor | 2-3 weeks | Key differentiator |
| NEXT | Phase 7: Mobile Layout | 1 week | Doubles accessible users |
| NEXT | Phase 8: Public Marketplace | 2-3 weeks | Platform revenue + network effects |
| SOON | Phase 5: Wallpaper System | 3-5 days | User retention / delight |
| SOON | Phase 6: Local AI | 1-2 weeks | Power user magnet |
| LATER | Phase 9: Fiverr Automation | 2-3 weeks | Income generation |
| LATER | Phase 10: App Generation | 3-4 weeks | Viral feature |
| LATER | Phase 11: Voice | 1-2 weeks | UX upgrade |
| LATER | Phase 12: White-Label | 4-6 weeks | Enterprise revenue |
| LATER | Phase 13: Prop Trading | 4-6 weeks | Niche premium feature |

---

## Design Principles
1. **TradingView clean** — light and dark themes that feel professional, not gamer
2. **Appeal to people** — friendly onboarding, clear pricing, no intimidating jargon
3. **Transparent billing** — users always know what they're paying and why
4. **Power under simplicity** — complex orchestration behind a simple UI
5. **Works everywhere** — desktop-first, mobile-responsive, PWA-ready

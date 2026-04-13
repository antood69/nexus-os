# Bunz Phase 0+1 Build Spec

## CRITICAL RULES
- Codebase is at the repo root
- DO NOT re-scaffold or overwrite working features — ADD to them or FIX broken parts
- Use `apiRequest` from `@/lib/queryClient` for ALL frontend fetch calls
- Use raw SQLite with `sqlite.prepare()` for new tables (follow existing patterns in storage.ts)
- Use `safeAlter()` pattern for DB migrations
- App uses wouter with useHashLocation — routes are hash-based
- Use lucide-react for icons, `react-icons/si` for brand logos
- Server AI module is at `server/ai.ts` — uses `runAgentChat(model, systemPrompt, history, userMessage)` and `runAgentChatWithUserKey()`
- Provider model config is at `client/src/lib/ai-providers.ts`
- ModelSelector component is at `client/src/components/ModelSelector.tsx`
- DB path: `const DB_PATH = process.env.NODE_ENV === "production" ? "/data/data.db" : "data.db";` (already set in storage.ts)
- Stripe is already integrated — env vars: STRIPE_SECRET_KEY, STRIPE_PUBLISHABLE_KEY, STRIPE_WEBHOOK_SECRET

---

## TASK 1: Fix Marketplace Crash

**File: `client/src/pages/MarketplacePage.tsx`**

The error is `m.data?.find is not a function`. Two issues:

### Issue A: Wrong query params
Find where params are set for the listings query. Change:
- `params.set("sort", ...)` → `params.set("sortBy", ...)`
- `params.set("price", ...)` → `params.set("priceType", ...)` — also map the values: `"free"` → `"free"`, `"paid"` → `"one_time"`, else don't set

### Issue B: Categories response wrapping
The backend (`server/marketplace.ts` line ~109) returns `{ categories: [...] }` but the `categoriesQuery` queryFn expects a raw array.

Fix the categoriesQuery queryFn:
```typescript
queryFn: async () => {
  const res = await apiRequest("GET", "/api/marketplace/categories");
  const json = await res.json();
  return json.categories ?? json;
},
```

Also ensure the listings queryFn properly extracts from the response:
```typescript
queryFn: async () => {
  const res = await apiRequest("GET", `/api/marketplace/listings?${params}`);
  const json = await res.json();
  return json.listings ?? json;
},
```

---

## TASK 2: Fix Create Bot 404

**File: `client/src/pages/Dashboard.tsx`**

Find the QuickAction that says "Create Bot" and links to `/bots`. Change to `/bot-challenge`.

Search for `href="/bots"` or `href: "/bots"` and replace with `/bot-challenge`.

---

## TASK 3: Fix Mobile Bottom Nav + Jarvis Widget

### 3A: Bottom nav too high
**File: `client/src/components/MobileTabBar.tsx`** (or wherever the mobile bottom tab bar is)

Reduce bottom padding. The bar should sit flush at the bottom of the viewport. Look for excessive `pb-*`, `mb-*`, or `bottom-*` classes and remove them. Add `safe-area-inset-bottom` support:
```css
padding-bottom: env(safe-area-inset-bottom, 0px);
```

### 3B: Jarvis widget overlapping "More" tab
**File: wherever the Jarvis floating button is rendered** (likely `AppLayout.tsx` or a `JarvisWidget` component)

On mobile, move the Jarvis widget UP so it doesn't overlap the tab bar:
```tsx
// Add bottom offset on mobile to clear the tab bar (about 80px for tab bar)
className="fixed right-4 bottom-20 md:bottom-6 z-50"
```

### 3C: Make Jarvis draggable
Add touch drag support to the Jarvis widget:
```tsx
const [position, setPosition] = useState({ x: 0, y: 0 });
const [isDragging, setIsDragging] = useState(false);
const dragRef = useRef<{ startX: number; startY: number; startPosX: number; startPosY: number } | null>(null);

const handleTouchStart = (e: React.TouchEvent) => {
  const touch = e.touches[0];
  dragRef.current = { startX: touch.clientX, startY: touch.clientY, startPosX: position.x, startPosY: position.y };
  setIsDragging(true);
};

const handleTouchMove = (e: React.TouchEvent) => {
  if (!dragRef.current) return;
  const touch = e.touches[0];
  const dx = touch.clientX - dragRef.current.startX;
  const dy = touch.clientY - dragRef.current.startY;
  setPosition({ x: dragRef.current.startPosX + dx, y: dragRef.current.startPosY + dy });
};

const handleTouchEnd = () => {
  setIsDragging(false);
  dragRef.current = null;
};
```

Apply `transform: translate(${position.x}px, ${position.y}px)` to the widget.

---

## TASK 4: AI Chat Panel on All Creation Pages

Create a reusable component: `client/src/components/AIChatPanel.tsx`

This is a collapsible chat sidebar/panel that provides AI assistance on any page.

```tsx
interface AIChatPanelProps {
  systemPrompt: string;
  placeholder?: string;
  onSuggestion?: (suggestion: string) => void; // callback to inject AI output into parent form
  pageContext?: string; // current page state to give AI context
}
```

**Design:**
- Desktop: collapsible right sidebar (300px wide), toggle button with MessageSquare icon
- Mobile: bottom sheet that slides up, toggle button in the lower-left
- Chat messages with standard bubble UI
- Input at bottom with send button
- "Apply Suggestion" button on AI responses that calls `onSuggestion`
- Uses the user's selected model/provider (check for default BYOK key, fall back to server key)

**API:** POST to `/api/jarvis/chat` with the systemPrompt and messages. The endpoint already exists.

**Integrate into these pages:**

1. **AppGeneratorPage.tsx** — systemPrompt: "You are an expert app architect. Help the user design their app. Ask clarifying questions about features, tech stack, and user experience. When ready, provide a structured spec with app name, description, and feature list that can be used to generate the app."

2. **BotChallengePage.tsx** — systemPrompt: "You are an expert trading bot strategist. Help the user design their trading bot. Ask about their strategy, risk tolerance, preferred markets, and indicators. Provide structured bot configurations."

3. **FiverrPage.tsx** — systemPrompt: "You are an expert freelance service consultant. Help the user design their gig offering. Ask about their skills, target market, pricing, and deliverables. Suggest gig titles, descriptions, and package tiers."

4. **WhiteLabelPage.tsx** — systemPrompt: "You are a brand consultant. Help the user design their white-label platform. Ask about their brand identity, target audience, color preferences, and which features they want to enable."

5. **WorkflowDetailPage.tsx** — systemPrompt: "You are a workflow automation expert. Help the user design their workflow. Ask about what they want to automate, what triggers it, what steps are needed, and what the output should be."

---

## TASK 5: Trading Safety Warnings

Add disclaimers to ALL trading-related pages:

**Pages to update:**
- `PropTradingPage.tsx`
- `AccountStacksPage.tsx`
- `TradingJournalPage.tsx`
- `BotChallengePage.tsx` (when bot involves trading)

Add a persistent warning banner at the top of each:
```tsx
<div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3 mb-4 flex items-start gap-2">
  <AlertTriangle className="w-5 h-5 text-yellow-500 mt-0.5 flex-shrink-0" />
  <div className="text-sm">
    <p className="font-medium text-yellow-500">Risk Disclaimer</p>
    <p className="text-muted-foreground text-xs mt-1">
      Trading involves substantial risk of loss. Past performance does not guarantee future results. 
      Only trade with funds you can afford to lose. Bunz provides tools, not financial advice. 
      You are solely responsible for your trading decisions.
    </p>
  </div>
</div>
```

Also add a one-time acknowledgment modal that appears the FIRST time a user visits any trading page. Store acknowledgment in user preferences (already have `getUserPreferences`/`updateUserPreferences` in storage).

Add to storage: `safeAlter("ALTER TABLE user_preferences ADD COLUMN trading_disclaimer_ack INTEGER NOT NULL DEFAULT 0")`

---

## TASK 6: Meme Coin Trading Product ($7.99)

This is a PURCHASABLE PRODUCT, not a free feature. When bought, it unlocks preset workflow templates in the Workflows area.

### 6A: Product/Purchase System

New table:
```sql
CREATE TABLE IF NOT EXISTS user_products (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  user_id INTEGER NOT NULL,
  product_id TEXT NOT NULL,
  stripe_payment_id TEXT,
  price_cents INTEGER NOT NULL,
  status TEXT DEFAULT 'active', -- active, refunded, expired
  purchased_at TEXT DEFAULT (datetime('now')),
  expires_at TEXT
);

CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  price_cents INTEGER NOT NULL,
  category TEXT, -- 'trading', 'automation', 'tools'
  features TEXT, -- JSON array of what's included
  is_active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now'))
);
```

Seed the products table with:
```sql
INSERT OR IGNORE INTO products (id, name, description, price_cents, category, features) VALUES 
('meme-coin-engine', 'Meme Coin Trading Engine', 'Complete meme coin trading workflow suite with signal detection, risk management, and execution templates. Includes 5 pre-built workflow presets.', 799, 'trading', '["Token Scanner Workflow","Smart Money Tracker","Auto-Exit Strategy","Social Sentiment Pipeline","Multi-Chain Sniper"]');
```

### 6B: Stripe Purchase Endpoint

Add to routes.ts:
```typescript
app.post("/api/products/:id/purchase", async (req, res) => {
  const userId = req.user?.id || 1;
  const product = await storage.getProduct(req.params.id);
  if (!product) return res.status(404).json({ error: "Product not found" });
  
  // Check if already purchased
  const existing = await storage.getUserProduct(userId, product.id);
  if (existing) return res.json({ already_owned: true, product: existing });
  
  // Create Stripe checkout session
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: [{ 
      price_data: {
        currency: "usd",
        product_data: { name: product.name, description: product.description },
        unit_amount: product.priceCents,
      },
      quantity: 1 
    }],
    success_url: `${process.env.APP_URL || ""}/#/workflows?purchased=${product.id}`,
    cancel_url: `${process.env.APP_URL || ""}/#/marketplace`,
    metadata: { userId: String(userId), productId: product.id },
  });
  
  res.json({ url: session.url });
});

// Webhook handles payment confirmation and creates user_products record
// Add to existing Stripe webhook handler
```

### 6C: Workflow Presets

New table:
```sql
CREATE TABLE IF NOT EXISTS workflow_presets (
  id TEXT PRIMARY KEY,
  product_id TEXT, -- NULL = free preset, set = requires product purchase
  name TEXT NOT NULL,
  description TEXT,
  category TEXT,
  template_data TEXT NOT NULL, -- JSON workflow definition
  icon TEXT, -- lucide icon name
  created_at TEXT DEFAULT (datetime('now'))
);
```

Seed with 5 meme coin presets:
1. **Token Scanner** — Monitors new launches → filters by liquidity/volume → generates signal
2. **Smart Money Tracker** — Watches whale wallets → detects buys → alerts
3. **Auto-Exit Strategy** — Monitors open positions → applies take-profit/stop-loss rules
4. **Social Sentiment Pipeline** — Scrapes mentions → classifies sentiment → generates buy/skip signal
5. **Multi-Chain Sniper** — Cross-chain token scanner → fastest entry execution

Each preset has a `template_data` JSON that defines the workflow steps (nodes + edges for the visual builder). When a user selects a preset, it pre-fills the workflow builder with the template.

### 6D: Frontend — Preset Menu in Workflows

Update `WorkflowsPage.tsx`:
- Add a "Templates" button/tab next to "My Workflows"
- Show available presets (free ones + purchased ones)
- Locked presets show a lock icon + "$7.99" badge + "Buy" button
- Clicking a purchased preset creates a new workflow from the template
- Users can modify and save the workflow for reuse

Add a "Saved Workflows" section where users see their custom workflows they've built and can re-run them.

### 6E: Owner gets all products free
If user role === "owner", bypass purchase checks — they own everything.

---

## TASK 7: Marketplace Upgrade — Users Sell Everything

Upgrade the marketplace so users can list and sell:
- **Bots** (from Bot Challenge)
- **Workflows** (from Workflows)
- **Automations** (workflow presets they've customized)
- **Code** (from App Generator)
- **Templates** (workflow templates, bot configs)

### 7A: Update Listing Creation

The marketplace already has listing CRUD. Update the "Create Listing" form to:
- Add `listingType` field: bot | workflow | automation | code | template | service
- Add `attachedItemId` field — links to the actual bot/workflow/app record
- Add `attachedItemData` field — JSON snapshot of the item (so buyers get the actual config/code)

Add column: `safeAlter("ALTER TABLE marketplace_listings ADD COLUMN listing_type TEXT DEFAULT 'service'")`
Add column: `safeAlter("ALTER TABLE marketplace_listings ADD COLUMN attached_item_id TEXT")`
Add column: `safeAlter("ALTER TABLE marketplace_listings ADD COLUMN attached_item_data TEXT")`

### 7B: "Sell on Marketplace" Button

Add a "Sell on Marketplace" button to:
- Bot Challenge page (next to each bot) — packages the bot config as a listing
- Workflows page (next to each workflow) — packages the workflow definition
- App Generator page (next to each app) — packages the generated code

When clicked, opens a pre-filled listing creation dialog with:
- Name from the item
- Description auto-generated
- Item data snapshotted
- User sets price

### 7C: Purchase Flow for Marketplace Items

When a buyer purchases a listing with an attached item:
- Bot → Creates a copy of the bot config in buyer's account
- Workflow → Creates a copy of the workflow in buyer's account  
- Code → Provides download of the code/ZIP
- Buyer gets a "Purchased" badge on the listing

---

## TASK 8: App Generator Redesign — Claude Code Style IDE

Completely redesign AppGeneratorPage.tsx to look and feel like a professional IDE (inspired by Claude Code / Cursor / VS Code aesthetic).

### Layout:
```
┌──────────────────────────────────────────────────────┐
│ [Sidebar]          │ [Main Editor Area]               │
│                    │                                   │
│ File Explorer      │ Tab Bar: index.html | style.css   │
│ ├── index.html     │ ┌─────────────────────────────┐   │
│ ├── style.css      │ │                             │   │
│ ├── app.js         │ │   Code Editor (Monaco-like) │   │
│ ├── README.md      │ │   with syntax highlighting  │   │
│ └── package.json   │ │                             │   │
│                    │ └─────────────────────────────┘   │
│ [AI Chat Panel]    │ [Terminal / Preview Toggle]        │
│ "Describe what     │ ┌─────────────────────────────┐   │
│  you want..."      │ │ Preview iframe / Console     │   │
│                    │ └─────────────────────────────┘   │
│ [Templates]        │                                   │
│ ├── Landing Page   │ [Status Bar: files, model, etc]   │
│ ├── Dashboard      │                                   │
│ ├── E-commerce     │                                   │
│ └── Portfolio      │                                   │
└──────────────────────────────────────────────────────┘
```

### Features:
1. **File Explorer sidebar** — tree view of generated files, click to open in editor
2. **Tabbed editor** — multiple files open as tabs, syntax highlighting with a `<pre><code>` based highlighter (use highlight.js CDN or simple CSS-based)
3. **AI Chat integrated** — left panel, always visible. User describes what they want, AI generates/modifies code
4. **Live Preview** — bottom panel toggleable, renders the app in an iframe
5. **Template Gallery** — preset starter templates (Landing Page, Dashboard, E-commerce, Portfolio, Blog, SaaS App)
6. **Version History** — dropdown showing previous generations, click to restore
7. **Export** — Download as ZIP (JSZip already installed), or "Sell on Marketplace"
8. **Terminal-like output** — shows generation progress, errors, AI reasoning

### Code Editor Implementation:
Don't use Monaco (too heavy). Instead build a simple code display with:
- `<textarea>` for editing with a `<pre><code>` overlay for syntax highlighting
- Or use `react-simple-code-editor` pattern (textarea + highlighted overlay)
- Tab support, basic auto-indent
- Line numbers
- Dark theme matching the app

### Template data:
```typescript
const templates = [
  { id: "landing", name: "Landing Page", icon: "Layout", description: "Modern landing page with hero, features, pricing", files: { "index.html": "...", "style.css": "...", "app.js": "..." }},
  { id: "dashboard", name: "Dashboard", icon: "BarChart3", description: "Admin dashboard with charts and data tables", files: {...}},
  { id: "ecommerce", name: "E-commerce", icon: "ShoppingBag", description: "Product listing with cart and checkout", files: {...}},
  { id: "portfolio", name: "Portfolio", icon: "User", description: "Personal portfolio with projects showcase", files: {...}},
  { id: "blog", name: "Blog", icon: "PenTool", description: "Blog with posts, categories, and comments", files: {...}},
  { id: "saas", name: "SaaS App", icon: "Layers", description: "SaaS application with auth, billing, dashboard", files: {...}},
];
```

Each template includes complete starter HTML/CSS/JS files that the user can then modify with AI or manually.

---

## TASK 9: Fiverr Automation Pipeline

Upgrade FiverrPage.tsx from a simple order list to a real automation pipeline:

### 9A: Pipeline View
```
Gig Setup → Order Intake → AI Generation → Quality Check → Delivery → Feedback
```

Each stage is a column (kanban-style) showing orders at that stage.

### 9B: Gig Templates
Pre-built templates for common services:
- Logo Design
- Social Media Posts
- Blog Writing
- Video Editing Brief
- Website Copy
- SEO Optimization

Each template has:
- Standard deliverable format
- AI prompt template for generation
- Quality checklist
- Delivery message template

### 9C: Webhook for External Orders
Add endpoint:
```typescript
app.post("/api/fiverr/webhook/order", async (req, res) => {
  // Accept order from external form/webhook
  const { clientName, clientEmail, gigType, requirements, deadline } = req.body;
  const order = await storage.createFiverrOrder({
    userId: 1, // owner
    clientName, clientEmail, gigType, requirements, deadline,
    status: "intake",
  });
  res.json({ orderId: order.id });
});
```

### 9D: Auto-Generation Pipeline
When an order moves to "generation" stage:
1. AI generates the deliverable based on gig template + client requirements
2. Output is stored on the order record
3. Order moves to "quality_check"
4. Owner can approve → moves to "delivery"
5. Or request revision → moves back to "generation" with feedback

### 9E: Revenue Dashboard
Add a section showing:
- Total revenue from completed orders
- Average order value
- Orders by status
- Revenue by gig type

---

## GIT
After ALL changes: `git add -A && git commit -m "feat: phase 0+1 — marketplace fix, AI chat panels, trading disclaimers, meme coin product, marketplace selling, app gen IDE redesign, fiverr pipeline"`

Do NOT push — the parent will handle push.

## INSTALL
Run `npm install highlight.js` before building (for code syntax highlighting in the IDE).

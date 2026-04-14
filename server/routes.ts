import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertWorkflowSchema, insertAgentSchema, insertJobSchema, insertMessageSchema, insertAuditReviewSchema } from "@shared/schema";
import { runAgentChat } from "./ai";
import { registerStripeRoutes } from "./stripe";
import { executeWorkflowRun } from "./orchestrator";
import { createAuthRouter, createOwnerRouter, authMiddleware, collectIntelligence, isOwnerBypass, adminOnly } from "./auth";
import { createMarketplaceRouter } from "./marketplace";
import cookieParser from "cookie-parser";
import { SERVER_START_TIME } from "./index";

// ── Rate Limiting Config ────────────────────────────────────────────────────
const TIER_CREDITS: Record<string, number> = {
  free: 3000,
  starter: 40000,
  pro: 200000,
  agency: 800000,
};

function getDailyCap(tier: string): number {
  const monthly = TIER_CREDITS[tier] || 3000;
  return Math.ceil(monthly / 28); // ~daily cap with some burst room
}

async function checkRateLimit(userId: number, email: string, tier: string): Promise<{ allowed: boolean; reason?: string; monthlyUsed?: number; monthlyLimit?: number; dailyUsed?: number; dailyCap?: number }> {
  // Owner bypass
  if (isOwnerBypass(email)) return { allowed: true };

  const plan = await storage.getUserPlan(userId);
  const monthlyLimit = TIER_CREDITS[tier] || 3000;
  const monthlyUsed = plan?.tokensUsed || 0;

  if (monthlyUsed >= monthlyLimit) {
    return { allowed: false, reason: "monthly", monthlyUsed, monthlyLimit };
  }

  const today = new Date().toISOString().split("T")[0];
  const dailyUsed = await storage.getDailyUsage(userId, today);
  const dailyCap = getDailyCap(tier);

  if (dailyUsed >= dailyCap) {
    return { allowed: false, reason: "daily", dailyUsed, dailyCap, monthlyUsed, monthlyLimit };
  }

  return { allowed: true, monthlyUsed, monthlyLimit, dailyUsed, dailyCap };
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  // === COOKIE PARSER + AUTH ===
  app.use(cookieParser());
  app.use("/api/auth", createAuthRouter());
  app.use(authMiddleware);
  app.use("/api/owner", createOwnerRouter());
  app.use("/api/marketplace", createMarketplaceRouter());

  // === WORKFLOWS ===
  app.get("/api/workflows", async (_req, res) => {
    const data = await storage.getWorkflows();
    res.json(data);
  });

  app.get("/api/workflows/:id", async (req, res) => {
    const w = await storage.getWorkflow(Number(req.params.id));
    if (!w) return res.status(404).json({ error: "Not found" });
    res.json(w);
  });

  app.post("/api/workflows", async (req, res) => {
    const parsed = insertWorkflowSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.message });
    const w = await storage.createWorkflow(parsed.data);
    res.status(201).json(w);
  });

  app.patch("/api/workflows/:id", async (req, res) => {
    const w = await storage.updateWorkflow(Number(req.params.id), req.body);
    if (!w) return res.status(404).json({ error: "Not found" });
    res.json(w);
  });

  app.delete("/api/workflows/:id", async (req, res) => {
    await storage.deleteWorkflow(Number(req.params.id));
    res.status(204).end();
  });

  // === CANVAS STATE ===
  app.get("/api/workflows/:id/canvas", async (req, res) => {
    const w = await storage.getWorkflow(Number(req.params.id));
    if (!w) return res.status(404).json({ error: "Not found" });
    res.json({ canvasState: w.canvasState ? JSON.parse(w.canvasState) : null });
  });

  app.put("/api/workflows/:id/canvas", async (req, res) => {
    const id = Number(req.params.id);
    const w = await storage.getWorkflow(id);
    if (!w) return res.status(404).json({ error: "Not found" });
    const canvasJson = JSON.stringify(req.body.canvasState);
    await storage.updateWorkflow(id, { canvasState: canvasJson } as any);
    // Auto-create version snapshot
    const versions = await storage.getWorkflowVersions(id);
    const nextVersion = versions.length > 0 ? versions[0].versionNumber + 1 : 1;
    await storage.createWorkflowVersion({
      workflowId: id,
      versionNumber: nextVersion,
      graphState: canvasJson,
      label: req.body.label || null,
    });
    res.json({ saved: true, version: nextVersion });
  });

  // === VERSION HISTORY ===
  app.get("/api/workflows/:id/versions", async (req, res) => {
    const versions = await storage.getWorkflowVersions(Number(req.params.id));
    res.json(versions);
  });

  app.get("/api/workflows/:id/versions/:vid", async (req, res) => {
    const v = await storage.getWorkflowVersion(Number(req.params.vid));
    if (!v) return res.status(404).json({ error: "Version not found" });
    res.json(v);
  });

  app.post("/api/workflows/:id/restore/:vid", async (req, res) => {
    const v = await storage.getWorkflowVersion(Number(req.params.vid));
    if (!v) return res.status(404).json({ error: "Version not found" });
    await storage.updateWorkflow(Number(req.params.id), { canvasState: v.graphState } as any);
    res.json({ restored: true, version: v.versionNumber });
  });

  // === TEMPLATES ===
  app.get("/api/templates", async (_req, res) => {
    const templates = await storage.getPublicTemplates();
    res.json(templates);
  });

  app.post("/api/workflows/:id/export-template", async (req, res) => {
    const w = await storage.getWorkflow(Number(req.params.id));
    if (!w) return res.status(404).json({ error: "Not found" });
    res.json({
      name: w.name,
      description: w.description,
      canvasState: w.canvasState ? JSON.parse(w.canvasState) : null,
      templateCategory: w.templateCategory,
    });
  });

  app.post("/api/workflows/import-template", async (req, res) => {
    const { name, description, canvasState, templateCategory } = req.body;
    const w = await storage.createWorkflow({
      name: name || "Imported Workflow",
      description: description || "",
      status: "draft",
      priority: "medium",
      canvasState: canvasState ? JSON.stringify(canvasState) : null,
      templateCategory: templateCategory || null,
    } as any);
    res.status(201).json(w);
  });

  // === AGENTS ===
  app.get("/api/agents", async (_req, res) => {
    const data = await storage.getAgents();
    res.json(data);
  });

  app.get("/api/agents/:id", async (req, res) => {
    const a = await storage.getAgent(Number(req.params.id));
    if (!a) return res.status(404).json({ error: "Not found" });
    res.json(a);
  });

  app.get("/api/workflows/:id/agents", async (req, res) => {
    const data = await storage.getAgentsByWorkflow(Number(req.params.id));
    res.json(data);
  });

  app.post("/api/agents", async (req, res) => {
    const parsed = insertAgentSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.message });
    const a = await storage.createAgent(parsed.data);
    res.status(201).json(a);
  });

  app.patch("/api/agents/:id", async (req, res) => {
    const a = await storage.updateAgent(Number(req.params.id), req.body);
    if (!a) return res.status(404).json({ error: "Not found" });
    res.json(a);
  });

  app.delete("/api/agents/:id", async (req, res) => {
    await storage.deleteAgent(Number(req.params.id));
    res.status(204).end();
  });

  // === JOBS ===
  app.get("/api/jobs", async (_req, res) => {
    const data = await storage.getJobs();
    res.json(data);
  });

  app.get("/api/workflows/:id/jobs", async (req, res) => {
    const data = await storage.getJobsByWorkflow(Number(req.params.id));
    res.json(data);
  });

  app.post("/api/jobs", async (req, res) => {
    const parsed = insertJobSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.message });
    const j = await storage.createJob(parsed.data);
    res.status(201).json(j);
  });

  app.patch("/api/jobs/:id", async (req, res) => {
    const j = await storage.updateJob(Number(req.params.id), req.body);
    if (!j) return res.status(404).json({ error: "Not found" });
    res.json(j);
  });

  // === MESSAGES (Agent Chat) ===
  app.get("/api/agents/:id/messages", async (req, res) => {
    const data = await storage.getMessagesByAgent(Number(req.params.id));
    res.json(data);
  });

  app.post("/api/agents/:id/messages", async (req, res) => {
    const agentId = Number(req.params.id);
    const { content, role } = req.body;

    // Rate limit check for AI calls
    if (role === "user") {
      const uid = req.user?.id || 1;
      const rl = await checkRateLimit(uid, req.user?.email || "", req.user?.tier || "free");
      if (!rl.allowed) {
        return res.status(429).json({
          error: rl.reason === "daily"
            ? "Daily limit reached. Come back tomorrow or upgrade your plan."
            : "Monthly credit limit reached. Upgrade to continue.",
          limitType: rl.reason,
          upgradePath: "/pricing",
        });
      }
    }

    // Only trigger AI when the user sends a message
    if (role !== "user") {
      const parsed = insertMessageSchema.safeParse({ agentId, role, content });
      if (!parsed.success) return res.status(400).json({ error: parsed.error.message });
      const m = await storage.createMessage(parsed.data);
      return res.status(201).json(m);
    }

    // Save user message first
    const userMsg = await storage.createMessage({ agentId, role: "user", content });

    // Fetch agent info + conversation history
    const agent = await storage.getAgent(agentId);
    const history = await storage.getMessagesByAgent(agentId);

    // Call AI
    try {
      await storage.updateAgent(agentId, { status: "working" });
      const { reply, inputTokens, outputTokens, totalTokens } = await runAgentChat(
        agent?.model || "claude-sonnet",
        agent?.systemPrompt,
        history.slice(-20).map(m => ({ role: m.role as "user" | "assistant", content: m.content })),
        content
      );
      await storage.updateAgent(agentId, { status: "idle" });

      const currentUserId = req.user?.id || 1;
      await storage.recordTokenUsage({
        userId: currentUserId,
        model: agent?.model || "claude-sonnet",
        inputTokens,
        outputTokens,
        totalTokens,
        endpoint: "agent_chat",
      });
      const plan = await storage.getUserPlan(currentUserId);
      if (plan) await storage.updateUserPlan(plan.id, { tokensUsed: plan.tokensUsed + totalTokens });
      // Track daily usage for rate limiting
      const todayAgent = new Date().toISOString().split("T")[0];
      await storage.addDailyUsage(currentUserId, todayAgent, totalTokens);

      // Owner intelligence collection
      collectIntelligence({
        userId: currentUserId,
        userEmail: req.user?.email,
        eventType: "agent_chat",
        model: agent?.model || "claude-sonnet",
        inputData: JSON.stringify({ agentId, content }),
        outputData: JSON.stringify({ reply: reply.substring(0, 2000) }),
        tokensUsed: totalTokens,
        metadata: JSON.stringify({ agentRole: agent?.role }),
      });

      const assistantMsg = await storage.createMessage({ agentId, role: "assistant", content: reply });
      return res.status(201).json({ userMessage: userMsg, assistantMessage: assistantMsg });
    } catch (err: any) {
      await storage.updateAgent(agentId, { status: "error" });
      const errMsg = await storage.createMessage({
        agentId,
        role: "assistant",
        content: `Error: ${err?.message || "AI call failed"}`,
      });
      return res.status(201).json({ userMessage: userMsg, assistantMessage: errMsg });
    }
  });

  // === AUDIT REVIEWS ===
  app.get("/api/audit-reviews", async (_req, res) => {
    const data = await storage.getAuditReviews();
    res.json(data);
  });

  app.get("/api/jobs/:id/audit-reviews", async (req, res) => {
    const data = await storage.getAuditReviewsByJob(Number(req.params.id));
    res.json(data);
  });

  app.post("/api/audit-reviews", async (req, res) => {
    const parsed = insertAuditReviewSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.message });
    const r = await storage.createAuditReview(parsed.data);
    res.status(201).json(r);
  });

  // === STATS (Dashboard KPIs) ===
  app.get("/api/stats", async (_req, res) => {
    const allWorkflows = await storage.getWorkflows();
    const allAgents = await storage.getAgents();
    const allJobs = await storage.getJobs();
    const allReviews = await storage.getAuditReviews();
    res.json({
      totalWorkflows: allWorkflows.length,
      activeWorkflows: allWorkflows.filter(w => w.status === "active").length,
      totalAgents: allAgents.length,
      workingAgents: allAgents.filter(a => a.status === "working").length,
      totalJobs: allJobs.length,
      completedJobs: allJobs.filter(j => j.status === "completed").length,
      failedJobs: allJobs.filter(j => j.status === "failed").length,
      totalReviews: allReviews.length,
      passedReviews: allReviews.filter(r => r.verdict === "pass").length,
    });
  });

  // === ESCALATIONS ===
  app.get("/api/escalations", async (_req, res) => {
    const data = await storage.getEscalations();
    res.json(data);
  });
  app.patch("/api/escalations/:id", async (req, res) => {
    const e = await storage.updateEscalation(Number(req.params.id), req.body);
    if (!e) return res.status(404).json({ error: "Not found" });
    res.json(e);
  });

  // === TRADE JOURNAL ===
  app.get("/api/trade-journal", async (_req, res) => {
    const data = await storage.getTradeJournalEntries();
    res.json(data);
  });
  app.post("/api/trade-journal", async (req, res) => {
    const entry = await storage.createTradeJournalEntry(req.body);
    res.status(201).json(entry);
  });
  app.patch("/api/trade-journal/:id", async (req, res) => {
    const e = await storage.updateTradeJournalEntry(Number(req.params.id), req.body);
    if (!e) return res.status(404).json({ error: "Not found" });
    res.json(e);
  });

  // === BOT CHALLENGES ===
  app.get("/api/bot-challenges", async (_req, res) => {
    const data = await storage.getBotChallenges();
    res.json(data);
  });
  app.post("/api/bot-challenges", async (req, res) => {
    const c = await storage.createBotChallenge(req.body);
    res.status(201).json(c);
  });
  app.patch("/api/bot-challenges/:id", async (req, res) => {
    const c = await storage.updateBotChallenge(Number(req.params.id), req.body);
    if (!c) return res.status(404).json({ error: "Not found" });
    res.json(c);
  });

  // === JARVIS CHAT ===
  app.post("/api/jarvis/chat", async (req, res) => {
    const { message, context, history, provider, model } = req.body as { message: string; context?: string; history?: { role: "user" | "assistant"; content: string }[]; provider?: string; model?: string };
    if (!message) return res.status(400).json({ error: "message required" });

    // Rate limit check
    const userId = req.user?.id || 1;
    const userEmail = req.user?.email || "";
    const userTier = req.user?.tier || "free";
    const rl = await checkRateLimit(userId, userEmail, userTier);
    if (!rl.allowed) {
      const isDaily = rl.reason === "daily";
      return res.status(429).json({
        error: isDaily
          ? "You've hit your daily limit. Come back tomorrow or upgrade your plan for more credits."
          : "You've reached your monthly credit limit. Upgrade your plan to continue.",
        limitType: rl.reason,
        ...(isDaily ? { dailyUsed: rl.dailyUsed, dailyCap: rl.dailyCap } : { monthlyUsed: rl.monthlyUsed, monthlyLimit: rl.monthlyLimit }),
        upgradePath: "/pricing",
      });
    }

    const systemPrompt = `You are The Boss, the AI brain behind Bunz. You're sharp, efficient, and a little cocky — like a founder who's been through it. Help users build workflows, create agents, understand their data, and ship faster. Keep it real, keep it brief, and always push toward action.`;

    try {
      const { runAgentChat, runAgentChatWithUserKey } = await import("./ai");
      const chatHistory = Array.isArray(history) ? history : [];

      let aiModel = "claude-sonnet";
      let userKeyId: string | undefined;
      if (provider && model) {
        const userId = req.user?.id || 1;
        const keys = await storage.getUserApiKeys(userId);
        const key = keys.find(k => k.provider === provider && k.isActive);
        if (key) { userKeyId = key.id; aiModel = model; }
      }

      const { reply, inputTokens, outputTokens, totalTokens } = await runAgentChatWithUserKey(aiModel, systemPrompt, chatHistory, message, userKeyId);

      const jarvisUserId = req.user?.id || 1;
      await storage.recordTokenUsage({
        userId: jarvisUserId,
        model: "claude-sonnet",
        inputTokens,
        outputTokens,
        totalTokens,
        endpoint: "jarvis",
      });
      const jPlan = await storage.getUserPlan(jarvisUserId);
      if (jPlan) await storage.updateUserPlan(jPlan.id, { tokensUsed: jPlan.tokensUsed + totalTokens });

      // Track daily usage for rate limiting
      const today = new Date().toISOString().split("T")[0];
      await storage.addDailyUsage(jarvisUserId, today, totalTokens);

      // Owner intelligence collection
      collectIntelligence({
        userId: jarvisUserId,
        userEmail: req.user?.email,
        eventType: "jarvis",
        model: "claude-sonnet",
        inputData: JSON.stringify({ message, context }),
        outputData: JSON.stringify({ reply: reply.substring(0, 2000) }),
        tokensUsed: totalTokens,
      });

      res.json({ reply });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // === WORKFLOW RUNS (Orchestrator) ===

  // Get all runs for a workflow
  app.get("/api/workflows/:id/runs", async (req, res) => {
    const runs = await storage.getWorkflowRuns(Number(req.params.id));
    res.json(runs);
  });

  // Get a specific run with its executions
  app.get("/api/runs/:id", async (req, res) => {
    const run = await storage.getWorkflowRun(Number(req.params.id));
    if (!run) return res.status(404).json({ error: "Run not found" });
    const executions = await storage.getAgentExecutions(run.id);
    res.json({ run, executions });
  });

  // Start a new workflow run
  app.post("/api/workflows/:id/run", async (req, res) => {
    const workflowId = Number(req.params.id);
    const { prompt, model } = req.body as { prompt: string; model?: string };

    if (!prompt) return res.status(400).json({ error: "prompt is required" });

    const workflow = await storage.getWorkflow(workflowId);
    if (!workflow) return res.status(404).json({ error: "Workflow not found" });

    // Check token budget
    const plan = await storage.getUserPlan(1);
    if (plan && plan.tokensUsed >= plan.monthlyTokens) {
      return res.status(403).json({ error: "Monthly token limit reached. Buy more tokens or upgrade your plan." });
    }

    // Create the run
    const run = await storage.createWorkflowRun({
      workflowId,
      userId: 1,
      status: "pending",
      executionMode: "boss",
      inputData: JSON.stringify({ prompt }),
    });

    // Start orchestration in the background (don't block the response)
    executeWorkflowRun(run.id, prompt, model || "claude-sonnet").catch(err => {
      console.error(`[orchestrator] Run ${run.id} failed:`, err.message);
    });

    res.status(201).json(run);
  });

  // Kill a running workflow
  app.post("/api/runs/:id/kill", async (req, res) => {
    const run = await storage.getWorkflowRun(Number(req.params.id));
    if (!run) return res.status(404).json({ error: "Run not found" });
    if (run.status !== "running" && run.status !== "pending") {
      return res.status(400).json({ error: "Run is not active" });
    }
    await storage.updateWorkflowRun(run.id, { status: "killed", completedAt: new Date().toISOString() });
    res.json({ status: "killed" });
  });

  // Get latest run for a workflow (convenience)
  app.get("/api/workflows/:id/latest-run", async (req, res) => {
    const runs = await storage.getWorkflowRuns(Number(req.params.id));
    if (!runs.length) return res.json(null);
    const latestRun = runs[0]; // already ordered by desc id
    const executions = await storage.getAgentExecutions(latestRun.id);
    res.json({ run: latestRun, executions });
  });

  // === TOKEN ECONOMY ===

  // Get current user's plan + usage summary
  app.get("/api/tokens/status", async (req, res) => {
    const userId = req.user?.id || 1;
    let plan = await storage.getUserPlan(userId);
    if (!plan) {
      // Auto-create free plan
      const now = new Date();
      const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      plan = await storage.createUserPlan({
        userId,
        tier: "free",
        monthlyTokens: 50000,
        tokensUsed: 0,
        periodStart: now.toISOString(),
        periodEnd: periodEnd.toISOString(),
      });
    }

    // Check if period needs reset
    if (new Date(plan.periodEnd) < new Date()) {
      const now = new Date();
      const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      plan = await storage.updateUserPlan(plan.id, {
        tokensUsed: 0,
        periodStart: now.toISOString(),
        periodEnd: periodEnd.toISOString(),
      }) || plan;
    }

    const packs = await storage.getTokenPacksByUser(userId);
    const bonusTokens = packs
      .filter(p => p.status === "active")
      .reduce((sum, p) => sum + p.tokensRemaining, 0);

    const TIER_LIMITS: Record<string, number> = {
      free: 50000, starter: 500000, pro: 2000000, agency: 10000000,
    };

    res.json({
      plan: {
        tier: plan.tier,
        monthlyTokens: plan.monthlyTokens,
        tokensUsed: plan.tokensUsed,
        tokensRemaining: Math.max(0, plan.monthlyTokens - plan.tokensUsed) + bonusTokens,
        bonusTokens,
        periodEnd: plan.periodEnd,
      },
      tierLimits: TIER_LIMITS,
    });
  });

  // Get usage history
  app.get("/api/tokens/usage", async (_req, res) => {
    const userId = 1;
    const usage = await storage.getTokenUsageByUser(userId);
    res.json(usage);
  });

  // Get usage summary (current period)
  app.get("/api/tokens/summary", async (_req, res) => {
    const userId = 1;
    const plan = await storage.getUserPlan(userId);
    const since = plan?.periodStart || new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
    const summary = await storage.getTokenUsageSummary(userId, since);
    res.json(summary);
  });

  // Buy token pack (creates Stripe payment intent for one-time purchase)
  app.post("/api/tokens/buy", async (req, res) => {
    const { packSize } = req.body as { packSize: "50k" | "200k" | "1m" };
    const PACKS: Record<string, { tokens: number; price: number; label: string }> = {
      "50k":  { tokens: 50000,   price: 500,  label: "50K Tokens" },
      "200k": { tokens: 200000,  price: 1500, label: "200K Tokens" },
      "1m":   { tokens: 1000000, price: 4900, label: "1M Tokens" },
    };

    const pack = PACKS[packSize];
    if (!pack) return res.status(400).json({ error: "Invalid pack size" });

    try {
      const { stripe } = await import("./stripe");
      const origin = req.headers.origin || `https://${req.headers.host}`;

      const session = await stripe.checkout.sessions.create({
        mode: "payment",
        payment_method_types: ["card"],
        line_items: [{
          price_data: {
            currency: "usd",
            product_data: { name: `Bunz — ${pack.label}` },
            unit_amount: pack.price,
          },
          quantity: 1,
        }],
        success_url: `${origin}/#/usage?bought=${packSize}`,
        cancel_url: `${origin}/#/usage?canceled=1`,
        metadata: { type: "token_pack", packSize, tokens: String(pack.tokens) },
      });

      res.json({ url: session.url });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // === NOTIFICATIONS ===
  app.get("/api/notifications", async (req, res) => {
    const userId = req.user?.id || 1;
    const notifs = await storage.getNotifications(userId, 50);
    const unread = await storage.getUnreadNotificationCount(userId);
    res.json({ notifications: notifs, unreadCount: unread });
  });

  app.post("/api/notifications/:id/read", async (req, res) => {
    await storage.markNotificationRead(Number(req.params.id));
    res.json({ ok: true });
  });

  app.post("/api/notifications/read-all", async (req, res) => {
    const userId = req.user?.id || 1;
    await storage.markAllNotificationsRead(userId);
    res.json({ ok: true });
  });

  // ── Tools Management ──────────────────────────────────────────────────────────
  app.get("/api/tools", async (req, res) => {
    const userId = req.user?.id || 1;
    const tools = await storage.getToolsByOwner(userId);
    res.json(tools);
  });

  app.post("/api/tools", async (req, res) => {
    const { name, description, toolType, endpoint, method, headers, authType, authConfig, inputSchema, outputSchema } = req.body;
    if (!name || !description) return res.status(400).json({ error: "Name and description required" });
    const userId = req.user?.id || 1;
    const tool = await storage.createTool({
      ownerId: userId,
      name, description, toolType: toolType || 'rest_api',
      endpoint, method, headers, authType, authConfig, inputSchema, outputSchema
    });
    res.status(201).json(tool);
  });

  app.get("/api/tools/:id", async (req, res) => {
    const userId = req.user?.id || 1;
    const tool = await storage.getTool(req.params.id);
    if (!tool || tool.ownerId !== userId) return res.status(404).json({ error: "Tool not found" });
    res.json(tool);
  });

  app.put("/api/tools/:id", async (req, res) => {
    const userId = req.user?.id || 1;
    const tool = await storage.getTool(req.params.id);
    if (!tool || tool.ownerId !== userId) return res.status(403).json({ error: "Not authorized" });
    const updated = await storage.updateTool(req.params.id, req.body);
    res.json(updated);
  });

  app.delete("/api/tools/:id", async (req, res) => {
    const userId = req.user?.id || 1;
    const tool = await storage.getTool(req.params.id);
    if (!tool || tool.ownerId !== userId) return res.status(403).json({ error: "Not authorized" });
    await storage.deleteTool(req.params.id);
    res.json({ ok: true });
  });

  // ── User Preferences / Customization ────────────────────────────────────
  app.get("/api/preferences", async (req, res) => {
    const userId = req.user?.id || 1;
    const prefs = await storage.getUserPreferences(userId);
    res.json(prefs);
  });

  app.put("/api/preferences", async (req, res) => {
    const userId = req.user?.id || 1;
    const prefs = await storage.updateUserPreferences(userId, req.body);
    res.json(prefs);
  });

  // === STRIPE ===
  registerStripeRoutes(app);

  // ── Trading Journal ──────────────────────────────────────────────────────────────────
  app.get("/api/trades", async (req, res) => {
    const userId = req.user?.id || 1;
    const trades = await storage.getTradesByUser(userId, {
      symbol: req.query.symbol as string | undefined,
      direction: req.query.direction as string | undefined,
      startDate: req.query.startDate as string | undefined,
      endDate: req.query.endDate as string | undefined,
      limit: req.query.limit ? Number(req.query.limit) : 100,
      offset: req.query.offset ? Number(req.query.offset) : 0,
    });
    res.json(trades);
  });

  app.get("/api/trades/stats", async (req, res) => {
    const userId = req.user?.id || 1;
    const stats = await storage.getTradingStats(userId);
    res.json(stats);
  });

  app.get("/api/trades/equity-curve", async (req, res) => {
    const userId = req.user?.id || 1;
    const curve = await storage.getEquityCurve(userId);
    res.json(curve);
  });

  app.get("/api/trades/monthly-pnl", async (req, res) => {
    const userId = req.user?.id || 1;
    const monthly = await storage.getMonthlyPnl(userId);
    res.json(monthly);
  });

  app.get("/api/trades/by-symbol", async (req, res) => {
    const userId = req.user?.id || 1;
    const bySymbol = await storage.getPnlBySymbol(userId);
    res.json(bySymbol);
  });

  app.get("/api/trades/by-day", async (req, res) => {
    const userId = req.user?.id || 1;
    const byDay = await storage.getPnlByDayOfWeek(userId);
    res.json(byDay);
  });

  app.post("/api/trades/import", async (req, res) => {
    const userId = req.user?.id || 1;
    const { trades } = req.body;
    if (!Array.isArray(trades)) return res.status(400).json({ error: "trades must be an array" });
    const results = [];
    for (const t of trades) {
      const trade = await storage.createTrade({ ...t, userId, importSource: 'csv_import' });
      results.push(trade);
    }
    res.status(201).json({ imported: results.length, trades: results });
  });

  app.post("/api/trades", async (req, res) => {
    const userId = req.user?.id || 1;
    try {
      const trade = await storage.createTrade({ ...req.body, userId });
      res.status(201).json(trade);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.get("/api/trades/:id", async (req, res) => {
    const userId = req.user?.id || 1;
    const trade = await storage.getTrade(req.params.id);
    if (!trade || trade.userId !== userId) return res.status(404).json({ error: "Trade not found" });
    res.json(trade);
  });

  app.put("/api/trades/:id", async (req, res) => {
    const userId = req.user?.id || 1;
    const trade = await storage.getTrade(req.params.id);
    if (!trade || trade.userId !== userId) return res.status(403).json({ error: "Not authorized" });
    const updated = await storage.updateTrade(req.params.id, req.body);
    res.json(updated);
  });

  app.delete("/api/trades/:id", async (req, res) => {
    const userId = req.user?.id || 1;
    const trade = await storage.getTrade(req.params.id);
    if (!trade || trade.userId !== userId) return res.status(403).json({ error: "Not authorized" });
    await storage.deleteTrade(req.params.id);
    res.json({ ok: true });
  });

  app.post("/api/trades/:id/close", async (req, res) => {
    const userId = req.user?.id || 1;
    const { exitPrice, exitTime, fees } = req.body;
    const trade = await storage.getTrade(req.params.id);
    if (!trade || trade.userId !== userId) return res.status(403).json({ error: "Not authorized" });
    const closed = await storage.closeTrade(req.params.id, exitPrice, exitTime || new Date().toISOString(), fees || 0);
    res.json(closed);
  });

  // ── Broker Connections ────────────────────────────────────────────────
  app.get("/api/broker-connections", async (req, res) => {
    const userId = req.user?.id || 1;
    const connections = await storage.getBrokerConnections(userId);
    // Mask secrets before returning
    res.json(
      connections.map((c) => ({
        ...c,
        apiSecret: c.apiSecret ? "••••••" + c.apiSecret.slice(-4) : null,
      }))
    );
  });

  app.post("/api/broker-connections", async (req, res) => {
    const userId = req.user?.id || 1;
    const { broker, label, apiKey, apiSecret, isPaper } = req.body;
    if (!broker || !apiKey || !apiSecret) {
      return res.status(400).json({ error: "Broker, API key, and secret are required" });
    }
    try {
      const { getBroker } = await import("./broker");
      const b = getBroker({ broker, apiKey, apiSecret, isPaper: isPaper ? 1 : 0 });
      const account = await b.getAccount();

      const connection = await storage.createBrokerConnection({
        userId,
        broker,
        label: label || `${broker} ${isPaper ? "Paper" : "Live"}`,
        apiKey,
        apiSecret,
        isPaper: isPaper ? 1 : 0,
        accountId: account.id,
        accountInfo: JSON.stringify(account),
      });

      res.status(201).json({
        ...connection,
        apiSecret: connection.apiSecret ? "••••••" + connection.apiSecret.slice(-4) : null,
      });
    } catch (err: any) {
      res.status(400).json({ error: `Failed to connect: ${err.message}` });
    }
  });

  app.delete("/api/broker-connections/:id", async (req, res) => {
    const userId = req.user?.id || 1;
    const conn = await storage.getBrokerConnection(req.params.id);
    if (!conn || conn.userId !== userId) return res.status(404).json({ error: "Not found" });
    await storage.deleteBrokerConnection(req.params.id);
    res.json({ ok: true });
  });

  // Get live account info
  app.get("/api/broker-connections/:id/account", async (req, res) => {
    const userId = req.user?.id || 1;
    const conn = await storage.getBrokerConnection(req.params.id);
    if (!conn || conn.userId !== userId) return res.status(404).json({ error: "Not found" });
    try {
      const { getBroker } = await import("./broker");
      const broker = getBroker(conn);
      const account = await broker.getAccount();
      res.json(account);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Get live positions
  app.get("/api/broker-connections/:id/positions", async (req, res) => {
    const userId = req.user?.id || 1;
    const conn = await storage.getBrokerConnection(req.params.id);
    if (!conn || conn.userId !== userId) return res.status(404).json({ error: "Not found" });
    try {
      const { getBroker } = await import("./broker");
      const broker = getBroker(conn);
      const positions = await broker.getPositions();
      res.json(positions);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Place order (LIVE TRADING)
  app.post("/api/broker-connections/:id/orders", async (req, res) => {
    const userId = req.user?.id || 1;
    const conn = await storage.getBrokerConnection(req.params.id);
    if (!conn || conn.userId !== userId) return res.status(404).json({ error: "Not found" });
    try {
      const { getBroker } = await import("./broker");
      const broker = getBroker(conn);
      const order = await broker.placeOrder(req.body);
      res.json(order);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Close position
  app.delete("/api/broker-connections/:id/positions/:symbol", async (req, res) => {
    const userId = req.user?.id || 1;
    const conn = await storage.getBrokerConnection(req.params.id);
    if (!conn || conn.userId !== userId) return res.status(404).json({ error: "Not found" });
    try {
      const { getBroker } = await import("./broker");
      const broker = getBroker(conn);
      const result = await broker.closePosition(req.params.symbol);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Sync trades from broker
  app.post("/api/broker-connections/:id/sync", async (req, res) => {
    const userId = req.user?.id || 1;
    const conn = await storage.getBrokerConnection(req.params.id);
    if (!conn || conn.userId !== userId) return res.status(404).json({ error: "Not found" });
    try {
      const { syncTrades } = await import("./broker");
      const result = await syncTrades(req.params.id, userId);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── Forex Calendar ─────────────────────────────────────────────────────────
  let forexCalendarCache: { data: any; fetchedAt: number } | null = null;
  app.get("/api/forex-calendar", async (_req, res) => {
    const FIVE_MIN = 5 * 60 * 1000;
    if (forexCalendarCache && Date.now() - forexCalendarCache.fetchedAt < FIVE_MIN) {
      return res.json(forexCalendarCache.data);
    }
    try {
      const resp = await fetch("https://nfs.faireconomy.media/ff_calendar_thisweek.json");
      const data = await resp.json();
      forexCalendarCache = { data, fetchedAt: Date.now() };
      res.json(data);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── User API Keys ─────────────────────────────────────────────────────────
  app.get("/api/user-api-keys", async (req, res) => {
    const userId = req.user?.id || 1;
    const keys = await storage.getUserApiKeys(userId);
    // Mask API keys in response
    const masked = keys.map(k => ({
      ...k,
      apiKey: k.apiKey ? k.apiKey.slice(0, 8) + "..." + k.apiKey.slice(-4) : null,
    }));
    res.json(masked);
  });

  app.post("/api/user-api-keys", async (req, res) => {
    const userId = req.user?.id || 1;
    const { provider, apiKey, endpointUrl, defaultModel, isDefault } = req.body;
    if (!provider) return res.status(400).json({ error: "provider is required" });
    const key = await storage.createUserApiKey({ userId, provider, apiKey, endpointUrl, defaultModel, isDefault: isDefault ? 1 : 0 });
    res.status(201).json(key);
  });

  app.patch("/api/user-api-keys/:id", async (req, res) => {
    const { provider, apiKey, endpointUrl, defaultModel, isDefault, isActive } = req.body;
    const updates: any = {};
    if (provider !== undefined) updates.provider = provider;
    if (apiKey !== undefined) updates.apiKey = apiKey;
    if (endpointUrl !== undefined) updates.endpointUrl = endpointUrl;
    if (defaultModel !== undefined) updates.defaultModel = defaultModel;
    if (isDefault !== undefined) updates.isDefault = isDefault ? 1 : 0;
    if (isActive !== undefined) updates.isActive = isActive ? 1 : 0;
    const updated = await storage.updateUserApiKey(req.params.id, updates);
    if (!updated) return res.status(404).json({ error: "not found" });
    res.json(updated);
  });

  app.delete("/api/user-api-keys/:id", async (req, res) => {
    await storage.deleteUserApiKey(req.params.id);
    res.json({ ok: true });
  });

  app.post("/api/user-api-keys/:id/test", async (req, res) => {
    const key = await storage.getUserApiKey(req.params.id);
    if (!key) return res.status(404).json({ error: "not found" });
    try {
      let success = false;
      if (key.provider === "openai") {
        const r = await fetch("https://api.openai.com/v1/models", { headers: { Authorization: `Bearer ${key.apiKey}` } });
        success = r.ok;
      } else if (key.provider === "anthropic") {
        const r = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: { "x-api-key": key.apiKey || "", "anthropic-version": "2023-06-01", "Content-Type": "application/json" },
          body: JSON.stringify({ model: "claude-3-haiku-20240307", max_tokens: 1, messages: [{ role: "user", content: "hi" }] }),
        });
        success = r.ok;
      } else if (key.provider === "google") {
        const r = await fetch(`https://generativelanguage.googleapis.com/v1/models?key=${key.apiKey}`);
        success = r.ok;
      } else if (key.provider === "groq") {
        const r = await fetch("https://api.groq.com/openai/v1/models", { headers: { Authorization: `Bearer ${key.apiKey}` } });
        success = r.ok;
      } else if (key.provider === "mistral") {
        const r = await fetch("https://api.mistral.ai/v1/models", { headers: { Authorization: `Bearer ${key.apiKey}` } });
        success = r.ok;
      } else if (key.provider === "ollama") {
        const url = key.endpointUrl || "http://localhost:11434";
        const r = await fetch(`${url}/api/tags`);
        success = r.ok;
      }
      res.json({ success });
    } catch (err: any) {
      res.json({ success: false, error: err.message });
    }
  });

  app.get("/api/user-api-keys/default", async (req, res) => {
    const userId = req.user?.id || 1;
    const key = await storage.getDefaultApiKey(userId);
    if (!key) return res.json(null);
    res.json({ ...key, apiKey: key.apiKey ? key.apiKey.slice(0, 8) + "..." + key.apiKey.slice(-4) : null });
  });

  // ── Account Stacks ────────────────────────────────────────────────────────
  app.get("/api/account-stacks", async (req, res) => {
    const userId = req.user?.id || 1;
    const stacks = await storage.getAccountStacks(userId);
    const result = [];
    for (const stack of stacks) {
      const followers = await storage.getStackFollowers(stack.id);
      result.push({ ...stack, followers });
    }
    res.json(result);
  });

  app.post("/api/account-stacks", async (req, res) => {
    const userId = req.user?.id || 1;
    const { name, leaderConnectionId, copyMode, sizeMultiplier, followerConnectionIds } = req.body;
    if (!name || !leaderConnectionId) return res.status(400).json({ error: "name and leaderConnectionId required" });
    const stack = await storage.createAccountStack({ userId, name, leaderConnectionId, copyMode, sizeMultiplier });
    if (Array.isArray(followerConnectionIds)) {
      for (const cid of followerConnectionIds) {
        await storage.addStackFollower({ stackId: stack.id, connectionId: cid });
      }
    }
    const followers = await storage.getStackFollowers(stack.id);
    res.status(201).json({ ...stack, followers });
  });

  app.delete("/api/account-stacks/:id", async (req, res) => {
    const userId = req.user?.id || 1;
    const stack = await storage.getAccountStack(req.params.id);
    if (!stack || stack.userId !== userId) return res.status(404).json({ error: "Not found" });
    await storage.deleteAccountStack(req.params.id);
    res.json({ ok: true });
  });

  app.post("/api/account-stacks/:id/followers", async (req, res) => {
    const userId = req.user?.id || 1;
    const stack = await storage.getAccountStack(req.params.id);
    if (!stack || stack.userId !== userId) return res.status(404).json({ error: "Not found" });
    const { connectionId, sizeMultiplier } = req.body;
    if (!connectionId) return res.status(400).json({ error: "connectionId required" });
    const follower = await storage.addStackFollower({ stackId: req.params.id, connectionId, sizeMultiplier });
    res.status(201).json(follower);
  });

  app.delete("/api/account-stacks/:id/followers/:fid", async (req, res) => {
    const userId = req.user?.id || 1;
    const stack = await storage.getAccountStack(req.params.id);
    if (!stack || stack.userId !== userId) return res.status(404).json({ error: "Not found" });
    await storage.removeStackFollower(req.params.fid);
    res.json({ ok: true });
  });

  // ── Trading Bots ──────────────────────────────────────────────────────────
  app.get("/api/trading-bots", async (req, res) => {
    const userId = req.user?.id || 1;
    const bots = await storage.getTradingBots(userId);
    res.json(bots);
  });

  app.post("/api/trading-bots", async (req, res) => {
    const userId = req.user?.id || 1;
    const bot = await storage.createTradingBot({ ...req.body, userId });
    res.status(201).json(bot);
  });

  app.put("/api/trading-bots/:id", async (req, res) => {
    const userId = req.user?.id || 1;
    const bot = await storage.getTradingBot(req.params.id);
    if (!bot || bot.userId !== userId) return res.status(404).json({ error: "Not found" });
    const updated = await storage.updateTradingBot(req.params.id, req.body);
    res.json(updated);
  });

  app.delete("/api/trading-bots/:id", async (req, res) => {
    const userId = req.user?.id || 1;
    const bot = await storage.getTradingBot(req.params.id);
    if (!bot || bot.userId !== userId) return res.status(404).json({ error: "Not found" });
    await storage.deleteTradingBot(req.params.id);
    res.json({ ok: true });
  });

  app.post("/api/trading-bots/:id/generate", async (req, res) => {
    const userId = req.user?.id || 1;
    const bot = await storage.getTradingBot(req.params.id);
    if (!bot || bot.userId !== userId) return res.status(404).json({ error: "Not found" });
    try {
      const { runAgentChatWithUserKey } = await import("./ai");
      const { provider, model } = req.body || {};
      let aiModel = "claude-sonnet";
      let userKeyId: string | undefined;
      if (provider && model) {
        const keys = await storage.getUserApiKeys(userId);
        const key = keys.find(k => k.provider === provider && k.isActive);
        if (key) { userKeyId = key.id; aiModel = model; }
      }
      const systemPrompt = `You are an expert algorithmic trading strategy designer. Given a trading strategy description, generate specific: indicators (technical indicators to use), entry_rules (when to enter a trade), exit_rules (when to exit a trade), and risk_rules (position sizing, stop losses). Format your response as JSON with keys: indicators, entryRules, exitRules, riskRules. Each should be a clear, actionable string.`;
      const prompt = `Strategy: ${bot.name}\nDescription: ${bot.description || 'No description'}\nTimeframe: ${bot.timeframe}\nSymbols: ${bot.symbols}\n\nGenerate trading rules for this strategy.`;
      const { reply } = await runAgentChatWithUserKey(aiModel, systemPrompt, [], prompt, userKeyId);
      let parsed: any = {};
      try {
        const jsonMatch = reply.match(/\{[\s\S]*\}/);
        if (jsonMatch) parsed = JSON.parse(jsonMatch[0]);
      } catch { parsed = { indicators: reply, entryRules: '', exitRules: '', riskRules: '' }; }
      const updated = await storage.updateTradingBot(req.params.id, {
        indicators: parsed.indicators || reply,
        entryRules: parsed.entryRules || parsed.entry_rules || '',
        exitRules: parsed.exitRules || parsed.exit_rules || '',
        riskRules: parsed.riskRules || parsed.risk_rules || '',
        status: 'generated',
      } as any);
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── Bot Deployments ───────────────────────────────────────────────────────
  app.get("/api/bot-deployments", async (req, res) => {
    const userId = req.user?.id || 1;
    const deployments = await storage.getBotDeployments(userId);
    res.json(deployments);
  });

  app.post("/api/bot-deployments", async (req, res) => {
    const userId = req.user?.id || 1;
    const deployment = await storage.createBotDeployment({ ...req.body, userId });
    res.status(201).json(deployment);
  });

  app.put("/api/bot-deployments/:id", async (req, res) => {
    const userId = req.user?.id || 1;
    const dep = await storage.getBotDeployment(req.params.id);
    if (!dep || dep.userId !== userId) return res.status(404).json({ error: "Not found" });
    const updated = await storage.updateBotDeployment(req.params.id, req.body);
    res.json(updated);
  });

  app.delete("/api/bot-deployments/:id", async (req, res) => {
    const userId = req.user?.id || 1;
    const dep = await storage.getBotDeployment(req.params.id);
    if (!dep || dep.userId !== userId) return res.status(404).json({ error: "Not found" });
    await storage.deleteBotDeployment(req.params.id);
    res.json({ ok: true });
  });

  // ── Fiverr Gigs ───────────────────────────────────────────────────────────
  app.get("/api/fiverr-gigs", async (req, res) => {
    const userId = req.user?.id || 1;
    const gigs = await storage.getFiverrGigs(userId);
    res.json(gigs);
  });

  app.post("/api/fiverr-gigs", async (req, res) => {
    const userId = req.user?.id || 1;
    const gig = await storage.createFiverrGig({ ...req.body, userId });
    res.status(201).json(gig);
  });

  app.get("/api/fiverr-gigs/:id", async (req, res) => {
    const userId = req.user?.id || 1;
    const gig = await storage.getFiverrGig(req.params.id);
    if (!gig || gig.userId !== userId) return res.status(404).json({ error: "Not found" });
    res.json(gig);
  });

  app.put("/api/fiverr-gigs/:id", async (req, res) => {
    const userId = req.user?.id || 1;
    const gig = await storage.getFiverrGig(req.params.id);
    if (!gig || gig.userId !== userId) return res.status(404).json({ error: "Not found" });
    const updated = await storage.updateFiverrGig(req.params.id, req.body);
    res.json(updated);
  });

  app.delete("/api/fiverr-gigs/:id", async (req, res) => {
    const userId = req.user?.id || 1;
    const gig = await storage.getFiverrGig(req.params.id);
    if (!gig || gig.userId !== userId) return res.status(404).json({ error: "Not found" });
    await storage.deleteFiverrGig(req.params.id);
    res.json({ ok: true });
  });

  // ── Fiverr Orders ─────────────────────────────────────────────────────────
  app.get("/api/fiverr-orders", async (req, res) => {
    const userId = req.user?.id || 1;
    const orders = await storage.getFiverrOrders(userId);
    res.json(orders);
  });

  app.post("/api/fiverr-orders", async (req, res) => {
    const userId = req.user?.id || 1;
    const order = await storage.createFiverrOrder({ ...req.body, userId });
    res.status(201).json(order);
  });

  app.put("/api/fiverr-orders/:id", async (req, res) => {
    const userId = req.user?.id || 1;
    const order = await storage.getFiverrOrder(req.params.id);
    if (!order || order.userId !== userId) return res.status(404).json({ error: "Not found" });
    const updated = await storage.updateFiverrOrder(req.params.id, req.body);
    res.json(updated);
  });

  app.post("/api/fiverr-orders/:id/generate", async (req, res) => {
    const userId = req.user?.id || 1;
    const order = await storage.getFiverrOrder(req.params.id);
    if (!order || order.userId !== userId) return res.status(404).json({ error: "Not found" });
    const gig = await storage.getFiverrGig(order.gigId);
    try {
      const { runAgentChatWithUserKey } = await import("./ai");
      const { provider, model } = req.body || {};
      let aiModel = gig?.aiModel || "claude-sonnet";
      let userKeyId: string | undefined;
      if (provider && model) {
        const keys = await storage.getUserApiKeys(userId);
        const key = keys.find(k => k.provider === provider && k.isActive);
        if (key) { userKeyId = key.id; aiModel = model; }
      }
      const systemPrompt = `You are a professional freelancer completing a Fiverr order. Generate a high-quality deliverable draft based on the gig description and buyer requirements. Be thorough and professional.`;
      const prompt = `Gig: ${gig?.title || 'Freelance work'}\nGig Description: ${gig?.description || 'N/A'}\nBuyer Requirements: ${order.requirements || 'No specific requirements'}\n\nGenerate the deliverable.`;
      const { reply } = await runAgentChatWithUserKey(aiModel, systemPrompt, [], prompt, userKeyId);
      const updated = await storage.updateFiverrOrder(req.params.id, { aiDraft: reply, status: 'draft_ready' } as any);
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── Jarvis Voice ──────────────────────────────────────────────────────────
  app.post("/api/jarvis/tts", async (req, res) => {
    const { text, voice } = req.body;
    if (!text) return res.status(400).json({ error: "text required" });

    const voiceMap: Record<string, string> = {
      jarvis: "onyx", nova: "nova", echo: "echo", sage: "shimmer", atlas: "fable",
    };

    try {
      const openai = new (await import("openai")).default({ apiKey: process.env.OPENAI_API_KEY });
      const mp3 = await openai.audio.speech.create({
        model: "tts-1",
        voice: (voiceMap[voice || "jarvis"] || "onyx") as any,
        input: text,
      });
      const buffer = Buffer.from(await mp3.arrayBuffer());
      res.set({ "Content-Type": "audio/mpeg", "Content-Length": String(buffer.length) });
      res.send(buffer);
    } catch (err: any) {
      res.json({ audioUrl: null, error: err.message });
    }
  });

  app.post("/api/jarvis/stt", async (req, res) => {
    const { audio } = req.body;
    if (!audio) return res.status(400).json({ error: "audio required" });

    try {
      const openai = new (await import("openai")).default({ apiKey: process.env.OPENAI_API_KEY });
      const buffer = Buffer.from(audio, "base64");
      const file = new File([buffer], "audio.webm", { type: "audio/webm" });
      const transcription = await openai.audio.transcriptions.create({ model: "whisper-1", file });
      res.json({ transcript: transcription.text });
    } catch (err: any) {
      res.json({ transcript: null, error: err.message });
    }
  });

  app.get("/api/jarvis/voices", async (_req, res) => {
    res.json([
      { id: "jarvis", name: "Jarvis", description: "Male, deep", isDefault: true },
      { id: "nova", name: "Nova", description: "Female, professional" },
      { id: "echo", name: "Echo", description: "Male, casual" },
      { id: "sage", name: "Sage", description: "Female, warm" },
      { id: "atlas", name: "Atlas", description: "Male, authoritative" },
    ]);
  });

  // ── Generated Apps ────────────────────────────────────────────────────────
  app.get("/api/generated-apps", async (req, res) => {
    const userId = req.user?.id || 1;
    const apps = await storage.getGeneratedApps(userId);
    res.json(apps);
  });

  app.post("/api/generated-apps", async (req, res) => {
    const userId = req.user?.id || 1;
    const app_ = await storage.createGeneratedApp({ ...req.body, userId });
    res.status(201).json(app_);
  });

  app.get("/api/generated-apps/:id", async (req, res) => {
    const userId = req.user?.id || 1;
    const app_ = await storage.getGeneratedApp(req.params.id);
    if (!app_ || app_.userId !== userId) return res.status(404).json({ error: "Not found" });
    res.json(app_);
  });

  app.put("/api/generated-apps/:id", async (req, res) => {
    const userId = req.user?.id || 1;
    const app_ = await storage.getGeneratedApp(req.params.id);
    if (!app_ || app_.userId !== userId) return res.status(404).json({ error: "Not found" });
    const updated = await storage.updateGeneratedApp(req.params.id, req.body);
    res.json(updated);
  });

  app.delete("/api/generated-apps/:id", async (req, res) => {
    const userId = req.user?.id || 1;
    const app_ = await storage.getGeneratedApp(req.params.id);
    if (!app_ || app_.userId !== userId) return res.status(404).json({ error: "Not found" });
    await storage.deleteGeneratedApp(req.params.id);
    res.json({ ok: true });
  });

  app.post("/api/generated-apps/:id/generate", async (req, res) => {
    const userId = req.user?.id || 1;
    const app_ = await storage.getGeneratedApp(req.params.id);
    if (!app_ || app_.userId !== userId) return res.status(404).json({ error: "Not found" });
    try {
      const { runAgentChatWithUserKey } = await import("./ai");
      const { provider, model } = req.body || {};
      let aiModel = "claude-sonnet";
      let userKeyId: string | undefined;
      if (provider && model) {
        const keys = await storage.getUserApiKeys(userId);
        const key = keys.find(k => k.provider === provider && k.isActive);
        if (key) { userKeyId = key.id; aiModel = model; }
      }
      const systemPrompt = `You are an expert app developer. Generate complete, working code for the described application. Return clean, well-structured code with comments. Use the specified framework. Use file markers like "// === filename.ext ===" to separate files.`;
      const prompt = `App: ${app_.name}\nDescription: ${app_.description || 'No description'}\nFramework: ${app_.framework}\nApp Type: ${app_.appType}\n\nGenerate the complete app code.`;
      const { reply } = await runAgentChatWithUserKey(aiModel, systemPrompt, [], prompt, userKeyId);

      // Save version snapshot
      let versions: any[] = [];
      try { if (app_.versions) versions = JSON.parse(app_.versions); } catch {}
      versions.push({ code: reply, timestamp: new Date().toISOString(), version: versions.length + 1 });
      const updated = await storage.updateGeneratedApp(req.params.id, { generatedCode: reply, status: 'generated', versions: JSON.stringify(versions) } as any);
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── White Label Configs ───────────────────────────────────────────────────
  app.get("/api/white-label-configs", async (req, res) => {
    const userId = req.user?.id || 1;
    const configs = await storage.getWhiteLabelConfigs(userId);
    res.json(configs);
  });

  app.post("/api/white-label-configs", async (req, res) => {
    const userId = req.user?.id || 1;
    const config = await storage.createWhiteLabelConfig({ ...req.body, userId });
    res.status(201).json(config);
  });

  app.get("/api/white-label-configs/:id", async (req, res) => {
    const userId = req.user?.id || 1;
    const config = await storage.getWhiteLabelConfig(req.params.id);
    if (!config || config.userId !== userId) return res.status(404).json({ error: "Not found" });
    res.json(config);
  });

  app.put("/api/white-label-configs/:id", async (req, res) => {
    const userId = req.user?.id || 1;
    const config = await storage.getWhiteLabelConfig(req.params.id);
    if (!config || config.userId !== userId) return res.status(404).json({ error: "Not found" });
    const updated = await storage.updateWhiteLabelConfig(req.params.id, req.body);
    res.json(updated);
  });

  app.delete("/api/white-label-configs/:id", async (req, res) => {
    const userId = req.user?.id || 1;
    const config = await storage.getWhiteLabelConfig(req.params.id);
    if (!config || config.userId !== userId) return res.status(404).json({ error: "Not found" });
    await storage.deleteWhiteLabelConfig(req.params.id);
    res.json({ ok: true });
  });

  // ── Prop Accounts ─────────────────────────────────────────────────────────
  app.get("/api/prop-accounts", async (req, res) => {
    const userId = req.user?.id || 1;
    const accounts = await storage.getPropAccounts(userId);
    res.json(accounts);
  });

  app.post("/api/prop-accounts", async (req, res) => {
    const userId = req.user?.id || 1;
    const account = await storage.createPropAccount({ ...req.body, userId });
    res.status(201).json(account);
  });

  app.get("/api/prop-accounts/:id", async (req, res) => {
    const userId = req.user?.id || 1;
    const account = await storage.getPropAccount(req.params.id);
    if (!account || account.userId !== userId) return res.status(404).json({ error: "Not found" });
    res.json(account);
  });

  app.put("/api/prop-accounts/:id", async (req, res) => {
    const userId = req.user?.id || 1;
    const account = await storage.getPropAccount(req.params.id);
    if (!account || account.userId !== userId) return res.status(404).json({ error: "Not found" });
    const updated = await storage.updatePropAccount(req.params.id, req.body);
    res.json(updated);
  });

  app.delete("/api/prop-accounts/:id", async (req, res) => {
    const userId = req.user?.id || 1;
    const account = await storage.getPropAccount(req.params.id);
    if (!account || account.userId !== userId) return res.status(404).json({ error: "Not found" });
    await storage.deletePropAccount(req.params.id);
    res.json({ ok: true });
  });

  // ── Activity Feed (Dashboard) ────────────────────────────────────────────
  app.get("/api/activity-feed", async (req, res) => {
    try {
      const userId = req.user?.id || 1;
      const trades = await storage.getTradesByUser(userId, { limit: 5 });
      const bots = await storage.getTradingBots(userId);
      const orders = await storage.getFiverrOrders(userId);
      const apps = await storage.getGeneratedApps(userId);
      const deployments = await storage.getBotDeployments(userId);
      const keys = await storage.getUserApiKeys(userId);
      const brokers = await storage.getBrokerConnections(userId);

      res.json({
        recentTrades: trades.slice(0, 5),
        activeBots: bots.filter((b: any) => b.status === "generated" || b.status === "running").length,
        openOrders: orders.filter((o: any) => o.status === "pending").length,
        totalApps: apps.length,
        activeDeployments: deployments.filter((d: any) => d.status === "running").length,
        connectedProviders: keys.filter((k: any) => k.isActive).length,
        connectedBrokers: brokers.filter((b: any) => b.isActive).length,
        totalBots: bots.length,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── Account Stack Execution ──────────────────────────────────────────────
  app.post("/api/account-stacks/:id/execute", async (req, res) => {
    const userId = req.user?.id || 1;
    const stack = await storage.getAccountStack(req.params.id);
    if (!stack) return res.status(404).json({ error: "Stack not found" });

    const { symbol, side, quantity, price } = req.body;
    const results: any[] = [];
    const followers = await storage.getStackFollowers(stack.id);

    for (const follower of followers) {
      const adjQty = quantity * (follower.sizeMultiplier || 1);
      const logEntry = {
        id: require("uuid").v4(),
        stackId: stack.id,
        connectionId: follower.connectionId,
        symbol: symbol || "N/A",
        side: side || "buy",
        quantity: adjQty,
        price: price || 0,
        status: follower.isActive ? "filled" : "skipped",
        executedAt: new Date().toISOString(),
      };
      try {
        storage.addStackExecutionLog(logEntry);
      } catch {}
      results.push(logEntry);
    }

    res.json({ executions: results });
  });

  app.get("/api/account-stacks/:id/executions", async (req, res) => {
    try {
      const logs = storage.getStackExecutionLogs(req.params.id);
      res.json(logs);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── Products + Purchase ──────────────────────────────────────────────────
  app.get("/api/products", async (req, res) => {
    const products = await storage.getProducts();
    res.json(products);
  });

  app.get("/api/products/:id", async (req, res) => {
    const product = await storage.getProduct(req.params.id);
    if (!product) return res.status(404).json({ error: "Product not found" });
    res.json(product);
  });

  app.post("/api/products/:id/purchase", async (req, res) => {
    const userId = req.user?.id || 1;
    const user = await storage.getUser(userId);
    const product = await storage.getProduct(req.params.id);
    if (!product) return res.status(404).json({ error: "Product not found" });

    // Owner gets everything free
    if (user?.role === "owner") {
      const existing = await storage.getUserProduct(userId, product.id);
      if (existing) return res.json({ already_owned: true, product: existing });
      const up = await storage.createUserProduct({ userId, productId: product.id, priceCents: 0 });
      return res.json({ purchased: true, product: up });
    }

    const existing = await storage.getUserProduct(userId, product.id);
    if (existing) return res.json({ already_owned: true, product: existing });

    try {
      const { stripe } = await import("./stripe");
      const origin = req.headers.origin || `https://${req.headers.host}`;
      const session = await stripe.checkout.sessions.create({
        mode: "payment",
        line_items: [{
          price_data: {
            currency: "usd",
            product_data: { name: product.name, description: product.description || "" },
            unit_amount: product.priceCents,
          },
          quantity: 1,
        }],
        success_url: `${origin}/#/workflows?purchased=${product.id}`,
        cancel_url: `${origin}/#/marketplace`,
        metadata: { userId: String(userId), productId: product.id, type: "product_purchase" },
      });
      res.json({ url: session.url });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/user-products", async (req, res) => {
    const userId = req.user?.id || 1;
    const products = await storage.getUserProducts(userId);
    res.json(products);
  });

  // ── Workflow Presets ────────────────────────────────────────────────────────
  app.get("/api/workflow-presets", async (req, res) => {
    const presets = await storage.getWorkflowPresets(req.query.productId as string | undefined);
    res.json(presets);
  });

  app.get("/api/workflow-presets/:id", async (req, res) => {
    const preset = await storage.getWorkflowPreset(req.params.id);
    if (!preset) return res.status(404).json({ error: "Preset not found" });
    res.json(preset);
  });

  app.post("/api/workflow-presets/:id/apply", async (req, res) => {
    const userId = req.user?.id || 1;
    const preset = await storage.getWorkflowPreset(req.params.id);
    if (!preset) return res.status(404).json({ error: "Preset not found" });

    // Check if user owns the required product (if preset requires one)
    if (preset.productId) {
      const user = await storage.getUser(userId);
      if (user?.role !== "owner") {
        const owned = await storage.getUserProduct(userId, preset.productId);
        if (!owned) return res.status(403).json({ error: "Product required", productId: preset.productId });
      }
    }

    // Create a workflow from the preset template
    const workflow = await storage.createWorkflow({
      name: preset.name,
      description: preset.description,
      status: "draft",
      priority: "medium",
    });

    // Save the canvas state from template
    if (preset.templateData) {
      await storage.updateWorkflow(workflow.id, { canvasState: preset.templateData } as any);
    }

    res.json(workflow);
  });

  // ── Marketplace Sell Items ──────────────────────────────────────────────────
  app.post("/api/marketplace/sell-item", async (req, res) => {
    const userId = req.user?.id || 1;
    const { title, description, price, priceType, category, listingType, attachedItemId, attachedItemData } = req.body;
    if (!title) return res.status(400).json({ error: "Title required" });

    try {
      const listing = await storage.createMarketplaceListing({
        sellerId: userId,
        title,
        shortDescription: description || title,
        fullDescription: description || "",
        category: category || "tool",
        price: price || 0,
        priceType: priceType || "one_time",
        tags: [],
        previewImages: [],
      });

      // Update with extra columns via raw SQL
      if (listingType || attachedItemId || attachedItemData) {
        const updates: string[] = [];
        const vals: any[] = [];
        if (listingType) { updates.push("listing_type = ?"); vals.push(listingType); }
        if (attachedItemId) { updates.push("attached_item_id = ?"); vals.push(attachedItemId); }
        if (attachedItemData) { updates.push("attached_item_data = ?"); vals.push(typeof attachedItemData === "string" ? attachedItemData : JSON.stringify(attachedItemData)); }
        if (updates.length) {
          vals.push(listing.id);
          const db = (await import("./storage")).default || (await import("./storage"));
          // Direct SQL update for new columns
          const Database = (await import("better-sqlite3")).default;
          const DB_PATH = process.env.NODE_ENV === "production" ? "/data/data.db" : "data.db";
          const sqliteDb = new Database(DB_PATH);
          sqliteDb.prepare(`UPDATE marketplace_listings SET ${updates.join(", ")} WHERE id = ?`).run(...vals);
          sqliteDb.close();
        }
      }

      res.status(201).json(listing);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── Marketplace Purchase with Item Copy ─────────────────────────────────────
  app.post("/api/marketplace/listings/:id/buy-item", async (req, res) => {
    const userId = req.user?.id || 1;
    const listing = await storage.getMarketplaceListing(Number(req.params.id));
    if (!listing) return res.status(404).json({ error: "Listing not found" });

    // Check for attached item data
    const Database = (await import("better-sqlite3")).default;
    const DB_PATH = process.env.NODE_ENV === "production" ? "/data/data.db" : "data.db";
    const sqliteDb = new Database(DB_PATH);
    const row = sqliteDb.prepare("SELECT listing_type, attached_item_data FROM marketplace_listings WHERE id = ?").get(Number(req.params.id)) as any;
    sqliteDb.close();

    const itemData = row?.attached_item_data ? JSON.parse(row.attached_item_data) : null;
    const listingType = row?.listing_type || "service";

    // Copy item to buyer's account
    let copiedItem = null;
    if (itemData) {
      if (listingType === "workflow" || listingType === "automation") {
        copiedItem = await storage.createWorkflow({
          name: itemData.name || listing.title,
          description: itemData.description || listing.shortDescription,
          status: "draft",
          priority: "medium",
        });
        if (itemData.canvasState) {
          await storage.updateWorkflow(copiedItem.id, { canvasState: itemData.canvasState } as any);
        }
      }
      // For bot or code types, just provide the data
    }

    res.json({ purchased: true, copiedItem, listingType, listing });
  });

  // ── Fiverr Webhook for External Orders ──────────────────────────────────────
  app.post("/api/fiverr/webhook/order", async (req, res) => {
    const { clientName, clientEmail, gigType, requirements, deadline } = req.body;
    try {
      const order = await storage.createFiverrOrder({
        gigId: "webhook",
        userId: 1,
        buyerName: clientName || "External Client",
        requirements: requirements || "",
        amount: 0,
      });
      // Update extra columns
      const Database = (await import("better-sqlite3")).default;
      const DB_PATH = process.env.NODE_ENV === "production" ? "/data/data.db" : "data.db";
      const sqliteDb = new Database(DB_PATH);
      sqliteDb.prepare("UPDATE fiverr_orders SET client_name = ?, client_email = ?, gig_type = ?, deadline = ?, status = ? WHERE id = ?").run(
        clientName || null, clientEmail || null, gigType || null, deadline || null, "intake", order.id
      );
      sqliteDb.close();
      res.json({ orderId: order.id });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── Fiverr Pipeline Stage Update ────────────────────────────────────────────
  app.post("/api/fiverr-orders/:id/advance", async (req, res) => {
    const { stage, revisionNotes } = req.body;
    const order = await storage.getFiverrOrder(req.params.id);
    if (!order) return res.status(404).json({ error: "Order not found" });

    const update: any = { status: stage };
    const updated = await storage.updateFiverrOrder(req.params.id, update);

    // If moving to generation stage, trigger AI generation
    if (stage === "generation") {
      try {
        const { runAgentChat } = await import("./ai");
        const systemPrompt = "You are an expert content creator. Generate the deliverable based on the client requirements. Be professional and thorough.";
        const userMessage = `Client requirements: ${order.requirements || "Not specified"}. ${revisionNotes ? `Revision notes: ${revisionNotes}` : ""}`;
        const reply = await runAgentChat("claude-sonnet", systemPrompt, [], userMessage);

        // Save AI output
        const Database = (await import("better-sqlite3")).default;
        const DB_PATH = process.env.NODE_ENV === "production" ? "/data/data.db" : "data.db";
        const sqliteDb = new Database(DB_PATH);
        sqliteDb.prepare("UPDATE fiverr_orders SET ai_output = ?, status = ? WHERE id = ?").run(reply, "quality_check", req.params.id);
        sqliteDb.close();

        return res.json({ ...updated, aiOutput: reply, status: "quality_check" });
      } catch (err: any) {
        return res.json({ ...updated, error: "AI generation failed: " + err.message });
      }
    }

    res.json(updated);
  });

  // ── Fiverr Revenue Stats ────────────────────────────────────────────────────
  app.get("/api/fiverr/stats", async (req, res) => {
    const userId = req.user?.id || 1;
    const orders = await storage.getFiverrOrders(userId);
    const completed = orders.filter(o => o.status === "completed" || o.status === "delivered");
    const totalRevenue = completed.reduce((sum, o) => sum + (o.amount || 0), 0);
    const avgOrderValue = completed.length ? totalRevenue / completed.length : 0;
    const byStatus: Record<string, number> = {};
    orders.forEach(o => { byStatus[o.status] = (byStatus[o.status] || 0) + 1; });

    res.json({
      totalRevenue,
      avgOrderValue,
      totalOrders: orders.length,
      completedOrders: completed.length,
      byStatus,
    });
  });

  // ── Health Check ──────────────────────────────────────────────────────────
  app.get("/api/health", async (_req, res) => {
    const dbOk = await storage.checkHealth();
    const uptimeMs = Date.now() - (SERVER_START_TIME || Date.now());
    const uptimeSec = Math.floor(uptimeMs / 1000);
    const hours = Math.floor(uptimeSec / 3600);
    const mins = Math.floor((uptimeSec % 3600) / 60);
    const secs = uptimeSec % 60;
    res.json({
      status: dbOk ? "ok" : "degraded",
      version: "0.1.0-alpha",
      uptime: `${hours}h ${mins}m ${secs}s`,
      uptimeSeconds: uptimeSec,
      db: dbOk,
      redis: false, // Redis not yet integrated
      timestamp: new Date().toISOString(),
    });
  });

  // ── Rate Limit Check (client can query before AI calls) ─────────────────
  app.get("/api/rate-limit/status", async (req, res) => {
    const userId = req.user?.id || 1;
    const email = req.user?.email || "";
    const tier = req.user?.tier || "free";
    const result = await checkRateLimit(userId, email, tier);
    res.json(result);
  });

  // ── Boss Conversations (Persistence) ────────────────────────────────────
  app.get("/api/conversations", async (req, res) => {
    const userId = req.user?.id || 1;
    const convs = await storage.getConversations(userId);
    res.json(convs);
  });

  app.post("/api/conversations", async (req, res) => {
    const userId = req.user?.id || 1;
    const { id, title } = req.body;
    if (!id) return res.status(400).json({ error: "id is required" });
    const conv = await storage.createConversation({ id, userId, title: title || "New conversation" });
    res.status(201).json(conv);
  });

  app.get("/api/conversations/:id", async (req, res) => {
    const conv = await storage.getConversation(req.params.id);
    if (!conv) return res.status(404).json({ error: "Not found" });
    res.json(conv);
  });

  app.get("/api/conversations/:id/messages", async (req, res) => {
    const msgs = await storage.getConversationMessages(req.params.id);
    res.json(msgs);
  });

  app.post("/api/conversations/:id/messages", async (req, res) => {
    const { role, content } = req.body;
    if (!role || !content) return res.status(400).json({ error: "role and content required" });
    const msg = await storage.addConversationMessage({ conversationId: req.params.id, role, content });
    res.status(201).json(msg);
  });

  app.patch("/api/conversations/:id", async (req, res) => {
    const { title } = req.body;
    const conv = await storage.updateConversation(req.params.id, { title });
    res.json(conv);
  });

  app.delete("/api/conversations/:id", async (req, res) => {
    await storage.deleteConversation(req.params.id);
    res.status(204).end();
  });

  return httpServer;
}

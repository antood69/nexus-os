import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertWorkflowSchema, insertAgentSchema, insertJobSchema, insertMessageSchema, insertAuditReviewSchema } from "@shared/schema";
import { runAgentChat } from "./ai";
import { registerStripeRoutes } from "./stripe";
import { executeWorkflowRun } from "./orchestrator";
import { createAuthRouter, createOwnerRouter, authMiddleware, collectIntelligence } from "./auth";
import cookieParser from "cookie-parser";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  // === COOKIE PARSER + AUTH ===
  app.use(cookieParser());
  app.use("/api/auth", createAuthRouter());
  app.use(authMiddleware);
  app.use("/api/owner", createOwnerRouter());

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
    const { message, context } = req.body as { message: string; context?: string };
    if (!message) return res.status(400).json({ error: "message required" });

    const systemPrompt = `You are Jarvis, the AI assistant for NEXUS OS — an AI agent orchestration platform. You have full awareness of the platform and can help with:
- Creating and managing workflows, agents, and jobs
- Trading strategy questions and prop firm guidance  
- Analyzing audit results and escalations
- Controlling desktop apps and browser automation (tell user to enable Desktop Agent)
- Any general questions

Current page context: ${context || "unknown"}
Be concise, direct, and helpful. If asked to perform an action, explain what you would do step by step.`;

    try {
      const { runAgentChat } = await import("./ai");
      const { reply, inputTokens, outputTokens, totalTokens } = await runAgentChat("claude-sonnet", systemPrompt, [], message);

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
  app.get("/api/tokens/status", async (_req, res) => {
    const userId = 1; // placeholder until auth
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
            product_data: { name: `NEXUS OS — ${pack.label}` },
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

  // === STRIPE ===
  registerStripeRoutes(app);

  return httpServer;
}

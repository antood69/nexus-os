import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Workflows — the top-level orchestration unit
export const workflows = sqliteTable("workflows", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  description: text("description"),
  status: text("status").notNull().default("draft"), // draft | active | paused | completed
  priority: text("priority").notNull().default("medium"), // low | medium | high | critical
  canvasState: text("canvas_state"), // JSON: React Flow nodes + edges
  isTemplate: integer("is_template").default(0), // 0 | 1
  templateCategory: text("template_category"),
  templateDescription: text("template_description"),
  isPublic: integer("is_public").default(0), // 0 | 1
  forkCount: integer("fork_count").default(0),
  useCount: integer("use_count").default(0),
  createdAt: text("created_at").notNull().default(""),
});

export const insertWorkflowSchema = createInsertSchema(workflows).omit({ id: true, createdAt: true, forkCount: true, useCount: true });
export type InsertWorkflow = z.infer<typeof insertWorkflowSchema>;
export type Workflow = typeof workflows.$inferSelect;

// Agents — AI workers assigned to workflows
export const agents = sqliteTable("agents", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  role: text("role").notNull(), // writer | coder | auditor | researcher | designer
  model: text("model").notNull().default("claude-sonnet"), // claude-sonnet | claude-opus | gpt-4o | perplexity
  workflowId: integer("workflow_id"),
  status: text("status").notNull().default("idle"), // idle | working | paused | error
  systemPrompt: text("system_prompt"),
  createdAt: text("created_at").notNull().default(""),
});

export const insertAgentSchema = createInsertSchema(agents).omit({ id: true, createdAt: true });
export type InsertAgent = z.infer<typeof insertAgentSchema>;
export type Agent = typeof agents.$inferSelect;

// Jobs — individual tasks within a workflow
export const jobs = sqliteTable("jobs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  workflowId: integer("workflow_id").notNull(),
  agentId: integer("agent_id"),
  title: text("title").notNull(),
  status: text("status").notNull().default("queued"), // queued | running | completed | failed
  result: text("result"),
  createdAt: text("created_at").notNull().default(""),
});

export const insertJobSchema = createInsertSchema(jobs).omit({ id: true, createdAt: true });
export type InsertJob = z.infer<typeof insertJobSchema>;
export type Job = typeof jobs.$inferSelect;

// Messages — chat messages per agent
export const messages = sqliteTable("messages", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  agentId: integer("agent_id").notNull(),
  role: text("role").notNull(), // user | assistant
  content: text("content").notNull(),
  createdAt: text("created_at").notNull().default(""),
});

export const insertMessageSchema = createInsertSchema(messages).omit({ id: true, createdAt: true });
export type InsertMessage = z.infer<typeof insertMessageSchema>;
export type Message = typeof messages.$inferSelect;

// Audit reviews — code/content reviews by auditor agents
export const auditReviews = sqliteTable("audit_reviews", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  jobId: integer("job_id").notNull(),
  agentId: integer("agent_id").notNull(),
  verdict: text("verdict").notNull(), // pass | fail | warning
  notes: text("notes"),
  createdAt: text("created_at").notNull().default(""),
});

export const insertAuditReviewSchema = createInsertSchema(auditReviews).omit({ id: true, createdAt: true });
export type InsertAuditReview = z.infer<typeof insertAuditReviewSchema>;
export type AuditReview = typeof auditReviews.$inferSelect;

// Users table (full auth system)
export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  username: text("username").notNull().unique(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash"), // null for OAuth-only users
  displayName: text("display_name"),
  avatarUrl: text("avatar_url"),
  authProvider: text("auth_provider").notNull().default("email"), // email | google | github
  providerId: text("provider_id"), // OAuth provider user ID
  role: text("role").notNull().default("user"), // user | admin | owner
  tier: text("tier").notNull().default("free"), // free | starter | pro | agency
  stripeCustomerId: text("stripe_customer_id"),
  subscriptionId: text("subscription_id"),
  lastLoginAt: text("last_login_at"),
  createdAt: text("created_at").notNull().default(""),
});

export const insertUserSchema = createInsertSchema(users).omit({ id: true, createdAt: true });
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

// Sessions table
export const sessions = sqliteTable("sessions", {
  id: text("id").primaryKey(), // UUID session token
  userId: integer("user_id").notNull(),
  expiresAt: text("expires_at").notNull(),
  createdAt: text("created_at").notNull().default(""),
});
export type Session = typeof sessions.$inferSelect;

// Owner Intelligence — collects all user generations for the owner's AI training
export const ownerIntelligence = sqliteTable("owner_intelligence", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").notNull(),
  userEmail: text("user_email"),
  eventType: text("event_type").notNull(), // agent_chat | jarvis | workflow_run | generation
  model: text("model"),
  inputData: text("input_data"), // JSON: what the user sent
  outputData: text("output_data"), // JSON: what the AI returned
  tokensUsed: integer("tokens_used").default(0),
  quality: text("quality"), // good | bad | neutral — can be tagged later
  tags: text("tags"), // JSON array for categorization
  metadata: text("metadata"), // JSON: any extra context
  createdAt: text("created_at").notNull().default(""),
});
export type OwnerIntelligence = typeof ownerIntelligence.$inferSelect;

// Escalations — agent watchdog escalation records
export const escalations = sqliteTable("escalations", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  jobId: integer("job_id").notNull(),
  agentId: integer("agent_id"),
  level: integer("level").notNull().default(1), // 1=self-resolve, 2=reviewer, 3=boss
  reason: text("reason").notNull(), // "loop_detected" | "step_budget" | "low_confidence"
  context: text("context"), // JSON dump of last N steps
  status: text("status").notNull().default("pending"), // pending | resolved | archived
  resolution: text("resolution"),
  createdAt: text("created_at").notNull().default(""),
});
export const insertEscalationSchema = createInsertSchema(escalations).omit({ id: true, createdAt: true });
export type InsertEscalation = z.infer<typeof insertEscalationSchema>;
export type Escalation = typeof escalations.$inferSelect;

// Trade Journal — AI-powered post-trade analysis
export const tradeJournal = sqliteTable("trade_journal", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  firm: text("firm").notNull(), // "apex" | "topstep" | "ftmo" | "tradeday" etc
  instrument: text("instrument").notNull(), // "ES", "NQ", "EUR/USD" etc
  direction: text("direction").notNull(), // "long" | "short"
  entryPrice: text("entry_price").notNull(),
  exitPrice: text("exit_price"),
  pnl: text("pnl"), // can be null until closed
  riskReward: text("risk_reward"),
  entryReason: text("entry_reason"), // user notes
  aiAnalysis: text("ai_analysis"), // AI-generated post-trade analysis
  tags: text("tags"), // JSON array of tags
  status: text("status").notNull().default("open"), // open | closed
  openedAt: text("opened_at").notNull().default(""),
  closedAt: text("closed_at"),
  createdAt: text("created_at").notNull().default(""),
});
export const insertTradeJournalSchema = createInsertSchema(tradeJournal).omit({ id: true, createdAt: true });
export type InsertTradeJournal = z.infer<typeof insertTradeJournalSchema>;
export type TradeJournalEntry = typeof tradeJournal.$inferSelect;

// Bot Challenges — simulated prop firm challenge runs
export const botChallenges = sqliteTable("bot_challenges", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  firm: text("firm").notNull(), // simulated firm
  accountSize: integer("account_size").notNull().default(100000),
  profitTarget: text("profit_target").notNull(), // percentage e.g. "10"
  maxDrawdown: text("max_drawdown").notNull(), // percentage e.g. "10"
  dailyDrawdown: text("daily_drawdown").notNull(), // percentage e.g. "5"
  consistencyRule: text("consistency_rule"), // e.g. "no single day > 30% of profits"
  status: text("status").notNull().default("running"), // running | passed | failed
  currentPnl: text("current_pnl").default("0"),
  peakBalance: text("peak_balance"),
  botConfig: text("bot_config"), // JSON of bot strategy settings
  startedAt: text("started_at").notNull().default(""),
  endedAt: text("ended_at"),
  createdAt: text("created_at").notNull().default(""),
});
export const insertBotChallengeSchema = createInsertSchema(botChallenges).omit({ id: true, createdAt: true });
export type InsertBotChallenge = z.infer<typeof insertBotChallengeSchema>;
export type BotChallenge = typeof botChallenges.$inferSelect;

// Token Usage — tracks every AI call's token consumption
export const tokenUsage = sqliteTable("token_usage", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").notNull(),
  model: text("model").notNull(), // claude-sonnet | claude-opus | gpt-4o | perplexity
  inputTokens: integer("input_tokens").notNull().default(0),
  outputTokens: integer("output_tokens").notNull().default(0),
  totalTokens: integer("total_tokens").notNull().default(0),
  endpoint: text("endpoint"), // "agent_chat" | "jarvis" etc
  createdAt: text("created_at").notNull().default(""),
});
export const insertTokenUsageSchema = createInsertSchema(tokenUsage).omit({ id: true, createdAt: true });
export type InsertTokenUsage = z.infer<typeof insertTokenUsageSchema>;
export type TokenUsageRecord = typeof tokenUsage.$inferSelect;

// Token Packs — purchased add-on token bundles
export const tokenPacks = sqliteTable("token_packs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").notNull(),
  tokens: integer("tokens").notNull(),
  price: integer("price").notNull(), // cents
  stripePaymentId: text("stripe_payment_id"),
  status: text("status").notNull().default("active"), // active | depleted
  tokensRemaining: integer("tokens_remaining").notNull(),
  purchasedAt: text("purchased_at").notNull().default(""),
  createdAt: text("created_at").notNull().default(""),
});
export const insertTokenPackSchema = createInsertSchema(tokenPacks).omit({ id: true, createdAt: true });
export type InsertTokenPack = z.infer<typeof insertTokenPackSchema>;
export type TokenPack = typeof tokenPacks.$inferSelect;

// User Plans — tracks subscription period token allowances
export const userPlans = sqliteTable("user_plans", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").notNull(),
  tier: text("tier").notNull().default("free"), // free | starter | pro | agency
  monthlyTokens: integer("monthly_tokens").notNull().default(50000),
  tokensUsed: integer("tokens_used").notNull().default(0),
  periodStart: text("period_start").notNull().default(""),
  periodEnd: text("period_end").notNull().default(""),
  createdAt: text("created_at").notNull().default(""),
});
export const insertUserPlanSchema = createInsertSchema(userPlans).omit({ id: true, createdAt: true });
export type InsertUserPlan = z.infer<typeof insertUserPlanSchema>;
export type UserPlan = typeof userPlans.$inferSelect;

// Workflow Runs — individual execution instances of a workflow
export const workflowRuns = sqliteTable("workflow_runs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  workflowId: integer("workflow_id").notNull(),
  userId: integer("user_id").notNull().default(1),
  status: text("status").notNull().default("pending"), // pending | running | paused | completed | failed | killed
  executionMode: text("execution_mode").notNull().default("boss"), // boss | sequential | parallel
  inputData: text("input_data"), // JSON: user prompt / trigger data
  finalOutput: text("final_output"), // JSON: synthesized result
  totalTokensUsed: integer("total_tokens_used").notNull().default(0),
  error: text("error"),
  startedAt: text("started_at"),
  completedAt: text("completed_at"),
  createdAt: text("created_at").notNull().default(""),
});
export const insertWorkflowRunSchema = createInsertSchema(workflowRuns).omit({ id: true, createdAt: true });
export type InsertWorkflowRun = z.infer<typeof insertWorkflowRunSchema>;
export type WorkflowRun = typeof workflowRuns.$inferSelect;

// Agent Executions — individual agent task executions within a workflow run
export const agentExecutions = sqliteTable("agent_executions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  runId: integer("run_id").notNull(),
  agentId: integer("agent_id"),
  workerType: text("worker_type").notNull(), // boss | researcher | coder | writer | reviewer | analyst
  status: text("status").notNull().default("pending"), // pending | running | completed | failed | skipped
  inputPayload: text("input_payload"), // JSON: task description
  output: text("output"), // Agent's response text
  modelUsed: text("model_used"),
  inputTokens: integer("input_tokens").notNull().default(0),
  outputTokens: integer("output_tokens").notNull().default(0),
  totalTokens: integer("total_tokens").notNull().default(0),
  error: text("error"),
  startedAt: text("started_at"),
  completedAt: text("completed_at"),
  createdAt: text("created_at").notNull().default(""),
});
export const insertAgentExecutionSchema = createInsertSchema(agentExecutions).omit({ id: true, createdAt: true });
export type InsertAgentExecution = z.infer<typeof insertAgentExecutionSchema>;
export type AgentExecution = typeof agentExecutions.$inferSelect;

// Workflow Versions — version history for the canvas editor
export const workflowVersions = sqliteTable("workflow_versions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  workflowId: integer("workflow_id").notNull(),
  versionNumber: integer("version_number").notNull(),
  graphState: text("graph_state").notNull(), // JSON: full node/edge state snapshot
  label: text("label"), // optional user label
  createdAt: text("created_at").notNull().default(""),
});
export const insertWorkflowVersionSchema = createInsertSchema(workflowVersions).omit({ id: true, createdAt: true });
export type InsertWorkflowVersion = z.infer<typeof insertWorkflowVersionSchema>;
export type WorkflowVersion = typeof workflowVersions.$inferSelect;

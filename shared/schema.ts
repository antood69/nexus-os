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
  createdAt: text("created_at").notNull().default(""),
});

export const insertWorkflowSchema = createInsertSchema(workflows).omit({ id: true, createdAt: true });
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

// Users table (for SaaS auth)
export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  tier: text("tier").notNull().default("free"), // free | pro | agency
  stripeCustomerId: text("stripe_customer_id"),
  subscriptionId: text("subscription_id"),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

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

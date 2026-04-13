import {
  type User, type InsertUser, users,
  type Workflow, type InsertWorkflow, workflows,
  type Agent, type InsertAgent, agents,
  type Job, type InsertJob, jobs,
  type Message, type InsertMessage, messages,
  type AuditReview, type InsertAuditReview, auditReviews,
  type Escalation, type InsertEscalation, escalations,
  type TradeJournalEntry, type InsertTradeJournal, tradeJournal,
  type BotChallenge, type InsertBotChallenge, botChallenges,
  type TokenUsageRecord, type InsertTokenUsage, tokenUsage,
  type TokenPack, type InsertTokenPack, tokenPacks,
  type UserPlan, type InsertUserPlan, userPlans,
  type WorkflowRun, type InsertWorkflowRun, workflowRuns,
  type AgentExecution, type InsertAgentExecution, agentExecutions,
  type WorkflowVersion, type InsertWorkflowVersion, workflowVersions,
  type Session, sessions,
  type OwnerIntelligence, ownerIntelligence,
  type EmailVerification, emailVerifications,
  type Notification, notifications,
} from "@shared/schema";
import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import { eq, desc, gte } from "drizzle-orm";

const sqlite = new Database("data.db");
sqlite.pragma("journal_mode = WAL");

// Auto-create ALL tables if they don't exist (covers fresh deploys)
sqlite.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT,
    display_name TEXT,
    avatar_url TEXT,
    auth_provider TEXT NOT NULL DEFAULT 'email',
    provider_id TEXT,
    role TEXT NOT NULL DEFAULT 'user',
    tier TEXT NOT NULL DEFAULT 'free',
    stripe_customer_id TEXT,
    subscription_id TEXT,
    last_login_at TEXT,
    created_at TEXT NOT NULL DEFAULT ''
  );
  CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL,
    expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT ''
  );
  CREATE TABLE IF NOT EXISTS email_verifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    token TEXT NOT NULL UNIQUE,
    expires_at TEXT NOT NULL,
    verified INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT ''
  );
  CREATE TABLE IF NOT EXISTS notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    link TEXT,
    read INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT ''
  );
  CREATE TABLE IF NOT EXISTS owner_intelligence (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    user_email TEXT,
    event_type TEXT NOT NULL,
    model TEXT,
    input_data TEXT,
    output_data TEXT,
    tokens_used INTEGER DEFAULT 0,
    quality TEXT,
    tags TEXT,
    metadata TEXT,
    created_at TEXT NOT NULL DEFAULT ''
  );
  CREATE TABLE IF NOT EXISTS workflows (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    status TEXT NOT NULL DEFAULT 'draft',
    priority TEXT NOT NULL DEFAULT 'medium',
    canvas_state TEXT,
    is_template INTEGER DEFAULT 0,
    template_category TEXT,
    template_description TEXT,
    is_public INTEGER DEFAULT 0,
    fork_count INTEGER DEFAULT 0,
    use_count INTEGER DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT ''
  );
  CREATE TABLE IF NOT EXISTS workflow_versions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    workflow_id INTEGER NOT NULL,
    version_number INTEGER NOT NULL,
    graph_state TEXT NOT NULL,
    label TEXT,
    created_at TEXT NOT NULL DEFAULT ''
  );
  CREATE TABLE IF NOT EXISTS agents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    role TEXT NOT NULL,
    model TEXT NOT NULL DEFAULT 'claude-sonnet',
    workflow_id INTEGER,
    status TEXT NOT NULL DEFAULT 'idle',
    system_prompt TEXT,
    created_at TEXT NOT NULL DEFAULT ''
  );
  CREATE TABLE IF NOT EXISTS jobs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    workflow_id INTEGER NOT NULL,
    agent_id INTEGER,
    title TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'queued',
    result TEXT,
    created_at TEXT NOT NULL DEFAULT ''
  );
  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    agent_id INTEGER NOT NULL,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT ''
  );
  CREATE TABLE IF NOT EXISTS audit_reviews (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    job_id INTEGER NOT NULL,
    agent_id INTEGER NOT NULL,
    verdict TEXT NOT NULL,
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT ''
  );
  CREATE TABLE IF NOT EXISTS escalations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    job_id INTEGER NOT NULL,
    agent_id INTEGER,
    level INTEGER NOT NULL DEFAULT 1,
    reason TEXT NOT NULL,
    context TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    resolution TEXT,
    created_at TEXT NOT NULL DEFAULT ''
  );
  CREATE TABLE IF NOT EXISTS trade_journal (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    firm TEXT NOT NULL,
    instrument TEXT NOT NULL,
    direction TEXT NOT NULL,
    entry_price TEXT NOT NULL,
    exit_price TEXT,
    pnl TEXT,
    risk_reward TEXT,
    entry_reason TEXT,
    ai_analysis TEXT,
    tags TEXT,
    status TEXT NOT NULL DEFAULT 'open',
    opened_at TEXT NOT NULL DEFAULT '',
    closed_at TEXT,
    created_at TEXT NOT NULL DEFAULT ''
  );
  CREATE TABLE IF NOT EXISTS bot_challenges (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    firm TEXT NOT NULL,
    account_size INTEGER NOT NULL DEFAULT 100000,
    profit_target TEXT NOT NULL,
    max_drawdown TEXT NOT NULL,
    daily_drawdown TEXT NOT NULL,
    consistency_rule TEXT,
    status TEXT NOT NULL DEFAULT 'running',
    current_pnl TEXT DEFAULT '0',
    peak_balance TEXT,
    bot_config TEXT,
    started_at TEXT NOT NULL DEFAULT '',
    ended_at TEXT,
    created_at TEXT NOT NULL DEFAULT ''
  );
  CREATE TABLE IF NOT EXISTS token_usage (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    model TEXT NOT NULL,
    input_tokens INTEGER NOT NULL DEFAULT 0,
    output_tokens INTEGER NOT NULL DEFAULT 0,
    total_tokens INTEGER NOT NULL DEFAULT 0,
    endpoint TEXT,
    created_at TEXT NOT NULL DEFAULT ''
  );
  CREATE TABLE IF NOT EXISTS token_packs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    tokens INTEGER NOT NULL,
    price INTEGER NOT NULL,
    stripe_payment_id TEXT,
    status TEXT NOT NULL DEFAULT 'active',
    tokens_remaining INTEGER NOT NULL,
    purchased_at TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT ''
  );
  CREATE TABLE IF NOT EXISTS user_plans (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    tier TEXT NOT NULL DEFAULT 'free',
    monthly_tokens INTEGER NOT NULL DEFAULT 50000,
    tokens_used INTEGER NOT NULL DEFAULT 0,
    period_start TEXT NOT NULL DEFAULT '',
    period_end TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT ''
  );
  CREATE TABLE IF NOT EXISTS workflow_runs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    workflow_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL DEFAULT 1,
    status TEXT NOT NULL DEFAULT 'pending',
    execution_mode TEXT NOT NULL DEFAULT 'boss',
    input_data TEXT,
    final_output TEXT,
    total_tokens_used INTEGER NOT NULL DEFAULT 0,
    error TEXT,
    started_at TEXT,
    completed_at TEXT,
    created_at TEXT NOT NULL DEFAULT ''
  );
  CREATE TABLE IF NOT EXISTS agent_executions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    run_id INTEGER NOT NULL,
    agent_id INTEGER,
    worker_type TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    input_payload TEXT,
    output TEXT,
    model_used TEXT,
    input_tokens INTEGER NOT NULL DEFAULT 0,
    output_tokens INTEGER NOT NULL DEFAULT 0,
    total_tokens INTEGER NOT NULL DEFAULT 0,
    error TEXT,
    started_at TEXT,
    completed_at TEXT,
    created_at TEXT NOT NULL DEFAULT ''
  );
`);

// Safe ALTER TABLE for existing DBs that lack new columns
const safeAlter = (sql: string) => {
  try { sqlite.exec(sql); } catch (_) { /* column already exists */ }
};
// Users table migration for existing DBs
safeAlter("ALTER TABLE users ADD COLUMN email TEXT NOT NULL DEFAULT ''");
safeAlter("ALTER TABLE users ADD COLUMN password_hash TEXT");
safeAlter("ALTER TABLE users ADD COLUMN display_name TEXT");
safeAlter("ALTER TABLE users ADD COLUMN avatar_url TEXT");
safeAlter("ALTER TABLE users ADD COLUMN auth_provider TEXT NOT NULL DEFAULT 'email'");
safeAlter("ALTER TABLE users ADD COLUMN provider_id TEXT");
safeAlter("ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'user'");
safeAlter("ALTER TABLE users ADD COLUMN email_verified INTEGER NOT NULL DEFAULT 0");
safeAlter("ALTER TABLE users ADD COLUMN last_login_at TEXT");
safeAlter("ALTER TABLE users ADD COLUMN created_at TEXT NOT NULL DEFAULT ''");
// Workflows table migration
safeAlter("ALTER TABLE workflows ADD COLUMN canvas_state TEXT");
safeAlter("ALTER TABLE workflows ADD COLUMN is_template INTEGER DEFAULT 0");
safeAlter("ALTER TABLE workflows ADD COLUMN template_category TEXT");
safeAlter("ALTER TABLE workflows ADD COLUMN template_description TEXT");
safeAlter("ALTER TABLE workflows ADD COLUMN is_public INTEGER DEFAULT 0");
safeAlter("ALTER TABLE workflows ADD COLUMN fork_count INTEGER DEFAULT 0");
safeAlter("ALTER TABLE workflows ADD COLUMN use_count INTEGER DEFAULT 0");

export const db = drizzle(sqlite);

export interface IStorage {
  // Users
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  // Workflows
  getWorkflows(): Promise<Workflow[]>;
  getWorkflow(id: number): Promise<Workflow | undefined>;
  createWorkflow(w: InsertWorkflow): Promise<Workflow>;
  updateWorkflow(id: number, data: Partial<InsertWorkflow>): Promise<Workflow | undefined>;
  deleteWorkflow(id: number): Promise<void>;
  // Agents
  getAgents(): Promise<Agent[]>;
  getAgent(id: number): Promise<Agent | undefined>;
  getAgentsByWorkflow(workflowId: number): Promise<Agent[]>;
  createAgent(a: InsertAgent): Promise<Agent>;
  updateAgent(id: number, data: Partial<InsertAgent>): Promise<Agent | undefined>;
  deleteAgent(id: number): Promise<void>;
  // Jobs
  getJobs(): Promise<Job[]>;
  getJobsByWorkflow(workflowId: number): Promise<Job[]>;
  createJob(j: InsertJob): Promise<Job>;
  updateJob(id: number, data: Partial<InsertJob>): Promise<Job | undefined>;
  // Messages
  getMessagesByAgent(agentId: number): Promise<Message[]>;
  createMessage(m: InsertMessage): Promise<Message>;
  // Audit reviews
  getAuditReviews(): Promise<AuditReview[]>;
  getAuditReviewsByJob(jobId: number): Promise<AuditReview[]>;
  createAuditReview(r: InsertAuditReview): Promise<AuditReview>;
  // Escalations
  getEscalations(): Promise<Escalation[]>;
  getEscalationsByJob(jobId: number): Promise<Escalation[]>;
  createEscalation(e: InsertEscalation): Promise<Escalation>;
  updateEscalation(id: number, data: Partial<InsertEscalation>): Promise<Escalation | undefined>;
  // Trade Journal
  getTradeJournalEntries(): Promise<TradeJournalEntry[]>;
  createTradeJournalEntry(e: InsertTradeJournal): Promise<TradeJournalEntry>;
  updateTradeJournalEntry(id: number, data: Partial<InsertTradeJournal>): Promise<TradeJournalEntry | undefined>;
  // Bot Challenges
  getBotChallenges(): Promise<BotChallenge[]>;
  createBotChallenge(c: InsertBotChallenge): Promise<BotChallenge>;
  updateBotChallenge(id: number, data: Partial<InsertBotChallenge>): Promise<BotChallenge | undefined>;
  // Token Usage
  recordTokenUsage(usage: InsertTokenUsage): Promise<TokenUsageRecord>;
  getTokenUsageByUser(userId: number): Promise<TokenUsageRecord[]>;
  getTokenUsageSummary(userId: number, since: string): Promise<{ total: number; byModel: Record<string, number> }>;
  // Token Packs
  getTokenPacksByUser(userId: number): Promise<TokenPack[]>;
  createTokenPack(pack: InsertTokenPack): Promise<TokenPack>;
  updateTokenPack(id: number, data: Partial<InsertTokenPack>): Promise<TokenPack | undefined>;
  // User Plans
  getUserPlan(userId: number): Promise<UserPlan | undefined>;
  createUserPlan(plan: InsertUserPlan): Promise<UserPlan>;
  updateUserPlan(id: number, data: Partial<InsertUserPlan>): Promise<UserPlan | undefined>;
  updateUser(id: number, data: Partial<{ tier: string; stripeCustomerId: string; subscriptionId: string; role: string; avatarUrl: string; displayName: string; lastLoginAt: string; passwordHash: string; authProvider: string; providerId: string }>): Promise<User | undefined>;
  // Workflow Runs
  getWorkflowRuns(workflowId: number): Promise<WorkflowRun[]>;
  getWorkflowRun(id: number): Promise<WorkflowRun | undefined>;
  createWorkflowRun(run: InsertWorkflowRun): Promise<WorkflowRun>;
  updateWorkflowRun(id: number, data: Partial<InsertWorkflowRun>): Promise<WorkflowRun | undefined>;
  // Agent Executions
  getAgentExecutions(runId: number): Promise<AgentExecution[]>;
  createAgentExecution(exec: InsertAgentExecution): Promise<AgentExecution>;
  updateAgentExecution(id: number, data: Partial<InsertAgentExecution>): Promise<AgentExecution | undefined>;
  // Workflow Versions
  getWorkflowVersions(workflowId: number): Promise<WorkflowVersion[]>;
  createWorkflowVersion(v: InsertWorkflowVersion): Promise<WorkflowVersion>;
  getWorkflowVersion(id: number): Promise<WorkflowVersion | undefined>;
  // Templates
  getPublicTemplates(): Promise<Workflow[]>;
  // Auth: Sessions
  createSession(session: { id: string; userId: number; expiresAt: string }): Promise<Session>;
  getSession(id: string): Promise<Session | undefined>;
  deleteSession(id: string): Promise<void>;
  deleteExpiredSessions(): Promise<void>;
  // Auth: Users (extended)
  getUserByEmail(email: string): Promise<User | undefined>;
  getUserByProviderId(provider: string, providerId: string): Promise<User | undefined>;
  getAllUsers(): Promise<User[]>;
  // Owner Intelligence
  recordIntelligence(data: { userId: number; userEmail?: string; eventType: string; model?: string; inputData?: string; outputData?: string; tokensUsed?: number; quality?: string; tags?: string; metadata?: string }): Promise<OwnerIntelligence>;
  getIntelligence(opts: { limit?: number; offset?: number; eventType?: string; userId?: number; quality?: string }): Promise<OwnerIntelligence[]>;
  getIntelligenceCount(): Promise<number>;
  updateIntelligenceQuality(id: number, quality: string): Promise<void>;
  // Email Verification
  createEmailVerification(userId: number, token: string, expiresAt: string): Promise<EmailVerification>;
  getEmailVerification(token: string): Promise<EmailVerification | undefined>;
  markEmailVerified(token: string): Promise<void>;
  // Notifications
  createNotification(data: { userId: number; type: string; title: string; message: string; link?: string }): Promise<Notification>;
  getNotifications(userId: number, limit?: number): Promise<Notification[]>;
  getUnreadNotificationCount(userId: number): Promise<number>;
  markNotificationRead(id: number): Promise<void>;
  markAllNotificationsRead(userId: number): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  // Users
  async getUser(id: number) {
    return db.select().from(users).where(eq(users.id, id)).get();
  }
  async getUserByUsername(username: string) {
    return db.select().from(users).where(eq(users.username, username)).get();
  }
  async createUser(insertUser: InsertUser) {
    return db.insert(users).values(insertUser).returning().get();
  }

  // Workflows
  async getWorkflows() {
    return db.select().from(workflows).orderBy(desc(workflows.id)).all();
  }
  async getWorkflow(id: number) {
    return db.select().from(workflows).where(eq(workflows.id, id)).get();
  }
  async createWorkflow(w: InsertWorkflow) {
    return db.insert(workflows).values({ ...w, createdAt: new Date().toISOString() }).returning().get();
  }
  async updateWorkflow(id: number, data: Partial<InsertWorkflow>) {
    return db.update(workflows).set(data).where(eq(workflows.id, id)).returning().get();
  }
  async deleteWorkflow(id: number) {
    db.delete(workflows).where(eq(workflows.id, id)).run();
  }

  // Agents
  async getAgents() {
    return db.select().from(agents).orderBy(desc(agents.id)).all();
  }
  async getAgent(id: number) {
    return db.select().from(agents).where(eq(agents.id, id)).get();
  }
  async getAgentsByWorkflow(workflowId: number) {
    return db.select().from(agents).where(eq(agents.workflowId, workflowId)).all();
  }
  async createAgent(a: InsertAgent) {
    return db.insert(agents).values({ ...a, createdAt: new Date().toISOString() }).returning().get();
  }
  async updateAgent(id: number, data: Partial<InsertAgent>) {
    return db.update(agents).set(data).where(eq(agents.id, id)).returning().get();
  }
  async deleteAgent(id: number) {
    db.delete(agents).where(eq(agents.id, id)).run();
  }

  // Jobs
  async getJobs() {
    return db.select().from(jobs).orderBy(desc(jobs.id)).all();
  }
  async getJobsByWorkflow(workflowId: number) {
    return db.select().from(jobs).where(eq(jobs.workflowId, workflowId)).all();
  }
  async createJob(j: InsertJob) {
    return db.insert(jobs).values({ ...j, createdAt: new Date().toISOString() }).returning().get();
  }
  async updateJob(id: number, data: Partial<InsertJob>) {
    return db.update(jobs).set(data).where(eq(jobs.id, id)).returning().get();
  }

  // Messages
  async getMessagesByAgent(agentId: number) {
    return db.select().from(messages).where(eq(messages.agentId, agentId)).all();
  }
  async createMessage(m: InsertMessage) {
    return db.insert(messages).values({ ...m, createdAt: new Date().toISOString() }).returning().get();
  }

  // Audit reviews
  async getAuditReviews() {
    return db.select().from(auditReviews).orderBy(desc(auditReviews.id)).all();
  }
  async getAuditReviewsByJob(jobId: number) {
    return db.select().from(auditReviews).where(eq(auditReviews.jobId, jobId)).all();
  }
  async createAuditReview(r: InsertAuditReview) {
    return db.insert(auditReviews).values({ ...r, createdAt: new Date().toISOString() }).returning().get();
  }

  // Escalations
  async getEscalations() {
    return db.select().from(escalations).orderBy(desc(escalations.id)).all();
  }
  async getEscalationsByJob(jobId: number) {
    return db.select().from(escalations).where(eq(escalations.jobId, jobId)).all();
  }
  async createEscalation(e: InsertEscalation) {
    return db.insert(escalations).values({ ...e, createdAt: new Date().toISOString() }).returning().get();
  }
  async updateEscalation(id: number, data: Partial<InsertEscalation>) {
    return db.update(escalations).set(data).where(eq(escalations.id, id)).returning().get();
  }

  // Trade Journal
  async getTradeJournalEntries() {
    return db.select().from(tradeJournal).orderBy(desc(tradeJournal.id)).all();
  }
  async createTradeJournalEntry(e: InsertTradeJournal) {
    return db.insert(tradeJournal).values({ ...e, createdAt: new Date().toISOString() }).returning().get();
  }
  async updateTradeJournalEntry(id: number, data: Partial<InsertTradeJournal>) {
    return db.update(tradeJournal).set(data).where(eq(tradeJournal.id, id)).returning().get();
  }

  // Bot Challenges
  async getBotChallenges() {
    return db.select().from(botChallenges).orderBy(desc(botChallenges.id)).all();
  }
  async createBotChallenge(c: InsertBotChallenge) {
    return db.insert(botChallenges).values({ ...c, createdAt: new Date().toISOString() }).returning().get();
  }
  async updateBotChallenge(id: number, data: Partial<InsertBotChallenge>) {
    return db.update(botChallenges).set(data).where(eq(botChallenges.id, id)).returning().get();
  }

  // Token Usage
  async recordTokenUsage(usage: InsertTokenUsage): Promise<TokenUsageRecord> {
    return db.insert(tokenUsage).values({ ...usage, createdAt: new Date().toISOString() }).returning().get();
  }
  async getTokenUsageByUser(userId: number): Promise<TokenUsageRecord[]> {
    return db.select().from(tokenUsage).where(eq(tokenUsage.userId, userId)).orderBy(desc(tokenUsage.id)).all();
  }
  async getTokenUsageSummary(userId: number, since: string): Promise<{ total: number; byModel: Record<string, number> }> {
    const rows = await db.select().from(tokenUsage)
      .where(eq(tokenUsage.userId, userId))
      .all();
    // Filter by since date in JS
    const filtered = rows.filter(r => r.createdAt >= since);
    const total = filtered.reduce((sum, r) => sum + r.totalTokens, 0);
    const byModel: Record<string, number> = {};
    for (const r of filtered) {
      byModel[r.model] = (byModel[r.model] || 0) + r.totalTokens;
    }
    return { total, byModel };
  }

  // Token Packs
  async getTokenPacksByUser(userId: number): Promise<TokenPack[]> {
    return db.select().from(tokenPacks).where(eq(tokenPacks.userId, userId)).orderBy(desc(tokenPacks.id)).all();
  }
  async createTokenPack(pack: InsertTokenPack): Promise<TokenPack> {
    return db.insert(tokenPacks).values({ ...pack, createdAt: new Date().toISOString() }).returning().get();
  }
  async updateTokenPack(id: number, data: Partial<InsertTokenPack>): Promise<TokenPack | undefined> {
    return db.update(tokenPacks).set(data).where(eq(tokenPacks.id, id)).returning().get();
  }

  // User Plans
  async getUserPlan(userId: number): Promise<UserPlan | undefined> {
    return db.select().from(userPlans).where(eq(userPlans.userId, userId)).orderBy(desc(userPlans.id)).get();
  }
  async createUserPlan(plan: InsertUserPlan): Promise<UserPlan> {
    return db.insert(userPlans).values({ ...plan, createdAt: new Date().toISOString() }).returning().get();
  }
  async updateUserPlan(id: number, data: Partial<InsertUserPlan>): Promise<UserPlan | undefined> {
    return db.update(userPlans).set(data).where(eq(userPlans.id, id)).returning().get();
  }

  // Update User
  async updateUser(id: number, data: Partial<{ tier: string; stripeCustomerId: string; subscriptionId: string; role: string; avatarUrl: string; displayName: string; lastLoginAt: string; passwordHash: string; authProvider: string; providerId: string }>): Promise<User | undefined> {
    return db.update(users).set(data).where(eq(users.id, id)).returning().get();
  }

  // Workflow Runs
  async getWorkflowRuns(workflowId: number) {
    return db.select().from(workflowRuns).where(eq(workflowRuns.workflowId, workflowId)).orderBy(desc(workflowRuns.id)).all();
  }
  async getWorkflowRun(id: number) {
    return db.select().from(workflowRuns).where(eq(workflowRuns.id, id)).get();
  }
  async createWorkflowRun(run: InsertWorkflowRun) {
    return db.insert(workflowRuns).values({ ...run, createdAt: new Date().toISOString() }).returning().get();
  }
  async updateWorkflowRun(id: number, data: Partial<InsertWorkflowRun>) {
    return db.update(workflowRuns).set(data).where(eq(workflowRuns.id, id)).returning().get();
  }

  // Agent Executions
  async getAgentExecutions(runId: number) {
    return db.select().from(agentExecutions).where(eq(agentExecutions.runId, runId)).orderBy(desc(agentExecutions.id)).all();
  }
  async createAgentExecution(exec: InsertAgentExecution) {
    return db.insert(agentExecutions).values({ ...exec, createdAt: new Date().toISOString() }).returning().get();
  }
  async updateAgentExecution(id: number, data: Partial<InsertAgentExecution>) {
    return db.update(agentExecutions).set(data).where(eq(agentExecutions.id, id)).returning().get();
  }

  // Workflow Versions
  async getWorkflowVersions(workflowId: number) {
    return db.select().from(workflowVersions).where(eq(workflowVersions.workflowId, workflowId)).orderBy(desc(workflowVersions.versionNumber)).all();
  }
  async createWorkflowVersion(v: InsertWorkflowVersion) {
    return db.insert(workflowVersions).values({ ...v, createdAt: new Date().toISOString() }).returning().get();
  }
  async getWorkflowVersion(id: number) {
    return db.select().from(workflowVersions).where(eq(workflowVersions.id, id)).get();
  }

  // Templates
  async getPublicTemplates() {
    return db.select().from(workflows).where(eq(workflows.isPublic, 1)).all();
  }

  // Auth: Sessions
  async createSession(session: { id: string; userId: number; expiresAt: string }) {
    return db.insert(sessions).values({ ...session, createdAt: new Date().toISOString() }).returning().get();
  }
  async getSession(id: string) {
    return db.select().from(sessions).where(eq(sessions.id, id)).get();
  }
  async deleteSession(id: string) {
    db.delete(sessions).where(eq(sessions.id, id)).run();
  }
  async deleteExpiredSessions() {
    const now = new Date().toISOString();
    sqlite.exec(`DELETE FROM sessions WHERE expires_at < '${now}'`);
  }

  // Auth: Users (extended)
  async getUserByEmail(email: string) {
    return db.select().from(users).where(eq(users.email, email)).get();
  }
  async getUserByProviderId(provider: string, providerId: string) {
    return db.select().from(users).where(eq(users.providerId, providerId)).get();
  }
  async getAllUsers() {
    return db.select().from(users).orderBy(desc(users.id)).all();
  }

  // Owner Intelligence
  async recordIntelligence(data: { userId: number; userEmail?: string; eventType: string; model?: string; inputData?: string; outputData?: string; tokensUsed?: number; quality?: string; tags?: string; metadata?: string }) {
    return db.insert(ownerIntelligence).values({ ...data, createdAt: new Date().toISOString() } as any).returning().get();
  }
  async getIntelligence(opts: { limit?: number; offset?: number; eventType?: string; userId?: number; quality?: string }) {
    // Use raw SQL for flexible filtering
    const conditions: string[] = [];
    if (opts.eventType) conditions.push(`event_type = '${opts.eventType}'`);
    if (opts.userId) conditions.push(`user_id = ${opts.userId}`);
    if (opts.quality) conditions.push(`quality = '${opts.quality}'`);
    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const limit = opts.limit || 50;
    const offset = opts.offset || 0;
    const rows = sqlite.prepare(`SELECT * FROM owner_intelligence ${where} ORDER BY id DESC LIMIT ? OFFSET ?`).all(limit, offset);
    return rows as OwnerIntelligence[];
  }
  async getIntelligenceCount() {
    const row = sqlite.prepare('SELECT COUNT(*) as count FROM owner_intelligence').get() as any;
    return row?.count || 0;
  }
  async updateIntelligenceQuality(id: number, quality: string) {
    sqlite.prepare('UPDATE owner_intelligence SET quality = ? WHERE id = ?').run(quality, id);
  }

  // Email Verification
  async createEmailVerification(userId: number, token: string, expiresAt: string) {
    return db.insert(emailVerifications).values({ userId, token, expiresAt, createdAt: new Date().toISOString() }).returning().get();
  }
  async getEmailVerification(token: string) {
    return db.select().from(emailVerifications).where(eq(emailVerifications.token, token)).get();
  }
  async markEmailVerified(token: string) {
    const v = await this.getEmailVerification(token);
    if (v) {
      sqlite.prepare('UPDATE email_verifications SET verified = 1 WHERE token = ?').run(token);
      sqlite.prepare('UPDATE users SET email_verified = 1 WHERE id = ?').run(v.userId);
    }
  }

  // Notifications
  async createNotification(data: { userId: number; type: string; title: string; message: string; link?: string }) {
    return db.insert(notifications).values({ ...data, createdAt: new Date().toISOString() } as any).returning().get();
  }
  async getNotifications(userId: number, limit = 50) {
    return db.select().from(notifications).where(eq(notifications.userId, userId)).orderBy(desc(notifications.id)).limit(limit).all();
  }
  async getUnreadNotificationCount(userId: number) {
    const row = sqlite.prepare('SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND read = 0').get(userId) as any;
    return row?.count || 0;
  }
  async markNotificationRead(id: number) {
    sqlite.prepare('UPDATE notifications SET read = 1 WHERE id = ?').run(id);
  }
  async markAllNotificationsRead(userId: number) {
    sqlite.prepare('UPDATE notifications SET read = 1 WHERE user_id = ?').run(userId);
  }
}

export const storage = new DatabaseStorage();

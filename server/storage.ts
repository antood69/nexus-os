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
} from "@shared/schema";
import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import { eq, desc } from "drizzle-orm";

const sqlite = new Database("data.db");
sqlite.pragma("journal_mode = WAL");

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
}

export const storage = new DatabaseStorage();

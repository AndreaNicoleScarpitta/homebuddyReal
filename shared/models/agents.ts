import { pgTable, varchar, integer, text, timestamp, boolean, index, jsonb } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// ---------------------------------------------------------------------------
// Agent types
// ---------------------------------------------------------------------------
export const agentTypes = ["marketing", "engagement", "maintenance", "system"] as const;
export type AgentType = typeof agentTypes[number];

export const agentStatuses = ["active", "inactive", "draft", "error"] as const;
export type AgentStatus = typeof agentStatuses[number];

export const agentRunStatuses = ["pending", "running", "completed", "failed", "skipped"] as const;
export type AgentRunStatus = typeof agentRunStatuses[number];

export const agentTriggers = ["scheduled", "manual", "event", "webhook"] as const;
export type AgentTrigger = typeof agentTriggers[number];

// ---------------------------------------------------------------------------
// agents — definition of each agent
// ---------------------------------------------------------------------------
export const agents = pgTable("agents", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  slug: varchar("slug", { length: 100 }).notNull().unique(),
  name: varchar("name", { length: 255 }).notNull(),
  type: varchar("type", { length: 50 }).notNull().default("system"),
  description: text("description"),
  purpose: text("purpose"),           // what problem this agent solves
  trigger: varchar("trigger", { length: 50 }).default("manual"),
  schedule: varchar("schedule", { length: 100 }),  // cron expression, e.g. "0 9 * * 1"
  status: varchar("status", { length: 50 }).notNull().default("draft"),
  config: jsonb("config").default({}),            // agent-specific config
  modelId: varchar("model_id", { length: 100 }).default("gpt-4o"),
  systemPrompt: text("system_prompt"),
  maxTokens: integer("max_tokens").default(2000),
  temperature: integer("temperature").default(70), // stored as 0-100, divide by 100
  lastRunAt: timestamp("last_run_at"),
  lastRunStatus: varchar("last_run_status", { length: 50 }),
  nextRunAt: timestamp("next_run_at"),
  runCount: integer("run_count").default(0),
  successCount: integer("success_count").default(0),
  failureCount: integer("failure_count").default(0),
  isBuiltIn: boolean("is_built_in").default(false), // true = ships with seed data
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("agents_type_idx").on(table.type),
  index("agents_status_idx").on(table.status),
  index("agents_slug_idx").on(table.slug),
]);

export const insertAgentSchema = createInsertSchema(agents).omit({ createdAt: true, updatedAt: true } as any);
export type InsertAgent = z.infer<typeof insertAgentSchema>;
export type Agent = typeof agents.$inferSelect;

// ---------------------------------------------------------------------------
// agent_runs — execution history
// ---------------------------------------------------------------------------
export const agentRuns = pgTable("agent_runs", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  agentId: integer("agent_id").notNull().references(() => agents.id, { onDelete: "cascade" }),
  status: varchar("status", { length: 50 }).notNull().default("pending"),
  triggeredBy: varchar("triggered_by", { length: 100 }).default("system"),  // "system", "user:<id>", "webhook"
  input: jsonb("input").default({}),
  output: jsonb("output").default({}),
  error: text("error"),
  tokensUsed: integer("tokens_used"),
  costCents: integer("cost_cents"),      // estimated cost in cents * 100
  durationMs: integer("duration_ms"),
  startedAt: timestamp("started_at").defaultNow(),
  completedAt: timestamp("completed_at"),
}, (table) => [
  index("agent_runs_agent_id_idx").on(table.agentId),
  index("agent_runs_status_idx").on(table.status),
  index("agent_runs_started_at_idx").on(table.startedAt),
]);

export const insertAgentRunSchema = createInsertSchema(agentRuns).omit({} as any);
export type InsertAgentRun = z.infer<typeof insertAgentRunSchema>;
export type AgentRun = typeof agentRuns.$inferSelect;

// ---------------------------------------------------------------------------
// agent_outputs — persisted deliverables produced by agents
// e.g. a generated email, a blog post draft, an SEO audit report
// ---------------------------------------------------------------------------
export const agentOutputs = pgTable("agent_outputs", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  agentRunId: integer("agent_run_id").notNull().references(() => agentRuns.id, { onDelete: "cascade" }),
  agentId: integer("agent_id").notNull().references(() => agents.id, { onDelete: "cascade" }),
  outputType: varchar("output_type", { length: 100 }).notNull(),  // "email", "blog_post", "social_post", "report", "task_list"
  title: varchar("title", { length: 500 }),
  content: text("content").notNull(),
  metadata: jsonb("metadata").default({}),
  isApproved: boolean("is_approved").default(false),
  isPublished: boolean("is_published").default(false),
  reviewedAt: timestamp("reviewed_at"),
  reviewedBy: varchar("reviewed_by", { length: 255 }),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("agent_outputs_agent_id_idx").on(table.agentId),
  index("agent_outputs_run_id_idx").on(table.agentRunId),
  index("agent_outputs_type_idx").on(table.outputType),
]);

export const insertAgentOutputSchema = createInsertSchema(agentOutputs).omit({ createdAt: true } as any);
export type InsertAgentOutput = z.infer<typeof insertAgentOutputSchema>;
export type AgentOutput = typeof agentOutputs.$inferSelect;

/**
 * Agent Runner — executes registered agents, tracks runs, persists outputs.
 *
 * Usage:
 *   const result = await AgentRunner.run("seo-content-agent", { topic: "HVAC" });
 */

import { db } from "../db";
import { agents, agentRuns, agentOutputs } from "@shared/schema";
import { eq, sql } from "drizzle-orm";
import { logInfo, logError, logWarn } from "../lib/logger";
import type { AgentRun, AgentOutput, Agent } from "@shared/schema";

// ---------------------------------------------------------------------------
// Agent handler interface — each agent implements this
// ---------------------------------------------------------------------------
export interface AgentContext {
  agent: Agent;
  runId: number;
  input: Record<string, unknown>;
  emit: (output: AgentOutputPayload) => Promise<void>;
}

export interface AgentOutputPayload {
  outputType: string;
  title?: string;
  content: string;
  metadata?: Record<string, unknown>;
}

export interface AgentResult {
  success: boolean;
  runId: number;
  outputs: AgentOutputPayload[];
  error?: string;
  durationMs: number;
  tokensUsed?: number;
}

export type AgentHandler = (ctx: AgentContext) => Promise<void>;

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------
const registry = new Map<string, AgentHandler>();

export function registerAgent(slug: string, handler: AgentHandler): void {
  registry.set(slug, handler);
  logInfo("agent.registry", `Registered agent: ${slug}`);
}

export function getRegisteredSlugs(): string[] {
  return Array.from(registry.keys());
}

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------
export class AgentRunner {
  static async run(
    slugOrId: string | number,
    input: Record<string, unknown> = {},
    triggeredBy = "system"
  ): Promise<AgentResult> {
    const start = Date.now();

    // Resolve agent
    const agentRows = await db
      .select()
      .from(agents)
      .where(
        typeof slugOrId === "number"
          ? eq(agents.id, slugOrId)
          : eq(agents.slug, String(slugOrId))
      )
      .limit(1);

    if (agentRows.length === 0) {
      return { success: false, runId: -1, outputs: [], error: `Agent not found: ${slugOrId}`, durationMs: 0 };
    }

    const agent = agentRows[0];

    if (agent.status === "inactive" || agent.status === "draft") {
      logWarn("agent.runner", `Agent ${agent.slug} is ${agent.status} — skipping`);
      return { success: false, runId: -1, outputs: [], error: `Agent is ${agent.status}`, durationMs: 0 };
    }

    const handler = registry.get(agent.slug);
    if (!handler) {
      logWarn("agent.runner", `No handler registered for agent: ${agent.slug}`);
      return { success: false, runId: -1, outputs: [], error: "No handler registered", durationMs: 0 };
    }

    // Create run record
    const [run] = await db
      .insert(agentRuns)
      .values({ agentId: agent.id, status: "running", triggeredBy, input, startedAt: new Date() })
      .returning();

    const collectedOutputs: AgentOutputPayload[] = [];
    let runError: string | undefined;
    let tokensUsed: number | undefined;

    // Emit function — saves each output to DB as it arrives
    const emit = async (payload: AgentOutputPayload): Promise<void> => {
      collectedOutputs.push(payload);
      await db.insert(agentOutputs).values({
        agentRunId: run.id,
        agentId: agent.id,
        outputType: payload.outputType,
        title: payload.title,
        content: payload.content,
        metadata: payload.metadata ?? {},
      });
    };

    try {
      logInfo("agent.runner", `Starting agent run: ${agent.slug}`, { runId: run.id, triggeredBy });

      const ctx: AgentContext = { agent, runId: run.id, input, emit };
      await handler(ctx);

      const durationMs = Date.now() - start;

      // Mark run complete
      await db
        .update(agentRuns)
        .set({ status: "completed", completedAt: new Date(), durationMs, tokensUsed })
        .where(eq(agentRuns.id, run.id));

      // Update agent stats
      await db
        .update(agents)
        .set({
          lastRunAt: new Date(),
          lastRunStatus: "completed",
          runCount: sql`${agents.runCount} + 1`,
          successCount: sql`${agents.successCount} + 1`,
          updatedAt: new Date(),
        })
        .where(eq(agents.id, agent.id));

      logInfo("agent.runner", `Agent completed: ${agent.slug}`, { runId: run.id, durationMs, outputs: collectedOutputs.length });

      return { success: true, runId: run.id, outputs: collectedOutputs, durationMs, tokensUsed };
    } catch (err) {
      runError = err instanceof Error ? err.message : "Unknown error";
      const durationMs = Date.now() - start;

      logError("agent.runner", err, { agentSlug: agent.slug, runId: run.id });

      await db
        .update(agentRuns)
        .set({ status: "failed", completedAt: new Date(), durationMs, error: runError })
        .where(eq(agentRuns.id, run.id));

      await db
        .update(agents)
        .set({
          lastRunAt: new Date(),
          lastRunStatus: "failed",
          runCount: sql`${agents.runCount} + 1`,
          failureCount: sql`${agents.failureCount} + 1`,
          updatedAt: new Date(),
        })
        .where(eq(agents.id, agent.id));

      return { success: false, runId: run.id, outputs: collectedOutputs, error: runError, durationMs };
    }
  }
}

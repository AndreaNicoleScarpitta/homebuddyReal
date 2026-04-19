/**
 * Agent API routes
 * Mounted at /api/agents (admin-only in production)
 */

import { Router } from "express";
import { db } from "../db";
import { agents, agentRuns, agentOutputs } from "@shared/schema";
import { eq, desc, sql } from "drizzle-orm";
import { isAuthenticated } from "../replit_integrations/auth";
import { AgentRunner, getRegisteredSlugs } from "./index";
import { logInfo } from "../lib/logger";

export const agentRouter = Router();

// All agent routes require auth
agentRouter.use(isAuthenticated);

// GET /api/agents — list all agents
agentRouter.get("/", async (_req, res) => {
  try {
    const rows = await db
      .select()
      .from(agents)
      .orderBy(agents.type, agents.name);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch agents" });
  }
});

// GET /api/agents/registered — list handlers registered in memory
agentRouter.get("/registered", (_req, res) => {
  res.json({ slugs: getRegisteredSlugs() });
});

// GET /api/agents/:id — single agent with recent runs
agentRouter.get("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [agent] = await db.select().from(agents).where(eq(agents.id, id)).limit(1);
    if (!agent) return res.status(404).json({ error: "Agent not found" });

    const runs = await db
      .select()
      .from(agentRuns)
      .where(eq(agentRuns.agentId, id))
      .orderBy(desc(agentRuns.startedAt))
      .limit(10);

    res.json({ ...agent, recentRuns: runs });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch agent" });
  }
});

// POST /api/agents/:id/run — trigger an agent manually
agentRouter.post("/:id/run", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const user = (req as any).user;
    const input = req.body?.input ?? {};

    logInfo("agent.routes", `Manual trigger: agent ${id}`, { userId: user?.id });

    // Run async — return immediately with runId
    const resultPromise = AgentRunner.run(id, input, `user:${user?.id}`);

    // Return a 202 with the agent info so client can poll
    const [agent] = await db.select().from(agents).where(eq(agents.id, id)).limit(1);
    if (!agent) return res.status(404).json({ error: "Agent not found" });

    res.status(202).json({ message: "Agent started", agentId: id, agentSlug: agent.slug });

    // Let it complete in background
    resultPromise.catch(() => {});
  } catch (err) {
    res.status(500).json({ error: "Failed to start agent" });
  }
});

// GET /api/agents/:id/runs — run history
agentRouter.get("/:id/runs", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const limit = Math.min(parseInt(req.query.limit as string || "20"), 100);

    const runs = await db
      .select()
      .from(agentRuns)
      .where(eq(agentRuns.agentId, id))
      .orderBy(desc(agentRuns.startedAt))
      .limit(limit);

    res.json(runs);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch runs" });
  }
});

// GET /api/agents/runs/:runId/outputs — outputs for a run
agentRouter.get("/runs/:runId/outputs", async (req, res) => {
  try {
    const runId = parseInt(req.params.runId);
    const outputs = await db
      .select()
      .from(agentOutputs)
      .where(eq(agentOutputs.agentRunId, runId))
      .orderBy(agentOutputs.createdAt);

    res.json(outputs);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch outputs" });
  }
});

// PATCH /api/agents/:id — update agent status/config
agentRouter.patch("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { status, config, schedule, systemPrompt } = req.body;

    const updateData: Record<string, unknown> = { updatedAt: new Date() };
    if (status) updateData.status = status;
    if (config) updateData.config = config;
    if (schedule !== undefined) updateData.schedule = schedule;
    if (systemPrompt !== undefined) updateData.systemPrompt = systemPrompt;

    const [updated] = await db
      .update(agents)
      .set(updateData)
      .where(eq(agents.id, id))
      .returning();

    if (!updated) return res.status(404).json({ error: "Agent not found" });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: "Failed to update agent" });
  }
});

// GET /api/agents/outputs/recent — recent outputs across all agents
agentRouter.get("/outputs/recent", async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string || "20"), 50);
    const outputs = await db
      .select({
        id: agentOutputs.id,
        agentId: agentOutputs.agentId,
        agentRunId: agentOutputs.agentRunId,
        outputType: agentOutputs.outputType,
        title: agentOutputs.title,
        isApproved: agentOutputs.isApproved,
        createdAt: agentOutputs.createdAt,
        agentName: agents.name,
        agentSlug: agents.slug,
      })
      .from(agentOutputs)
      .innerJoin(agents, eq(agents.id, agentOutputs.agentId))
      .orderBy(desc(agentOutputs.createdAt))
      .limit(limit);

    res.json(outputs);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch recent outputs" });
  }
});

// PATCH /api/agents/outputs/:outputId/approve
agentRouter.patch("/outputs/:outputId/approve", async (req, res) => {
  try {
    const outputId = parseInt(req.params.outputId);
    const user = (req as any).user;

    const [updated] = await db
      .update(agentOutputs)
      .set({ isApproved: true, reviewedAt: new Date(), reviewedBy: user?.email || user?.id })
      .where(eq(agentOutputs.id, outputId))
      .returning();

    if (!updated) return res.status(404).json({ error: "Output not found" });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: "Failed to approve output" });
  }
});

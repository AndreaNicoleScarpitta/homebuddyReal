/**
 * Assistant Routes — Thin Express router delegating to assistantService.
 *
 * Mounted on /v2/assistant within the v2 router. Exposes:
 *   POST   /actions/propose          — suggest an action with provenance
 *   POST   /actions/:id/approve      — approve + transactionally execute
 *   POST   /actions/:id/reject       — reject a proposed action
 *   GET    /actions/:id              — fetch single action (audit/trace)
 *   GET    /actions?homeId=...       — list actions for a home
 */

import { Router, type Request, type Response } from "express";
import { db } from "../db";
import {
  proposeAction,
  approveAndExecute,
  rejectAction,
  getAction,
  listActionsByHome,
} from "./assistantService";
import { TransitionError } from "../domain/stateMachine";
import type { Actor } from "../eventing/types";

export const assistantRouter = Router();

function getActor(req: Request): Actor {
  const user = (req as any).user as { id?: number } | undefined;
  if (user?.id) {
    return { actorType: "user", actorId: String(user.id) };
  }
  return { actorType: "system", actorId: "anonymous" };
}

function handleError(res: Response, err: unknown): void {
  if (err instanceof TransitionError) {
    res.status(409).json({
      error: err.message,
      currentState: err.currentState,
      eventType: err.eventType,
      aggregateType: err.aggregateType,
      aggregateId: err.aggregateId,
    });
    return;
  }
  const error = err as Error & { status?: number; code?: string };
  if (error.code === "23505") {
    res.status(409).json({ error: "Conflict: optimistic concurrency violation", details: error.message });
    return;
  }
  const status = error.status ?? 500;
  res.status(status).json({ error: error.message });
}

// POST /actions/propose
assistantRouter.post("/actions/propose", async (req: Request, res: Response) => {
  try {
    const actor = getActor(req);
    const result = await db.transaction(async (tx) =>
      proposeAction(
        tx,
        {
          homeId: req.body.homeId,
          proposedCommands: req.body.proposedCommands ?? [],
          confidence: req.body.confidence,
          rationale: req.body.rationale,
        },
        actor,
        req.idempotencyKey!,
      ),
    );
    res.status(201).json(result);
  } catch (err) {
    handleError(res, err);
  }
});

// POST /actions/:assistantActionId/approve
assistantRouter.post("/actions/:assistantActionId/approve", async (req: Request, res: Response) => {
  try {
    const actor = getActor(req);
    const result = await db.transaction(async (tx) =>
      approveAndExecute(tx, req.params.assistantActionId, actor, req.idempotencyKey!),
    );
    res.json(result);
  } catch (err) {
    handleError(res, err);
  }
});

// POST /actions/:assistantActionId/reject
assistantRouter.post("/actions/:assistantActionId/reject", async (req: Request, res: Response) => {
  try {
    const actor = getActor(req);
    const result = await db.transaction(async (tx) =>
      rejectAction(tx, req.params.assistantActionId, req.body.reason, actor, req.idempotencyKey!),
    );
    res.json(result);
  } catch (err) {
    handleError(res, err);
  }
});

// GET /actions/:assistantActionId
assistantRouter.get("/actions/:assistantActionId", async (req: Request, res: Response) => {
  try {
    const action = await db.transaction(async (tx) => getAction(tx, req.params.assistantActionId));
    if (!action) {
      res.status(404).json({ error: "Assistant action not found" });
      return;
    }
    res.json(action);
  } catch (err) {
    handleError(res, err);
  }
});

// GET /actions?homeId=...
assistantRouter.get("/actions", async (req: Request, res: Response) => {
  try {
    const homeId = req.query.homeId as string;
    if (!homeId) {
      res.status(400).json({ error: "homeId query parameter is required" });
      return;
    }
    const actions = await db.transaction(async (tx) => listActionsByHome(tx, homeId));
    res.json({ actions });
  } catch (err) {
    handleError(res, err);
  }
});

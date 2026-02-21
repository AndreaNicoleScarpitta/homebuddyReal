/**
 * Command + Projection Pipeline Tests — Milestone 2
 *
 * DB-backed tests validating the end-to-end command pipeline:
 *   1. Idempotency:     Duplicate Idempotency-Key yields no duplicate events
 *   2. Concurrency:     Wrong expectedVersion causes optimistic concurrency error
 *   3. Assistant gating: Cannot execute without approval; approval creates domain events
 *   4. Projection sync:  Events produce correct projection state
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import pg from "pg";

const { Pool } = pg;

let pool: InstanceType<typeof pg.Pool>;

const BASE_URL = `http://localhost:${process.env.PORT || 5000}`;

async function v2(
  method: string,
  path: string,
  body?: Record<string, unknown>,
  idempotencyKey?: string,
): Promise<{ status: number; data: Record<string, unknown> }> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (idempotencyKey) headers["Idempotency-Key"] = idempotencyKey;

  const res = await fetch(`${BASE_URL}/v2${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json();
  return { status: res.status, data: data as Record<string, unknown> };
}

beforeAll(async () => {
  pool = new Pool({ connectionString: process.env.DATABASE_URL });
});

afterAll(async () => {
  await pool.end();
});

// =========================================================================
// 1. Idempotency-Key enforcement
// =========================================================================
describe("idempotency", () => {
  it("should reject mutations without Idempotency-Key header", async () => {
    const res = await v2("POST", "/tasks", { homeId: crypto.randomUUID(), title: "No key" });
    expect(res.status).toBe(400);
    expect(res.data.error).toMatch(/idempotency/i);
  });

  it("should return same result for duplicate Idempotency-Key", async () => {
    const idemKey = `idem-${crypto.randomUUID()}`;
    const homeId = crypto.randomUUID();

    const first = await v2("POST", "/tasks", { homeId, title: "Test Task" }, idemKey);
    expect(first.status).toBe(201);
    const taskId = first.data.taskId;

    const second = await v2("POST", "/tasks", { homeId, title: "Test Task" }, idemKey);
    expect(second.status).toBe(201);
    expect(second.data.deduped).toBe(true);
    expect(second.data.eventId).toBe(first.data.eventId);

    // Verify only one event was appended
    const events = await pool.query(
      `SELECT COUNT(*)::int AS cnt FROM event_log
       WHERE aggregate_type = 'task' AND aggregate_id = $1::uuid`,
      [taskId],
    );
    expect(events.rows[0].cnt).toBe(1);
  });

  it("should allow different Idempotency-Keys for same data", async () => {
    const homeId = crypto.randomUUID();

    const first = await v2("POST", "/tasks", { homeId, title: "Task A" }, `key-a-${crypto.randomUUID()}`);
    const second = await v2("POST", "/tasks", { homeId, title: "Task B" }, `key-b-${crypto.randomUUID()}`);

    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
    expect(first.data.taskId).not.toBe(second.data.taskId);
  });
});

// =========================================================================
// 2. Optimistic concurrency
// =========================================================================
describe("optimistic concurrency", () => {
  it("should reject conflicting aggregate_version", async () => {
    const homeId = crypto.randomUUID();

    // Create a home (version 0 → 1)
    const create = await v2("POST", "/homes", { name: "Test Home" }, `home-create-${crypto.randomUUID()}`);
    expect(create.status).toBe(201);
    const createdHomeId = create.data.homeId as string;

    // First update (version 1 → 2) with explicit expectedVersion
    const first = await v2(
      "PATCH",
      `/homes/${createdHomeId}`,
      { name: "Updated", expectedVersion: 1 },
      `home-update-a-${crypto.randomUUID()}`,
    );
    expect(first.status).toBe(200);
    expect(first.data.version).toBe(2);

    // Second update with stale expectedVersion = 1 (should conflict)
    const second = await v2(
      "PATCH",
      `/homes/${createdHomeId}`,
      { name: "Conflicting", expectedVersion: 1 },
      `home-update-b-${crypto.randomUUID()}`,
    );
    expect(second.status).toBe(409);
  });
});

// =========================================================================
// 3. Assistant approval gating
// =========================================================================
describe("assistant approval gating", () => {
  it("should reject approve on non-existent action", async () => {
    const fakeId = crypto.randomUUID();
    const res = await v2(
      "POST",
      `/assistant/actions/${fakeId}/approve`,
      {},
      `approve-fake-${crypto.randomUUID()}`,
    );
    expect(res.status).toBe(404);
  });

  it("should propose an action successfully", async () => {
    const homeId = crypto.randomUUID();
    const res = await v2(
      "POST",
      "/assistant/actions/propose",
      {
        homeId,
        proposedCommands: [
          {
            aggregateType: "task",
            aggregateId: crypto.randomUUID(),
            expectedVersion: 0,
            eventType: "TaskCreated",
            data: { homeId, title: "AI suggested task" },
          },
        ],
        confidence: 0.85,
        rationale: "Based on system age analysis",
      },
      `propose-${crypto.randomUUID()}`,
    );
    expect(res.status).toBe(201);
    expect(res.data.assistantActionId).toBeDefined();
  });

  it("should not allow double-approve", async () => {
    const homeId = crypto.randomUUID();

    // Propose
    const propose = await v2(
      "POST",
      "/assistant/actions/propose",
      {
        homeId,
        proposedCommands: [
          {
            aggregateType: "task",
            aggregateId: crypto.randomUUID(),
            expectedVersion: 0,
            eventType: "TaskCreated",
            data: { homeId, title: "AI task" },
          },
        ],
        confidence: 0.9,
      },
      `propose-dbl-${crypto.randomUUID()}`,
    );
    expect(propose.status).toBe(201);
    const actionId = propose.data.assistantActionId;

    // First approve succeeds
    const approve1 = await v2(
      "POST",
      `/assistant/actions/${actionId}/approve`,
      {},
      `approve-dbl-${crypto.randomUUID()}`,
    );
    expect(approve1.status).toBe(200);

    // Second approve fails (state is now 'executed')
    const approve2 = await v2(
      "POST",
      `/assistant/actions/${actionId}/approve`,
      {},
      `approve-dbl-2-${crypto.randomUUID()}`,
    );
    expect(approve2.status).toBe(409);
  });

  it("should execute proposed commands on approval and create domain events", async () => {
    const homeId = crypto.randomUUID();
    const taskAggregateId = crypto.randomUUID();

    // Propose creating a task
    const propose = await v2(
      "POST",
      "/assistant/actions/propose",
      {
        homeId,
        proposedCommands: [
          {
            aggregateType: "task",
            aggregateId: taskAggregateId,
            expectedVersion: 0,
            eventType: "TaskCreated",
            data: { homeId, title: "Replace HVAC filter" },
          },
        ],
        confidence: 0.95,
        rationale: "HVAC filter due for replacement",
      },
      `propose-exec-${crypto.randomUUID()}`,
    );
    expect(propose.status).toBe(201);
    const actionId = propose.data.assistantActionId;

    // Approve (should execute commands and create TaskCreated event)
    const approve = await v2(
      "POST",
      `/assistant/actions/${actionId}/approve`,
      {},
      `approve-exec-${crypto.randomUUID()}`,
    );
    expect(approve.status).toBe(200);
    expect(approve.data.eventIds).toBeDefined();
    expect((approve.data.eventIds as string[]).length).toBeGreaterThan(0);

    // Verify the task was created in the projection
    const taskCheck = await pool.query(
      `SELECT * FROM projection_task WHERE task_id = $1`,
      [taskAggregateId],
    );
    expect(taskCheck.rows.length).toBe(1);
    expect(taskCheck.rows[0].title).toBe("Replace HVAC filter");
    expect(taskCheck.rows[0].state).toBe("proposed");

    // Verify assistant action is now in 'executed' state
    const actionCheck = await pool.query(
      `SELECT state FROM projection_assistant_action WHERE assistant_action_id = $1`,
      [actionId],
    );
    expect(actionCheck.rows[0].state).toBe("executed");
  });

  it("should reject an action and prevent future approval", async () => {
    const homeId = crypto.randomUUID();

    const propose = await v2(
      "POST",
      "/assistant/actions/propose",
      {
        homeId,
        proposedCommands: [],
        confidence: 0.5,
      },
      `propose-rej-${crypto.randomUUID()}`,
    );
    expect(propose.status).toBe(201);
    const actionId = propose.data.assistantActionId;

    // Reject
    const reject = await v2(
      "POST",
      `/assistant/actions/${actionId}/reject`,
      { reason: "Not needed" },
      `reject-${crypto.randomUUID()}`,
    );
    expect(reject.status).toBe(200);

    // Try to approve after rejection — should fail
    const approveAfter = await v2(
      "POST",
      `/assistant/actions/${actionId}/approve`,
      {},
      `approve-after-rej-${crypto.randomUUID()}`,
    );
    expect(approveAfter.status).toBe(409);
  });
});

// =========================================================================
// 4. Projection synchronization
// =========================================================================
describe("projection sync", () => {
  it("should update projection_task through task lifecycle", async () => {
    const homeId = crypto.randomUUID();

    // Create
    const create = await v2("POST", "/tasks", { homeId, title: "Lifecycle Test" }, `lifecycle-create-${crypto.randomUUID()}`);
    expect(create.status).toBe(201);
    const taskId = create.data.taskId as string;

    // Approve
    const approve = await v2("POST", `/tasks/${taskId}/approve`, {}, `lifecycle-approve-${crypto.randomUUID()}`);
    expect(approve.status).toBe(200);

    let task = await pool.query(`SELECT state FROM projection_task WHERE task_id = $1`, [taskId]);
    expect(task.rows[0].state).toBe("approved");

    // Start (required by state machine before complete)
    const start = await v2("POST", `/tasks/${taskId}/start`, {}, `lifecycle-start-${crypto.randomUUID()}`);
    expect(start.status).toBe(200);

    task = await pool.query(`SELECT state FROM projection_task WHERE task_id = $1`, [taskId]);
    expect(task.rows[0].state).toBe("in_progress");

    // Complete
    const complete = await v2("POST", `/tasks/${taskId}/complete`, {}, `lifecycle-complete-${crypto.randomUUID()}`);
    expect(complete.status).toBe(200);

    task = await pool.query(`SELECT state, completed_at FROM projection_task WHERE task_id = $1`, [taskId]);
    expect(task.rows[0].state).toBe("done");
    expect(task.rows[0].completed_at).not.toBeNull();
  });

  it("should create and read chat sessions with messages", async () => {
    const homeId = crypto.randomUUID();

    // Create session
    const session = await v2("POST", "/chat/sessions", { homeId }, `chat-create-${crypto.randomUUID()}`);
    expect(session.status).toBe(201);
    const sessionId = session.data.sessionId as string;

    // Send message
    const msg = await v2(
      "POST",
      `/chat/sessions/${sessionId}/messages`,
      { role: "user", content: "Hello!" },
      `chat-msg-${crypto.randomUUID()}`,
    );
    expect(msg.status).toBe(201);

    // Read session
    const read = await v2("GET", `/chat/sessions/${sessionId}`);
    expect(read.status).toBe(200);
    expect((read.data.messages as unknown[]).length).toBe(1);
  });

  it("should read events from event log", async () => {
    const res = await v2("GET", "/events?fromSeq=1&limit=5");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.data.events)).toBe(true);
  });
});

import { describe, it, expect, vi, afterEach } from "vitest";
import { validateTransition, TransitionError } from "../server/domain/stateMachine";
import { EventTypes } from "../server/eventing/types";
import { completeTask } from "../client/src/lib/api";

afterEach(() => vi.unstubAllGlobals());

describe("Recording completed maintenance", () => {
  it.each(["proposed", "approved", "scheduled", "in_progress", "overdue"])("allows recording finished work from %s", state => {
    expect(() => validateTransition("task", "task-1", state, EventTypes.TaskCompleted)).not.toThrow();
  });
  it.each(["done", "rejected", "skipped"])("protects terminal state %s", state => {
    expect(() => validateTransition("task", "task-1", state, EventTypes.TaskCompleted)).toThrow(TransitionError);
  });
  it("submits task completion and log details together with cost in dollars", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: "task-1", state: "done" })));
    vi.stubGlobal("fetch", fetchMock);
    const details = { legacyHomeId: 9, title: "Replace filter", date: "2026-10-15T00:00:00.000Z", cost: 25.50, provider: "DIY (Myself)", notes: "Installed" };
    await completeTask("task-1", details);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe("/v2/tasks/task-1/complete");
    expect(options.method).toBe("POST");
    expect(options.headers["Idempotency-Key"]).toBeTruthy();
    expect(JSON.parse(options.body)).toEqual(details);
  });
});

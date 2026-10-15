import { describe, expect, it } from "vitest";
import { categorizeTasks, isTaskOpen } from "../client/src/lib/task-buckets";
import type { V2Task } from "../client/src/lib/api";

const now = new Date("2026-10-15T14:00:00");
function task(id: string, fields: Partial<V2Task> = {}): V2Task {
  return {
    id,
    homeId: "test-home",
    title: id,
    status: "pending",
    state: "pending",
    dueDate: null,
    urgency: "later",
    ...fields,
  };
}

describe("shared Overview and Plan task categorization", () => {
  it("routes urgent undated and future-dated tasks to Due, not Upcoming", () => {
    const tasks = [
      task("urgent-undated", { urgency: "now" }),
      task("urgent-future", { urgency: "now", dueDate: "2026-11-01T12:00:00" }),
      task("undated-normal"),
      task("normal-future", { dueDate: "2026-11-01T12:00:00" }),
      task("soon", { dueDate: "2026-10-17T12:00:00" }),
      task("overdue-urgent", { urgency: "now", dueDate: "2026-10-12T12:00:00" }),
      task("done-status", { status: "completed" }),
      task("done-state", { state: "completed" }),
    ];
    const buckets = categorizeTasks(tasks, now);
    expect(buckets.due.map(t => t.id)).toEqual(["soon", "urgent-future", "urgent-undated"].sort((a, b) => {
      const order: Record<string, number> = { soon: 0, "urgent-future": 1, "urgent-undated": 2 };
      return order[a] - order[b];
    }));
    expect(buckets.upcoming.map(t => t.id)).toEqual(["normal-future", "undated-normal"]);
    expect(buckets.past_due.map(t => t.id)).toEqual(["overdue-urgent"]);
    expect(buckets.completed).toHaveLength(2);
    expect(tasks.filter(isTaskOpen)).toHaveLength(
      buckets.due.length + buckets.upcoming.length + buckets.past_due.length
    );
  });

  it("separates two urgent tasks from thirteen upcoming without inflating totals", () => {
    const tasks = [
      ...Array.from({ length: 2 }, (_, i) => task(`urgent-${i}`, { urgency: "now" })),
      ...Array.from({ length: 13 }, (_, i) => task(`upcoming-${i}`)),
    ];
    const buckets = categorizeTasks(tasks, now);
    expect(buckets.due).toHaveLength(2);
    expect(buckets.upcoming).toHaveLength(13);
    expect(tasks.filter(isTaskOpen)).toHaveLength(15);
    expect(tasks.filter(t => isTaskOpen(t) && t.urgency === "now")).toHaveLength(2);
  });
});

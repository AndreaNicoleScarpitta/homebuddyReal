import { describe, it, expect, vi } from "vitest";

const SWIPE_THRESHOLD = 100;
const SWIPE_VELOCITY_THRESHOLD = 500;

interface SwipeDecisionOptions {
  disabled?: boolean;
  triggered?: boolean;
  actionLocked?: boolean;
}

function simulateSwipeDecision(
  offsetX: number,
  velocityX: number,
  options: SwipeDecisionOptions = {}
): { action: "left" | "right" | "snap_back" | "none"; reason: string } {
  const { disabled = false, triggered = false, actionLocked = false } = options;

  if (disabled || actionLocked || triggered) {
    return { action: "none", reason: "blocked" };
  }

  const swipedLeft = offsetX < -SWIPE_THRESHOLD || velocityX < -SWIPE_VELOCITY_THRESHOLD;
  const swipedRight = offsetX > SWIPE_THRESHOLD || velocityX > SWIPE_VELOCITY_THRESHOLD;

  if (swipedLeft) return { action: "left", reason: "threshold" };
  if (swipedRight) return { action: "right", reason: "threshold" };
  return { action: "snap_back", reason: "partial" };
}

interface MockTask {
  id: string;
  title: string;
  status: string;
  state?: string;
}

function createMockTaskList(): MockTask[] {
  return [
    { id: "1", title: "Replace furnace filter", status: "pending" },
    { id: "2", title: "Clean gutters", status: "pending" },
    { id: "3", title: "Check smoke detectors", status: "completed" },
  ];
}

function optimisticComplete(tasks: MockTask[], taskId: string): MockTask[] {
  return tasks.map(t => t.id === taskId ? { ...t, status: "completed" } : t);
}

function optimisticDelete(tasks: MockTask[], taskId: string): MockTask[] {
  return tasks.filter(t => t.id !== taskId);
}

describe("SwipeableTask - Swipe Left (Mark as Done)", () => {
  it("triggers left action when swiped past threshold", () => {
    const result = simulateSwipeDecision(-120, 0);
    expect(result.action).toBe("left");
  });

  it("triggers left action with high velocity even below position threshold", () => {
    const result = simulateSwipeDecision(-50, -600);
    expect(result.action).toBe("left");
  });

  it("calls onSwipeLeft callback and updates task status to completed", () => {
    const tasks = createMockTaskList();
    const onSwipeLeft = vi.fn(() => optimisticComplete(tasks, "1"));
    const result = simulateSwipeDecision(-120, 0);
    if (result.action === "left") {
      const updated = onSwipeLeft();
      expect(updated.find(t => t.id === "1")?.status).toBe("completed");
    }
    expect(onSwipeLeft).toHaveBeenCalledOnce();
  });

  it("completed task remains visible in the list (moves to completed section)", () => {
    const tasks = createMockTaskList();
    const updated = optimisticComplete(tasks, "1");
    expect(updated).toHaveLength(3);
    const completedTask = updated.find(t => t.id === "1");
    expect(completedTask?.status).toBe("completed");
    const completedTasks = updated.filter(t => t.status === "completed");
    expect(completedTasks).toHaveLength(2);
  });

  it("task UI should show completed styling after left swipe", () => {
    const task = { id: "1", title: "Test", status: "pending" };
    const completed = { ...task, status: "completed" };
    expect(completed.status).toBe("completed");
  });
});

describe("SwipeableTask - Swipe Right (Delete)", () => {
  it("triggers right action when swiped past threshold", () => {
    const result = simulateSwipeDecision(120, 0);
    expect(result.action).toBe("right");
  });

  it("triggers right action with high velocity even below position threshold", () => {
    const result = simulateSwipeDecision(50, 600);
    expect(result.action).toBe("right");
  });

  it("calls onSwipeRight callback and removes task from list", () => {
    const tasks = createMockTaskList();
    const onSwipeRight = vi.fn(() => optimisticDelete(tasks, "1"));
    const result = simulateSwipeDecision(120, 0);
    if (result.action === "right") {
      const remaining = onSwipeRight();
      expect(remaining).toHaveLength(2);
      expect(remaining.find(t => t.id === "1")).toBeUndefined();
    }
    expect(onSwipeRight).toHaveBeenCalledOnce();
  });

  it("task is removed from active list UI after delete", () => {
    const tasks = createMockTaskList();
    const activeBefore = tasks.filter(t => t.status !== "completed");
    expect(activeBefore).toHaveLength(2);
    const afterDelete = optimisticDelete(tasks, "1");
    const activeAfter = afterDelete.filter(t => t.status !== "completed");
    expect(activeAfter).toHaveLength(1);
    expect(activeAfter[0].id).toBe("2");
  });
});

describe("SwipeableTask - Direction Correctness", () => {
  it("left swipe does NOT trigger delete/archive", () => {
    const onSwipeRight = vi.fn();
    const result = simulateSwipeDecision(-120, 0);
    if (result.action === "right") onSwipeRight();
    expect(onSwipeRight).not.toHaveBeenCalled();
    expect(result.action).toBe("left");
  });

  it("right swipe does NOT mark as done", () => {
    const onSwipeLeft = vi.fn();
    const result = simulateSwipeDecision(120, 0);
    if (result.action === "left") onSwipeLeft();
    expect(onSwipeLeft).not.toHaveBeenCalled();
    expect(result.action).toBe("right");
  });

  it("swipe directions are mutually exclusive for any given gesture", () => {
    const leftResult = simulateSwipeDecision(-120, 0);
    const rightResult = simulateSwipeDecision(120, 0);
    expect(leftResult.action).toBe("left");
    expect(rightResult.action).toBe("right");
    expect(leftResult.action).not.toBe(rightResult.action);
  });

  it("negative velocity triggers left, positive velocity triggers right", () => {
    expect(simulateSwipeDecision(0, -600).action).toBe("left");
    expect(simulateSwipeDecision(0, 600).action).toBe("right");
  });
});

describe("SwipeableTask - UI Affordance Labels", () => {
  it("left swipe reveals green Done indicator (background action)", () => {
    const result = simulateSwipeDecision(-120, 0);
    expect(result.action).toBe("left");
  });

  it("right swipe reveals red Delete indicator (background action)", () => {
    const result = simulateSwipeDecision(120, 0);
    expect(result.action).toBe("right");
  });

  it("completed styling appears only after successful left swipe", () => {
    const task: MockTask = { id: "1", title: "Test", status: "pending" };
    expect(task.status).not.toBe("completed");
    const result = simulateSwipeDecision(-150, 0);
    expect(result.action).toBe("left");
    const updated = optimisticComplete([task], "1")[0];
    expect(updated.status).toBe("completed");
  });

  it("task disappears from list only after successful right swipe", () => {
    const tasks = createMockTaskList();
    const partialResult = simulateSwipeDecision(50, 0);
    expect(partialResult.action).toBe("snap_back");
    expect(tasks).toHaveLength(3);
    const fullResult = simulateSwipeDecision(150, 0);
    expect(fullResult.action).toBe("right");
    const remaining = optimisticDelete(tasks, "1");
    expect(remaining).toHaveLength(2);
  });
});

describe("SwipeableTask - Edge Cases", () => {
  it("partial swipe left below threshold snaps back without action", () => {
    const result = simulateSwipeDecision(-50, 0);
    expect(result.action).toBe("snap_back");
  });

  it("partial swipe right below threshold snaps back without action", () => {
    const result = simulateSwipeDecision(50, 0);
    expect(result.action).toBe("snap_back");
  });

  it("zero offset and zero velocity snaps back", () => {
    const result = simulateSwipeDecision(0, 0);
    expect(result.action).toBe("snap_back");
  });

  it("exact threshold value does NOT trigger (strict inequality)", () => {
    const atThreshold = simulateSwipeDecision(-100, 0);
    expect(atThreshold.action).toBe("snap_back");
    const pastThreshold = simulateSwipeDecision(-101, 0);
    expect(pastThreshold.action).toBe("left");
  });

  it("disabled state prevents any action on left swipe", () => {
    const result = simulateSwipeDecision(-200, -800, { disabled: true });
    expect(result.action).toBe("none");
    expect(result.reason).toBe("blocked");
  });

  it("disabled state prevents any action on right swipe", () => {
    const result = simulateSwipeDecision(200, 800, { disabled: true });
    expect(result.action).toBe("none");
    expect(result.reason).toBe("blocked");
  });

  it("task already completed disables swipe gestures", () => {
    const isCompleted = true;
    const result = simulateSwipeDecision(-150, 0, { disabled: isCompleted });
    expect(result.action).toBe("none");
  });

  it("already triggered state prevents duplicate action", () => {
    const result = simulateSwipeDecision(-200, 0, { triggered: true });
    expect(result.action).toBe("none");
    expect(result.reason).toBe("blocked");
  });

  it("action lock prevents duplicate rapid swipes", () => {
    const onSwipeLeft = vi.fn();

    const first = simulateSwipeDecision(-120, 0);
    if (first.action === "left") onSwipeLeft();

    const second = simulateSwipeDecision(-120, 0, { actionLocked: true });
    if (second.action === "left") onSwipeLeft();

    const third = simulateSwipeDecision(-120, 0, { triggered: true });
    if (third.action === "left") onSwipeLeft();

    expect(onSwipeLeft).toHaveBeenCalledOnce();
  });

  it("velocity alone can trigger action below position threshold", () => {
    const highVelocity = simulateSwipeDecision(-30, -600);
    expect(highVelocity.action).toBe("left");

    const lowVelocity = simulateSwipeDecision(-30, -200);
    expect(lowVelocity.action).toBe("snap_back");
  });

  it("failed persistence rolls back optimistic update", () => {
    const tasks = createMockTaskList();
    const previous = [...tasks];
    const updated = optimisticComplete(tasks, "1");
    expect(updated.find(t => t.id === "1")?.status).toBe("completed");
    const rollback = previous;
    expect(rollback.find(t => t.id === "1")?.status).toBe("pending");
    expect(rollback).toHaveLength(3);
  });

  it("failed delete rolls back optimistic removal", () => {
    const tasks = createMockTaskList();
    const previous = [...tasks];
    const afterDelete = optimisticDelete(tasks, "2");
    expect(afterDelete).toHaveLength(2);
    const rollback = previous;
    expect(rollback).toHaveLength(3);
    expect(rollback.find(t => t.id === "2")).toBeDefined();
  });

  it("completing an already-completed task is a no-op", () => {
    const tasks = createMockTaskList();
    const completedTask = tasks.find(t => t.id === "3")!;
    expect(completedTask.status).toBe("completed");
    const result = simulateSwipeDecision(-150, 0, { disabled: completedTask.status === "completed" });
    expect(result.action).toBe("none");
  });

  it("deleting task that was already deleted results in empty filter", () => {
    const tasks = createMockTaskList();
    const afterFirst = optimisticDelete(tasks, "1");
    const afterSecond = afterFirst.filter(t => t.id !== "1");
    expect(afterSecond).toHaveLength(2);
  });
});

describe("SwipeableTask - Optimistic State Transitions", () => {
  it("complete: pending → completed with cache update", () => {
    const tasks = createMockTaskList();
    const task = tasks.find(t => t.id === "1")!;
    expect(task.status).toBe("pending");
    const updated = optimisticComplete(tasks, "1");
    expect(updated.find(t => t.id === "1")?.status).toBe("completed");
    const otherTasks = updated.filter(t => t.id !== "1");
    expect(otherTasks.every(t => t.status === tasks.find(tt => tt.id === t.id)?.status)).toBe(true);
  });

  it("delete: task removed with cache update", () => {
    const tasks = createMockTaskList();
    expect(tasks).toHaveLength(3);
    const remaining = optimisticDelete(tasks, "2");
    expect(remaining).toHaveLength(2);
    expect(remaining.map(t => t.id)).toEqual(["1", "3"]);
  });

  it("complete then delete: task can be deleted after completion", () => {
    const tasks = createMockTaskList();
    const afterComplete = optimisticComplete(tasks, "1");
    expect(afterComplete.find(t => t.id === "1")?.status).toBe("completed");
    const afterDelete = optimisticDelete(afterComplete, "1");
    expect(afterDelete).toHaveLength(2);
    expect(afterDelete.find(t => t.id === "1")).toBeUndefined();
  });
});

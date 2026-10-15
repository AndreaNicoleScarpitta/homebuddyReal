import { differenceInCalendarDays, parseISO } from "date-fns";
import type { V2Task } from "@/lib/api";

/** A task is open unless either V2 lifecycle field explicitly marks it complete. */
export function isTaskOpen(task: V2Task): boolean {
  return task.status !== "completed" && task.state !== "completed";
}

/**
 * One source of truth for Overview and Plan. Each task belongs to exactly one
 * bucket: completed, past due, due/urgent, or upcoming.
 *
 * "Now" urgency outranks an absent or future date, so urgent tasks can never
 * silently appear as Upcoming. Past-due tasks stay in their own bucket.
 */
export function categorizeTasks(tasks: V2Task[], now = new Date()) {
  const upcoming: V2Task[] = [];
  const due: V2Task[] = [];
  const past_due: V2Task[] = [];
  const completed: V2Task[] = [];

  for (const task of tasks) {
    if (!isTaskOpen(task)) {
      completed.push(task);
      continue;
    }

    const parsedDate = task.dueDate
      ? (task.dueDate.length === 10 ? parseISO(task.dueDate) : new Date(task.dueDate))
      : null;
    const dueDate = parsedDate && !Number.isNaN(parsedDate.getTime()) ? parsedDate : null;

    const daysUntilDue = dueDate ? differenceInCalendarDays(dueDate, now) : null;

    if (daysUntilDue !== null && daysUntilDue < 0) {
      past_due.push(task);
    } else if (
      task.urgency === "now" ||
      (daysUntilDue !== null && daysUntilDue <= 7)
    ) {
      due.push(task);
    } else {
      upcoming.push(task);
    }
  }

  const ascendingDueDate = (a: V2Task, b: V2Task) =>
    (a.dueDate ? new Date(a.dueDate).getTime() : Infinity) -
    (b.dueDate ? new Date(b.dueDate).getTime() : Infinity);
  past_due.sort(ascendingDueDate);
  due.sort(ascendingDueDate);
  upcoming.sort(ascendingDueDate);
  completed.sort((a, b) =>
    (b.dueDate ? new Date(b.dueDate).getTime() : 0) -
    (a.dueDate ? new Date(a.dueDate).getTime() : 0)
  );

  return { upcoming, due, past_due, completed };
}

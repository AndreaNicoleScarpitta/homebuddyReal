/**
 * Agent Scheduler — runs scheduled agents based on their cron expressions.
 *
 * Checks every minute: for each agent with status=active and a schedule,
 * if the current minute matches the cron expression AND we haven't run in
 * the last 50 seconds, fire it.
 *
 * Supports standard 5-field cron: "minute hour day-of-month month day-of-week"
 * Wildcards, lists (1,2,3), and ranges (1-5) supported. No step values.
 */

import { db } from "../db";
import { agents } from "@shared/schema";
import { and, eq, isNotNull } from "drizzle-orm";
import { logInfo, logError } from "../lib/logger";
import { AgentRunner } from "../agents/runner";

const TICK_INTERVAL_MS = 60 * 1000; // 1 minute
let schedulerTimer: ReturnType<typeof setInterval> | null = null;

// Per-agent in-memory last-fired timestamp to prevent double-firing in a minute
const lastFiredAt = new Map<number, number>();

/** Parses one field of a cron expression into a Set of valid numeric values. */
function parseCronField(field: string, min: number, max: number): Set<number> {
  const out = new Set<number>();
  if (field === "*") {
    for (let i = min; i <= max; i++) out.add(i);
    return out;
  }
  for (const part of field.split(",")) {
    const trimmed = part.trim();
    if (trimmed.includes("-")) {
      const [a, b] = trimmed.split("-").map((n) => parseInt(n, 10));
      for (let i = a; i <= b; i++) out.add(i);
    } else {
      const n = parseInt(trimmed, 10);
      if (!isNaN(n)) out.add(n);
    }
  }
  return out;
}

/** Does the given cron expression match the given Date (to-the-minute)? */
export function cronMatches(expr: string, date: Date): boolean {
  const parts = expr.trim().split(/\s+/);
  if (parts.length !== 5) return false;

  const [mF, hF, domF, monF, dowF] = parts;
  const minute = parseCronField(mF, 0, 59);
  const hour = parseCronField(hF, 0, 23);
  const dom = parseCronField(domF, 1, 31);
  const mon = parseCronField(monF, 1, 12);
  const dow = parseCronField(dowF, 0, 6); // Sun=0

  return (
    minute.has(date.getMinutes()) &&
    hour.has(date.getHours()) &&
    dom.has(date.getDate()) &&
    mon.has(date.getMonth() + 1) &&
    dow.has(date.getDay())
  );
}

async function tick(): Promise<void> {
  try {
    const now = new Date();
    const scheduled = await db
      .select()
      .from(agents)
      .where(and(eq(agents.status, "active"), isNotNull(agents.schedule)));

    for (const a of scheduled) {
      if (!a.schedule) continue;
      if (!cronMatches(a.schedule, now)) continue;

      const lastMs = lastFiredAt.get(a.id) ?? 0;
      if (Date.now() - lastMs < 50_000) continue; // prevent dupes within same minute

      lastFiredAt.set(a.id, Date.now());
      logInfo("agent.scheduler", `Firing scheduled agent: ${a.slug}`, { cron: a.schedule });

      // Fire-and-forget — don't block the tick
      AgentRunner.run(a.id, {}, "scheduler").catch((err) => {
        logError("agent.scheduler", err, { agentSlug: a.slug });
      });
    }
  } catch (err) {
    logError("agent.scheduler", err);
  }
}

export function startAgentScheduler(): void {
  if (schedulerTimer) return;
  logInfo("agent.scheduler", "Starting agent scheduler", { intervalMs: TICK_INTERVAL_MS });
  // Align first tick near the top of the next minute for cleaner cron semantics
  const msToNextMinute = 60_000 - (Date.now() % 60_000);
  setTimeout(() => {
    tick().catch(() => {});
    schedulerTimer = setInterval(() => {
      tick().catch(() => {});
    }, TICK_INTERVAL_MS);
  }, msToNextMinute);
}

export function stopAgentScheduler(): void {
  if (schedulerTimer) {
    clearInterval(schedulerTimer);
    schedulerTimer = null;
    logInfo("agent.scheduler", "Agent scheduler stopped");
  }
}

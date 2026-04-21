/**
 * Home Report Agent
 * Generates a comprehensive "State of Your Home" report — a narrative PDF-ready summary
 * of systems, tasks, health score, and recommendations.
 * Input: { homeId }
 * Output: report
 */

import { registerAgent, type AgentContext } from "../runner";
import { db, openaiBreaker } from "../../db";
import { sql } from "drizzle-orm";
import { logInfo, logWarn } from "../../lib/logger";
import OpenAI from "openai";

registerAgent("home-report-agent", async (ctx: AgentContext) => {
  const { homeId } = ctx.input as { homeId?: string };
  if (!homeId) throw new Error("home-report-agent requires `homeId` input");

  logInfo("agent.home-report", `Generating home report for: ${homeId}`);

  // Use allSettled so a single slow/failing query (e.g. systems projection
  // lock contention) doesn't tank the whole report. Home is required; the
  // other two are best-effort and default to empty on failure.
  const [homeSettled, systemsSettled, tasksSettled] = await Promise.allSettled([
    db.execute(sql`
      SELECT ph.attrs, ph.user_id FROM projection_home ph WHERE ph.home_id = ${homeId} LIMIT 1
    `),
    db.execute(sql`
      SELECT ps.attrs FROM projection_system ps WHERE ps.home_id = ${homeId} LIMIT 20
    `),
    db.execute(sql`
      SELECT pt.title, pt.state, pt.due_at, pt.attrs->>'urgency' AS urgency, pt.attrs->>'category' AS category
      FROM projection_task pt WHERE pt.home_id = ${homeId}
      ORDER BY pt.due_at ASC LIMIT 30
    `),
  ]);

  if (homeSettled.status === "rejected") {
    throw new Error(`Home lookup failed: ${(homeSettled.reason as Error)?.message || homeSettled.reason}`);
  }
  const homeResult = homeSettled.value;
  if (homeResult.rows.length === 0) throw new Error(`Home not found: ${homeId}`);

  if (systemsSettled.status === "rejected") {
    logWarn("agent.home-report", `systems query failed; continuing with empty list: ${(systemsSettled.reason as Error)?.message}`);
  }
  if (tasksSettled.status === "rejected") {
    logWarn("agent.home-report", `tasks query failed; continuing with empty list: ${(tasksSettled.reason as Error)?.message}`);
  }

  const home = (homeResult.rows[0] as any).attrs || {};
  const systems = systemsSettled.status === "fulfilled"
    ? (systemsSettled.value.rows as any[]).map(r => r.attrs)
    : [];
  const tasks = tasksSettled.status === "fulfilled"
    ? (tasksSettled.value.rows as any[])
    : [];

  const overdue = tasks.filter(t => t.state !== "completed" && t.due_at && new Date(t.due_at) < new Date());
  const completed = tasks.filter(t => t.state === "completed");
  const pending = tasks.filter(t => t.state !== "completed");

  // 60s timeout + circuit breaker: without these, a hung OpenAI request ties
  // up the agent worker indefinitely, and repeated failures cascade across
  // the whole scheduler. The breaker trips after 3 consecutive errors and
  // fast-fails for 60s so we stop piling requests on a broken upstream.
  const openai = new OpenAI({
    apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
    timeout: 60_000,
    maxRetries: 1,
  });

  const completion = await openaiBreaker.execute(() => openai.chat.completions.create({
    model: "gpt-4o",
    max_tokens: 2500,
    temperature: 0.5,
    messages: [
      {
        role: "system",
        content: `You are a home maintenance analyst writing a "State of Your Home" report.
Tone: Professional but warm. Like a thorough home inspector who actually cares.
Structure the report with clear sections. Use data provided. Be specific.
Format as clean HTML (h2, h3, p, ul, table tags).`,
      },
      {
        role: "user",
        content: `Write a complete "State of Your Home" report.

Home Details:
${JSON.stringify(home, null, 2)}

Systems (${systems.length} tracked):
${systems.map((s: any) => `- ${s.name || s.category}: ${s.condition || "Unknown"} condition, installed ${s.installYear || "unknown"}`).join("\n")}

Task Summary:
- Total tasks: ${tasks.length}
- Completed: ${completed.length}
- Pending: ${pending.length}
- Overdue: ${overdue.length}

Top overdue tasks:
${overdue.slice(0, 5).map(t => `- ${t.title} (${t.category || "General"})`).join("\n") || "None"}

Sections to include:
1. Executive Summary (2-3 sentences, overall health assessment)
2. Systems Overview (what's in good shape, what needs attention)
3. Priority Actions (top 3-5 things to do now)
4. What's Going Well (celebrate completed work)
5. Looking Ahead (6-month outlook)
6. Recommendations`,
      },
    ],
  }));

  const content = completion.choices[0]?.message?.content || "";

  await ctx.emit({
    outputType: "report",
    title: `State of Your Home Report — ${home.address || homeId} — ${new Date().toLocaleDateString()}`,
    content,
    metadata: {
      homeId,
      systemCount: systems.length,
      taskCount: tasks.length,
      overdueCount: overdue.length,
      completedCount: completed.length,
      generatedAt: new Date().toISOString(),
    },
  });

  logInfo("agent.home-report", `Report generated for home ${homeId}`);
});

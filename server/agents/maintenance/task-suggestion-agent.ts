/**
 * Task Suggestion Agent
 * For a given home, analyzes the system inventory and generates a best-practice task list
 * based on system ages, conditions, and seasonal context.
 * Input: { homeId, season }
 * Output: task_list
 */

import { registerAgent, type AgentContext } from "../runner";
import { db } from "../../db";
import { sql } from "drizzle-orm";
import { logInfo } from "../../lib/logger";
import { getOpenAIClient } from "../../lib/openai-client";

function getCurrentSeason(): string {
  const month = new Date().getMonth() + 1;
  if (month >= 3 && month <= 5) return "spring";
  if (month >= 6 && month <= 8) return "summer";
  if (month >= 9 && month <= 11) return "fall";
  return "winter";
}

registerAgent("task-suggestion-agent", async (ctx: AgentContext) => {
  const { homeId, season = getCurrentSeason() } = ctx.input as { homeId?: string; season?: string };

  if (!homeId) throw new Error("task-suggestion-agent requires `homeId` input");

  logInfo("agent.task-suggestion", `Generating task suggestions for home: ${homeId}`);

  const homeResult = await db.execute(sql`
    SELECT
      ph.attrs->>'address' AS address,
      ph.attrs->>'builtYear' AS built_year,
      ph.attrs->>'type' AS home_type
    FROM projection_home ph
    WHERE ph.home_id = ${homeId}
    LIMIT 1
  `);

  if (homeResult.rows.length === 0) throw new Error(`Home not found: ${homeId}`);

  const home = homeResult.rows[0] as any;

  const systemsResult = await db.execute(sql`
    SELECT
      ps.attrs->>'name' AS name,
      ps.attrs->>'category' AS category,
      ps.attrs->>'condition' AS condition,
      ps.attrs->>'installYear' AS install_year,
      ps.attrs->>'lastServiceDate' AS last_service
    FROM projection_system ps
    WHERE ps.home_id = ${homeId}
    LIMIT 20
  `);

  const systems = (systemsResult.rows as any[]).map(s =>
    `${s.name} (${s.category}): condition=${s.condition || "unknown"}, installed=${s.install_year || "unknown"}, last service=${s.last_service || "never"}`
  ).join("\n");

  const openai = getOpenAIClient();

  const completion = await openai.chat.completions.create({
    model: "gpt-4o",
    max_tokens: 2000,
    temperature: 0.5,
    messages: [
      {
        role: "system",
        content: `You are a home maintenance expert generating a prioritized task list.
Be specific and actionable. Assign each task:
- urgency: "now" | "soon" | "later" | "monitor"
- diyLevel: "DIY-Safe" | "Caution" | "Pro-Only"
- estimatedCost: a rough dollar range string
- category: the home system it relates to
Return as JSON array.`,
      },
      {
        role: "user",
        content: `Generate a prioritized maintenance task list for this home.

Home: ${home.address || "Unknown"}, built ${home.built_year || "unknown"}, type: ${home.home_type || "residential"}
Season: ${season}

Installed systems:
${systems || "No systems tracked yet — suggest general maintenance tasks"}

Return 8-12 tasks as JSON:
[{ title, description, category, urgency, diyLevel, estimatedCost, dueInDays }]`,
      },
    ],
  });

  const raw = completion.choices[0]?.message?.content || "[]";
  let tasks: any[] = [];
  try {
    const jsonMatch = raw.match(/\[[\s\S]*\]/);
    if (jsonMatch) tasks = JSON.parse(jsonMatch[0]);
  } catch {
    tasks = [];
  }

  await ctx.emit({
    outputType: "task_list",
    title: `AI Task Suggestions — ${home.address || homeId} — ${season}`,
    content: JSON.stringify(tasks, null, 2),
    metadata: { homeId, season, taskCount: tasks.length, builtYear: home.built_year },
  });

  logInfo("agent.task-suggestion", `Generated ${tasks.length} task suggestions for home ${homeId}`);
});

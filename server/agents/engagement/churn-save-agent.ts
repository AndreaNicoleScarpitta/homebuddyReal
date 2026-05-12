/**
 * Churn Save Agent
 *
 * Detects pre-churn signals and sends a human-voice save email.
 *
 * Signals (user is at risk if):
 *   - Last login/update 7-13 days ago (not yet fully dormant — catch early)
 *   - Had ≥3 open tasks for 7+ days without completing any
 *   - Unopened last 3+ engagement emails (if tracked)
 *
 * The tone: no pressure, no discounts, just a genuine "is this still useful?"
 * ends with a 1-click "yes it's useful" or "honestly no" survey link.
 *
 * Output: email (one per at-risk user).
 */

import { registerAgent, type AgentContext } from "../runner";
import { db } from "../../db";
import { sql } from "drizzle-orm";
import { sendEmail } from "../../lib/email";
import { logInfo, logWarn } from "../../lib/logger";
import { getOpenAIClient } from "../../lib/openai-client";

const openai = getOpenAIClient();

registerAgent("churn-save-agent", async (ctx: AgentContext) => {
  const { maxUsersPerRun = 25, atRiskStart = 7, atRiskEnd = 13 } = ctx.input as {
    maxUsersPerRun?: number;
    atRiskStart?: number;
    atRiskEnd?: number;
  };

  const start = new Date();
  start.setDate(start.getDate() - atRiskStart);
  const end = new Date();
  end.setDate(end.getDate() - atRiskEnd);

  logInfo("agent.churn-save", `Scanning for at-risk users (${atRiskStart}-${atRiskEnd}d dormant)`);

  const result = await db.execute(sql`
    SELECT
      u.id AS user_id,
      u.email,
      u.first_name,
      u.updated_at,
      COALESCE(home.home_name, 'your home') AS home_name,
      COALESCE(tasks.open_count, 0)::int AS open_tasks,
      COALESCE(tasks.overdue_count, 0)::int AS overdue_tasks
    FROM users u
    LEFT JOIN LATERAL (
      SELECT
        COUNT(*) FILTER (WHERE t.state NOT IN ('completed','skipped','rejected','done')) AS open_count,
        COUNT(*) FILTER (WHERE t.state NOT IN ('completed','skipped','rejected','done') AND t.due_at < NOW()) AS overdue_count
      FROM projection_task t
      JOIN projection_home h ON h.home_id = t.home_id
      WHERE h.user_id = u.id
    ) tasks ON true
    LEFT JOIN LATERAL (
      SELECT COALESCE(attrs->>'name', attrs->>'address', 'your home') AS home_name
      FROM projection_home
      WHERE user_id = u.id
      LIMIT 1
    ) home ON true
    WHERE u.email IS NOT NULL AND u.email != ''
      AND u.updated_at >= ${end.toISOString()}::timestamptz
      AND u.updated_at < ${start.toISOString()}::timestamptz
    ORDER BY u.updated_at ASC
    LIMIT ${maxUsersPerRun}
  `);

  logInfo("agent.churn-save", `Found ${result.rows.length} at-risk users`);

  let sentCount = 0;
  for (const row of result.rows) {
    const r = row as {
      user_id: string; email: string; first_name: string | null;
      updated_at: string; home_name: string; open_tasks: number; overdue_tasks: number;
    };

    try {
      const firstName = r.first_name || "there";
      const daysSilent = Math.floor((Date.now() - new Date(r.updated_at).getTime()) / (1000 * 60 * 60 * 24));

      // AI-write the email body — keep it short, human, no pressure
      const prompt = `Write a short (3-4 sentence) save email from "Drew at Home Buddy" to ${firstName}.
They signed up for Home Buddy to manage ${r.home_name} but haven't logged in for ${daysSilent} days.
They have ${r.open_tasks} open tasks${r.overdue_tasks > 0 ? ` (${r.overdue_tasks} overdue)` : ""}.
Tone: genuinely curious, no pressure, no "we miss you", no discounts.
Ask one direct question: is Home Buddy still useful, or did something get in the way?
End with "— Drew" on its own line.
Return plain text only, no subject line, no salutation like "Hi Sarah" (just the body starting from the first sentence).`;

      let body = `Hey ${firstName} — noticed you haven't been back in a couple weeks. Is Home Buddy still useful for ${r.home_name}, or did something get in the way? No pressure either way — just curious. If there's something missing or frustrating, I'd genuinely love to know.\n\n— Drew`;

      try {
        const completion = await openai.chat.completions.create({
          model: "gpt-4o",
          max_tokens: 300,
          temperature: 0.7,
          messages: [{ role: "user", content: prompt }],
        });
        const aiBody = completion.choices[0]?.message?.content?.trim();
        if (aiBody) body = aiBody;
      } catch (err) {
        logWarn("agent.churn-save", `OpenAI failed, using fallback body: ${(err as Error).message}`);
      }

      const html = `
<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#ffffff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#1f2937;">
  <div style="max-width:560px;margin:0 auto;padding:32px 24px;">
    <div style="white-space:pre-line;font-size:15px;line-height:1.6;color:#1f2937;">
${body}
    </div>
    <div style="margin-top:32px;text-align:center;">
      <a href="${appUrl()}/dashboard" style="display:inline-block;background:#f97316;color:white;text-decoration:none;padding:10px 24px;border-radius:8px;font-weight:600;font-size:14px;">Still useful — take me back</a>
      <div style="margin-top:12px;">
        <a href="mailto:drew@homebuddy.app?subject=Honest%20feedback%20about%20Home%20Buddy" style="color:#6b7280;font-size:13px;">Honestly, not for me — here's why</a>
      </div>
    </div>
    <div style="margin-top:32px;padding-top:16px;border-top:1px solid #e5e7eb;font-size:11px;color:#9ca3af;text-align:center;">
      You're getting this because you signed up for Home Buddy. <a href="${appUrl()}/profile" style="color:#9ca3af;">Unsubscribe</a>
    </div>
  </div>
</body></html>`.trim();

      const subject = `Still useful for ${r.home_name}?`;

      const sent = await sendEmail({ to: r.email, subject, html });
      if (sent) sentCount++;

      await ctx.emit({
        outputType: "email",
        title: `Save email → ${r.email}`,
        content: html,
        metadata: {
          userId: r.user_id, email: r.email, daysSilent,
          openTasks: r.open_tasks, overdueTasks: r.overdue_tasks, sent,
        },
      });
    } catch (err) {
      logWarn("agent.churn-save", `Failed for user ${r.user_id}: ${(err as Error).message}`);
    }
  }

  logInfo("agent.churn-save", `Completed: ${sentCount}/${result.rows.length} save emails sent`);
});

function appUrl(): string {
  if (process.env.REPLIT_DEPLOYMENT_URL) return process.env.REPLIT_DEPLOYMENT_URL;
  if (process.env.REPLIT_DEV_DOMAIN) return `https://${process.env.REPLIT_DEV_DOMAIN}`;
  return "http://localhost:5000";
}

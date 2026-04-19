/**
 * Home Health Alert Agent
 * Monitors home health scores, alerts users when score drops significantly.
 * Input: { scoreThreshold, dropThreshold }
 * Output: alert (one per home needing attention)
 */

import { registerAgent, type AgentContext } from "../runner";
import { db } from "../../db";
import { sql } from "drizzle-orm";
import { sendEmail } from "../../lib/email";
import { logInfo } from "../../lib/logger";

registerAgent("home-health-alert-agent", async (ctx: AgentContext) => {
  const { scoreThreshold = 60 } = ctx.input as { scoreThreshold?: number };

  logInfo("agent.home-health-alert", `Checking homes with health score below ${scoreThreshold}`);

  const result = await db.execute(sql`
    SELECT
      ph.home_id,
      ph.user_id,
      ph.attrs->>'address' AS address,
      COALESCE((ph.attrs->>'healthScore')::int, 0) AS health_score,
      u.email,
      u.first_name,
      COUNT(pt.task_id) FILTER (WHERE pt.state NOT IN ('completed','skipped','done') AND pt.due_at < NOW()) AS overdue_count,
      COUNT(pt.task_id) FILTER (WHERE pt.attrs->>'urgency' = 'now') AS urgent_count
    FROM projection_home ph
    JOIN users u ON u.id = ph.user_id
    LEFT JOIN projection_task pt ON pt.home_id = ph.home_id
    WHERE u.email IS NOT NULL
      AND COALESCE((ph.attrs->>'healthScore')::int, 0) < ${scoreThreshold}
    GROUP BY ph.home_id, ph.user_id, ph.attrs, u.email, u.first_name
    HAVING COUNT(pt.task_id) FILTER (WHERE pt.state NOT IN ('completed','skipped','done') AND pt.due_at < NOW()) > 0
    LIMIT 100
  `);

  if (result.rows.length === 0) {
    logInfo("agent.home-health-alert", "No homes need health alerts");
    return;
  }

  for (const home of result.rows as any[]) {
    const score = parseInt(home.health_score);
    const overdue = parseInt(home.overdue_count);
    const urgent = parseInt(home.urgent_count);

    const scoreLabel = score < 30 ? "critical" : score < 50 ? "poor" : "fair";
    const subject = urgent > 0
      ? `⚠ Urgent: Your home needs attention — Health Score ${score}/100`
      : `Your Home Buddy health score dropped to ${score}/100`;

    const html = `
      <div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto;padding:24px">
        <h2 style="color:#f97316;margin:0 0 16px">Home Health Alert</h2>
        <p>Hi ${home.first_name || "there"},</p>
        <p>Your home's health score is currently <strong style="color:${score < 50 ? '#dc2626' : '#f97316'}">${score}/100</strong> (${scoreLabel}).</p>
        ${overdue > 0 ? `<p>You have <strong>${overdue} overdue task${overdue > 1 ? "s" : ""}</strong> that need attention.</p>` : ""}
        ${urgent > 0 ? `<p>⚠ <strong>${urgent} task${urgent > 1 ? "s are" : " is"} marked urgent</strong> — these could become expensive if delayed.</p>` : ""}
        <p style="margin-top:24px">
          <a href="https://home-buddy.replit.app/maintenance-log"
             style="background:#f97316;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600;">
            View Tasks →
          </a>
        </p>
        <p style="color:#6b7280;font-size:12px;margin-top:24px">— Drew at Home Buddy</p>
      </div>
    `;

    await sendEmail({ to: home.email, subject, html });

    await ctx.emit({
      outputType: "alert",
      title: `Health Alert: ${home.address || home.home_id} — Score ${score}`,
      content: `Health score ${score}/100. ${overdue} overdue, ${urgent} urgent.`,
      metadata: { homeId: home.home_id, userId: home.user_id, score, overdue, urgent, scoreLabel },
    });
  }

  logInfo("agent.home-health-alert", `Sent ${result.rows.length} health alerts`);
});

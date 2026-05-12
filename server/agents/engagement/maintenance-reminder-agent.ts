/**
 * Maintenance Reminder Agent
 * Scans all users with overdue/upcoming tasks and sends personalized reminder emails.
 * This is the smarter, AI-personalized version of the basic notificationScheduler.
 * Input: { lookAheadDays, minOverdueDays }
 * Output: email (one per user who gets a digest)
 */

import { registerAgent, type AgentContext } from "../runner";
import { db } from "../../db";
import { sql } from "drizzle-orm";
import { sendEmail } from "../../lib/email";
import { logInfo, logWarn } from "../../lib/logger";
import { getOpenAIClient } from "../../lib/openai-client";

registerAgent("maintenance-reminder-agent", async (ctx: AgentContext) => {
  const { lookAheadDays = 7, minOverdueDays = 1 } = ctx.input as {
    lookAheadDays?: number;
    minOverdueDays?: number;
  };

  logInfo("agent.maintenance-reminder", "Scanning for users needing reminders", { lookAheadDays });

  const soonEnd = new Date();
  soonEnd.setDate(soonEnd.getDate() + lookAheadDays);
  const overdueStart = new Date();
  overdueStart.setDate(overdueStart.getDate() - minOverdueDays);

  // Get users with active notification preferences
  const usersResult = await db.execute(sql`
    SELECT DISTINCT
      u.id AS user_id,
      u.email,
      u.first_name,
      u.last_name,
      np.email_enabled,
      np.maintenance_reminders
    FROM users u
    JOIN notification_preferences np ON np.user_id = u.id
    WHERE np.email_enabled = true
      AND np.maintenance_reminders = true
      AND u.email IS NOT NULL
      AND u.email != ''
    LIMIT 100
  `);

  if (usersResult.rows.length === 0) {
    logWarn("agent.maintenance-reminder", "No eligible users found");
    return;
  }

  const openai = getOpenAIClient();

  let emailsSent = 0;

  for (const userRow of usersResult.rows as any[]) {
    // Get this user's tasks
    const tasksResult = await db.execute(sql`
      SELECT t.task_id, t.title, t.state, t.due_at, t.home_id,
             COALESCE(t.attrs->>'category', 'General') AS category,
             COALESCE(t.attrs->>'urgency', 'later') AS urgency
      FROM projection_task t
      JOIN projection_home h ON h.home_id = t.home_id
      WHERE h.user_id = ${userRow.user_id}
        AND t.state NOT IN ('completed', 'skipped', 'done')
        AND t.due_at IS NOT NULL
        AND t.due_at <= ${soonEnd.toISOString()}::timestamptz
      ORDER BY t.due_at ASC
      LIMIT 20
    `);

    if (tasksResult.rows.length === 0) continue;

    const tasks = tasksResult.rows as any[];
    const overdue = tasks.filter(t => new Date(t.due_at) < new Date());
    const upcoming = tasks.filter(t => new Date(t.due_at) >= new Date());

    // Use AI to write a personalized, human-feeling reminder
    const taskSummary = tasks
      .slice(0, 5)
      .map(t => `- ${t.title} (${t.urgency}, due ${new Date(t.due_at).toLocaleDateString()})`)
      .join("\n");

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      max_tokens: 400,
      temperature: 0.7,
      messages: [
        {
          role: "system",
          content: `You are Drew from Home Buddy writing a brief, friendly maintenance reminder email.
Voice: Warm, direct, never alarmist. Like a helpful neighbor who happens to know everything about houses.
Keep it under 150 words. No fluff. One clear CTA at the end.`,
        },
        {
          role: "user",
          content: `Write a personalized maintenance reminder for ${userRow.first_name || "a homeowner"}.

They have:
- ${overdue.length} overdue task(s)
- ${upcoming.length} upcoming task(s) in the next ${lookAheadDays} days

Top tasks:
${taskSummary}

Write just the email body (no subject line, no headers). End with "[VIEW_TASKS_LINK]".`,
        },
      ],
    });

    const emailBody = completion.choices[0]?.message?.content || "";
    const subject = overdue.length > 0
      ? `⚠ ${overdue.length} overdue task${overdue.length > 1 ? "s" : ""} — Home Buddy`
      : `🏠 ${upcoming.length} task${upcoming.length > 1 ? "s" : ""} coming up — Home Buddy`;

    const html = emailBody
      .replace(/\[VIEW_TASKS_LINK\]/g, `<a href="https://home-buddy.replit.app/maintenance-log" style="color:#f97316;font-weight:600;">View your tasks →</a>`)
      .replace(/\n/g, "<br/>");

    const sent = await sendEmail({ to: userRow.email, subject, html });

    if (sent) {
      emailsSent++;
      await ctx.emit({
        outputType: "email",
        title: `Reminder to ${userRow.email}: ${subject}`,
        content: emailBody,
        metadata: { userId: userRow.user_id, overdueCount: overdue.length, upcomingCount: upcoming.length, sent: true },
      });
    }
  }

  logInfo("agent.maintenance-reminder", `Sent ${emailsSent} personalized reminders`);
});

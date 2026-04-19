/**
 * Re-engagement Agent
 * Identifies users dormant for N days and crafts a personalized win-back email.
 * Input: { dormantDays, maxUsers }
 * Output: email (one per dormant user)
 */

import { registerAgent, type AgentContext } from "../runner";
import { db } from "../../db";
import { sql } from "drizzle-orm";
import { sendEmail } from "../../lib/email";
import { logInfo } from "../../lib/logger";
import OpenAI from "openai";

registerAgent("reengagement-agent", async (ctx: AgentContext) => {
  const { dormantDays = 14, maxUsers = 50 } = ctx.input as {
    dormantDays?: number;
    maxUsers?: number;
  };

  logInfo("agent.reengagement", `Finding users dormant for ${dormantDays}+ days`);

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - dormantDays);

  const dormantResult = await db.execute(sql`
    SELECT
      u.id,
      u.email,
      u.first_name,
      u.created_at,
      u.login_count,
      (SELECT COUNT(*) FROM projection_task pt JOIN projection_home ph ON ph.home_id = pt.home_id WHERE ph.user_id = u.id AND pt.state NOT IN ('completed','skipped','done')) AS open_tasks,
      (SELECT COUNT(*) FROM projection_home ph2 WHERE ph2.user_id = u.id) AS home_count
    FROM users u
    WHERE u.email IS NOT NULL
      AND u.email != ''
      AND u.updated_at < ${cutoff.toISOString()}::timestamptz
      AND u.login_count > 0
    ORDER BY u.updated_at ASC
    LIMIT ${maxUsers}
  `);

  if (dormantResult.rows.length === 0) {
    logInfo("agent.reengagement", "No dormant users found");
    return;
  }

  const openai = new OpenAI({ apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY });

  for (const user of dormantResult.rows as any[]) {
    const daysDormant = Math.floor((Date.now() - new Date(user.updated_at || user.created_at).getTime()) / (1000 * 60 * 60 * 24));
    const hasHome = parseInt(user.home_count) > 0;
    const openTasks = parseInt(user.open_tasks) || 0;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      max_tokens: 300,
      temperature: 0.75,
      messages: [
        {
          role: "system",
          content: `You are Drew from Home Buddy writing a personal, low-pressure win-back email.
Be genuine. No guilt trips. No "we miss you" clichés.
If they have open tasks, mention that their home has been waiting.
If they don't have a home set up yet, make it feel easy to start.
Under 120 words. End with a single link: [RETURN_LINK]`,
        },
        {
          role: "user",
          content: `Write a re-engagement email for ${user.first_name || "this homeowner"}.

Context:
- Days since last visit: ~${daysDormant} days
- Has home set up: ${hasHome ? "Yes" : "No"}
- Open tasks waiting: ${openTasks}
- Total logins ever: ${user.login_count}

Keep it short, human, and pressure-free.`,
        },
      ],
    });

    const emailBody = completion.choices[0]?.message?.content || "";
    const subject = openTasks > 0
      ? `Your home has ${openTasks} task${openTasks > 1 ? "s" : ""} waiting — Home Buddy`
      : hasHome ? "It's been a while — your home might need attention" : "Ready to get your home organized?";

    const html = emailBody
      .replace(/\[RETURN_LINK\]/g, `<a href="https://home-buddy.replit.app" style="color:#f97316;font-weight:600;">Come back to Home Buddy →</a>`)
      .replace(/\n/g, "<br/>");

    await sendEmail({ to: user.email, subject, html });

    await ctx.emit({
      outputType: "email",
      title: `Re-engagement: ${user.email}`,
      content: emailBody,
      metadata: { userId: user.id, daysDormant, openTasks, hasHome },
    });
  }

  logInfo("agent.reengagement", `Processed ${dormantResult.rows.length} dormant users`);
});

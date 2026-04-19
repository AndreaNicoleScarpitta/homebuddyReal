/**
 * Onboarding Coach Agent
 * Identifies new users stuck in onboarding (have account but no home/systems) and nudges them.
 * Input: { stuckAfterHours, maxUsers }
 * Output: email
 */

import { registerAgent, type AgentContext } from "../runner";
import { db } from "../../db";
import { sql } from "drizzle-orm";
import { sendEmail } from "../../lib/email";
import { logInfo } from "../../lib/logger";
import OpenAI from "openai";

registerAgent("onboarding-coach-agent", async (ctx: AgentContext) => {
  const { stuckAfterHours = 24, maxUsers = 100 } = ctx.input as {
    stuckAfterHours?: number;
    maxUsers?: number;
  };

  logInfo("agent.onboarding-coach", `Finding users stuck for ${stuckAfterHours}+ hours`);

  const cutoff = new Date();
  cutoff.setHours(cutoff.getHours() - stuckAfterHours);

  // Find users who signed up but haven't added a home yet
  const stuckResult = await db.execute(sql`
    SELECT
      u.id,
      u.email,
      u.first_name,
      u.login_count,
      u.created_at,
      (SELECT COUNT(*) FROM projection_home ph WHERE ph.user_id = u.id) AS home_count,
      (SELECT COUNT(*) FROM projection_system ps JOIN projection_home ph2 ON ph2.home_id = ps.home_id WHERE ph2.user_id = u.id) AS system_count
    FROM users u
    WHERE u.email IS NOT NULL
      AND u.created_at < ${cutoff.toISOString()}::timestamptz
      AND u.login_count >= 1
      AND (
        (SELECT COUNT(*) FROM projection_home ph WHERE ph.user_id = u.id) = 0
        OR (SELECT COUNT(*) FROM projection_system ps JOIN projection_home ph2 ON ph2.home_id = ps.home_id WHERE ph2.user_id = u.id) = 0
      )
    ORDER BY u.created_at DESC
    LIMIT ${maxUsers}
  `);

  if (stuckResult.rows.length === 0) {
    logInfo("agent.onboarding-coach", "No stuck users found");
    return;
  }

  const openai = new OpenAI({ apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY });

  for (const user of stuckResult.rows as any[]) {
    const hasHome = parseInt(user.home_count) > 0;
    const stage = hasHome ? "add-first-system" : "add-home";

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      max_tokens: 250,
      temperature: 0.7,
      messages: [
        {
          role: "system",
          content: `You are Drew from Home Buddy writing a friendly setup nudge.
This person signed up but hasn't finished setting up yet.
Be encouraging, not nagging. Under 100 words. Mention specifically what one step to take next.
End with [SETUP_LINK].`,
        },
        {
          role: "user",
          content: `Write a setup nudge for ${user.first_name || "this new user"}.
They are stuck at the "${stage}" step.
${!hasHome ? "They haven't added their home address yet." : "They added a home but haven't added any systems (HVAC, roof, etc.) yet."}
Make the next step feel small and easy.`,
        },
      ],
    });

    const emailBody = completion.choices[0]?.message?.content || "";
    const subject = !hasHome
      ? "One quick thing to get started — Home Buddy"
      : "Your home is set up — add your first system";

    const html = emailBody
      .replace(/\[SETUP_LINK\]/g, `<a href="https://home-buddy.replit.app/onboarding" style="color:#f97316;font-weight:600;">Finish setup →</a>`)
      .replace(/\n/g, "<br/>");

    await sendEmail({ to: user.email, subject, html });

    await ctx.emit({
      outputType: "email",
      title: `Onboarding nudge: ${user.email} (${stage})`,
      content: emailBody,
      metadata: { userId: user.id, stage, hasHome, loginCount: user.login_count },
    });
  }

  logInfo("agent.onboarding-coach", `Sent ${stuckResult.rows.length} onboarding nudges`);
});

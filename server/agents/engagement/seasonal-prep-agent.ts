/**
 * Seasonal Prep Agent
 * Detects current season, generates a personalized seasonal prep checklist email for each user.
 * Input: { season } (auto-detected if omitted)
 * Output: email
 */

import { registerAgent, type AgentContext } from "../runner";
import { db } from "../../db";
import { sql } from "drizzle-orm";
import { sendEmail } from "../../lib/email";
import { logInfo } from "../../lib/logger";
import OpenAI from "openai";

function getCurrentSeason(): string {
  const month = new Date().getMonth() + 1;
  if (month >= 3 && month <= 5) return "spring";
  if (month >= 6 && month <= 8) return "summer";
  if (month >= 9 && month <= 11) return "fall";
  return "winter";
}

registerAgent("seasonal-prep-agent", async (ctx: AgentContext) => {
  const { season = getCurrentSeason() } = ctx.input as { season?: string };

  logInfo("agent.seasonal-prep", `Generating seasonal prep emails for: ${season}`);

  const usersResult = await db.execute(sql`
    SELECT
      u.id,
      u.email,
      u.first_name,
      ph.attrs->>'address' AS address,
      (
        SELECT json_agg(json_build_object('name', ps.attrs->>'name', 'category', ps.attrs->>'category'))
        FROM projection_system ps
        WHERE ps.home_id = ph.home_id
        LIMIT 5
      ) AS systems
    FROM users u
    JOIN projection_home ph ON ph.user_id = u.id
    JOIN notification_preferences np ON np.user_id = u.id
    WHERE np.email_enabled = true
      AND u.email IS NOT NULL
    LIMIT 200
  `);

  if (usersResult.rows.length === 0) {
    logInfo("agent.seasonal-prep", "No users to email");
    return;
  }

  const openai = new OpenAI({ apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY });

  const seasonEmojis: Record<string, string> = { spring: "🌱", summer: "☀️", fall: "🍂", winter: "❄️" };
  const emoji = seasonEmojis[season] || "🏠";

  for (const user of usersResult.rows as any[]) {
    const systems = (user.systems as any[] || []).map((s: any) => s.category || s.name).join(", ");

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      max_tokens: 500,
      temperature: 0.7,
      messages: [
        {
          role: "system",
          content: `You are Drew from Home Buddy writing a seasonal prep email.
Warm, practical, brief. Under 180 words.
Create a short numbered checklist (5-7 items) tailored to the user's systems.
End with [VIEW_CHECKLIST_LINK].`,
        },
        {
          role: "user",
          content: `Write a ${season} prep email for ${user.first_name || "this homeowner"}.
Their tracked home systems: ${systems || "general home systems (HVAC, roof, plumbing)"}
Season: ${season}`,
        },
      ],
    });

    const emailBody = completion.choices[0]?.message?.content || "";
    const subject = `${emoji} Your ${season} home prep checklist — Home Buddy`;

    const html = emailBody
      .replace(/\[VIEW_CHECKLIST_LINK\]/g, `<a href="https://home-buddy.replit.app/maintenance-log" style="color:#f97316;font-weight:600;">Open your maintenance log →</a>`)
      .replace(/\n/g, "<br/>");

    await sendEmail({ to: user.email, subject, html });

    await ctx.emit({
      outputType: "email",
      title: `Seasonal Prep (${season}): ${user.email}`,
      content: emailBody,
      metadata: { userId: user.id, season, systems },
    });
  }

  logInfo("agent.seasonal-prep", `Sent ${usersResult.rows.length} seasonal prep emails`);
});

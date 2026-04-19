/**
 * Social Content Agent
 * Generates a week of social media posts (Twitter/X + LinkedIn) from a maintenance tip or season.
 * Input: { theme, season, platform }
 * Output: social_post (one per post, 7 total)
 */

import { registerAgent, type AgentContext } from "../runner";
import { logInfo } from "../../lib/logger";
import OpenAI from "openai";

registerAgent("social-content-agent", async (ctx: AgentContext) => {
  const { theme = "home maintenance", season = "spring", platform = "both" } = ctx.input as {
    theme?: string;
    season?: string;
    platform?: "twitter" | "linkedin" | "both";
  };

  logInfo("agent.social-content", `Generating social posts for: ${theme} / ${season}`);

  const openai = new OpenAI({ apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY });

  const completion = await openai.chat.completions.create({
    model: ctx.agent.modelId || "gpt-4o",
    max_tokens: 2000,
    temperature: 0.8,
    messages: [
      {
        role: "system",
        content: `You are a social media expert for Home Buddy, an AI home maintenance app.
Voice: Calm, practical, slightly witty. Like a knowledgeable friend, not a brand.
Twitter posts: Max 240 chars, punchy, include 1-2 relevant hashtags.
LinkedIn posts: 3-5 short paragraphs, insight + tip + soft CTA. Professional but human.`,
      },
      {
        role: "user",
        content: `Create a 7-day social media content calendar for home maintenance.

Theme: ${theme}
Season: ${season}
Platform: ${platform}

For each day provide:
- Day number (1-7)
- Platform (Twitter or LinkedIn)
- Post content
- Best time to post

Return as JSON array: [{ day, platform, content, bestTime }]`,
      },
    ],
  });

  const raw = completion.choices[0]?.message?.content || "[]";

  let posts: Array<{ day: number; platform: string; content: string; bestTime: string }> = [];
  try {
    const jsonMatch = raw.match(/\[[\s\S]*\]/);
    if (jsonMatch) posts = JSON.parse(jsonMatch[0]);
  } catch {
    posts = [{ day: 1, platform: "twitter", content: raw, bestTime: "9am" }];
  }

  for (const post of posts) {
    await ctx.emit({
      outputType: "social_post",
      title: `Day ${post.day} — ${post.platform} — ${season} ${theme}`,
      content: post.content,
      metadata: { platform: post.platform, bestTime: post.bestTime, day: post.day, season, theme },
    });
  }
});

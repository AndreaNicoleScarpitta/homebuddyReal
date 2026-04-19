/**
 * SEO Content Agent
 * Generates long-form, SEO-optimized guide articles for the Home Buddy blog.
 *
 * Now GA4-aware: before writing, it fetches the top-performing and
 * worst-performing guide pages so the writer can be told what style/topics
 * actually rank and what's decaying and needs a refresh.
 *
 * Input: { topic, keyword, targetAudience, mode? }
 *   mode: "new" (default) | "refresh" — if "refresh", agent picks the worst-decaying guide
 * Output: blog_post
 */

import { registerAgent, type AgentContext } from "../runner";
import { logInfo } from "../../lib/logger";
import { getTopPages, comparePagesWoW, ga4Configured } from "../../lib/ga4";
import OpenAI from "openai";

registerAgent("seo-content-agent", async (ctx: AgentContext) => {
  const { topic: topicInput, keyword, targetAudience = "homeowners", mode = "new" } = ctx.input as {
    topic?: string;
    keyword?: string;
    targetAudience?: string;
    mode?: "new" | "refresh";
  };

  // --- GA4 context gathering -------------------------------------------------
  let ga4Context = "";
  let resolvedTopic = topicInput;

  if (ga4Configured()) {
    try {
      const [topPages, wow] = await Promise.all([
        getTopPages(28, 10),
        comparePagesWoW(30),
      ]);

      const topGuides = topPages.filter((p) => p.path.startsWith("/guides/")).slice(0, 5);
      const decaying = wow
        .filter((p) => p.path.startsWith("/guides/") && p.previousPageViews >= 20 && p.deltaPct <= -0.25)
        .sort((a, b) => a.deltaPct - b.deltaPct)
        .slice(0, 5);

      if (topGuides.length) {
        ga4Context += `\n\nTop-performing guides (last 28 days) — write in this style/format:\n` +
          topGuides.map((p) => `  - ${p.title || p.path} — ${p.pageViews} views, ${Math.round(p.avgEngagementTime)}s avg engagement`).join("\n");
      }
      if (decaying.length) {
        ga4Context += `\n\nDecaying guides (WoW dropped >25%) — consider a refresh topic:\n` +
          decaying.map((p) => `  - ${p.title || p.path} — ${Math.round(p.deltaPct * 100)}% WoW`).join("\n");
      }

      // If mode is "refresh" and no topic was supplied, pick the worst-decaying guide
      if (mode === "refresh" && !topicInput && decaying.length) {
        const pick = decaying[0];
        resolvedTopic = pick.title || pick.path;
        logInfo("agent.seo-content", `GA4-driven refresh mode: picked decaying guide "${resolvedTopic}"`);
      }
    } catch (err: any) {
      logInfo("agent.seo-content", `GA4 context fetch failed (non-fatal): ${err?.message}`);
    }
  }

  if (!resolvedTopic) throw new Error("seo-content-agent requires `topic` input (or GA4 + mode=refresh)");

  logInfo("agent.seo-content", `Generating article for topic: ${resolvedTopic}${ga4Context ? " (with GA4 context)" : ""}`);

  const openai = new OpenAI({ apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY });

  const systemPrompt = ctx.agent.systemPrompt || `You are a friendly, expert home maintenance writer.
Write in a calm, conversational tone — like Drew explaining something to a nervous first-time homeowner.
- Use short paragraphs (2-3 sentences max)
- Use h2/h3 headings for structure
- Include practical checklists where appropriate
- End with a soft CTA to try Home Buddy
- Target 900-1100 words
- No fluff, no filler — every sentence earns its place`;

  const completion = await openai.chat.completions.create({
    model: ctx.agent.modelId || "gpt-4o",
    max_tokens: ctx.agent.maxTokens || 2000,
    temperature: (ctx.agent.temperature || 70) / 100,
    messages: [
      { role: "system", content: systemPrompt },
      {
        role: "user",
        content: `Write a comprehensive home maintenance guide article.

Topic: ${resolvedTopic}
Primary keyword: ${keyword || resolvedTopic}
Target audience: ${targetAudience}
${ga4Context ? `\nReal performance data from our site (use this to inform style and depth):${ga4Context}\n` : ""}
Structure:
1. Hook opening (2-3 sentences, conversational)
2. Why this matters section
3. Main content (checklists, steps, or breakdown)
4. Common mistakes to avoid
5. Soft CTA for Home Buddy

Return the article in clean HTML (h1, h2, h3, p, ul, li tags only).`,
      },
    ],
  });

  const content = completion.choices[0]?.message?.content || "";

  await ctx.emit({
    outputType: "blog_post",
    title: `${resolvedTopic} — Home Buddy Guide`,
    content,
    metadata: {
      keyword,
      targetAudience,
      mode,
      wordCount: content.split(" ").length,
      ga4Informed: Boolean(ga4Context),
    },
  });
});

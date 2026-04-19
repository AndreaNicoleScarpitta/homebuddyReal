/**
 * SEO Content Agent
 * Generates long-form, SEO-optimized guide articles for the Home Buddy blog.
 * Input: { topic, keyword, targetAudience }
 * Output: blog_post
 */

import { registerAgent, type AgentContext } from "../runner";
import { logInfo } from "../../lib/logger";
import OpenAI from "openai";

registerAgent("seo-content-agent", async (ctx: AgentContext) => {
  const { topic, keyword, targetAudience = "homeowners" } = ctx.input as {
    topic?: string;
    keyword?: string;
    targetAudience?: string;
  };

  if (!topic) throw new Error("seo-content-agent requires `topic` input");

  logInfo("agent.seo-content", `Generating article for topic: ${topic}`);

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

Topic: ${topic}
Primary keyword: ${keyword || topic}
Target audience: ${targetAudience}

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
    title: `${topic} — Home Buddy Guide`,
    content,
    metadata: { keyword, targetAudience, wordCount: content.split(" ").length },
  });
});

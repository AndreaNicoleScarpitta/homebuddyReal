/**
 * Landing Copy Agent
 * Generates A/B test copy variations for the Home Buddy landing page.
 * Input: { section, numVariants, angle }
 * Output: copy_variant (one per variant)
 */

import { registerAgent, type AgentContext } from "../runner";
import { logInfo } from "../../lib/logger";
import OpenAI from "openai";

const SECTIONS = {
  hero: {
    description: "Main hero headline + subheadline",
    currentCopy: `Headline: "Stop guessing. Start maintaining."\nSubheadline: "Home Buddy builds a personalized maintenance schedule for your home, tells you what's safe to DIY, and catches problems before they become expensive emergencies."`,
  },
  cta: {
    description: "Primary CTA button text",
    currentCopy: `Current: "Get Started"`,
  },
  valueProps: {
    description: "3-4 core value propositions",
    currentCopy: `Current: AI document analysis, personalized schedules, DIY ratings, system tracking`,
  },
  social: {
    description: "Social proof / trust signals section",
    currentCopy: `Current: Stats section with numbers (14 systems, 50+ templates, etc.)`,
  },
};

registerAgent("landing-copy-agent", async (ctx: AgentContext) => {
  const { section = "hero", numVariants = 3, angle = "anxiety-relief" } = ctx.input as {
    section?: keyof typeof SECTIONS;
    numVariants?: number;
    angle?: string;
  };

  const sectionDef = SECTIONS[section] || SECTIONS.hero;

  logInfo("agent.landing-copy", `Generating ${numVariants} ${section} variants with angle: ${angle}`);

  const openai = new OpenAI({ apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY });

  const completion = await openai.chat.completions.create({
    model: ctx.agent.modelId || "gpt-4o",
    max_tokens: 2000,
    temperature: 0.85,
    messages: [
      {
        role: "system",
        content: `You are a conversion copywriter specializing in SaaS and home services.
Home Buddy's brand: Calm, practical, honest. Not hype. Not corporate.
Target user: Homeowners who feel overwhelmed by maintenance and afraid of expensive surprises.
Design aesthetic: Minimalist, construction orange accent, anxiety-aware UX.`,
      },
      {
        role: "user",
        content: `Generate ${numVariants} A/B test copy variants for the ${section} section of the Home Buddy landing page.

Section: ${sectionDef.description}
Current copy: ${sectionDef.currentCopy}
Angle to explore: ${angle}

For each variant provide:
- Variant label (A, B, C...)
- The copy (appropriate for the section)
- Hypothesis (why this might outperform current)
- Best for (which user segment)

Return as JSON array: [{ variant, copy, hypothesis, bestFor }]`,
      },
    ],
  });

  const raw = completion.choices[0]?.message?.content || "[]";

  let variants: Array<{ variant: string; copy: string; hypothesis: string; bestFor: string }> = [];
  try {
    const jsonMatch = raw.match(/\[[\s\S]*\]/);
    if (jsonMatch) variants = JSON.parse(jsonMatch[0]);
  } catch {
    variants = [{ variant: "A", copy: raw, hypothesis: "Test this angle", bestFor: "All users" }];
  }

  for (const v of variants) {
    await ctx.emit({
      outputType: "copy_variant",
      title: `${section} — Variant ${v.variant} — ${angle}`,
      content: v.copy,
      metadata: { section, variant: v.variant, hypothesis: v.hypothesis, bestFor: v.bestFor, angle },
    });
  }
});

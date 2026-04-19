/**
 * Landing Copy Agent
 * Generates A/B test copy variations for the Home Buddy landing page.
 *
 * Now GA4-aware: pulls landing-page traffic, engagement, bounce rate, and
 * conversion data so the writer knows where the page actually leaks.
 *
 * Input: { section, numVariants, angle }
 * Output: copy_variant (one per variant)
 */

import { registerAgent, type AgentContext } from "../runner";
import { logInfo } from "../../lib/logger";
import { getTopPages, getTrafficSources, ga4Configured } from "../../lib/ga4";
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

  // --- GA4 performance context ----------------------------------------------
  let ga4Context = "";
  if (ga4Configured()) {
    try {
      const [topPages, sources] = await Promise.all([
        getTopPages(28, 15),
        getTrafficSources(28, 8),
      ]);

      // Focus on landing ("/") specifically
      const landing = topPages.find((p) => p.path === "/" || p.path === "");
      if (landing) {
        const bouncePct = Math.round(landing.bounceRate * 100);
        const convRate = landing.activeUsers > 0 ? ((landing.conversions / landing.activeUsers) * 100).toFixed(1) : "0.0";
        ga4Context += `\n\nLanding page actual performance (last 28 days):\n` +
          `  - Users: ${landing.activeUsers}\n` +
          `  - Pageviews: ${landing.pageViews}\n` +
          `  - Bounce rate: ${bouncePct}%  ${bouncePct > 70 ? "⚠️ high — hero is failing to hook" : ""}\n` +
          `  - Avg engagement: ${Math.round(landing.avgEngagementTime)}s  ${landing.avgEngagementTime < 15 ? "⚠️ low — they're not reading" : ""}\n` +
          `  - Conversion rate: ${convRate}%\n`;
      }

      if (sources.length) {
        const topSources = sources.slice(0, 5);
        ga4Context += `\nWhere visitors come from (top 5):\n` +
          topSources.map((s) => `  - ${s.source} / ${s.medium}: ${s.sessions} sessions, ${s.conversions} conversions`).join("\n") +
          `\n\nWrite copy that resonates with the top traffic intent (e.g. if mostly organic search → address what they searched for).`;
      }
    } catch (err: any) {
      logInfo("agent.landing-copy", `GA4 context fetch failed (non-fatal): ${err?.message}`);
    }
  }

  logInfo("agent.landing-copy", `Generating ${numVariants} ${section} variants with angle: ${angle}${ga4Context ? " (GA4-informed)" : ""}`);

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
${ga4Context}

For each variant provide:
- Variant label (A, B, C...)
- The copy (appropriate for the section)
- Hypothesis (why this might outperform current — reference the GA4 data above if relevant)
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
      metadata: { section, variant: v.variant, hypothesis: v.hypothesis, bestFor: v.bestFor, angle, ga4Informed: Boolean(ga4Context) },
    });
  }
});

/**
 * Seed agent definitions into the database.
 * Run: npx tsx server/seed-agents.ts
 */

import { db } from "./db";
import { agents } from "@shared/schema";
import { sql } from "drizzle-orm";

const SEED_AGENTS = [
  // ── MARKETING ──────────────────────────────────────────────────────────────
  {
    slug: "seo-content-agent",
    name: "SEO Content Writer",
    type: "marketing",
    status: "active",
    trigger: "manual",
    description: "Generates long-form, SEO-optimized guide articles for the Home Buddy blog.",
    purpose: "Drive organic search traffic by producing high-quality, keyword-targeted home maintenance content that ranks on Google.",
    config: {
      defaultTopic: "home maintenance tips",
      defaultKeyword: "home maintenance checklist",
      targetWordCount: 1000,
    },
    systemPrompt: `You are a friendly, expert home maintenance writer for Home Buddy.
Write in a calm, conversational tone — like Drew explaining something to a nervous first-time homeowner.
- Short paragraphs (2-3 sentences max)
- h2/h3 headings for structure
- Practical checklists where appropriate
- End with a soft CTA to try Home Buddy
- Target 900-1100 words
- No fluff — every sentence earns its place`,
    modelId: "gpt-4o",
    maxTokens: 2500,
    temperature: 70,
    isBuiltIn: true,
  },
  {
    slug: "social-content-agent",
    name: "Social Media Content Creator",
    type: "marketing",
    status: "active",
    trigger: "scheduled",
    schedule: "0 8 * * 1",  // Every Monday 8am
    description: "Generates a week of Twitter/X and LinkedIn posts around home maintenance themes.",
    purpose: "Maintain a consistent social presence that builds brand awareness and drives traffic to guide pages.",
    config: {
      defaultTheme: "home maintenance",
      platforms: ["twitter", "linkedin"],
      postsPerWeek: 7,
    },
    modelId: "gpt-4o",
    maxTokens: 2000,
    temperature: 80,
    isBuiltIn: true,
  },
  {
    slug: "email-drip-agent",
    name: "Email Drip Sequence Writer",
    type: "marketing",
    status: "active",
    trigger: "manual",
    description: "Generates multi-email drip sequences: onboarding, win-back, and seasonal campaigns.",
    purpose: "Convert signups into active users and re-engage churned users with human-feeling email sequences written in Drew's voice.",
    config: {
      sequences: ["onboarding", "winback", "seasonal"],
      defaultSequence: "onboarding",
      senderName: "Drew at Home Buddy",
    },
    modelId: "gpt-4o",
    maxTokens: 1500,
    temperature: 70,
    isBuiltIn: true,
  },
  {
    slug: "landing-copy-agent",
    name: "Landing Page Copy A/B Tester",
    type: "marketing",
    status: "active",
    trigger: "manual",
    description: "Generates conversion copy variants for A/B testing key landing page sections.",
    purpose: "Continuously improve landing page conversion rate by testing different angles, headlines, and value propositions.",
    config: {
      sections: ["hero", "cta", "valueProps", "social"],
      numVariantsDefault: 3,
      testAngles: ["anxiety-relief", "time-savings", "money-protection", "simplicity", "confidence"],
    },
    modelId: "gpt-4o",
    maxTokens: 2000,
    temperature: 85,
    isBuiltIn: true,
  },

  {
    slug: "seo-performance-agent",
    name: "SEO Performance Analyst",
    type: "marketing",
    status: "active",
    trigger: "scheduled",
    schedule: "0 8 * * 1",  // Mondays at 8am
    description: "Weekly GA4 analysis: decaying pages, surging pages, high-bounce pages, and leaky guides with traffic but no conversion.",
    purpose: "Turn raw GA4 data into a prioritized weekly action list — know which articles to refresh, double down on, or fix before rankings slip.",
    config: {
      decayThresholdPct: -25,
      surgeThresholdPct: 50,
      highBounceThreshold: 0.8,
      minPageviewsForAlert: 20,
    },
    modelId: "gpt-4o",
    maxTokens: 100,  // SQL/GA4 only — no AI currently
    temperature: 50,
    isBuiltIn: true,
  },

  // ── ENGAGEMENT ─────────────────────────────────────────────────────────────
  {
    slug: "maintenance-reminder-agent",
    name: "AI Maintenance Reminder",
    type: "engagement",
    status: "active",
    trigger: "scheduled",
    schedule: "0 9 * * *",  // Daily at 9am
    description: "Scans for users with overdue/upcoming tasks and sends personalized AI-written reminder emails.",
    purpose: "Increase task completion rates and reduce home health score decline by keeping users engaged with timely, relevant reminders.",
    config: {
      lookAheadDays: 7,
      minOverdueDays: 1,
      emailTemplate: "personalized-ai",
    },
    modelId: "gpt-4o",
    maxTokens: 400,
    temperature: 70,
    isBuiltIn: true,
  },
  {
    slug: "reengagement-agent",
    name: "Win-Back Agent",
    type: "engagement",
    status: "active",
    trigger: "scheduled",
    schedule: "0 10 * * 3",  // Wednesdays at 10am
    description: "Identifies users dormant for 14+ days and sends personalized, pressure-free win-back emails.",
    purpose: "Recover churned users before they permanently leave by reaching out with genuine, low-pressure messages.",
    config: {
      dormantDays: 14,
      maxUsersPerRun: 50,
      tone: "friendly-no-pressure",
    },
    modelId: "gpt-4o",
    maxTokens: 300,
    temperature: 75,
    isBuiltIn: true,
  },
  {
    slug: "home-health-alert-agent",
    name: "Home Health Alert",
    type: "engagement",
    status: "active",
    trigger: "scheduled",
    schedule: "0 8 * * 2,5",  // Tuesdays and Fridays at 8am
    description: "Monitors home health scores and alerts users when their score drops below threshold.",
    purpose: "Prevent deferred maintenance from compounding by alerting users early when their home health score deteriorates.",
    config: {
      scoreThreshold: 60,
      alertOnDrop: true,
      urgentThreshold: 30,
    },
    modelId: "gpt-4o",
    maxTokens: 300,
    temperature: 50,
    isBuiltIn: true,
  },
  {
    slug: "seasonal-prep-agent",
    name: "Seasonal Prep Campaign",
    type: "engagement",
    status: "active",
    trigger: "scheduled",
    schedule: "0 9 1 3,6,9,12 *",  // 1st of March, June, September, December
    description: "Sends personalized seasonal maintenance prep emails tailored to each user's tracked systems.",
    purpose: "Prevent seasonal maintenance neglect by reminding users of time-sensitive tasks at the start of each season.",
    config: {
      autoDetectSeason: true,
      tailorToSystems: true,
    },
    modelId: "gpt-4o",
    maxTokens: 500,
    temperature: 70,
    isBuiltIn: true,
  },
  {
    slug: "onboarding-coach-agent",
    name: "Onboarding Coach",
    type: "engagement",
    status: "active",
    trigger: "scheduled",
    schedule: "0 11 * * *",  // Daily at 11am
    description: "Identifies new users stuck in setup and sends a targeted nudge to complete their home profile.",
    purpose: "Improve new user activation rate by identifying and unblocking users who signed up but haven't completed setup.",
    config: {
      stuckAfterHours: 24,
      maxUsersPerRun: 100,
      nudgeStages: ["add-home", "add-first-system"],
    },
    modelId: "gpt-4o",
    maxTokens: 250,
    temperature: 70,
    isBuiltIn: true,
  },

  // ── MAINTENANCE ────────────────────────────────────────────────────────────
  {
    slug: "task-suggestion-agent",
    name: "AI Task Suggester",
    type: "maintenance",
    status: "active",
    trigger: "event",
    description: "Analyzes a home's system inventory and generates a prioritized, season-aware maintenance task list.",
    purpose: "Accelerate new user value by immediately populating a smart, personalized task backlog based on their specific systems.",
    config: {
      maxTasksPerRun: 12,
      includeSeasonalContext: true,
      urgencyDistribution: { now: 0.1, soon: 0.3, later: 0.5, monitor: 0.1 },
    },
    modelId: "gpt-4o",
    maxTokens: 2000,
    temperature: 50,
    isBuiltIn: true,
  },
  {
    slug: "home-report-agent",
    name: "Home Health Report Generator",
    type: "maintenance",
    status: "active",
    trigger: "manual",
    description: "Generates a comprehensive 'State of Your Home' narrative report for a given home.",
    purpose: "Give users a clear, motivating snapshot of their home's overall condition, progress, and what to focus on next.",
    config: {
      reportFormat: "html",
      includeRecommendations: true,
      includeSixMonthOutlook: true,
    },
    modelId: "gpt-4o",
    maxTokens: 2500,
    temperature: 50,
    isBuiltIn: true,
  },

  // ── REVENUE / RETENTION ────────────────────────────────────────────────────
  {
    slug: "churn-save-agent",
    name: "Churn Save Agent",
    type: "engagement",
    status: "active",
    trigger: "scheduled",
    schedule: "0 11 * * 2",  // Tuesdays at 11am — mid-week, high open rate
    description: "Detects users 7-13 days dormant and sends a genuine, no-pressure save email asking if Home Buddy is still useful.",
    purpose: "Save ~10% of would-be churn by reaching at-risk users before they fully disengage. Compounds directly into LTV.",
    config: {
      atRiskStart: 7,
      atRiskEnd: 13,
      maxUsersPerRun: 25,
      tone: "genuine-curious-no-pressure",
    },
    modelId: "gpt-4o",
    maxTokens: 300,
    temperature: 75,
    isBuiltIn: true,
  },
  {
    slug: "dunning-agent",
    name: "Failed Payment Recovery Agent",
    type: "engagement",
    status: "active",
    trigger: "event",  // Triggered by Stripe webhook invoice.payment_failed
    description: "Multi-stage (polite → helpful → last-chance) email sequence for recovering failed Stripe payments.",
    purpose: "Recover 30-50% of involuntary churn. Most failed payments are expired cards, not intent to cancel — this gets them back.",
    config: {
      stages: 3,
      stageDelaysDays: [1, 3, 7],
      tone: "drew-personal-voice",
    },
    modelId: "gpt-4o",
    maxTokens: 400,
    temperature: 60,
    isBuiltIn: true,
  },

  // ── SYSTEM / FOUNDER ───────────────────────────────────────────────────────
  {
    slug: "founder-brief-agent",
    name: "Founder Morning Brief",
    type: "system",
    status: "active",
    trigger: "scheduled",
    schedule: "0 7 * * *",  // Daily at 7am
    description: "Daily metrics digest sent to every email in ADMIN_EMAILS: active homes, signups, churn, agent health, anomalies.",
    purpose: "Replace 'check 7 dashboards' with 'read one email.' Surfaces anomalies automatically so the founder only reacts to real signal.",
    config: {
      sendTime: "07:00",
      includeAnomalies: true,
      anomalyThresholds: {
        signupDropPct: 40,
        agentFailureRatePct: 20,
        overduePerHome: 5,
      },
    },
    modelId: "gpt-4o",
    maxTokens: 100,  // No AI used currently — SQL only. Present for future AI narrative.
    temperature: 50,
    isBuiltIn: true,
  },
];

async function seedAgents() {
  console.log(`Seeding ${SEED_AGENTS.length} agents...`);

  for (const agentDef of SEED_AGENTS) {
    await db
      .insert(agents)
      .values(agentDef as any)
      .onConflictDoUpdate({
        target: agents.slug,
        set: {
          name: sql`excluded.name`,
          type: sql`excluded.type`,
          description: sql`excluded.description`,
          purpose: sql`excluded.purpose`,
          trigger: sql`excluded.trigger`,
          schedule: sql`excluded.schedule`,
          config: sql`excluded.config`,
          systemPrompt: sql`excluded.system_prompt`,
          modelId: sql`excluded.model_id`,
          maxTokens: sql`excluded.max_tokens`,
          temperature: sql`excluded.temperature`,
          updatedAt: new Date(),
        },
      });

    console.log(`  ✓ ${agentDef.slug} (${agentDef.type})`);
  }

  console.log("\n✅ Agent seed complete.");
  process.exit(0);
}

seedAgents().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});

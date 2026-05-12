/**
 * Email Drip Agent
 * Generates a multi-email onboarding drip sequence for new Home Buddy users.
 * Input: { sequenceType, numEmails, targetSegment }
 * Output: email (one per email in sequence)
 */

import { registerAgent, type AgentContext } from "../runner";
import { logInfo } from "../../lib/logger";
import { getOpenAIClient } from "../../lib/openai-client";

const SEQUENCES = {
  onboarding: {
    name: "New User Onboarding",
    emails: [
      { day: 0, subject: "Welcome to Home Buddy 🏠", focus: "Welcome, what Home Buddy does, first action to take (add your first system)" },
      { day: 2, subject: "Your home's first health check", focus: "How the health score works, what a good score looks like, encourage adding 3+ systems" },
      { day: 5, subject: "The $5,000 mistake most homeowners make", focus: "Ignoring HVAC filter changes, relatable story, encourage setting first task" },
      { day: 10, subject: "Quick win: your first maintenance task", focus: "Pick one easy task (HVAC filter), mark it done, feel the momentum" },
      { day: 21, subject: "One month in — how's your home doing?", focus: "Check-in, celebrate progress, introduce the AI document analysis feature" },
    ],
  },
  winback: {
    name: "Win-Back Inactive Users",
    emails: [
      { day: 0, subject: "We noticed you've been away 👋", focus: "Friendly check-in, what changed since they left, soft nudge to log back in" },
      { day: 3, subject: "Your home didn't take a break", focus: "Seasonal maintenance they may have missed, urgency without panic" },
      { day: 7, subject: "One thing before you go", focus: "Final nudge, highlight new features, offer to delete account if they want" },
    ],
  },
  seasonal: {
    name: "Seasonal Prep Campaign",
    emails: [
      { day: 0, subject: "Your home's seasonal prep checklist", focus: "What to do this season, tie to their specific systems" },
      { day: 5, subject: "Don't skip this one (seriously)", focus: "The #1 most missed seasonal task, why it matters" },
      { day: 14, subject: "Season check-in: how's it going?", focus: "Encourage logging completed tasks, praise progress" },
    ],
  },
};

registerAgent("email-drip-agent", async (ctx: AgentContext) => {
  const { sequenceType = "onboarding" } = ctx.input as { sequenceType?: keyof typeof SEQUENCES };

  const sequence = SEQUENCES[sequenceType] || SEQUENCES.onboarding;

  logInfo("agent.email-drip", `Generating ${sequence.name} sequence (${sequence.emails.length} emails)`);

  const openai = getOpenAIClient();

  for (const emailDef of sequence.emails) {
    const completion = await openai.chat.completions.create({
      model: ctx.agent.modelId || "gpt-4o",
      max_tokens: 1500,
      temperature: 0.7,
      messages: [
        {
          role: "system",
          content: `You are Drew, the founder of Home Buddy writing personal emails to users.
Voice: Warm, direct, honest. Like a knowledgeable friend who actually owns a home.
Format: Plain text with occasional line breaks. No marketing speak. No "I hope this email finds you well."
Always end with a single, clear CTA link placeholder: [CTA_LINK]
Sign off as: Drew at Home Buddy`,
        },
        {
          role: "user",
          content: `Write email #${sequence.emails.indexOf(emailDef) + 1} in the "${sequence.name}" sequence.

Subject line: ${emailDef.subject}
Send day: Day ${emailDef.day}
Email focus: ${emailDef.focus}

Write the full email body. Keep it under 200 words. Be real, not corporate.`,
        },
      ],
    });

    const content = completion.choices[0]?.message?.content || "";

    await ctx.emit({
      outputType: "email",
      title: emailDef.subject,
      content,
      metadata: {
        sequence: sequenceType,
        sendDay: emailDef.day,
        emailIndex: sequence.emails.indexOf(emailDef) + 1,
        totalEmails: sequence.emails.length,
      },
    });
  }
});

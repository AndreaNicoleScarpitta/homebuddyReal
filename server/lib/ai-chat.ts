import OpenAI from "openai";
import { storage } from "../storage";
import { logInfo, logError } from "./logger";

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

const SYSTEM_PROMPT = `You are "Home Buddy Assistant," a calm, trustworthy home-repair planning helper for homeowners age 27-45.
Your job is to reduce anxiety, increase clarity, and help users make confident decisions about home maintenance, repairs, and budgeting.

CORE PRINCIPLES (ALWAYS)
1) Be calm and professional. No hype, no cheerleading, no "exciting journey" language.
2) Assume the user may be stressed about money or risk. Use supportive, non-judgmental language.
3) Provide practical next steps. Prefer simple decisions over long explanations.
4) Be transparent about uncertainty. Use ranges, probabilities, and "it depends" when appropriate.
5) Never sound salesy. Do not push services, upgrades, or "book now" behavior.
6) Do not shame the user for budgets or "not being prepared."
7) Keep responses concise by default; offer to go deeper.
8) Avoid contractor jargon unless you define it in plain language.

WHAT YOU SHOULD DO WITH EVERY USER MESSAGE (INGEST STEPS)
For each message, internally extract:
- (A) User intent: what they want (diagnosis, plan, budget, provider research, DIY guidance, prioritization).
- (B) Urgency: emergency / soon / later / unsure.
- (C) Risk signals: water, electrical, gas, structural, mold, active leak, burning smell, no heat, etc.
- (D) Context: location (if known), home age/systems (if provided), constraints (budget, DIY comfort).
- (E) Emotional state: anxious, overwhelmed, skeptical, urgent, curious.

Then choose the best response mode:
1) Quick triage (if safety risk or urgent)
2) Prioritize + plan (if multiple issues / overwhelm)
3) Budget + affordability (if money decisions)
4) DIY vs Pro guidance (if "can I do this?")
5) Provider research (only if the user asks or is clearly ready)

RESPONSE STRUCTURE (DEFAULT TEMPLATE)
Use this structure unless the user asks otherwise:
1) Acknowledge + normalize (1 sentence, calm)
2) Clarify the decision (what we're deciding today)
3) Provide 2-4 actionable next steps (bullets)
4) Offer an optional "If you want, I can..." follow-up (one line)

Example tone:
- "Totally reasonable to feel unsure here."
- "Let's reduce this to one decision: fix now vs monitor."
- "Here's the safest next step."

SAFETY & ESCALATION RULES (HIGH PRIORITY)
If the user mentions any of the following, immediately switch to safety-first guidance:
- gas smell, electrical burning smell, sparking, active flooding, sewage backup, roof collapse risk, major structural cracks, carbon monoxide alarm, mold with health symptoms, no heat in freezing weather, etc.

In these cases:
- Tell them to stop/avoid the hazard and contact an appropriate professional or emergency services if needed.
- Do not give step-by-step dangerous instructions.
- Keep it calm and direct.

ASSISTANT PERSONALITY & TONE
- Voice: "steady expert neighbor" + "financially responsible planner"
- No emojis by default (unless user uses them a lot)
- No exclamation marks unless truly necessary
- No patronizing positivity ("That's fantastic!")
- Do not over-apologize

QUESTIONING STRATEGY (DON'T INTERROGATE)
Ask at most 1-2 questions at a time, only when required to move forward.
Prefer offering options:
- "Is this an active leak right now, or just evidence of past moisture?"
- "Are you comfortable doing a simple fix if I keep it safe and basic, or do you want pro-only recommendations?"

HOMEOWNER MENTAL MODEL (ALWAYS MATCH THIS)
Homeowners think in:
- "What needs attention now vs later?"
- "What can go wrong if I wait?"
- "How much could this cost?"
- "Can I do it myself safely?"
- "Who can I trust to fix it?"
- "How do I plan this without blowing my budget?"

So always include:
- urgency guidance (now/soon/later)
- consequence of delay (in plain language)
- rough cost range when possible
- DIY vs Pro recommendation

AI UNCERTAINTY & ESTIMATES (TRUST RULES)
When discussing costs or diagnoses:
- Use ranges, not exact numbers.
- Say what drives variance (region, access, severity).
- Offer "quick ways to refine the estimate" (photo, dimensions, symptoms, age of system).
- Never claim certainty without evidence.

INSPECTION REPORT / FINDINGS HANDLING
If user references an inspection finding or the app has a finding object:
- Restate the finding simply
- Explain "why it matters" in 1 sentence
- Give "fix now vs monitor" recommendation
- Offer next step: add to plan, set reminder, estimate budget impact

BUDGET & FUNDS HANDLING
If user mentions affordability, savings, or budgeting:
- Avoid shame.
- Reframe into preparedness:
  - "You're covered" / "You're not covered yet" / "You'd be partially covered"
- Suggest creating a buffer category rather than "Emergency reserve = $0"
- Offer a simple plan:
  - "Set aside $X/month" + "target date" + "what to do if it becomes urgent"

PROVIDER RESEARCH (ANGI / ANGIE'S LIST) - STRICT RULES
Only surface provider research when:
- The user asks "who should I call / find a contractor," OR
- The user has accepted "pro-only" and is ready to act (Phase 4: who do I trust?)

When you do:
- Frame as research, not hire:
  - "I can help you research well-reviewed local pros for this repair."
- Never push "book now."
- Provide evaluation criteria:
  - licensing/insurance, multiple quotes, scope clarity, warranty, reviews, photos, payment schedule
- Include disclosure if applicable:
  - "Provider listings powered by Angi. Home Buddy does not receive payment based on your choice."

PHOTO ANALYSIS RULES
When analyzing photos:
- Describe only what is clearly visible
- Acknowledge lighting, angle, and image quality limitations
- Note that hidden conditions cannot be assessed from photos
- Recommend professional inspection for anything safety-related
- Be honest about uncertainty

DEFAULT OUTPUT LENGTH
- Keep responses to ~120-200 words unless user asks for more detail.
- Use bullets and short paragraphs.

WHAT NOT TO DO
- Don't invent facts about the user's home or inspection.
- Don't diagnose confidently from vague info.
- Don't overwhelm with 10+ steps.
- Don't be salesy, gimmicky, or overly enthusiastic.
- Don't suggest unsafe DIY for electrical/gas/structural hazards.

ENDING EVERY RESPONSE
End with one of these:
- "Want the DIY-safe steps, or should we treat this as pro-only?"
- "Do you want to handle this now, or plan it for later with a budget target?"
- "If you share a photo / the exact wording from the inspection, I can narrow this down."`;

const HIGH_RISK_KEYWORDS = [
  "gas leak", "smell gas", "gas odor",
  "electrical fire", "sparking", "burning smell",
  "structural", "foundation crack", "load bearing",
  "carbon monoxide", "co detector",
  "asbestos", "lead paint",
  "mold", "black mold",
  "sewage", "sewer backup",
];

function containsHighRiskTopic(message: string): { isHighRisk: boolean; topic?: string } {
  const lowerMessage = message.toLowerCase();
  for (const keyword of HIGH_RISK_KEYWORDS) {
    if (lowerMessage.includes(keyword)) {
      return { isHighRisk: true, topic: keyword };
    }
  }
  return { isHighRisk: false };
}

function getHighRiskResponse(topic: string): string {
  const emergencyTopics = ["gas leak", "smell gas", "gas odor", "electrical fire", "sparking", "carbon monoxide", "co detector"];
  
  if (emergencyTopics.some(t => topic.includes(t))) {
    return `⚠️ **This sounds like a potential emergency.**

If you suspect a gas leak, electrical fire, or carbon monoxide issue:
1. **Leave the area immediately** - do not use light switches or electronics
2. **Call 911** or your gas company's emergency line from outside
3. **Do not re-enter** until emergency responders confirm it's safe

I cannot provide guidance on active emergencies. Your safety comes first.

Once the emergency is resolved and you're safe, I'm happy to help with next steps.`;
  }

  return `⚠️ **Important: This requires professional attention.**

${topic.charAt(0).toUpperCase() + topic.slice(1)} issues should be evaluated by licensed professionals because:
- They can pose serious health and safety risks
- Accurate assessment requires specialized equipment and training
- DIY attempts can make the problem worse or create additional hazards
- There may be legal/permit requirements

**My recommendation:**
1. Contact a licensed professional for an inspection
2. Get multiple opinions if the repair estimate is significant
3. Ask about testing/verification if relevant (e.g., mold testing, structural engineering)

I can help you understand what questions to ask the professional, or provide general information about the repair process. What would be most helpful?`;
}

export async function getAIResponse(
  homeId: number,
  userMessage: string,
  conversationHistory: Array<{ role: string; content: string }>
): Promise<string> {
  try {
    const highRiskCheck = containsHighRiskTopic(userMessage);
    if (highRiskCheck.isHighRisk && highRiskCheck.topic) {
      return getHighRiskResponse(highRiskCheck.topic);
    }

    const home = await storage.getHomeById(homeId);
    
    let contextMessage = "";
    if (home) {
      contextMessage = `\n\nContext about this user's home:
- Address: ${home.city || "Unknown"}, ${home.state || "Unknown area"}
- Year Built: ${home.builtYear || "Unknown"}
- Square Footage: ${home.sqFt || "Unknown"} sq ft
- Type: ${home.type || "Unknown"}`;
    }

    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      { role: "system", content: SYSTEM_PROMPT + contextMessage },
      ...conversationHistory.map(msg => ({
        role: msg.role as "user" | "assistant",
        content: msg.content,
      })),
      { role: "user", content: userMessage },
    ];

    logInfo("ai-chat", "Sending request to OpenAI", { homeId, messageCount: messages.length });

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages,
      max_completion_tokens: 1024,
      temperature: 0.7,
    });

    const assistantMessage = response.choices[0]?.message?.content || "I apologize, but I couldn't generate a response. Please try again.";
    
    logInfo("ai-chat", "Received response from OpenAI", { homeId, responseLength: assistantMessage.length });

    return assistantMessage;
  } catch (error) {
    logError("ai-chat", error);
    throw new Error("Failed to get AI response. Please try again later.");
  }
}

export async function streamAIResponse(
  homeId: number,
  userMessage: string,
  conversationHistory: Array<{ role: string; content: string }>,
  onChunk: (content: string) => void,
  onDone: () => void,
  imageBase64?: string,
  imageType?: string
): Promise<string> {
  try {
    const highRiskCheck = containsHighRiskTopic(userMessage);
    if (highRiskCheck.isHighRisk && highRiskCheck.topic) {
      const response = getHighRiskResponse(highRiskCheck.topic);
      onChunk(response);
      onDone();
      return response;
    }

    const home = await storage.getHomeById(homeId);
    
    let contextMessage = "";
    if (home) {
      contextMessage = `\n\nContext about this user's home:
- Address: ${home.city || "Unknown"}, ${home.state || "Unknown area"}
- Year Built: ${home.builtYear || "Unknown"}
- Square Footage: ${home.sqFt || "Unknown"} sq ft
- Type: ${home.type || "Unknown"}`;
    }

    let userContent: OpenAI.Chat.Completions.ChatCompletionContentPart[] | string;
    
    if (imageBase64 && imageType) {
      userContent = [
        { 
          type: "text", 
          text: userMessage + "\n\n[Note: The user has shared a photo. Describe what you observe, acknowledge limitations, and recommend professional inspection for any safety concerns.]" 
        },
        {
          type: "image_url",
          image_url: {
            url: `data:${imageType};base64,${imageBase64}`,
            detail: "high",
          },
        },
      ];
    } else {
      userContent = userMessage;
    }

    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      { role: "system", content: SYSTEM_PROMPT + contextMessage },
      ...conversationHistory.map(msg => ({
        role: msg.role as "user" | "assistant",
        content: msg.content,
      })),
      { role: "user", content: userContent },
    ];

    logInfo("ai-chat", "Sending request to OpenAI", { 
      homeId, 
      messageCount: messages.length,
      hasImage: !!imageBase64 
    });

    const stream = await openai.chat.completions.create({
      model: "gpt-4o",
      messages,
      max_completion_tokens: 1024,
      temperature: 0.7,
      stream: true,
    });

    let fullResponse = "";

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content || "";
      if (content) {
        fullResponse += content;
        onChunk(content);
      }
    }

    onDone();
    return fullResponse;
  } catch (error) {
    logError("ai-chat.stream", error);
    throw new Error("Failed to get AI response. Please try again later.");
  }
}

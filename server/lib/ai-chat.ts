import OpenAI from "openai";
import { storage } from "../storage";
import { logInfo, logError } from "./logger";

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

const SYSTEM_PROMPT = `You are Home Buddy, a helpful home maintenance assistant. You provide general informational guidance to help homeowners understand their homes better.

CRITICAL SAFETY RULES:
1. You are NOT a licensed inspector, contractor, or professional. Always make this clear.
2. For any safety-critical issue (gas, electrical, structural, roofing, water damage), strongly recommend professional inspection.
3. NEVER provide definitive diagnoses - use language like "this appears to be," "this could indicate," or "you may want to have a professional check"
4. For emergencies (gas leaks, electrical fires, flooding, structural collapse), immediately direct users to evacuate and call 911.

RESPONSE GUIDELINES:
1. Lead with uncertainty when appropriate - acknowledge what you cannot determine from the information given
2. Provide cost estimates as RANGES (e.g., "$200-500") and emphasize these are general ballpark figures, not quotes
3. Classify tasks as: DIY-Possible (with caveats), Caution (research carefully first), or Pro-Recommended (get professional help)
4. Suggest urgency levels: Investigate Now, Plan Soon, or Monitor
5. Always recommend getting multiple professional opinions for significant repairs

TONE:
- Be calm and grounded, not alarmist
- Be helpful without being pushy
- Acknowledge that homeownership is challenging
- Respect that the user is in control of all decisions
- Don't oversell your capabilities

When analyzing photos:
- Describe only what is clearly visible
- Acknowledge lighting, angle, and image quality limitations
- Note that hidden conditions cannot be assessed from photos
- Recommend professional inspection for anything safety-related
- Be honest about uncertainty

ALWAYS END RESPONSES WITH:
For any significant concern, I recommend consulting a licensed professional who can inspect in person.`;

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

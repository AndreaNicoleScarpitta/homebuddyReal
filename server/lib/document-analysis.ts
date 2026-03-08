import OpenAI from "openai";
import { storage } from "../storage";
import { logInfo, logError } from "./logger";
import { z } from "zod";
import {
  KNOWN_SYSTEMS,
  systemNameToPrefix,
  prefixAttribute,
  validateAttributeNamespace,
  enforceAttributeNamespaces,
  type KnownSystem,
  type ExtractedIssue,
} from "./attribute-namespace";

export {
  KNOWN_SYSTEMS,
  systemNameToPrefix,
  prefixAttribute,
  validateAttributeNamespace,
  enforceAttributeNamespaces,
  type KnownSystem,
};

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

export const extractedIssueSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional().default(""),
  systemName: z.string().optional().default("unknown_system"),
  category: z.string().optional().default("Other"),
  urgency: z.enum(["now", "soon", "later", "monitor"]).optional().default("later"),
  diyLevel: z.enum(["DIY-Safe", "Caution", "Pro-Only"]).optional().default("Caution"),
  estimatedCost: z.string().optional().default("Unknown"),
  safetyWarning: z.string().nullable().optional().default(null),
  attributes: z.record(z.string(), z.string()).optional().default({}),
});

export const documentAnalysisResponseSchema = z.object({
  issues: z.array(extractedIssueSchema),
});

export type DocumentAnalysisResponse = z.infer<typeof documentAnalysisResponseSchema>;

const DOCUMENT_ANALYSIS_PROMPT = `You are a home maintenance expert analyzing a document for potential home issues and recommended maintenance tasks.

Analyze the provided document text and extract any home-related issues, maintenance needs, repair recommendations, or inspection findings.

You MUST respond with valid JSON only — no markdown, no explanation, no surrounding text.

CRITICAL RULE — System-Scoped Attributes:
Every attribute you extract MUST be prefixed with the system name it belongs to.
- Use the format: systemName_attributeName
- Examples: roof_material, siding_condition, hvac_unit_type, plumbing_pipe_material
- NEVER use generic attribute names like "material", "condition", "age", or "installation_year"
- Each attribute MUST only appear in the system it belongs to
- If roof material is detected, set "roof_material" — do NOT set "siding_material" or any other system's material
- If you cannot confidently determine which system an attribute belongs to, prefix it with "unknown_system_"

Known systems: roof, hvac, plumbing, electrical, windows, siding, foundation, appliances, water_heater, landscaping, pest, other

Response format:
{
  "issues": [
    {
      "title": "Short descriptive title of the issue or task",
      "description": "Detailed description of the issue and what needs to be done",
      "systemName": "The home system this issue belongs to (e.g., roof, hvac, plumbing, electrical, siding, foundation, windows, appliances, water_heater, landscaping, pest, other, or unknown_system)",
      "category": "One of: Roof, HVAC, Plumbing, Electrical, Windows, Siding/Exterior, Foundation, Appliances, Water Heater, Landscaping, Pest, Other",
      "urgency": "One of: now, soon, later, monitor",
      "diyLevel": "One of: DIY-Safe, Caution, Pro-Only",
      "estimatedCost": "Rough cost range like '$100-$300' or 'Unknown'",
      "safetyWarning": "Safety warning if applicable, or null",
      "attributes": {
        "systemName_attributeName": "value"
      }
    }
  ]
}

Attribute examples per system:
- Roof issue: { "roof_material": "asphalt shingles", "roof_condition": "deteriorating", "roof_installation_year": "2005" }
- Siding issue: { "siding_material": "vinyl", "siding_condition": "cracked" }
- HVAC issue: { "hvac_unit_type": "central air", "hvac_condition": "failing", "hvac_age_years": "18" }
- Plumbing issue: { "plumbing_pipe_material": "copper", "plumbing_condition": "corroded" }
- Foundation issue: { "foundation_crack_type": "hairline", "foundation_location": "southeast corner" }

Rules:
- Extract ONLY home-maintenance-related issues from the document.
- If the document contains no relevant home issues, return {"issues": []}.
- Be specific in titles — avoid generic descriptions.
- Cost estimates should be ranges reflecting typical US pricing.
- Mark anything involving gas, electrical panels, structural work, or asbestos/mold as "Pro-Only".
- Include safety warnings for anything that could be dangerous.
- Do not fabricate issues not present in the document text.
- ALL attribute keys MUST be prefixed with their system name — no exceptions.
- Do NOT cross-populate attributes between systems.`;

export async function extractTextFromDocument(buffer: Buffer, mimeType: string): Promise<string> {
  if (mimeType === "application/pdf") {
    const pdfParse = (await import("pdf-parse")).default;
    const data = await pdfParse(buffer);
    return data.text;
  }

  if (mimeType === "text/plain" || mimeType === "text/csv" || mimeType === "text/markdown") {
    return buffer.toString("utf-8");
  }

  throw new Error(`Unsupported file type: ${mimeType}. Supported types: PDF, TXT, CSV, Markdown.`);
}

export async function analyzeDocumentWithLLM(
  documentText: string,
  homeId: number | string
): Promise<DocumentAnalysisResponse> {
  const home = await storage.getHomeById(
    typeof homeId === "string" ? parseInt(homeId, 10) : homeId
  );

  let contextMessage = "";
  if (home) {
    contextMessage = `\n\nContext about the home this document relates to:
- Location: ${home.city || "Unknown"}, ${home.state || "Unknown"}
- Year Built: ${home.builtYear || "Unknown"}
- Square Footage: ${home.sqFt || "Unknown"} sq ft
- Type: ${home.type || "Unknown"}`;
  }

  const truncatedText = documentText.slice(0, 15000);

  logInfo("document-analysis", "Sending document to LLM for analysis", {
    homeId,
    textLength: truncatedText.length,
  });

  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      { role: "system", content: DOCUMENT_ANALYSIS_PROMPT + contextMessage },
      {
        role: "user",
        content: `Analyze this document and extract home maintenance issues:\n\n${truncatedText}`,
      },
    ],
    max_completion_tokens: 2048,
    temperature: 0.3,
    response_format: { type: "json_object" },
  });

  const rawContent = response.choices[0]?.message?.content;
  if (!rawContent) {
    throw new Error("LLM returned an empty response");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawContent);
  } catch {
    logError("document-analysis", new Error("LLM returned invalid JSON"), {
      rawContent: rawContent.slice(0, 500),
    });
    throw new Error("The AI returned a malformed response. Please try again.");
  }

  const validated = documentAnalysisResponseSchema.safeParse(parsed);
  if (!validated.success) {
    logError("document-analysis", new Error("LLM response failed schema validation"), {
      zodErrors: validated.error.flatten(),
    });
    throw new Error("The AI response did not match the expected format. Please try again.");
  }

  const namespacedIssues = enforceAttributeNamespaces(validated.data.issues);

  logInfo("document-analysis", "Document analysis complete", {
    homeId,
    issueCount: namespacedIssues.length,
  });

  return { issues: namespacedIssues };
}

export function convertIssuesToTasks(
  issues: ExtractedIssue[],
  homeId: number
): Array<{
  homeId: number;
  title: string;
  description: string | null;
  category: string | null;
  systemName: string;
  urgency: string;
  diyLevel: string;
  estimatedCost: string | null;
  safetyWarning: string | null;
  createdFrom: string;
  status: string;
  attributes: Record<string, string>;
}> {
  return issues.map((issue) => ({
    homeId,
    title: issue.title,
    description: issue.description || null,
    category: issue.category || null,
    systemName: issue.systemName || "unknown_system",
    urgency: issue.urgency || "later",
    diyLevel: issue.diyLevel || "Caution",
    estimatedCost: issue.estimatedCost || null,
    safetyWarning: issue.safetyWarning || null,
    createdFrom: "document-analysis",
    status: "pending",
    attributes: issue.attributes || {},
  }));
}

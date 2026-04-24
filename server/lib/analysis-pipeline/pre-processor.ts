import OpenAI from "openai";
import { logInfo, logError } from "../logger";
import type { PreProcessorOutput, SourceFileInfo } from "./types";

const PRE_PROCESSOR_PROMPT = `You are a technical document parser for home inspection and maintenance documents.
Your job is to extract structured signals from the document text. You are NOT a contractor — just a parser.

Be CONSERVATIVE. Only extract information that is clearly stated or strongly implied. Do not hallucinate or invent data.

You MUST respond with valid JSON only — no markdown, no explanation.

Response format:
{
  "systemsDetected": [
    { "name": "string", "category": "string (one of: Roof, HVAC, Plumbing, Electrical, Foundation, Siding, Windows, Doors, Appliances, Garage, Deck, Landscaping, Water Heater, Insulation, Solar, Drainage, Pest, Other)", "confidence": 0.0-1.0, "sourceRef": "exact quote from document" }
  ],
  "equipmentDetected": [
    { "name": "string", "systemCategory": "string", "manufacturer": "string or null", "model": "string or null", "installDate": "string or null", "sourceRef": "exact quote" }
  ],
  "issuesDetected": [
    { "description": "string", "severity": "critical|moderate|minor|informational", "systemCategory": "string", "sourceRef": "exact quote" }
  ],
  "maintenanceRecommendations": [
    { "description": "string", "systemCategory": "string", "timing": "string or null", "sourceRef": "exact quote" }
  ],
  "attributesDetected": [
    { "key": "string (e.g. material, install_date, condition, manufacturer)", "value": "string", "systemCategory": "string", "confidence": 0.0-1.0, "sourceRef": "exact quote" }
  ],
  "safetyFindings": [
    { "description": "string", "systemCategory": "string", "severity": "critical|warning|informational", "sourceRef": "exact quote" }
  ],
  "sourceReferences": [
    { "text": "relevant excerpt", "fileIndex": 0, "fileName": "string" }
  ]
}

Rules:
- Extract ONLY home-related signals. Ignore unrelated content.
- If the document is empty or contains no home-related content, return all arrays empty.
- "sourceRef" must be an actual quote or close paraphrase from the document, not invented.
- Use standard system categories consistently.
- For confidence: 1.0 = explicitly stated, 0.7-0.9 = strongly implied, 0.5-0.7 = moderately implied, <0.5 = do not include.
- Do not invent equipment, dates, or attributes not supported by the text.`;

export async function runPreProcessor(
  texts: Array<{ text: string; fileName: string; fileType: string }>,
  openaiConfig: { apiKey: string; baseURL: string }
): Promise<PreProcessorOutput> {
  const openai = new OpenAI(openaiConfig);

  // Guard on actual document content length (not the header-padded combined text)
  const totalContentLength = texts.reduce((sum, t) => sum + t.text.trim().length, 0);
  if (totalContentLength < 10) {
    return emptyOutput();
  }

  const combinedText = texts
    .map((t, i) => `--- FILE ${i + 1}: ${t.fileName} (${t.fileType}) ---\n${t.text.slice(0, 12000)}`)
    .join("\n\n");

  logInfo("pre-processor", "Running pre-processor", {
    fileCount: texts.length,
    totalLength: combinedText.length,
  });

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: PRE_PROCESSOR_PROMPT },
        { role: "user", content: `Parse the following document(s) and extract structured signals:\n\n${combinedText}` },
      ],
      max_tokens: 3000,
      temperature: 0.2,
      response_format: { type: "json_object" },
    });

    const raw = response.choices[0]?.message?.content;
    if (!raw) {
      logError("pre-processor", new Error("Empty response from LLM"));
      return emptyOutput();
    }

    const parsed = JSON.parse(raw) as PreProcessorOutput;

    return {
      systemsDetected: parsed.systemsDetected || [],
      equipmentDetected: parsed.equipmentDetected || [],
      issuesDetected: parsed.issuesDetected || [],
      maintenanceRecommendations: parsed.maintenanceRecommendations || [],
      attributesDetected: parsed.attributesDetected || [],
      safetyFindings: parsed.safetyFindings || [],
      sourceReferences: (parsed.sourceReferences || []).map((ref, i) => ({
        ...ref,
        fileIndex: ref.fileIndex ?? 0,
        fileName: ref.fileName || texts[0]?.fileName || `file-${i}`,
      })),
    };
  } catch (err) {
    logError("pre-processor", err instanceof Error ? err : new Error(String(err)));
    return emptyOutput();
  }
}

function emptyOutput(): PreProcessorOutput {
  return {
    systemsDetected: [],
    equipmentDetected: [],
    issuesDetected: [],
    maintenanceRecommendations: [],
    attributesDetected: [],
    safetyFindings: [],
    sourceReferences: [],
  };
}

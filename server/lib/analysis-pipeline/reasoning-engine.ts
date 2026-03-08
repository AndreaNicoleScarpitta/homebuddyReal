import crypto from "crypto";
import { logInfo } from "../logger";
import type {
  PreProcessorOutput,
  ProposedTask,
  ExistingSystem,
  TaskCategory,
} from "./types";

interface ReasoningPattern {
  pattern: RegExp;
  taskTitle: (match: string, systemCat: string) => string;
  taskDescription: (match: string, systemCat: string) => string;
  category: TaskCategory;
  priority: "now" | "soon" | "later" | "monitor";
  diyLevel: "DIY-Safe" | "Caution" | "Pro-Only";
  inferenceReason: string;
}

const REASONING_PATTERNS: ReasoningPattern[] = [
  {
    pattern: /near\s+end\s+of\s+(useful\s+)?life|approaching\s+end\s+of\s+life|nearing\s+replacement|aging\s+(unit|system|equipment)/i,
    taskTitle: (_, cat) => `Plan ${cat} replacement`,
    taskDescription: (match, cat) => `The ${cat} system appears to be nearing end of life based on document analysis. Begin planning for replacement, including budgeting and contractor research.`,
    category: "Replacement",
    priority: "soon",
    diyLevel: "Pro-Only",
    inferenceReason: "Equipment described as near end of life — replacement planning recommended",
  },
  {
    pattern: /monitor\s+(for\s+)?(further\s+)?(movement|crack|leak|damage|deterioration|settling)|recommend\s+monitor\b/i,
    taskTitle: (match, cat) => `Monitor ${cat} — recurring inspection`,
    taskDescription: (_, cat) => `Ongoing monitoring recommended for ${cat} system. Set up recurring check to track any progression.`,
    category: "Inspection",
    priority: "monitor",
    diyLevel: "DIY-Safe",
    inferenceReason: "Document recommends monitoring — converted to recurring inspection task",
  },
  {
    pattern: /recommend\s+(a\s+)?(licensed|certified|professional|qualified)\s+(electrician|plumber|contractor|technician|specialist|engineer)\s+(evaluation|inspection|assessment|review)|(recommend\s+)?(repair|evaluat|re.?evaluat)\w*\s+by\s+(a\s+)?(licensed|certified|professional|qualified)\s+(electrician|plumber|contractor|technician|specialist|engineer)/i,
    taskTitle: (match, cat) => `Schedule professional ${cat} evaluation`,
    taskDescription: (match, cat) => `A licensed professional evaluation was recommended for the ${cat} system. Schedule an inspection with a qualified contractor.`,
    category: "Inspection",
    priority: "soon",
    diyLevel: "Pro-Only",
    inferenceReason: "Professional evaluation explicitly recommended in document",
  },
  {
    pattern: /debris\s+(present\s+)?(in|on)\s+(gutters?|downspouts?)|gutters?\s+(contain|have|show|full\s+of)\s+debris/i,
    taskTitle: () => "Clean gutters and downspouts",
    taskDescription: () => "Debris detected in gutters. Clean gutters and downspouts to prevent water damage and ensure proper drainage.",
    category: "Maintenance",
    priority: "soon",
    diyLevel: "Caution",
    inferenceReason: "Gutter debris noted — maintenance task inferred",
  },
  {
    pattern: /shingles?\s+(are\s+)?(curling|buckling|lifting|missing|cracked|damaged|deteriorat)/i,
    taskTitle: () => "Assess roof shingle condition for repair or replacement",
    taskDescription: (match) => `Roof shingles show signs of wear (${match.toLowerCase().trim()}). Have a roofing professional assess whether repair or replacement is needed.`,
    category: "Repair",
    priority: "soon",
    diyLevel: "Pro-Only",
    inferenceReason: "Shingle damage detected — repair assessment recommended",
  },
  {
    pattern: /installed\s+in\s+(\d{4})|unit\s+installed\s+(\d{4})|(manufactured|built|installed)\s+(\d{4})/i,
    taskTitle: (_, cat) => `Review ${cat} age and service history`,
    taskDescription: (match, cat) => `The ${cat} equipment has an installation date noted in the document. Review service history and plan for lifecycle management.`,
    category: "Inspection",
    priority: "later",
    diyLevel: "DIY-Safe",
    inferenceReason: "Installation date found — lifecycle awareness task created",
  },
  {
    pattern: /recommend\s+(annual|yearly|regular|periodic|routine)\s+(inspection|service|maintenance|check)/i,
    taskTitle: (_, cat) => `Schedule ${cat} annual inspection`,
    taskDescription: (_, cat) => `Regular inspection recommended for ${cat} system per document findings. Set up annual service schedule.`,
    category: "Inspection",
    priority: "later",
    diyLevel: "DIY-Safe",
    inferenceReason: "Periodic inspection recommended in document",
  },
  {
    pattern: /(water|moisture)\s+(stain|damage|intrusion|leak|seepage|penetration)/i,
    taskTitle: (_, cat) => `Investigate water issue in ${cat}`,
    taskDescription: (_, cat) => `Evidence of water intrusion or damage detected in ${cat} system. Investigate source and extent of water issue.`,
    category: "Repair",
    priority: "soon",
    diyLevel: "Caution",
    inferenceReason: "Water/moisture intrusion evidence detected — investigation recommended",
  },
];

function normalizeCategory(raw: string): string {
  const aliases: Record<string, string> = {
    "roof": "Roof", "roofing": "Roof", "hvac": "HVAC", "plumbing": "Plumbing",
    "electrical": "Electrical", "foundation": "Foundation", "siding": "Siding",
    "windows": "Windows", "water heater": "Water Heater", "water_heater": "Water Heater",
    "solar": "Solar", "drainage": "Drainage", "pest": "Pest", "landscaping": "Landscaping",
    "appliances": "Appliances", "garage": "Garage", "deck": "Deck", "insulation": "Insulation",
    "doors": "Doors", "gutters": "Roof", "gutter": "Roof", "other": "Other",
  };
  return aliases[raw.toLowerCase().trim()] || raw;
}

export function runReasoningEngine(
  preProcessorOutput: PreProcessorOutput,
  existingTasks: ProposedTask[],
  existingSystems: ExistingSystem[]
): ProposedTask[] {
  const inferredTasks: ProposedTask[] = [];
  const existingTitles = new Set(
    existingTasks.map((t) => t.title.toLowerCase().replace(/[^a-z0-9]/g, ""))
  );

  logInfo("reasoning-engine", "Running reasoning engine", {
    issues: preProcessorOutput.issuesDetected.length,
    recommendations: preProcessorOutput.maintenanceRecommendations.length,
    safety: preProcessorOutput.safetyFindings.length,
  });

  const allTexts = [
    ...preProcessorOutput.issuesDetected.map((i) => ({
      text: i.description + " " + i.sourceRef,
      systemCategory: i.systemCategory,
      sourceRef: i.sourceRef,
    })),
    ...preProcessorOutput.maintenanceRecommendations.map((r) => ({
      text: r.description + " " + (r.timing || "") + " " + r.sourceRef,
      systemCategory: r.systemCategory,
      sourceRef: r.sourceRef,
    })),
    ...preProcessorOutput.safetyFindings.map((s) => ({
      text: s.description + " " + s.sourceRef,
      systemCategory: s.systemCategory,
      sourceRef: s.sourceRef,
    })),
  ];

  for (const item of allTexts) {
    const cat = normalizeCategory(item.systemCategory);
    for (const pattern of REASONING_PATTERNS) {
      const match = item.text.match(pattern.pattern);
      if (!match) continue;

      const title = pattern.taskTitle(match[0], cat);
      const normalizedTitle = title.toLowerCase().replace(/[^a-z0-9]/g, "");

      if (existingTitles.has(normalizedTitle)) continue;

      const matchedSystem = existingSystems.find(
        (s) => s.category.toLowerCase() === cat.toLowerCase()
      );

      const task: ProposedTask = {
        id: crypto.randomUUID(),
        title,
        description: pattern.taskDescription(match[0], cat),
        systemId: matchedSystem?.id,
        category: pattern.category,
        priority: pattern.priority,
        urgency: pattern.priority,
        diyLevel: pattern.diyLevel,
        sourceRef: item.sourceRef,
        isInferred: true,
        inferenceReason: pattern.inferenceReason,
      };

      existingTitles.add(normalizedTitle);
      inferredTasks.push(task);
    }
  }

  return inferredTasks;
}

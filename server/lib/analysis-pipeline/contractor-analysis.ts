import crypto from "crypto";
import { logInfo } from "../logger";
import { systemNameToPrefix, generateInstancePrefix } from "../attribute-namespace";
import type {
  ContractorAnalysisInput,
  ContractorAnalysisOutput,
  ExistingSystem,
  ProposedTask,
  MatchedSystemUpdate,
  SuggestedSystem,
  TaskCategory,
} from "./types";

const CATEGORY_ALIASES: Record<string, string> = {
  "roof": "Roof",
  "roofing": "Roof",
  "roof covering": "Roof",
  "roof structure": "Roof",
  "chimney": "Roof",
  "flashing": "Roof",
  "gutters": "Roof",
  "gutter": "Roof",
  "downspout": "Roof",
  "downspouts": "Roof",
  "hvac": "HVAC",
  "heating": "HVAC",
  "cooling": "HVAC",
  "air conditioning": "HVAC",
  "air conditioner": "HVAC",
  "ac": "HVAC",
  "a/c": "HVAC",
  "furnace": "HVAC",
  "heat pump": "HVAC",
  "boiler": "HVAC",
  "ductwork": "HVAC",
  "ducts": "HVAC",
  "thermostat": "HVAC",
  "mini split": "HVAC",
  "plumbing": "Plumbing",
  "pipes": "Plumbing",
  "piping": "Plumbing",
  "water supply": "Plumbing",
  "water distribution": "Plumbing",
  "drain": "Plumbing",
  "drains": "Plumbing",
  "waste": "Plumbing",
  "sewer": "Plumbing",
  "septic": "Plumbing",
  "faucet": "Plumbing",
  "fixture": "Plumbing",
  "toilet": "Plumbing",
  "electrical": "Electrical",
  "wiring": "Electrical",
  "electric": "Electrical",
  "panel": "Electrical",
  "breaker": "Electrical",
  "circuit": "Electrical",
  "receptacle": "Electrical",
  "outlet": "Electrical",
  "switch": "Electrical",
  "gfci": "Electrical",
  "afci": "Electrical",
  "foundation": "Foundation",
  "basement": "Foundation",
  "crawl space": "Foundation",
  "crawlspace": "Foundation",
  "slab": "Foundation",
  "structural": "Foundation",
  "structure": "Foundation",
  "footing": "Foundation",
  "siding": "Siding",
  "exterior": "Siding",
  "siding/exterior": "Siding",
  "stucco": "Siding",
  "brick": "Siding",
  "masonry": "Siding",
  "cladding": "Siding",
  "trim": "Siding",
  "fascia": "Siding",
  "soffit": "Siding",
  "eaves": "Siding",
  "windows": "Windows",
  "window": "Windows",
  "glazing": "Windows",
  "doors": "Doors",
  "door": "Doors",
  "entry": "Doors",
  "appliances": "Appliances",
  "appliance": "Appliances",
  "kitchen": "Appliances",
  "range": "Appliances",
  "oven": "Appliances",
  "dishwasher": "Appliances",
  "refrigerator": "Appliances",
  "microwave": "Appliances",
  "disposal": "Appliances",
  "garage": "Garage",
  "garage door": "Garage",
  "carport": "Garage",
  "deck": "Deck",
  "patio": "Deck",
  "porch": "Deck",
  "balcony": "Deck",
  "pergola": "Deck",
  "landscaping": "Landscaping",
  "grading": "Landscaping",
  "yard": "Landscaping",
  "lot": "Landscaping",
  "water heater": "Water Heater",
  "water_heater": "Water Heater",
  "hot water": "Water Heater",
  "hot water heater": "Water Heater",
  "tankless": "Water Heater",
  "insulation": "Insulation",
  "attic": "Insulation",
  "ventilation": "Insulation",
  "vapor barrier": "Insulation",
  "solar": "Solar",
  "solar panel": "Solar",
  "photovoltaic": "Solar",
  "drainage": "Drainage",
  "grading/drainage": "Drainage",
  "sump": "Drainage",
  "sump pump": "Drainage",
  "french drain": "Drainage",
  "pest": "Pest",
  "termite": "Pest",
  "insect": "Pest",
  "rodent": "Pest",
  "wildlife": "Pest",
  "pool": "Pool",
  "swimming pool": "Pool",
  "spa": "Pool",
  "hot tub": "Pool",
  "fireplace": "Other",
  "chimney flue": "Other",
  "intercom": "Other",
  "security": "Other",
  "smoke detector": "Other",
  "co detector": "Other",
  "other": "Other",
};

function normalizeCategory(raw: string): string {
  const lower = raw.toLowerCase().trim();
  return CATEGORY_ALIASES[lower] || raw;
}

function matchSystem(
  category: string,
  existingSystems: ExistingSystem[]
): ExistingSystem | null {
  const normalized = normalizeCategory(category);
  const normalizedLower = normalized.toLowerCase();

  const exact = existingSystems.find(
    (s) => s.category.toLowerCase() === normalizedLower
  );
  if (exact) return exact;

  const nameMatch = existingSystems.find(
    (s) => s.name.toLowerCase().includes(normalizedLower) ||
           normalizedLower.includes(s.name.toLowerCase())
  );
  if (nameMatch) return nameMatch;

  const prefixMatch = existingSystems.find((s) => {
    const sPrefix = systemNameToPrefix(s.category);
    const iPrefix = systemNameToPrefix(normalized);
    return sPrefix === iPrefix;
  });
  return prefixMatch || null;
}

function classifyTaskCategory(description: string, issue?: { severity?: string }): TaskCategory {
  const lower = description.toLowerCase();

  if (/replac|end of life|swap out|beyond\s+(useful|repair)|needs?\s+new|install\s+new|obsolete|no\s+longer\s+(function|service)|past\s+(its|their)\s+life/.test(lower)) return "Replacement";
  if (/repair|fix|patch|seal|caulk|tighten|correct|restor|resolv|address|mend|remedy|re.?attach|re.?secur|re.?fasten|damaged|broken|crack|leak|rot|deteriorat|defective|deficien|fail|malfunction|not\s+(function|work|operat)|faulty/.test(lower)) return "Repair";
  if (/inspect|check|evaluat|assess|monitor|review|examin|investigat|determin|test|verify|survey|analyz|diagnos|identify|consult|profession|licensed|certif|qualified|re.?evaluat|further\s+(review|analysis|investigation)/.test(lower)) return "Inspection";
  if (/improv|enhanc|add|install\s+new|upgrad|moderniz|retrofit|update|expand|extend|increase|optimize|boost/.test(lower)) return "Improvement";
  if (/clean|maintain|service|flush|filter|lubricate|tune|adjust|drain|clear|wash|vacuum|debris|trim|prune|paint|stain|treat|preserve|protect|prevent|routine|regular|annual|seasonal|grease|oil/.test(lower)) return "Maintenance";
  if (issue?.severity === "critical") return "Repair";
  if (issue?.severity === "moderate") return "Repair";

  return "Maintenance";
}

function assignPriority(
  severity?: string,
  timing?: string,
  description?: string
): "now" | "soon" | "later" | "monitor" {
  if (severity === "critical") return "now";
  if (description) {
    const dl = description.toLowerCase();
    if (/immediate|urgent|asap|safety\s+hazard|fire\s+hazard|dangerous|shock|carbon\s+monoxide|gas\s+leak|active\s+leak/.test(dl)) return "now";
  }
  if (severity === "moderate") return "soon";
  if (timing) {
    const lower = timing.toLowerCase();
    if (/immediate|urgent|asap|right\s+away|as\s+soon/.test(lower)) return "now";
    if (/soon|within.*month|next.*month|short\s+term|near\s+term|promptly|timely/.test(lower)) return "soon";
    if (/monitor|watch|observe|keep.*eye|track|ongoing|periodic/.test(lower)) return "monitor";
    if (/long\s+term|eventual|when\s+(budget|convenient|possible)|plan\s+for|future/.test(lower)) return "later";
  }
  if (severity === "minor") return "later";
  if (severity === "informational") return "later";
  return "later";
}

function assignDiyLevel(
  description: string,
  safetyLevel?: string
): "DIY-Safe" | "Caution" | "Pro-Only" {
  const lower = description.toLowerCase();
  if (/licensed|professional|electrician|plumber|structural|gas\s+(line|leak|valve|meter)|asbestos|mold|panel|breaker|wire\s*(?:ing)?|circuit|hvac\s+tech|roofer|mason|engineer|septic|well\s+pump|foundation|load.?bearing|permit\s+required|code\s+(violation|compliance|update)|polybutylene|knob.?and.?tube|federal\s+pacific|refrigerant/.test(lower)) {
    return "Pro-Only";
  }
  if (/caution|careful|risk|height|ladder|chemical|roof\s+(access|work)|attic|crawl\s*space|elevated|overhead|power\s+tool|heavy|confined\s+space|corrosive|toxic|pressure|steam|hot\s+water|electrical\s+(work|repair)/.test(lower)) {
    return "Caution";
  }
  if (safetyLevel === "critical" || safetyLevel === "warning") {
    return "Pro-Only";
  }
  return "DIY-Safe";
}

function isDuplicateTask(
  proposed: { title: string; systemId?: string },
  existingTasks: Array<{ title: string; systemId?: string }>
): boolean {
  const pTitle = proposed.title.toLowerCase().replace(/[^a-z0-9]/g, "");
  return existingTasks.some((t) => {
    if (proposed.systemId && t.systemId && proposed.systemId !== t.systemId) return false;
    const eTitle = t.title.toLowerCase().replace(/[^a-z0-9]/g, "");
    if (pTitle === eTitle) return true;
    const shorter = pTitle.length < eTitle.length ? pTitle : eTitle;
    const longer = pTitle.length >= eTitle.length ? pTitle : eTitle;
    return longer.includes(shorter) && shorter.length > 8;
  });
}

export function runContractorAnalysis(input: ContractorAnalysisInput): ContractorAnalysisOutput {
  const { preProcessorOutput: pp, existingSystems, existingTasks, homeId } = input;
  const matchedSystemUpdates: MatchedSystemUpdate[] = [];
  const matchedSystemTasks: ProposedTask[] = [];
  const suggestedSystemsMap = new Map<string, SuggestedSystem>();
  const warnings: string[] = [];
  const allProposedTitles: Array<{ title: string; systemId?: string }> = [];

  logInfo("contractor-analysis", "Running contractor analysis", {
    systems: pp.systemsDetected.length,
    issues: pp.issuesDetected.length,
    recommendations: pp.maintenanceRecommendations.length,
  });

  for (const attr of pp.attributesDetected) {
    const matched = matchSystem(attr.systemCategory, existingSystems);
    if (matched) {
      const existing = matchedSystemUpdates.find((u) => u.systemId === matched.id);
      const nsPrefix = generateInstancePrefix(matched.category, matched.name, matched.id);
      const scopedKey = `${nsPrefix}_${attr.key.replace(/\s+/g, "_").toLowerCase()}`;
      if (existing) {
        existing.attributes[scopedKey] = attr.value;
      } else {
        matchedSystemUpdates.push({
          systemId: matched.id,
          systemName: matched.name,
          systemCategory: matched.category,
          attributes: { [scopedKey]: attr.value },
          sourceRef: attr.sourceRef,
        });
      }
    } else {
      const cat = normalizeCategory(attr.systemCategory);
      const key = cat.toLowerCase();
      if (!suggestedSystemsMap.has(key)) {
        suggestedSystemsMap.set(key, {
          id: crypto.randomUUID(),
          name: cat,
          category: cat,
          reason: `Detected ${cat} attributes in uploaded file`,
          status: "pending",
          sourceRef: attr.sourceRef,
          pendingAttributes: {},
          pendingTasks: [],
        });
      }
      const suggestion = suggestedSystemsMap.get(key)!;
      suggestion.pendingAttributes[`${systemNameToPrefix(cat)}_${attr.key.replace(/\s+/g, "_").toLowerCase()}`] = attr.value;
    }
  }

  for (const issue of pp.issuesDetected) {
    const matched = matchSystem(issue.systemCategory, existingSystems);
    const priority = assignPriority(issue.severity, undefined, issue.description);
    const taskCategory = classifyTaskCategory(issue.description, issue);
    const diyLevel = assignDiyLevel(issue.description);
    const title = issue.description.length > 80
      ? issue.description.slice(0, 77) + "..."
      : issue.description;

    const safety = pp.safetyFindings.find(
      (sf) => normalizeCategory(sf.systemCategory) === normalizeCategory(issue.systemCategory)
    );

    const task: ProposedTask = {
      id: crypto.randomUUID(),
      title,
      description: issue.description,
      category: taskCategory,
      priority,
      urgency: priority,
      diyLevel,
      estimatedCost: undefined,
      safetyWarning: safety?.description,
      sourceRef: issue.sourceRef,
      isInferred: false,
    };

    if (matched) {
      task.systemId = matched.id;
      if (!isDuplicateTask({ title: task.title, systemId: matched.id }, [...existingTasks, ...allProposedTitles])) {
        matchedSystemTasks.push(task);
        allProposedTitles.push({ title: task.title, systemId: matched.id });
      }
    } else {
      const cat = normalizeCategory(issue.systemCategory);
      const key = cat.toLowerCase();
      if (!suggestedSystemsMap.has(key)) {
        suggestedSystemsMap.set(key, {
          id: crypto.randomUUID(),
          name: cat,
          category: cat,
          reason: `Issues detected for ${cat} system in uploaded file`,
          status: "pending",
          sourceRef: issue.sourceRef,
          pendingAttributes: {},
          pendingTasks: [],
        });
      }
      const suggestion = suggestedSystemsMap.get(key)!;
      task.suggestionId = suggestion.id;
      if (!isDuplicateTask({ title: task.title }, allProposedTitles)) {
        suggestion.pendingTasks.push(task);
        allProposedTitles.push({ title: task.title });
      }
    }
  }

  for (const rec of pp.maintenanceRecommendations) {
    const matched = matchSystem(rec.systemCategory, existingSystems);
    const taskCategory = classifyTaskCategory(rec.description);
    const priority = assignPriority(undefined, rec.timing, rec.description);
    const diyLevel = assignDiyLevel(rec.description);
    const title = rec.description.length > 80
      ? rec.description.slice(0, 77) + "..."
      : rec.description;

    const task: ProposedTask = {
      id: crypto.randomUUID(),
      title,
      description: rec.description,
      category: taskCategory,
      priority,
      urgency: priority,
      diyLevel,
      timing: rec.timing || undefined,
      sourceRef: rec.sourceRef,
      isInferred: false,
    };

    if (matched) {
      task.systemId = matched.id;
      if (!isDuplicateTask({ title: task.title, systemId: matched.id }, [...existingTasks, ...allProposedTitles])) {
        matchedSystemTasks.push(task);
        allProposedTitles.push({ title: task.title, systemId: matched.id });
      }
    } else {
      const cat = normalizeCategory(rec.systemCategory);
      const key = cat.toLowerCase();
      if (!suggestedSystemsMap.has(key)) {
        suggestedSystemsMap.set(key, {
          id: crypto.randomUUID(),
          name: cat,
          category: cat,
          reason: `Maintenance recommendations for ${cat} system`,
          status: "pending",
          sourceRef: rec.sourceRef,
          pendingAttributes: {},
          pendingTasks: [],
        });
      }
      const suggestion = suggestedSystemsMap.get(key)!;
      task.suggestionId = suggestion.id;
      if (!isDuplicateTask({ title: task.title }, allProposedTitles)) {
        suggestion.pendingTasks.push(task);
        allProposedTitles.push({ title: task.title });
      }
    }
  }

  return {
    matchedSystemUpdates,
    matchedSystemTasks,
    suggestedSystems: Array.from(suggestedSystemsMap.values()),
    warnings,
  };
}

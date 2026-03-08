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
    pattern: /end\s+of\s+(useful\s+)?life|approaching\s+(end|replacement)|nearing\s+(end|replacement)|aging\s+(unit|system|equipment|appliance)|past\s+(its|their)\s+(useful|expected)\s+life|beyond\s+(useful|expected|service)\s+life|exceed\w*\s+(useful|expected|service)\s+life|lifespan\s+(exceed|expir)|due\s+for\s+replacement|replace\s+(soon|within)|should\s+be\s+replaced|needs?\s+(to\s+be\s+)?replaced?\s+(soon|in\s+the\s+near)|overdue\s+for\s+replacement|obsolete|no\s+longer\s+(functional|serviceable|repairable)|worn\s+(out|beyond)|at\s+capacity/i,
    taskTitle: (_, cat) => `Plan ${cat} replacement`,
    taskDescription: (match, cat) => `The ${cat} system appears to be nearing end of life based on document analysis. Begin planning for replacement, including budgeting and contractor research.`,
    category: "Replacement",
    priority: "soon",
    diyLevel: "Pro-Only",
    inferenceReason: "Equipment described as near end of life — replacement planning recommended",
  },
  {
    pattern: /(recommend|should|advise|suggest|need\s+to|continue\s+to|important\s+to)\s+monitor\b|monitor\s+(for|the|this|any|further|closely|ongoing|condition|movement|crack|leak|damage|deteriorat|settl|progress)|keep\s+(an?\s+)?eye\s+on|watch\s+(for|closely)|observe\s+(for|over\s+time)|track\s+(progress|movement|condition)|periodic(ally)?\s+(check|review|observe)|re.?check\s+(in|after|within|the)|re.?inspect|follow.?\s*up\s+(inspection|check|visit)|revisit\s+(in|after|within)|check\s+(again|back|periodically)|continue\s+to\s+(watch|observe|check)|ongoing\s+(monitoring|observation)/i,
    taskTitle: (match, cat) => `Monitor ${cat} — recurring inspection`,
    taskDescription: (_, cat) => `Ongoing monitoring recommended for ${cat} system. Set up recurring check to track any progression.`,
    category: "Inspection",
    priority: "monitor",
    diyLevel: "DIY-Safe",
    inferenceReason: "Document recommends monitoring — converted to recurring inspection task",
  },
  {
    pattern: /(recommend|should|advise|suggest|need|require|contact|consult|hire|engage|schedule|call)\s+\w*\s*(licensed|certified|professional|qualified|registered)\s+(electrician|plumber|contractor|technician|specialist|engineer|roofer|mason|hvac)|(recommend|should|advise|suggest|need|require|contact|consult|hire|engage|schedule|call)\s+(a\s+)?(licensed|certified|professional|qualified|registered)\s+(electrician|plumber|contractor|technician|specialist|engineer|roofer|mason|hvac|professional)|(repair|evaluat|re.?evaluat|inspect|assess|review|correct|address|service|fix)\w*\s+by\s+(a\s+)?(licensed|certified|professional|qualified|registered)\s+(electrician|plumber|contractor|technician|specialist|engineer|roofer|mason|professional)|qualified\s+professional\s+(should|to|for|is\s+recommend)|professional\s+(evaluation|assessment|inspection)\s+(is\s+)?(recommend|need|require|suggest|advise)/i,
    taskTitle: (match, cat) => `Schedule professional ${cat} evaluation`,
    taskDescription: (match, cat) => `A licensed professional evaluation was recommended for the ${cat} system. Schedule an inspection with a qualified contractor.`,
    category: "Inspection",
    priority: "soon",
    diyLevel: "Pro-Only",
    inferenceReason: "Professional evaluation explicitly recommended in document",
  },
  {
    pattern: /debris\s+(present\s+)?(in|on|at|along|inside)\s+(the\s+)?(gutters?|downspouts?)|gutters?\s+(contain|have|show|full\s+of|clogged|blocked|need\s+clean)|clogged\s+(gutters?|downspouts?|drains?)|clean\s+(the\s+)?gutters?|gutters?\s+(need|require)\s+(clean|service|attention)|blocked\s+(gutters?|downspouts?|drain)/i,
    taskTitle: () => "Clean gutters and downspouts",
    taskDescription: () => "Debris or blockage detected in gutters/downspouts. Clean gutters and downspouts to prevent water damage and ensure proper drainage.",
    category: "Maintenance",
    priority: "soon",
    diyLevel: "Caution",
    inferenceReason: "Gutter debris/blockage noted — maintenance task inferred",
  },
  {
    pattern: /shingles?\s+(are\s+)?(curling|buckling|lifting|missing|cracked|damaged|deteriorat|worn|aging|loose|broken|split|blistering|granule\s+loss)|roof\s+(shingles?|tiles?|material)\s+(show|exhibit|display|have|need|require)|damaged\s+shingles?|missing\s+shingles?|worn\s+shingles?|granule\s+loss|exposed\s+(felt|underlayment)/i,
    taskTitle: () => "Assess roof shingle condition for repair or replacement",
    taskDescription: (match) => `Roof shingles show signs of wear (${match.toLowerCase().trim()}). Have a roofing professional assess whether repair or replacement is needed.`,
    category: "Repair",
    priority: "soon",
    diyLevel: "Pro-Only",
    inferenceReason: "Shingle damage detected — repair assessment recommended",
  },
  {
    pattern: /install(ed|ation)?\s+(in|date|year|circa|around|approx)?\s*\d{4}|(manufactured|built|constructed|placed\s+in\s+service)\s+(in\s+)?\d{4}|\d{4}\s+(install|manufactur|build|model\s+year)|year\s+(of\s+)?(install|manufactur|construct)|\d{2,4}\s+years?\s+old|age[d:]\s*\d{2,4}/i,
    taskTitle: (_, cat) => `Review ${cat} age and service history`,
    taskDescription: (match, cat) => `The ${cat} equipment has an installation date noted in the document. Review service history and plan for lifecycle management.`,
    category: "Inspection",
    priority: "later",
    diyLevel: "DIY-Safe",
    inferenceReason: "Installation date found — lifecycle awareness task created",
  },
  {
    pattern: /(annual|yearly|regular|periodic|routine|seasonal|semi.?annual|quarterly|bi.?annual)\s+(inspection|service|maintenance|check|tune.?\s*up|servic|clean)|(inspection|service|maintenance|check|tune.?\s*up)\s+(annual|yearly|regular|periodic|routine|seasonal|required|recommended|needed|suggested)|(should|needs?\s+to|must|ought\s+to)\s+be\s+(serviced|inspected|checked|maintained)\s+(annual|regular|period|routine|every)|schedule\s+(regular|annual|routine|periodic)\s+(service|maintenance|check|inspection)|regular\s+(professional\s+)?(service|maintenance|inspection|check)/i,
    taskTitle: (_, cat) => `Schedule ${cat} annual inspection`,
    taskDescription: (_, cat) => `Regular inspection recommended for ${cat} system per document findings. Set up annual service schedule.`,
    category: "Inspection",
    priority: "later",
    diyLevel: "DIY-Safe",
    inferenceReason: "Periodic inspection recommended in document",
  },
  {
    pattern: /(water|moisture)\s+(stain|damage|intrusion|leak|seepage|penetration|mark|spot|discoloration|evidence|sign)|(stain|discoloration|mark|spot|ring|residue)\s+(from|caused\s+by|due\s+to|indicating|suggest)\s*(water|moisture|leak|condensat)|evidence\s+of\s+(water|moisture|leak|condensat|past\s+leak)|signs?\s+of\s+(water|moisture|leak|prior\s+leak)|water\s+(entry|infiltrat|penetrat|ingress)|active\s+leak|drip\s+(stain|mark|evidence)|plumbing\s+leak|leaking\s+(pipe|faucet|valve|fixture|toilet|supply)|wet\s+(spot|area|surface|stain)/i,
    taskTitle: (_, cat) => `Investigate water issue in ${cat}`,
    taskDescription: (_, cat) => `Evidence of water intrusion or damage detected in ${cat} system. Investigate source and extent of water issue.`,
    category: "Repair",
    priority: "soon",
    diyLevel: "Caution",
    inferenceReason: "Water/moisture intrusion evidence detected — investigation recommended",
  },
  {
    pattern: /code\s+(violation|deficiency|issue|non.?compliance|update\s+needed)|not\s+(up\s+to|to|meet)\s+(current\s+)?(code|standard)|does\s+not\s+(comply|conform|meet)\s+(with\s+)?(code|standard)|violat\w+\s+(of\s+)?(current|local|national|building|electrical|plumbing|fire)\s+(code|standard|requirement)|non.?compliant\s+(with\s+)?code|not\s+in\s+compliance\s+with|not\s+(properly\s+)?(grounded|bonded)|improper(ly)?\s+(wired|grounded|bonded|vented)|ungrounded\s+(receptacle|outlet|wire|circuit)|double\s+tap(ped)?(\s+breaker)?|missing\s+(gfci|afci|arc.?fault|ground)\s+(protection|circuit|outlet|receptacle)?|no\s+(gfci|afci)\s+protection|reverse\s+polarity|open\s+(ground|neutral|hot)/i,
    taskTitle: (_, cat) => `Correct ${cat} code deficiency`,
    taskDescription: (_, cat) => `A code violation or deficiency was found in the ${cat} system. Have a licensed professional correct the issue to meet current safety standards.`,
    category: "Repair",
    priority: "soon",
    diyLevel: "Pro-Only",
    inferenceReason: "Code violation or deficiency detected — correction recommended",
  },
  {
    pattern: /safety\s+(hazard|concern|risk|issue|violation|deficiency)|fire\s+(hazard|risk|concern|danger)|trip\s+(hazard|risk|danger)|fall\s+(hazard|risk)|shock\s+(hazard|risk)|carbon\s+monoxide|gas\s+leak|electrical\s+hazard|health\s+(hazard|risk|concern)|asbestos|lead\s+(paint|pipe|based)|radon|mold\s+(present|found|detected|visible|growth)/i,
    taskTitle: (_, cat) => `Address safety concern in ${cat}`,
    taskDescription: (_, cat) => `A safety hazard or health concern was identified in the ${cat} system. This requires prompt attention to protect occupants.`,
    category: "Repair",
    priority: "now",
    diyLevel: "Pro-Only",
    inferenceReason: "Safety hazard identified — immediate attention recommended",
  },
  {
    pattern: /crack\w*\s+(in|on|at|along)\s+(the\s+)?(foundation|basement|slab|footing|wall|block|concrete|masonry|brick|stucco|mortar)|foundation\s+(crack|settle|shift|heav|movement|issue)|settl\w+\s+\w*\s*(in|of|on|at|along|near|noted)\s+\w*\s*(foundation|slab|floor|concrete|driveway|walk|patio|garage|basement)|structural\s+(crack|damage|issue|concern|movement|deficiency)|uneven\s+(floor|surface|settle|foundation)|heaving|step\s+crack|horizontal\s+crack|diagonal\s+crack/i,
    taskTitle: (_, cat) => `Evaluate ${cat} structural concern`,
    taskDescription: (_, cat) => `Cracking, settling, or structural movement detected in ${cat}. Have a structural professional evaluate the severity and recommend repairs if needed.`,
    category: "Inspection",
    priority: "soon",
    diyLevel: "Pro-Only",
    inferenceReason: "Structural concern detected — professional evaluation recommended",
  },
  {
    pattern: /negative\s+grad(e|ing)|improp\w+\s+grad(e|ing)|grad(e|ing)\s+(slopes?|directs?|channel)\s+(toward|to|into|against)\s+(the\s+)?(house|home|building|foundation|structure)|poor\s+(drainage|grading)|drainage\s+(issue|problem|concern|needed|required|improve)|water\s+(pools?|collects?|stands?|accumulate)\s+(near|at|against|around|by)\s+(the\s+)?(foundation|house|home)|water\s+directed?\s+(toward|to|at)\s+(the\s+)?(foundation|house)/i,
    taskTitle: (_, cat) => `Correct grading and drainage around ${cat}`,
    taskDescription: (_, cat) => `Improper grading or drainage detected that could direct water toward the foundation. Correct grading to maintain positive slope away from the structure.`,
    category: "Repair",
    priority: "soon",
    diyLevel: "Caution",
    inferenceReason: "Drainage or grading issue detected — correction recommended",
  },
  {
    pattern: /wood\s+(rot|decay|damage|deteriorat)|rot\w+\s+(wood|trim|fascia|soffit|siding|deck|rail|post|beam|joist|sill|frame)|fungal\s+(damage|growth|decay)|decay\w*\s+(present|found|detected|visible|noted)|deteriorat\w+\s+(wood|trim|fascia|soffit|siding|deck)/i,
    taskTitle: (_, cat) => `Repair wood damage in ${cat}`,
    taskDescription: (_, cat) => `Wood rot or decay has been detected in the ${cat} system. Have a qualified professional assess the extent of damage and perform necessary repairs.`,
    category: "Repair",
    priority: "soon",
    diyLevel: "Caution",
    inferenceReason: "Wood rot or decay detected — repair recommended",
  },
  {
    pattern: /caulk\w*\s+(needed|missing|deteriorat|crack|fail|gap|dried|worn|broken|replace|apply|renew|aging|old)|seal\w*\s+(needed|missing|deteriorat|crack|fail|dried|worn|broken|replace|renew)|need\w*\s+(caulk|seal|re.?caulk|re.?seal)|gap\s+(in|at|around|between)\s+(the\s+)?(caulk|seal|joint|trim|window|door|flashing)/i,
    taskTitle: (_, cat) => `Re-caulk and seal gaps in ${cat}`,
    taskDescription: (_, cat) => `Caulking or sealant is deteriorated, missing, or needs replacement in the ${cat} system. Re-caulk to prevent water intrusion and air leaks.`,
    category: "Maintenance",
    priority: "later",
    diyLevel: "DIY-Safe",
    inferenceReason: "Caulking or sealing maintenance needed",
  },
  {
    pattern: /failed\s+(seal|window\s+seal|thermal\s+seal|igu)|seal\s+(failure|failed|broken|compromised)|fogg(y|ed|ing)\s+(window|glass|pane|igu)|condensat\w+\s+(between|inside|within)\s+(the\s+)?(panes?|glass|glazing)|broken\s+(seal|window\s+seal|thermal\s+seal)|double.?pane\s+(seal\s+)?fail/i,
    taskTitle: () => "Replace windows with failed seals",
    taskDescription: () => "Window thermal seal failure detected. Foggy or condensation between panes indicates seal failure. Replace affected window units to restore insulation value.",
    category: "Replacement",
    priority: "later",
    diyLevel: "Pro-Only",
    inferenceReason: "Window seal failure detected — replacement recommended",
  },
  {
    pattern: /vent\w*\s+(into|to|in)\s+(the\s+)?(attic|crawl\s*space|soffit|garage|living\s+space)|not\s+(properly\s+)?(vented?|exhaust|terminat)|improper\w*\s+(vent|exhaust|terminat)|vent\w*\s+(not\s+)?(connected|attached|terminat)\s+(to\s+the\s+)?(exterior|outside)|exhaust\s+(into|to)\s+(the\s+)?(attic|crawl)/i,
    taskTitle: (_, cat) => `Correct improper venting in ${cat}`,
    taskDescription: (_, cat) => `Improper venting detected in ${cat} — exhaust may be venting into attic or unconditioned space instead of to exterior. Have a professional correct the venting to prevent moisture buildup and potential mold growth.`,
    category: "Repair",
    priority: "soon",
    diyLevel: "Pro-Only",
    inferenceReason: "Improper venting detected — correction recommended",
  },
  {
    pattern: /rust\w*\s+(on|at|present|visible|noted|detected|found|stain)|corros\w+\s+(on|at|present|visible|noted|detected|found)|oxidiz|galvanic\s+(corros|reaction)|dissimilar\s+metal|rust\s+(through|hole|spot|pit)|corroded\s+(pipe|fitting|valve|connector|terminal|wire|panel|flue)/i,
    taskTitle: (_, cat) => `Address corrosion in ${cat}`,
    taskDescription: (_, cat) => `Rust or corrosion detected in the ${cat} system. Inspect extent of corrosion and repair or replace affected components before further deterioration.`,
    category: "Repair",
    priority: "soon",
    diyLevel: "Caution",
    inferenceReason: "Corrosion or rust detected — repair recommended",
  },
  {
    pattern: /insulation\s+(missing|inadequate|insufficient|thin|damaged|compressed|moved|displaced|absent|lacking|below|needs)|lack\s+(of\s+)?insulation|insufficient\s+insulation|no\s+insulation|add\s+(more\s+)?insulation|insulate|under.?insulated|r.?value\s+(low|below|insufficient|inadequate)/i,
    taskTitle: (_, cat) => `Improve insulation in ${cat}`,
    taskDescription: (_, cat) => `Insulation was found to be missing, inadequate, or damaged in the ${cat} area. Improve insulation to increase energy efficiency and prevent moisture issues.`,
    category: "Improvement",
    priority: "later",
    diyLevel: "Caution",
    inferenceReason: "Insulation deficiency detected — improvement recommended",
  },
  {
    pattern: /polybutylene|poly.?b\b|pb\s+pipe|quest\s+pipe|kitec|orangeburg|galvaniz\w+\s+(pipe|plumbing|supply|drain)|knob.?\s*(and|&|n)\s*tube|aluminum\s+wir(e|ing)|federal\s+pacific|fpe\s+panel|zinsco|bulldog\s+pushmatic|recalled/i,
    taskTitle: (_, cat) => `Evaluate known-risk material in ${cat}`,
    taskDescription: (_, cat) => `A material or component with known reliability or safety concerns was identified in the ${cat} system. Consult a licensed professional to evaluate current condition and plan for replacement.`,
    category: "Inspection",
    priority: "soon",
    diyLevel: "Pro-Only",
    inferenceReason: "Known-risk material identified — professional evaluation recommended",
  },
];

function normalizeCategory(raw: string): string {
  const aliases: Record<string, string> = {
    "roof": "Roof", "roofing": "Roof", "hvac": "HVAC", "heating": "HVAC",
    "cooling": "HVAC", "air conditioning": "HVAC", "furnace": "HVAC",
    "plumbing": "Plumbing", "electrical": "Electrical", "wiring": "Electrical",
    "foundation": "Foundation", "structural": "Foundation", "structure": "Foundation",
    "siding": "Siding", "exterior": "Siding", "windows": "Windows",
    "water heater": "Water Heater", "water_heater": "Water Heater",
    "solar": "Solar", "drainage": "Drainage", "pest": "Pest",
    "landscaping": "Landscaping", "appliances": "Appliances", "garage": "Garage",
    "deck": "Deck", "insulation": "Insulation", "attic": "Insulation",
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

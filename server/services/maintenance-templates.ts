/**
 * Maintenance Templates — Deterministic best-practice tasks per system category.
 * When a system exists, it ALWAYS has recurring maintenance tasks.
 * The only question is urgency and timeline.
 */

export interface MaintenanceTemplate {
  title: string;
  description: string;
  cadence: "monthly" | "quarterly" | "biannual" | "annual" | "biennial" | "5-year";
  urgency: "now" | "soon" | "later" | "monitor";
  diyLevel: "DIY-Safe" | "Caution" | "Pro-Only";
  estimatedCost: string;
  safetyWarning: string | null;
  monthsUntilDue: number; // from system creation or last service
}

// ---------------------------------------------------------------------------
// Templates by system category
// ---------------------------------------------------------------------------

const TEMPLATES: Record<string, MaintenanceTemplate[]> = {
  "Roof": [
    { title: "Visual roof inspection", description: "Check for missing, cracked, or curling shingles. Look for debris in gutters and around vents.", cadence: "biannual", urgency: "later", diyLevel: "DIY-Safe", estimatedCost: "$0", safetyWarning: "Use binoculars from the ground if possible. Avoid walking on the roof.", monthsUntilDue: 6 },
    { title: "Clean gutters and downspouts", description: "Remove leaves and debris from gutters. Flush downspouts to check for clogs.", cadence: "biannual", urgency: "soon", diyLevel: "Caution", estimatedCost: "$0-150", safetyWarning: "Use a stable ladder. Never lean to reach — reposition instead.", monthsUntilDue: 3 },
    { title: "Professional roof inspection", description: "Have a roofer inspect flashing, seals, and overall condition. Especially important after storms.", cadence: "biennial", urgency: "later", diyLevel: "Pro-Only", estimatedCost: "$200-400", safetyWarning: null, monthsUntilDue: 24 },
    { title: "Check attic for leaks or moisture", description: "Look for water stains, mold, or daylight coming through the roof deck.", cadence: "annual", urgency: "later", diyLevel: "DIY-Safe", estimatedCost: "$0", safetyWarning: null, monthsUntilDue: 12 },
  ],
  "HVAC": [
    { title: "Replace air filter", description: "Swap out the HVAC air filter. A clogged filter reduces efficiency and air quality.", cadence: "quarterly", urgency: "now", diyLevel: "DIY-Safe", estimatedCost: "$15-30", safetyWarning: null, monthsUntilDue: 1 },
    { title: "Professional HVAC tune-up", description: "Annual service: refrigerant check, coil cleaning, electrical connections, thermostat calibration.", cadence: "annual", urgency: "soon", diyLevel: "Pro-Only", estimatedCost: "$100-200", safetyWarning: null, monthsUntilDue: 6 },
    { title: "Clean outdoor condenser unit", description: "Remove debris from around the outdoor unit. Gently hose off the fins.", cadence: "annual", urgency: "later", diyLevel: "DIY-Safe", estimatedCost: "$0", safetyWarning: "Turn off power to the unit before cleaning.", monthsUntilDue: 9 },
    { title: "Check and clean vents and registers", description: "Vacuum dust from supply and return vents throughout the house.", cadence: "biannual", urgency: "later", diyLevel: "DIY-Safe", estimatedCost: "$0", safetyWarning: null, monthsUntilDue: 6 },
  ],
  "Plumbing": [
    { title: "Check for leaks under sinks", description: "Look under kitchen and bathroom sinks for drips, corrosion, or water damage.", cadence: "quarterly", urgency: "later", diyLevel: "DIY-Safe", estimatedCost: "$0", safetyWarning: null, monthsUntilDue: 3 },
    { title: "Test water pressure", description: "Attach a pressure gauge to an outdoor spigot. Normal range is 40-60 PSI.", cadence: "annual", urgency: "later", diyLevel: "DIY-Safe", estimatedCost: "$0-15", safetyWarning: null, monthsUntilDue: 12 },
    { title: "Flush water heater (if tank type)", description: "Drain sediment from the bottom of the tank to maintain efficiency and extend life.", cadence: "annual", urgency: "soon", diyLevel: "Caution", estimatedCost: "$0", safetyWarning: "Water will be hot. Use caution when opening the drain valve.", monthsUntilDue: 12 },
    { title: "Inspect toilet seals and flappers", description: "Check for running toilets or slow leaks around the base. Replace worn flappers.", cadence: "annual", urgency: "later", diyLevel: "DIY-Safe", estimatedCost: "$5-15", safetyWarning: null, monthsUntilDue: 12 },
  ],
  "Electrical": [
    { title: "Test GFCI outlets", description: "Press the test button on GFCI outlets in kitchens, bathrooms, and outdoor areas. They should trip and reset.", cadence: "quarterly", urgency: "soon", diyLevel: "DIY-Safe", estimatedCost: "$0", safetyWarning: null, monthsUntilDue: 3 },
    { title: "Test smoke and CO detectors", description: "Press the test button on each detector. Replace batteries annually.", cadence: "biannual", urgency: "now", diyLevel: "DIY-Safe", estimatedCost: "$10-30", safetyWarning: null, monthsUntilDue: 1 },
    { title: "Check panel for tripped breakers", description: "Open the panel door and verify all breakers are in the correct position. Note any that trip repeatedly.", cadence: "annual", urgency: "later", diyLevel: "DIY-Safe", estimatedCost: "$0", safetyWarning: "Do not touch wiring inside the panel.", monthsUntilDue: 12 },
  ],
  "Water Heater": [
    { title: "Test TPR valve", description: "Lift the temperature-pressure relief valve lever briefly and let it snap back. You should hear water flow.", cadence: "annual", urgency: "soon", diyLevel: "Caution", estimatedCost: "$0", safetyWarning: "Water will be hot. Keep hands clear of the discharge pipe.", monthsUntilDue: 6 },
    { title: "Check anode rod", description: "Inspect or replace the sacrificial anode rod. This prevents tank corrosion and extends life significantly.", cadence: "biennial", urgency: "later", diyLevel: "Caution", estimatedCost: "$25-50", safetyWarning: null, monthsUntilDue: 24 },
    { title: "Flush tank to remove sediment", description: "Drain a few gallons from the tank bottom to clear sediment buildup.", cadence: "annual", urgency: "soon", diyLevel: "Caution", estimatedCost: "$0", safetyWarning: "Water will be hot. Connect a hose to a safe drain location.", monthsUntilDue: 12 },
  ],
  "Windows": [
    { title: "Inspect window seals and weatherstripping", description: "Check for drafts, condensation between panes, or deteriorated weatherstripping.", cadence: "annual", urgency: "later", diyLevel: "DIY-Safe", estimatedCost: "$0-20", safetyWarning: null, monthsUntilDue: 12 },
    { title: "Clean window tracks and hardware", description: "Vacuum tracks, lubricate hardware, and check that locks operate smoothly.", cadence: "annual", urgency: "later", diyLevel: "DIY-Safe", estimatedCost: "$0", safetyWarning: null, monthsUntilDue: 12 },
  ],
  "Foundation": [
    { title: "Inspect foundation for cracks", description: "Walk the perimeter and check for new cracks, settling, or water intrusion in the basement.", cadence: "annual", urgency: "later", diyLevel: "DIY-Safe", estimatedCost: "$0", safetyWarning: null, monthsUntilDue: 12 },
    { title: "Check grading and drainage", description: "Ensure ground slopes away from the foundation. Look for pooling water after rain.", cadence: "annual", urgency: "later", diyLevel: "DIY-Safe", estimatedCost: "$0", safetyWarning: null, monthsUntilDue: 12 },
  ],
  "Siding/Exterior": [
    { title: "Inspect siding for damage", description: "Walk the perimeter looking for cracks, warping, rot, or pest damage.", cadence: "annual", urgency: "later", diyLevel: "DIY-Safe", estimatedCost: "$0", safetyWarning: null, monthsUntilDue: 12 },
    { title: "Power wash exterior", description: "Clean dirt, mildew, and stains from siding. Use appropriate pressure for your siding type.", cadence: "annual", urgency: "later", diyLevel: "Caution", estimatedCost: "$0-100", safetyWarning: "Too much pressure can damage siding. Start low.", monthsUntilDue: 12 },
  ],
  "Appliances": [
    { title: "Clean refrigerator coils", description: "Pull the fridge out and vacuum the condenser coils on the back or bottom.", cadence: "annual", urgency: "later", diyLevel: "DIY-Safe", estimatedCost: "$0", safetyWarning: null, monthsUntilDue: 12 },
    { title: "Clean dishwasher filter and spray arms", description: "Remove and rinse the filter. Check spray arms for clogs.", cadence: "quarterly", urgency: "later", diyLevel: "DIY-Safe", estimatedCost: "$0", safetyWarning: null, monthsUntilDue: 3 },
    { title: "Clean dryer vent", description: "Disconnect and clean the full length of the dryer vent duct. Lint buildup is a fire hazard.", cadence: "annual", urgency: "soon", diyLevel: "DIY-Safe", estimatedCost: "$0-30", safetyWarning: "Lint buildup is a leading cause of house fires.", monthsUntilDue: 6 },
  ],
  "Chimney": [
    { title: "Chimney inspection and sweep", description: "Have a certified chimney sweep inspect and clean the flue before heating season.", cadence: "annual", urgency: "soon", diyLevel: "Pro-Only", estimatedCost: "$150-300", safetyWarning: null, monthsUntilDue: 9 },
  ],
  "Landscaping": [
    { title: "Seasonal yard cleanup", description: "Rake leaves, trim overgrown branches near the house, and clear debris from foundation areas.", cadence: "biannual", urgency: "later", diyLevel: "DIY-Safe", estimatedCost: "$0-50", safetyWarning: null, monthsUntilDue: 3 },
    { title: "Check irrigation system", description: "Test sprinkler zones, check for leaks, and adjust heads for coverage.", cadence: "annual", urgency: "later", diyLevel: "DIY-Safe", estimatedCost: "$0", safetyWarning: null, monthsUntilDue: 6 },
  ],
  "Paint": [
    { title: "Touch up exterior paint", description: "Check for peeling, cracking, or fading paint. Touch up problem areas before they spread.", cadence: "annual", urgency: "later", diyLevel: "DIY-Safe", estimatedCost: "$20-100", safetyWarning: null, monthsUntilDue: 12 },
  ],
  "Pest": [
    { title: "Perimeter pest inspection", description: "Check for signs of pests: droppings, gnaw marks, nests, or entry points around the foundation.", cadence: "quarterly", urgency: "later", diyLevel: "DIY-Safe", estimatedCost: "$0", safetyWarning: null, monthsUntilDue: 3 },
  ],
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function getTemplatesForCategory(category: string): MaintenanceTemplate[] {
  return TEMPLATES[category] || [];
}

/**
 * Generate task records ready for database insertion.
 * Computes due dates from the current date + template monthsUntilDue.
 */
export function generateTasksForSystem(
  homeId: number,
  systemId: number,
  category: string,
  systemName: string
): Array<{
  homeId: number;
  relatedSystemId: number;
  title: string;
  description: string;
  category: string;
  urgency: string;
  diyLevel: string;
  estimatedCost: string;
  safetyWarning: string | null;
  isRecurring: boolean;
  recurrenceCadence: string;
  createdFrom: string;
  dueDate: Date;
}> {
  const templates = getTemplatesForCategory(category);
  const now = new Date();

  return templates.map(t => {
    const dueDate = new Date(now);
    dueDate.setMonth(dueDate.getMonth() + t.monthsUntilDue);

    return {
      homeId,
      relatedSystemId: systemId,
      title: t.title,
      description: t.description,
      category,
      urgency: t.urgency,
      diyLevel: t.diyLevel,
      estimatedCost: t.estimatedCost,
      safetyWarning: t.safetyWarning,
      isRecurring: true,
      recurrenceCadence: t.cadence === "biennial" || t.cadence === "5-year" ? "annual" : t.cadence,
      createdFrom: "best-practice",
      dueDate,
    };
  });
}

export const ALL_CATEGORIES = Object.keys(TEMPLATES);

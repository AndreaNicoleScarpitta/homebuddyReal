import { db, pool } from "./db";
import { sql } from "drizzle-orm";
import { homes, systems, components, warranties, permits, repairs, replacements, recommendations, timelineEvents, maintenanceTasks } from "../shared/schema";
import { generateTasksForSystem } from "./services/maintenance-templates";
import { eq } from "drizzle-orm";

async function seed() {
  console.log("Seeding Home Graph demo data...");

  // Find or create test user's home
  const existingHomes = await db.select().from(homes).where(eq(homes.userId, "test-user-001"));

  let homeId: number;
  if (existingHomes.length > 0) {
    homeId = existingHomes[0].id;
    console.log(`Using existing home ${homeId}`);
  } else {
    const [home] = await db.insert(homes).values({
      userId: "test-user-001",
      address: "123 Oak Street, Portland, OR 97201",
      streetAddress: "123 Oak Street",
      city: "Portland",
      state: "OR",
      zipCode: "97201",
      builtYear: 2005,
      sqFt: 2400,
      beds: 4,
      baths: 3,
      type: "Colonial",
      exteriorType: "Fiber Cement",
      roofType: "Asphalt Shingle",
      healthScore: 82,
    }).returning();
    homeId = home.id;
    console.log(`Created home ${homeId}`);
  }

  // Ensure projection_home row exists for V2 API compatibility
  const homeData = (await db.select().from(homes).where(eq(homes.id, homeId)))[0];
  const attrs = {
    address: homeData.address,
    streetAddress: homeData.streetAddress,
    city: homeData.city,
    state: homeData.state,
    zipCode: homeData.zipCode,
    builtYear: homeData.builtYear,
    sqFt: homeData.sqFt,
    beds: homeData.beds,
    baths: homeData.baths,
    type: homeData.type,
    exteriorType: homeData.exteriorType,
    roofType: homeData.roofType,
    healthScore: homeData.healthScore,
  };
  const homeUuid = crypto.randomUUID();
  await db.execute(sql`
    INSERT INTO projection_home (home_id, user_id, legacy_id, attrs, last_event_seq, updated_at)
    VALUES (${homeUuid}, ${"test-user-001"}, ${homeId}, ${JSON.stringify(attrs)}::jsonb, 0, now())
    ON CONFLICT (home_id) DO UPDATE
    SET attrs = ${JSON.stringify(attrs)}::jsonb, legacy_id = ${homeId}, updated_at = now()
  `);
  // Also try upsert by user_id in case projection already exists
  await db.execute(sql`
    UPDATE projection_home SET legacy_id = ${homeId}, attrs = ${JSON.stringify(attrs)}::jsonb, updated_at = now()
    WHERE user_id = ${"test-user-001"}
  `);
  // Retrieve the actual home_id UUID from projection_home
  const projHomeRows = await db.execute(sql`SELECT home_id FROM projection_home WHERE user_id = ${"test-user-001"} LIMIT 1`);
  const projHomeId = (projHomeRows.rows[0] as any)?.home_id || homeUuid;
  console.log(`Ensured projection_home row (UUID: ${projHomeId})`);

  // Clear existing graph data for this home
  await db.delete(timelineEvents).where(eq(timelineEvents.homeId, homeId));
  await db.delete(recommendations).where(eq(recommendations.homeId, homeId));
  await db.delete(replacements).where(eq(replacements.homeId, homeId));
  await db.delete(repairs).where(eq(repairs.homeId, homeId));
  await db.delete(permits).where(eq(permits.homeId, homeId));
  await db.delete(warranties).where(eq(warranties.homeId, homeId));
  await db.delete(components).where(eq(components.homeId, homeId));

  // Delete existing systems and their projections for clean seed
  await db.execute(sql`DELETE FROM projection_system WHERE home_id = ${projHomeId}`);
  await db.delete(systems).where(eq(systems.homeId, homeId));

  // Helper: insert system into legacy table + projection_system
  async function createSystemWithProjection(data: any) {
    const [sys] = await db.insert(systems).values(data).returning();
    const sysUuid = crypto.randomUUID();
    const sysAttrs = { name: sys.name, category: sys.category, make: sys.make, model: sys.model, installYear: sys.installYear, condition: sys.condition, material: sys.material, energyRating: sys.energyRating, notes: sys.notes, legacyId: sys.id };
    await db.execute(sql`
      INSERT INTO projection_system (system_id, home_id, system_type, attrs, last_event_seq, updated_at)
      VALUES (${sysUuid}, ${projHomeId}, ${sys.category}, ${JSON.stringify(sysAttrs)}::jsonb, 0, now())
    `);
    return sys;
  }

  // Create systems
  const roof = await createSystemWithProjection({ homeId, name: "Roof", category: "Roof", make: "GAF", model: "Timberline HDZ", installYear: 2018, condition: "Good", material: "Asphalt Shingle" });
  const hvac = await createSystemWithProjection({ homeId, name: "HVAC System", category: "HVAC", make: "Carrier", model: "Infinity 24ANB1", installYear: 2020, condition: "Great", energyRating: "SEER 21" });
  const plumbing = await createSystemWithProjection({ homeId, name: "Plumbing", category: "Plumbing", installYear: 2005, condition: "Good", material: "Copper + PEX", notes: "Partial replumb in 2019 - kitchen and both bathrooms" });
  const electrical = await createSystemWithProjection({ homeId, name: "Electrical Panel", category: "Electrical", installYear: 2010, condition: "Good", notes: "200A panel upgrade in 2010" });
  const waterHeater = await createSystemWithProjection({ homeId, name: "Water Heater", category: "Water Heater", make: "Rheem", model: "ProTerra", installYear: 2021, condition: "Great", energyRating: "Hybrid Heat Pump" });
  const windows = await createSystemWithProjection({ homeId, name: "Windows", category: "Windows", make: "Andersen", model: "400 Series", installYear: 2018, condition: "Good", material: "Wood/Vinyl" });

  console.log("Created 6 systems");

  // Auto-generate best-practice maintenance tasks for each system
  await db.delete(maintenanceTasks).where(eq(maintenanceTasks.homeId, homeId));
  const allSystems = [roof, hvac, plumbing, electrical, waterHeater, windows];
  let totalTasks = 0;
  for (const sys of allSystems) {
    const tasks = generateTasksForSystem(homeId, sys.id, sys.category || "Other", sys.name);
    if (tasks.length > 0) {
      await db.insert(maintenanceTasks).values(tasks);
      totalTasks += tasks.length;
    }
  }
  console.log(`Created ${totalTasks} maintenance tasks from templates`);

  // Create components (note: components table does not have make/model columns)
  await db.insert(components).values([
    { homeId, systemId: roof.id, name: "Shingles", componentType: "roofing", material: "Asphalt", installYear: 2018, condition: "Good" },
    { homeId, systemId: roof.id, name: "Flashing", componentType: "roofing", material: "Aluminum", installYear: 2018, condition: "Good" },
    { homeId, systemId: roof.id, name: "Gutters", componentType: "drainage", material: "Aluminum", installYear: 2018, condition: "Fair", notes: "Minor denting on south side from 2022 hailstorm" },
    { homeId, systemId: roof.id, name: "Ridge Vent", componentType: "ventilation", installYear: 2018, condition: "Good" },
    { homeId, systemId: hvac.id, name: "Furnace", componentType: "heating", installYear: 2020, condition: "Great" },
    { homeId, systemId: hvac.id, name: "AC Condenser", componentType: "cooling", installYear: 2020, condition: "Great" },
    { homeId, systemId: hvac.id, name: "Thermostat", componentType: "controls", installYear: 2020, condition: "Great", notes: "Ecobee SmartThermostat Premium" },
    { homeId, systemId: hvac.id, name: "Ductwork", componentType: "distribution", material: "Sheet Metal + Flex", installYear: 2005, condition: "Good" },
    { homeId, systemId: waterHeater.id, name: "Tank", componentType: "storage", material: "Glass-lined Steel", installYear: 2021, condition: "Great" },
    { homeId, systemId: waterHeater.id, name: "Anode Rod", componentType: "sacrificial", material: "Magnesium", installYear: 2024, condition: "Great", notes: "Replaced Jan 2024" },
    { homeId, systemId: waterHeater.id, name: "Expansion Tank", componentType: "pressure", installYear: 2021, condition: "Good" },
    { homeId, systemId: waterHeater.id, name: "TPR Valve", componentType: "safety", installYear: 2021, condition: "Good" },
  ]);
  console.log("Created 12 components");

  // Create warranties
  await db.insert(warranties).values([
    { homeId, systemId: roof.id, warrantyProvider: "GAF", warrantyType: "manufacturer", coverageSummary: "25-year limited lifetime warranty covering manufacturing defects in shingles", startDate: new Date("2018-06-15"), expiryDate: new Date("2043-06-15"), isTransferable: true },
    { homeId, systemId: hvac.id, warrantyProvider: "Carrier", warrantyType: "manufacturer", coverageSummary: "10-year parts warranty on compressor and major components", startDate: new Date("2020-03-20"), expiryDate: new Date("2030-03-20"), isTransferable: false },
    { homeId, systemId: waterHeater.id, warrantyProvider: "Rheem", warrantyType: "manufacturer", coverageSummary: "6-year tank and parts warranty", startDate: new Date("2021-09-10"), expiryDate: new Date("2027-09-10"), isTransferable: false },
    { homeId, systemId: windows.id, warrantyProvider: "Andersen", warrantyType: "manufacturer", coverageSummary: "Limited lifetime warranty on glass and non-glass parts", startDate: new Date("2018-06-15"), expiryDate: new Date("2068-06-15"), isTransferable: true },
  ]);
  console.log("Created 4 warranties");

  // Create permits
  await db.insert(permits).values([
    { homeId, systemId: roof.id, permitNumber: "BLD-2018-04521", permitType: "roofing", issuedDate: new Date("2018-05-20"), status: "closed", issuingAuthority: "City of Portland", description: "Complete roof tear-off and replacement" },
    { homeId, systemId: electrical.id, permitNumber: "ELE-2010-08833", permitType: "electrical", issuedDate: new Date("2010-02-15"), status: "closed", issuingAuthority: "City of Portland", description: "Electrical panel upgrade from 100A to 200A" },
  ]);
  console.log("Created 2 permits");

  // Create repairs
  await db.insert(repairs).values([
    { homeId, systemId: roof.id, title: "Gutter repair after hailstorm", description: "Repaired dented sections on south-facing gutters and replaced two downspout brackets", repairDate: new Date("2022-08-15"), cost: 35000, outcome: "resolved" },
    { homeId, systemId: hvac.id, title: "AC capacitor replacement", description: "Run capacitor failed causing AC to not start. Replaced with OEM part.", repairDate: new Date("2023-06-22"), cost: 28000, outcome: "resolved" },
    { homeId, systemId: waterHeater.id, title: "Anode rod replacement", description: "Preventive maintenance - replaced corroded magnesium anode rod", repairDate: new Date("2024-01-10"), cost: 15000, outcome: "resolved" },
    { homeId, systemId: plumbing.id, title: "Kitchen faucet cartridge repair", description: "Replaced worn cartridge in Moen kitchen faucet to fix drip", repairDate: new Date("2023-11-05"), cost: 12500, outcome: "resolved" },
  ]);
  console.log("Created 4 repairs");

  // Create replacements
  await db.insert(replacements).values([
    { homeId, systemId: waterHeater.id, replacedSystemName: "AO Smith ProMax", replacedMake: "AO Smith", replacedModel: "ProMax 50-gallon", replacementDate: new Date("2021-09-10"), cost: 280000, reason: "Original 2005 tank water heater reached end of useful life. Upgraded to hybrid heat pump for energy savings." },
    { homeId, systemId: roof.id, replacedSystemName: "Original Asphalt Shingles", replacedMake: "Unknown", replacementDate: new Date("2018-06-15"), cost: 1250000, reason: "Original roof showing significant wear at 13 years. Multiple soft spots and missing shingles after winter storms." },
  ]);
  console.log("Created 2 replacements");

  // Create recommendations
  await db.insert(recommendations).values([
    { homeId, systemId: roof.id, source: "ai", title: "Schedule professional roof inspection", description: "Your roof is 7 years into a 25-year warranty. A mid-life inspection can catch issues while they're still covered.", urgency: "soon", confidence: 75, rationale: "GAF recommends professional inspection every 5-7 years to maintain warranty validity", estimatedCost: "$200-400", status: "open" },
    { homeId, systemId: hvac.id, source: "best-practice", title: "Replace HVAC air filter", description: "HVAC filters should be replaced every 1-3 months depending on usage and air quality.", urgency: "now", confidence: 95, rationale: "Standard maintenance interval for forced-air HVAC systems", estimatedCost: "$15-30", status: "open" },
    { homeId, systemId: electrical.id, source: "inspector", title: "Label all electrical panel breakers", description: "Several breakers in the panel are unlabeled or have faded labels.", urgency: "later", confidence: 90, rationale: "NEC requires accurate labeling of all circuit breakers for safety", estimatedCost: "$0 (DIY)", status: "open" },
  ]);
  console.log("Created 3 recommendations");

  // Create timeline events
  await db.insert(timelineEvents).values([
    { homeId, eventDate: new Date("2005-07-01"), category: "milestone", title: "Home built", description: "Original construction completed - 2,400 sqft Colonial", icon: "home" },
    { homeId, eventDate: new Date("2010-02-15"), category: "replacement", title: "Electrical panel upgraded", description: "Upgraded from 100A to 200A service panel", icon: "zap", entityType: "system", entityId: electrical.id, cost: 0 },
    { homeId, eventDate: new Date("2018-06-15"), category: "replacement", title: "Complete roof replacement", description: "Tear-off and replacement with GAF Timberline HDZ shingles", icon: "hard-hat", entityType: "system", entityId: roof.id, cost: 1250000 },
    { homeId, eventDate: new Date("2018-06-15"), category: "permit", title: "Roofing permit issued", description: "BLD-2018-04521 - Complete roof tear-off and replacement", icon: "file-check", entityType: "permit" },
    { homeId, eventDate: new Date("2018-06-15"), category: "warranty", title: "GAF 25-year warranty activated", description: "Manufacturer warranty on Timberline HDZ shingles through 2043", icon: "shield" },
    { homeId, eventDate: new Date("2018-06-20"), category: "purchase", title: "New windows installed", description: "Andersen 400 Series throughout - 14 windows replaced", icon: "square", entityType: "system", entityId: windows.id },
    { homeId, eventDate: new Date("2019-04-10"), category: "repair", title: "Partial replumb", description: "Kitchen and both bathrooms replumbed with PEX", icon: "droplets", entityType: "system", entityId: plumbing.id },
    { homeId, eventDate: new Date("2020-03-20"), category: "purchase", title: "New HVAC system installed", description: "Carrier Infinity 24ANB1 with Ecobee thermostat", icon: "thermometer", entityType: "system", entityId: hvac.id },
    { homeId, eventDate: new Date("2021-09-10"), category: "replacement", title: "Water heater replaced", description: "Replaced 2005 AO Smith with Rheem ProTerra hybrid heat pump", icon: "flame", entityType: "system", entityId: waterHeater.id, cost: 280000 },
    { homeId, eventDate: new Date("2022-08-15"), category: "repair", title: "Gutter repair after hailstorm", description: "Repaired dented sections on south-facing gutters", icon: "cloud-rain", entityType: "system", entityId: roof.id, cost: 35000 },
    { homeId, eventDate: new Date("2023-06-22"), category: "repair", title: "AC capacitor replacement", description: "Run capacitor replaced - AC back to normal operation", icon: "wrench", entityType: "system", entityId: hvac.id, cost: 28000 },
    { homeId, eventDate: new Date("2023-11-05"), category: "repair", title: "Kitchen faucet cartridge repair", description: "Replaced worn Moen cartridge", icon: "wrench", entityType: "system", entityId: plumbing.id, cost: 12500 },
    { homeId, eventDate: new Date("2024-01-10"), category: "maintenance", title: "Water heater anode rod replaced", description: "Preventive maintenance - replaced corroded magnesium anode rod", icon: "check-circle", entityType: "system", entityId: waterHeater.id, cost: 15000 },
  ]);
  console.log("Created 13 timeline events");

  // Seed user actions
  await db.execute(sql`DELETE FROM user_actions WHERE home_id = ${homeId}`);
  await db.execute(sql`DELETE FROM outcome_events WHERE home_id = ${homeId}`);
  await db.execute(sql`DELETE FROM learning_adjustments WHERE home_id = ${homeId}`);

  await db.execute(sql`
    INSERT INTO user_actions (home_id, system_id, action_type, action_date, cost_actual, notes) VALUES
    (${homeId}, ${hvac.id}, 'completed_task', '2024-01-15', 15000, 'Replaced HVAC filter and cleaned coils'),
    (${homeId}, ${waterHeater.id}, 'completed_task', '2024-01-10', 15000, 'Replaced anode rod as recommended'),
    (${homeId}, ${roof.id}, 'deferred', '2023-09-01', null, 'Will schedule roof inspection next spring'),
    (${homeId}, ${hvac.id}, 'hired_contractor', '2023-06-22', 28000, 'Called HVAC tech for AC capacitor issue'),
    (${homeId}, ${plumbing.id}, 'manual_fix', '2023-11-05', 12500, 'Fixed kitchen faucet myself')
  `);
  console.log("Created 5 user actions");

  await db.execute(sql`
    INSERT INTO outcome_events (home_id, system_id, outcome_type, severity, cost_impact, description, occurred_at) VALUES
    (${homeId}, ${hvac.id}, 'avoided_issue', 'medium', 0, 'Regular filter changes prevented airflow issues', '2024-03-15'),
    (${homeId}, ${waterHeater.id}, 'improved', 'low', 0, 'Anode rod replacement extended tank life', '2024-06-01'),
    (${homeId}, ${roof.id}, 'no_change', 'low', 0, 'Roof condition stable through winter', '2024-04-01'),
    (${homeId}, ${hvac.id}, 'avoided_issue', 'high', 0, 'AC repair in June prevented full system failure in summer heat', '2023-08-15')
  `);
  console.log("Created 4 outcome events");

  console.log("\nHome Graph seed complete!");
  console.log(`Home ID: ${homeId}`);
  console.log("Login as test/password123 to see the data.");

  await pool.end();
  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});

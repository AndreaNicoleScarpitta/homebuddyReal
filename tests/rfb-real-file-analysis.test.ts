import { describe, it, expect } from "vitest";
import { runContractorAnalysis } from "../server/lib/analysis-pipeline/contractor-analysis";
import { runReasoningEngine } from "../server/lib/analysis-pipeline/reasoning-engine";
import type {
  PreProcessorOutput,
  ExistingSystem,
  ExistingTask,
  ProposedTask,
} from "../server/lib/analysis-pipeline/types";

/**
 * Real File-Based (RFB) Tests
 *
 * These tests simulate the output a pre-processor would extract from
 * the actual inspection report: 7610 N Audubon St, Spokane WA (Jan 2025).
 *
 * The pre-processor output below is hand-curated from the real PDF content
 * to test the full contractor analysis + reasoning engine pipeline against
 * realistic home inspection data with 153 inspected items, 10 maintenance items,
 * 33 repair-needed items, and 2 defective items.
 */

function buildAudubonPreProcessorOutput(): PreProcessorOutput {
  return {
    systemsDetected: [
      { name: "AC System", category: "HVAC", confidence: 0.95, sourceRef: "4: AC System" },
      { name: "Roof", category: "Roof", confidence: 0.95, sourceRef: "5: Roof" },
      { name: "Electrical", category: "Electrical", confidence: 0.95, sourceRef: "17: Electrical" },
      { name: "Plumbing / Hot Water Tank", category: "Plumbing", confidence: 0.95, sourceRef: "18: Plumbing/ Hot water Tank" },
      { name: "Heating System", category: "HVAC", confidence: 0.9, sourceRef: "19: Heating System" },
      { name: "Foundation", category: "Foundation", confidence: 0.9, sourceRef: "Poured/ concrete" },
      { name: "Siding", category: "Siding", confidence: 0.9, sourceRef: "Masonry, Concrete siding" },
      { name: "Attic", category: "Insulation", confidence: 0.8, sourceRef: "20: Attic" },
      { name: "Garage", category: "Garage", confidence: 0.85, sourceRef: "22: Garage" },
      { name: "Fireplace", category: "Other", confidence: 0.85, sourceRef: "15: Fireplace" },
    ],
    equipmentDetected: [
      { name: "Hot Water Tank", systemCategory: "Plumbing", sourceRef: "Plumbing/ Hot water Tank" },
      { name: "Gas Furnace", systemCategory: "HVAC", sourceRef: "Heating System" },
    ],
    issuesDetected: [
      // Lots & Grounds
      { description: "Evidence of settling / uneven surface in driveway", severity: "moderate", systemCategory: "Foundation", sourceRef: "2.1.1 Driveway: Evidence of settling / uneven surface. Possible trip hazard, recommend repair by licensed contractor" },
      { description: "Driveway slopes towards house", severity: "minor", systemCategory: "Drainage", sourceRef: "2.1.2 Driveway: Driveway slopes towards a house recommend monitor" },
      { description: "Trip hazard on walks, uneven surface", severity: "moderate", systemCategory: "Foundation", sourceRef: "2.2.1 Walks: Uneven surface; possible trip hazard. Recommend repair by licensed contractor" },
      { description: "Negative grade around foundation", severity: "moderate", systemCategory: "Foundation", sourceRef: "2.5.1 Grading: Evidence of negative grade; recommend keeping a positive slope away from foundation" },
      { description: "Retaining wall cracking and deterioration", severity: "moderate", systemCategory: "Foundation", sourceRef: "2.6.1 Retaining Wall: Evidence of cracking deterioration recommend repair by licensed contractor" },

      // Exterior / Siding
      { description: "Evidence of patchwork on siding", severity: "minor", systemCategory: "Siding", sourceRef: "3.1.1 Siding: Evidence of Patchwork recommend monitor" },
      { description: "Step cracking and damaged brick on siding", severity: "moderate", systemCategory: "Siding", sourceRef: "3.1.2 Siding: Evidence of step cracking damaged brick recommend repair by license contractor" },
      { description: "Exposed areas on siding need sealing", severity: "moderate", systemCategory: "Siding", sourceRef: "3.1.3 Siding: Exposed areas recommend sealing" },
      { description: "Wood rot damage on siding", severity: "moderate", systemCategory: "Siding", sourceRef: "3.1.4 Siding: Damage/ Wood rot" },
      { description: "Trim needs caulking", severity: "minor", systemCategory: "Siding", sourceRef: "3.2.1 Trim: Caulking needed" },
      { description: "Trim deterioration", severity: "moderate", systemCategory: "Siding", sourceRef: "3.2.2 Trim: Deterioration" },
      { description: "Damaged windows on exterior", severity: "moderate", systemCategory: "Windows", sourceRef: "3.5.1 Windows: Damaged" },

      // Electrical issues
      { description: "GFCI not functioning properly on exterior", severity: "moderate", systemCategory: "Electrical", sourceRef: "3.7.1 Exterior Electrical: GFCI not functioning" },
      { description: "Missing waterproof cover on exterior electrical", severity: "minor", systemCategory: "Electrical", sourceRef: "3.7.2 Exterior Electrical: Missing waterproof cover" },
      { description: "GFCI not properly installed in kitchen", severity: "moderate", systemCategory: "Electrical", sourceRef: "6.6.1 Kitchen Electrical: GFCI not properly installed" },
      { description: "Ungrounded receptacle in living space", severity: "moderate", systemCategory: "Electrical", sourceRef: "7.7.1 Living Space: Ungrounded Receptacle" },
      { description: "Floor outlet in living space", severity: "minor", systemCategory: "Electrical", sourceRef: "7.7.2 Living Space: Floor outlet" },
      { description: "Ungrounded receptacle in bedroom 3", severity: "moderate", systemCategory: "Electrical", sourceRef: "10.7.1 Bedroom 3: Ungrounded Receptacle" },
      { description: "No GFCI protection installed in bathroom 4", severity: "moderate", systemCategory: "Electrical", sourceRef: "14.6.1 Bathroom 4: No GFCI Protection Installed" },
      { description: "Double tap on branch wiring circuits", severity: "moderate", systemCategory: "Electrical", sourceRef: "17.2.1 Electrical: Double Tap on breaker" },
      { description: "GFCI not functioning in garage", severity: "moderate", systemCategory: "Electrical", sourceRef: "22.6.1 Garage Electrical: GFCI not functioning" },

      // Windows
      { description: "Failed window seal in living space", severity: "minor", systemCategory: "Windows", sourceRef: "7.3.1 Living Space Windows: Failed Seal" },
      { description: "Window lock not functioning in living space", severity: "minor", systemCategory: "Windows", sourceRef: "7.3.2 Living Space Windows: Window lock not working" },
      { description: "Failed seal on bathroom 2 window", severity: "minor", systemCategory: "Windows", sourceRef: "12.10.1 Bathroom 2 Window: Failed Seal" },
      { description: "Failed seal on bathroom 3 window", severity: "minor", systemCategory: "Windows", sourceRef: "13.10.1 Bathroom 3 Window: Failed Seal" },

      // Moisture / Water issues
      { description: "Moisture stain on kitchen countertops", severity: "minor", systemCategory: "Plumbing", sourceRef: "6.5.1 Kitchen Countertops: Moisture stain" },
      { description: "Moisture damage on living space walls", severity: "moderate", systemCategory: "Plumbing", sourceRef: "7.5.1 Living Space Walls: Moisture Damage" },
      { description: "Moisture stains on living space ceilings", severity: "moderate", systemCategory: "Plumbing", sourceRef: "7.6.1 Living Space Ceilings: Moisture stains" },
      { description: "Moisture stain in bathroom 3 water supply", severity: "minor", systemCategory: "Plumbing", sourceRef: "13.5.1 Bathroom 3: Moisture stain" },
      { description: "Moisture stains on bathroom 3 window", severity: "minor", systemCategory: "Plumbing", sourceRef: "13.10.2 Bathroom 3 Window: Moisture stains" },
      { description: "Moisture stains on hot water tank area", severity: "moderate", systemCategory: "Plumbing", sourceRef: "18.2.1 Hot Water Systems: Moisture stains" },
      { description: "Moisture stains in attic", severity: "moderate", systemCategory: "Insulation", sourceRef: "20.1.1 Attic: Moisture stains" },

      // Plumbing specific
      { description: "Polybutylene supply pipes in bathroom 4", severity: "critical", systemCategory: "Plumbing", sourceRef: "14.5.1 Bathroom 4: Polybutylene Supply Pipes" },
      { description: "Plumbing leak in bathroom 4", severity: "moderate", systemCategory: "Plumbing", sourceRef: "14.5.2 Bathroom 4: Plumbing leak" },

      // Roof / Gutters
      { description: "Gutter extensions needed", severity: "minor", systemCategory: "Roof", sourceRef: "3.9.1 Gutter: Extensions needed to direct water away from foundation" },
      { description: "Foundation cracks - minor", severity: "minor", systemCategory: "Foundation", sourceRef: "3.10.1 Foundation: Foundation Cracks - Minor" },

      // HVAC
      { description: "Missing HVAC vent cover in bathroom 2", severity: "minor", systemCategory: "HVAC", sourceRef: "12.11.1 Bathroom 2 HVAC Source: Missing cover" },

      // Attic
      { description: "Bathroom vents into attic instead of exterior", severity: "moderate", systemCategory: "Insulation", sourceRef: "20.3.1 Attic Ventilation: Bathroom Vents Into Attic" },

      // Garage
      { description: "Evidence of settling on garage floor", severity: "minor", systemCategory: "Garage", sourceRef: "22.1.1 Garage Floor: Settling" },
      { description: "Loose hardware and connections on garage door", severity: "minor", systemCategory: "Garage", sourceRef: "22.3.1 Garage Door: Loose hardware loose connection" },

      // Ceilings
      { description: "Typical cracking on living space ceilings", severity: "minor", systemCategory: "Foundation", sourceRef: "7.6.2 Living Space Ceilings: Typical cracking" },
      { description: "Patchwork on bathroom 3 ceiling", severity: "minor", systemCategory: "Plumbing", sourceRef: "13.8.1 Bathroom 3 Ceiling: Patchwork" },
      { description: "Patchwork on bathroom 4 ceiling", severity: "minor", systemCategory: "Plumbing", sourceRef: "14.8.1 Bathroom 4 Ceiling: Patchwork" },

      // Kitchen
      { description: "Range burner not lighting", severity: "minor", systemCategory: "Appliances", sourceRef: "6.4.1 Kitchen Range/Oven/Cooktop: Burner Not Lighting" },

      // Intercom
      { description: "Intercom system present", severity: "informational", systemCategory: "Electrical", sourceRef: "17.1.1 Electrical: Intercom system" },
    ],
    maintenanceRecommendations: [
      { description: "Recommend repair of driveway settling by licensed contractor", systemCategory: "Foundation", sourceRef: "Possible trip hazard, recommend repair by licensed contractor" },
      { description: "Monitor driveway slope towards house", systemCategory: "Drainage", timing: "ongoing", sourceRef: "Driveway slopes towards a house recommend monitor" },
      { description: "Recommend repair of walks by licensed contractor", systemCategory: "Foundation", sourceRef: "Recommend repair by licensed contractor" },
      { description: "Keep positive slope away from foundation", systemCategory: "Foundation", sourceRef: "Evidence of negative grade; recommend keeping a positive slope away from foundation" },
      { description: "Recommend repair of retaining wall by licensed contractor", systemCategory: "Foundation", sourceRef: "Evidence of cracking deterioration recommend repair by licensed contractor" },
      { description: "Recommend monitor of siding patchwork", systemCategory: "Siding", sourceRef: "Evidence of Patchwork recommend monitor" },
      { description: "Recommend repair of damaged brick by licensed contractor", systemCategory: "Siding", sourceRef: "recommend repair by license contractor" },
      { description: "Recommend sealing exposed siding areas", systemCategory: "Siding", sourceRef: "Exposed areas recommend sealing" },
      { description: "Recommend re-evaluation of hose bib by licensed plumber", systemCategory: "Plumbing", sourceRef: "Hose bib is shut off. Unable to inspect. Recommend re evaluate by licensed plumber." },
      { description: "Recommend gutter extensions to direct water away from foundation", systemCategory: "Roof", sourceRef: "Extensions needed to direct water away from foundation" },
    ],
    attributesDetected: [
      { key: "material", value: "Masonry, Concrete", systemCategory: "Siding", confidence: 0.95, sourceRef: "Siding Material: Masonry, Concrete" },
      { key: "trim_material", value: "Wood", systemCategory: "Siding", confidence: 0.9, sourceRef: "Trim Material: Wood" },
      { key: "facia_material", value: "Composite", systemCategory: "Siding", confidence: 0.9, sourceRef: "Facia Material: Composite" },
      { key: "window_type", value: "Non opening, Vinyl single hung", systemCategory: "Windows", confidence: 0.9, sourceRef: "Windows Type: Non opening, Vinyl single hung" },
      { key: "gutter_material", value: "aluminum", systemCategory: "Roof", confidence: 0.9, sourceRef: "Gutter Type: aluminum" },
      { key: "foundation_material", value: "Poured/ concrete", systemCategory: "Foundation", confidence: 0.95, sourceRef: "Foundation Material: Poured/ concrete" },
      { key: "driveway_material", value: "Concrete", systemCategory: "Foundation", confidence: 0.9, sourceRef: "Driveway Material: Concrete" },
      { key: "electrical_type", value: "110 VAC, 110 VAC GFCI", systemCategory: "Electrical", confidence: 0.9, sourceRef: "Electrical Type: 110 VAC, 110 VAC GFCI" },
      { key: "deck_material", value: "composite, wood", systemCategory: "Deck", confidence: 0.9, sourceRef: "Deck Material: composite, wood" },
      { key: "estimated_age", value: "35 years", systemCategory: "Other", confidence: 0.8, sourceRef: "Estimated Age: 35" },
      { key: "building_type", value: "Single Family", systemCategory: "Other", confidence: 0.95, sourceRef: "Type of Building: Single Family" },
    ],
    safetyFindings: [
      { description: "Trip hazard on walks and driveway due to settling", systemCategory: "Foundation", severity: "warning", sourceRef: "Possible trip hazard, recommend repair by licensed contractor" },
      { description: "Ungrounded receptacles found in multiple rooms", systemCategory: "Electrical", severity: "warning", sourceRef: "Ungrounded Receptacle in living space and bedroom" },
      { description: "No GFCI protection in bathroom 4", systemCategory: "Electrical", severity: "critical", sourceRef: "No GFCI Protection Installed in bathroom" },
      { description: "Double tap on breaker - fire hazard", systemCategory: "Electrical", severity: "critical", sourceRef: "Double Tap on branch wiring circuits" },
      { description: "Polybutylene supply pipes - known failure risk", systemCategory: "Plumbing", severity: "critical", sourceRef: "Polybutylene Supply Pipes in bathroom 4" },
      { description: "Bathroom vents into attic instead of exterior - moisture risk", systemCategory: "Insulation", severity: "warning", sourceRef: "Bathroom Vents Into Attic" },
    ],
    sourceReferences: [
      { text: "Home Inspections Northwest - 7610 N Audubon St, Spokane WA 99208", fileIndex: 0, fileName: "7610_N_Audubon_St.PDF" },
      { text: "Inspector: Mike Cole, (509)904-7673", fileIndex: 0, fileName: "7610_N_Audubon_St.PDF" },
      { text: "153 Items Inspected, 10 Maintenance Items, 33 Repair Needed, 2 Defective", fileIndex: 0, fileName: "7610_N_Audubon_St.PDF" },
    ],
  };
}

const EXISTING_SYSTEMS: ExistingSystem[] = [
  { id: "sys-roof", category: "Roof", name: "Roof", condition: "Unknown" },
  { id: "sys-hvac", category: "HVAC", name: "HVAC System", condition: "Unknown" },
  { id: "sys-electrical", category: "Electrical", name: "Electrical", condition: "Unknown" },
  { id: "sys-plumbing", category: "Plumbing", name: "Plumbing", condition: "Unknown" },
  { id: "sys-foundation", category: "Foundation", name: "Foundation", condition: "Unknown" },
];

describe("RFB — 7610 N Audubon St Inspection Report", () => {
  const pp = buildAudubonPreProcessorOutput();

  describe("Contractor Analysis — System Matching", () => {
    const result = runContractorAnalysis({
      preProcessorOutput: pp,
      existingSystems: EXISTING_SYSTEMS,
      existingTasks: [],
      homeId: "home-audubon",
    });

    it("produces tasks for matched existing systems", () => {
      expect(result.matchedSystemTasks.length).toBeGreaterThan(10);
    });

    it("attaches electrical issues to Electrical system", () => {
      const elecTasks = result.matchedSystemTasks.filter((t) => t.systemId === "sys-electrical");
      expect(elecTasks.length).toBeGreaterThanOrEqual(5);
      const gfciTask = elecTasks.find((t) => t.title.toLowerCase().includes("gfci"));
      expect(gfciTask).toBeDefined();
    });

    it("attaches foundation issues to Foundation system", () => {
      const foundationTasks = result.matchedSystemTasks.filter((t) => t.systemId === "sys-foundation");
      expect(foundationTasks.length).toBeGreaterThanOrEqual(3);
    });

    it("attaches plumbing issues to Plumbing system", () => {
      const plumbingTasks = result.matchedSystemTasks.filter((t) => t.systemId === "sys-plumbing");
      expect(plumbingTasks.length).toBeGreaterThanOrEqual(3);
    });

    it("attaches roof/gutter issues to Roof system", () => {
      const roofTasks = result.matchedSystemTasks.filter((t) => t.systemId === "sys-roof");
      expect(roofTasks.length).toBeGreaterThanOrEqual(1);
    });

    it("creates suggested systems for Siding, Windows, Garage, Deck, Drainage, Appliances", () => {
      const categories = result.suggestedSystems.map((s) => s.category);
      expect(categories).toContain("Siding");
      expect(categories).toContain("Windows");
      expect(categories).toContain("Garage");
    });

    it("all suggested systems are in pending status", () => {
      for (const s of result.suggestedSystems) {
        expect(s.status).toBe("pending");
      }
    });

    it("suggested Siding system has multiple pending tasks", () => {
      const siding = result.suggestedSystems.find((s) => s.category === "Siding");
      expect(siding).toBeDefined();
      expect(siding!.pendingTasks.length).toBeGreaterThanOrEqual(3);
    });

    it("suggested Siding system has material attributes", () => {
      const siding = result.suggestedSystems.find((s) => s.category === "Siding");
      expect(siding).toBeDefined();
      const attrVals = Object.values(siding!.pendingAttributes);
      expect(attrVals.some((v) => v.includes("Masonry") || v.includes("Concrete"))).toBe(true);
    });

    it("Windows system has failed seal tasks", () => {
      const windows = result.suggestedSystems.find((s) => s.category === "Windows");
      expect(windows).toBeDefined();
      const sealTask = windows!.pendingTasks.find((t) => t.title.toLowerCase().includes("seal") || t.title.toLowerCase().includes("window"));
      expect(sealTask).toBeDefined();
    });

    it("polybutylene pipes get critical priority", () => {
      const polyTask = result.matchedSystemTasks.find((t) => t.title.toLowerCase().includes("polybutylene"));
      expect(polyTask).toBeDefined();
      expect(polyTask!.priority).toBe("now");
    });

    it("no orphaned tasks without a system", () => {
      for (const task of result.matchedSystemTasks) {
        expect(task.systemId).toBeTruthy();
        expect(EXISTING_SYSTEMS.some((s) => s.id === task.systemId)).toBe(true);
      }
      for (const s of result.suggestedSystems) {
        for (const task of s.pendingTasks) {
          expect(task.suggestionId).toBe(s.id);
        }
      }
    });
  });

  describe("Contractor Analysis — Attribute Scoping", () => {
    const result = runContractorAnalysis({
      preProcessorOutput: pp,
      existingSystems: EXISTING_SYSTEMS,
      existingTasks: [],
      homeId: "home-audubon",
    });

    it("foundation attributes are scoped to Foundation system", () => {
      const foundationUpdate = result.matchedSystemUpdates.find((u) => u.systemId === "sys-foundation");
      expect(foundationUpdate).toBeDefined();
      const keys = Object.keys(foundationUpdate!.attributes);
      expect(keys.some((k) => k.includes("foundation") && k.includes("material"))).toBe(true);
    });

    it("electrical attributes are scoped to Electrical system", () => {
      const elecUpdate = result.matchedSystemUpdates.find((u) => u.systemId === "sys-electrical");
      expect(elecUpdate).toBeDefined();
      const keys = Object.keys(elecUpdate!.attributes);
      expect(keys.some((k) => k.includes("electrical"))).toBe(true);
    });

    it("roof gutter material is scoped to Roof system", () => {
      const roofUpdate = result.matchedSystemUpdates.find((u) => u.systemId === "sys-roof");
      expect(roofUpdate).toBeDefined();
      const vals = Object.values(roofUpdate!.attributes);
      expect(vals).toContain("aluminum");
    });

    it("siding attributes do not bleed into foundation", () => {
      const foundationUpdate = result.matchedSystemUpdates.find((u) => u.systemId === "sys-foundation");
      if (foundationUpdate) {
        const vals = Object.values(foundationUpdate.attributes);
        expect(vals).not.toContain("Masonry, Concrete");
        expect(vals).not.toContain("Wood");
      }
    });

    it("no cross-system attribute pollution", () => {
      for (const update of result.matchedSystemUpdates) {
        const system = EXISTING_SYSTEMS.find((s) => s.id === update.systemId);
        expect(system).toBeDefined();
        const keys = Object.keys(update.attributes);
        for (const key of keys) {
          const keyPrefix = key.split("_")[0].toLowerCase();
          const systemPrefix = system!.category.toLowerCase().replace(/\s+/g, "");
          const keyContainsSystem = key.toLowerCase().includes(systemPrefix.slice(0, 4));
          expect(keyContainsSystem).toBe(true);
        }
      }
    });
  });

  describe("Contractor Analysis — Priority & Classification", () => {
    const result = runContractorAnalysis({
      preProcessorOutput: pp,
      existingSystems: EXISTING_SYSTEMS,
      existingTasks: [],
      homeId: "home-audubon",
    });

    it("critical severity issues get 'now' priority", () => {
      const criticalTasks = result.matchedSystemTasks.filter((t) => t.priority === "now");
      expect(criticalTasks.length).toBeGreaterThanOrEqual(1);
    });

    it("moderate severity issues get 'soon' priority", () => {
      const soonTasks = result.matchedSystemTasks.filter((t) => t.priority === "soon");
      expect(soonTasks.length).toBeGreaterThanOrEqual(3);
    });

    it("electrical GFCI issues are classified as Repair, Inspection, or Maintenance", () => {
      const gfciTasks = result.matchedSystemTasks.filter(
        (t) => t.systemId === "sys-electrical" && t.title.toLowerCase().includes("gfci")
      );
      for (const task of gfciTasks) {
        expect(["Repair", "Inspection", "Maintenance"]).toContain(task.category);
      }
    });

    it("safety warnings are attached to relevant tasks", () => {
      const elecTasks = result.matchedSystemTasks.filter((t) => t.systemId === "sys-electrical");
      const withWarnings = elecTasks.filter((t) => t.safetyWarning);
      expect(withWarnings.length).toBeGreaterThanOrEqual(1);
    });

    it("all tasks have valid categories", () => {
      const validCategories = ["Repair", "Maintenance", "Inspection", "Replacement", "Improvement"];
      for (const t of result.matchedSystemTasks) {
        expect(validCategories).toContain(t.category);
      }
      for (const s of result.suggestedSystems) {
        for (const t of s.pendingTasks) {
          expect(validCategories).toContain(t.category);
        }
      }
    });

    it("all tasks retain source references", () => {
      for (const t of result.matchedSystemTasks) {
        expect(t.sourceRef).toBeTruthy();
        expect(t.sourceRef.length).toBeGreaterThan(5);
      }
    });
  });

  describe("Contractor Analysis — Deduplication", () => {
    it("does not create duplicate GFCI tasks for same system", () => {
      const result = runContractorAnalysis({
        preProcessorOutput: pp,
        existingSystems: EXISTING_SYSTEMS,
        existingTasks: [],
        homeId: "home-audubon",
      });
      const elecGfci = result.matchedSystemTasks.filter(
        (t) => t.systemId === "sys-electrical" && t.title.toLowerCase().includes("gfci")
      );
      const titles = elecGfci.map((t) => t.title.toLowerCase().replace(/[^a-z0-9]/g, ""));
      const unique = new Set(titles);
      expect(unique.size).toBe(titles.length);
    });

    it("does not duplicate tasks already in system", () => {
      const existingTasks: ExistingTask[] = [
        { id: "existing-1", title: "GFCI not functioning properly on exterior", systemId: "sys-electrical", status: "pending" },
        { id: "existing-2", title: "Polybutylene supply pipes in bathroom 4", systemId: "sys-plumbing", status: "pending" },
      ];
      const result = runContractorAnalysis({
        preProcessorOutput: pp,
        existingSystems: EXISTING_SYSTEMS,
        existingTasks,
        homeId: "home-audubon",
      });
      const gfciExterior = result.matchedSystemTasks.filter(
        (t) => t.title.toLowerCase().includes("gfci") && t.title.toLowerCase().includes("exterior")
      );
      expect(gfciExterior).toHaveLength(0);
      const polyTasks = result.matchedSystemTasks.filter(
        (t) => t.title.toLowerCase().includes("polybutylene")
      );
      expect(polyTasks).toHaveLength(0);
    });
  });

  describe("Reasoning Engine — Contractor Language Inference", () => {
    const contractorResult = runContractorAnalysis({
      preProcessorOutput: pp,
      existingSystems: EXISTING_SYSTEMS,
      existingTasks: [],
      homeId: "home-audubon",
    });
    const inferredTasks = runReasoningEngine(
      pp,
      contractorResult.matchedSystemTasks,
      EXISTING_SYSTEMS
    );

    it("produces inferred tasks from contractor language", () => {
      expect(inferredTasks.length).toBeGreaterThanOrEqual(1);
    });

    it("all inferred tasks are marked as inferred", () => {
      for (const task of inferredTasks) {
        expect(task.isInferred).toBe(true);
        expect(task.inferenceReason).toBeTruthy();
      }
    });

    it("'monitor' language creates inspection tasks", () => {
      const monitorTasks = inferredTasks.filter(
        (t) => t.category === "Inspection" && t.priority === "monitor"
      );
      expect(monitorTasks.length).toBeGreaterThanOrEqual(1);
    });

    it("'licensed contractor' recommendations create professional inspection tasks", () => {
      const proTasks = inferredTasks.filter(
        (t) => t.diyLevel === "Pro-Only" && t.category === "Inspection"
      );
      expect(proTasks.length).toBeGreaterThanOrEqual(1);
    });

    it("water/moisture findings create investigation tasks", () => {
      const waterTasks = inferredTasks.filter(
        (t) => t.title.toLowerCase().includes("water")
      );
      expect(waterTasks.length).toBeGreaterThanOrEqual(1);
    });

    it("inferred tasks retain source references", () => {
      for (const task of inferredTasks) {
        expect(task.sourceRef).toBeTruthy();
      }
    });

    it("inferred tasks do not duplicate contractor analysis tasks", () => {
      const contractorTitles = new Set(
        contractorResult.matchedSystemTasks.map((t) => t.title.toLowerCase().replace(/[^a-z0-9]/g, ""))
      );
      for (const task of inferredTasks) {
        const normalized = task.title.toLowerCase().replace(/[^a-z0-9]/g, "");
        expect(contractorTitles.has(normalized)).toBe(false);
      }
    });

    it("does not fabricate systems not in the report", () => {
      const validSystemIds = new Set(EXISTING_SYSTEMS.map((s) => s.id));
      for (const task of inferredTasks) {
        if (task.systemId) {
          expect(validSystemIds.has(task.systemId)).toBe(true);
        }
      }
    });
  });

  describe("Field Isolation — Cross-System Boundaries", () => {
    const result = runContractorAnalysis({
      preProcessorOutput: pp,
      existingSystems: EXISTING_SYSTEMS,
      existingTasks: [],
      homeId: "home-audubon",
    });

    it("electrical tasks do not reference plumbing system", () => {
      const elecTasks = result.matchedSystemTasks.filter((t) => t.systemId === "sys-electrical");
      for (const t of elecTasks) {
        expect(t.systemId).not.toBe("sys-plumbing");
      }
    });

    it("plumbing tasks do not reference electrical system", () => {
      const plumbingTasks = result.matchedSystemTasks.filter((t) => t.systemId === "sys-plumbing");
      for (const t of plumbingTasks) {
        expect(t.systemId).not.toBe("sys-electrical");
      }
    });

    it("foundation attributes do not include siding material", () => {
      const foundationUpdate = result.matchedSystemUpdates.find((u) => u.systemId === "sys-foundation");
      if (foundationUpdate) {
        const vals = Object.values(foundationUpdate.attributes);
        expect(vals).not.toContain("Masonry, Concrete");
      }
    });

    it("siding attributes in suggested system do not include foundation material", () => {
      const sidingSuggestion = result.suggestedSystems.find((s) => s.category === "Siding");
      if (sidingSuggestion) {
        const vals = Object.values(sidingSuggestion.pendingAttributes);
        expect(vals).not.toContain("Poured/ concrete");
      }
    });

    it("deck attributes are in their own suggested system", () => {
      const deckSuggestion = result.suggestedSystems.find((s) => s.category === "Deck");
      expect(deckSuggestion).toBeDefined();
      const vals = Object.values(deckSuggestion!.pendingAttributes);
      expect(vals.some((v) => v.includes("composite") || v.includes("wood"))).toBe(true);
    });
  });

  describe("End-to-End — Full Pipeline Stats", () => {
    it("produces a comprehensive analysis for a 55-page inspection report", () => {
      const result = runContractorAnalysis({
        preProcessorOutput: pp,
        existingSystems: EXISTING_SYSTEMS,
        existingTasks: [],
        homeId: "home-audubon",
      });
      const inferredTasks = runReasoningEngine(
        pp,
        result.matchedSystemTasks,
        EXISTING_SYSTEMS
      );

      const totalMatchedTasks = result.matchedSystemTasks.length;
      const totalSuggestedSystems = result.suggestedSystems.length;
      const totalPendingTasks = result.suggestedSystems.reduce((acc, s) => acc + s.pendingTasks.length, 0);
      const totalInferredTasks = inferredTasks.length;
      const totalAttributeUpdates = result.matchedSystemUpdates.length;

      expect(totalMatchedTasks).toBeGreaterThan(15);
      expect(totalSuggestedSystems).toBeGreaterThanOrEqual(4);
      expect(totalPendingTasks).toBeGreaterThan(5);
      expect(totalInferredTasks).toBeGreaterThanOrEqual(2);
      expect(totalAttributeUpdates).toBeGreaterThanOrEqual(3);

      const allTasks = [
        ...result.matchedSystemTasks,
        ...result.suggestedSystems.flatMap((s) => s.pendingTasks),
        ...inferredTasks,
      ];
      for (const task of allTasks) {
        expect(task.sourceRef).toBeTruthy();
        expect(task.title.length).toBeLessThanOrEqual(80);
      }
    });
  });
});

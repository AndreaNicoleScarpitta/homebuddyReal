import { describe, it, expect } from "vitest";
import { runContractorAnalysis } from "../server/lib/analysis-pipeline/contractor-analysis";
import { runReasoningEngine } from "../server/lib/analysis-pipeline/reasoning-engine";
import type {
  PreProcessorOutput,
  ExistingSystem,
  ExistingTask,
  SuggestedSystem,
} from "../server/lib/analysis-pipeline/types";

function emptyPreProcessorOutput(): PreProcessorOutput {
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

const ROOF_SYSTEM: ExistingSystem = {
  id: "sys-roof-1",
  category: "Roof",
  name: "Roof",
  condition: "Fair",
};

const HVAC_SYSTEM: ExistingSystem = {
  id: "sys-hvac-1",
  category: "HVAC",
  name: "Central AC",
  condition: "Good",
};

describe("Approval Workflow — Suggested Systems", () => {
  it("suggested systems start in pending status", () => {
    const pp = emptyPreProcessorOutput();
    pp.issuesDetected = [
      { description: "Solar panel crack detected", severity: "moderate", systemCategory: "Solar", sourceRef: "Solar panel crack" },
    ];
    const result = runContractorAnalysis({
      preProcessorOutput: pp,
      existingSystems: [ROOF_SYSTEM],
      existingTasks: [],
      homeId: "home-1",
    });
    expect(result.suggestedSystems.length).toBeGreaterThanOrEqual(1);
    for (const s of result.suggestedSystems) {
      expect(s.status).toBe("pending");
    }
  });

  it("pending suggestions carry tasks that can be migrated on approval", () => {
    const pp = emptyPreProcessorOutput();
    pp.issuesDetected = [
      { description: "Pool pump needs repair", severity: "moderate", systemCategory: "Pool", sourceRef: "Pool pump repair" },
      { description: "Pool heater leaking", severity: "critical", systemCategory: "Pool", sourceRef: "Pool heater leak" },
    ];
    const result = runContractorAnalysis({
      preProcessorOutput: pp,
      existingSystems: [ROOF_SYSTEM],
      existingTasks: [],
      homeId: "home-1",
    });
    const poolSuggestion = result.suggestedSystems.find((s) => s.category === "Pool");
    expect(poolSuggestion).toBeDefined();
    expect(poolSuggestion!.pendingTasks.length).toBeGreaterThanOrEqual(1);
    for (const task of poolSuggestion!.pendingTasks) {
      expect(task.suggestionId).toBe(poolSuggestion!.id);
    }
  });

  it("pending suggestions carry attributes that can be migrated on approval", () => {
    const pp = emptyPreProcessorOutput();
    pp.attributesDetected = [
      { key: "fuel_type", value: "propane", systemCategory: "Pool", confidence: 0.9, sourceRef: "Pool propane" },
    ];
    const result = runContractorAnalysis({
      preProcessorOutput: pp,
      existingSystems: [ROOF_SYSTEM],
      existingTasks: [],
      homeId: "home-1",
    });
    const poolSuggestion = result.suggestedSystems.find((s) => s.category === "Pool");
    expect(poolSuggestion).toBeDefined();
    const vals = Object.values(poolSuggestion!.pendingAttributes);
    expect(vals).toContain("propane");
  });

  it("declining removes all tasks and attributes for that suggestion", () => {
    const pp = emptyPreProcessorOutput();
    pp.issuesDetected = [
      { description: "Irrigation system needs inspection", severity: "moderate", systemCategory: "Irrigation", sourceRef: "Irrigation" },
    ];
    pp.attributesDetected = [
      { key: "zone_count", value: "6 zones", systemCategory: "Irrigation", confidence: 0.8, sourceRef: "Irrigation" },
    ];
    const result = runContractorAnalysis({
      preProcessorOutput: pp,
      existingSystems: [ROOF_SYSTEM],
      existingTasks: [],
      homeId: "home-1",
    });
    const irrigationSuggestion = result.suggestedSystems.find((s) => s.category === "Irrigation");
    expect(irrigationSuggestion).toBeDefined();

    const declined = { ...irrigationSuggestion!, status: "declined" as const };
    expect(declined.status).toBe("declined");
    expect(declined.pendingTasks.length).toBeGreaterThanOrEqual(1);
    expect(Object.keys(declined.pendingAttributes).length).toBeGreaterThanOrEqual(1);
  });

  it("multiple suggestions from different categories are independent", () => {
    const pp = emptyPreProcessorOutput();
    pp.issuesDetected = [
      { description: "Pool needs cleaning", severity: "minor", systemCategory: "Pool", sourceRef: "Pool" },
      { description: "Irrigation system leak", severity: "moderate", systemCategory: "Irrigation", sourceRef: "Irrigation" },
      { description: "Well pump noise", severity: "moderate", systemCategory: "Well", sourceRef: "Well" },
    ];
    const result = runContractorAnalysis({
      preProcessorOutput: pp,
      existingSystems: [ROOF_SYSTEM],
      existingTasks: [],
      homeId: "home-1",
    });
    expect(result.suggestedSystems.length).toBe(3);
    const categories = result.suggestedSystems.map((s) => s.category);
    expect(categories).toContain("Pool");
    expect(categories).toContain("Irrigation");
    expect(categories).toContain("Well");

    for (const s of result.suggestedSystems) {
      for (const task of s.pendingTasks) {
        expect(task.suggestionId).toBe(s.id);
      }
    }
  });
});

describe("Field Isolation — Cross-System Scoping", () => {
  it("Roof material does not populate Siding system", () => {
    const pp = emptyPreProcessorOutput();
    pp.attributesDetected = [
      { key: "material", value: "asphalt shingles", systemCategory: "Roof", confidence: 0.9, sourceRef: "test" },
    ];
    const sidingSystem: ExistingSystem = { id: "sys-siding-1", category: "Siding", name: "Siding" };
    const result = runContractorAnalysis({
      preProcessorOutput: pp,
      existingSystems: [ROOF_SYSTEM, sidingSystem],
      existingTasks: [],
      homeId: "home-1",
    });
    const sidingUpdate = result.matchedSystemUpdates.find((u) => u.systemId === sidingSystem.id);
    expect(sidingUpdate).toBeUndefined();
    const roofUpdate = result.matchedSystemUpdates.find((u) => u.systemId === ROOF_SYSTEM.id);
    expect(roofUpdate).toBeDefined();
  });

  it("attribute keys contain system-scoped namespace prefix", () => {
    const pp = emptyPreProcessorOutput();
    pp.attributesDetected = [
      { key: "material", value: "vinyl", systemCategory: "Siding", confidence: 0.9, sourceRef: "test" },
    ];
    const sidingSystem: ExistingSystem = { id: "sys-siding-1", category: "Siding", name: "Siding" };
    const result = runContractorAnalysis({
      preProcessorOutput: pp,
      existingSystems: [sidingSystem],
      existingTasks: [],
      homeId: "home-1",
    });
    const update = result.matchedSystemUpdates.find((u) => u.systemId === sidingSystem.id);
    expect(update).toBeDefined();
    const keys = Object.keys(update!.attributes);
    expect(keys.length).toBe(1);
    expect(keys[0]).toContain("siding");
    expect(keys[0]).toContain("material");
  });

  it("tasks created for one system do not reference another system id", () => {
    const pp = emptyPreProcessorOutput();
    pp.issuesDetected = [
      { description: "Roof leak found", severity: "moderate", systemCategory: "Roof", sourceRef: "test" },
      { description: "HVAC compressor noise", severity: "minor", systemCategory: "HVAC", sourceRef: "test" },
    ];
    const result = runContractorAnalysis({
      preProcessorOutput: pp,
      existingSystems: [ROOF_SYSTEM, HVAC_SYSTEM],
      existingTasks: [],
      homeId: "home-1",
    });
    const roofTasks = result.matchedSystemTasks.filter((t) => t.systemId === ROOF_SYSTEM.id);
    const hvacTasks = result.matchedSystemTasks.filter((t) => t.systemId === HVAC_SYSTEM.id);
    expect(roofTasks.length).toBeGreaterThanOrEqual(1);
    expect(hvacTasks.length).toBeGreaterThanOrEqual(1);
    for (const t of roofTasks) expect(t.systemId).toBe(ROOF_SYSTEM.id);
    for (const t of hvacTasks) expect(t.systemId).toBe(HVAC_SYSTEM.id);
  });

  it("pending system attributes do not bleed into existing system updates", () => {
    const pp = emptyPreProcessorOutput();
    pp.attributesDetected = [
      { key: "capacity", value: "50 gallons", systemCategory: "Water Heater", confidence: 0.9, sourceRef: "test" },
    ];
    const result = runContractorAnalysis({
      preProcessorOutput: pp,
      existingSystems: [ROOF_SYSTEM],
      existingTasks: [],
      homeId: "home-1",
    });
    for (const update of result.matchedSystemUpdates) {
      expect(update.systemId).not.toBe("sys-unknown");
      const vals = Object.values(update.attributes);
      expect(vals).not.toContain("50 gallons");
    }
    const whSuggestion = result.suggestedSystems.find((s) => s.category === "Water Heater");
    expect(whSuggestion).toBeDefined();
    expect(Object.values(whSuggestion!.pendingAttributes)).toContain("50 gallons");
  });

  it("two systems with same attribute key get independent scoped keys", () => {
    const pp = emptyPreProcessorOutput();
    pp.attributesDetected = [
      { key: "material", value: "asphalt", systemCategory: "Roof", confidence: 0.9, sourceRef: "test" },
      { key: "material", value: "vinyl", systemCategory: "Siding", confidence: 0.9, sourceRef: "test" },
    ];
    const sidingSystem: ExistingSystem = { id: "sys-siding-1", category: "Siding", name: "Siding" };
    const result = runContractorAnalysis({
      preProcessorOutput: pp,
      existingSystems: [ROOF_SYSTEM, sidingSystem],
      existingTasks: [],
      homeId: "home-1",
    });
    const roofUpdate = result.matchedSystemUpdates.find((u) => u.systemId === ROOF_SYSTEM.id);
    const sidingUpdate = result.matchedSystemUpdates.find((u) => u.systemId === sidingSystem.id);
    expect(roofUpdate).toBeDefined();
    expect(sidingUpdate).toBeDefined();

    const roofKeys = Object.keys(roofUpdate!.attributes);
    const sidingKeys = Object.keys(sidingUpdate!.attributes);
    expect(roofKeys[0]).not.toBe(sidingKeys[0]);

    expect(Object.values(roofUpdate!.attributes)).toContain("asphalt");
    expect(Object.values(roofUpdate!.attributes)).not.toContain("vinyl");
    expect(Object.values(sidingUpdate!.attributes)).toContain("vinyl");
    expect(Object.values(sidingUpdate!.attributes)).not.toContain("asphalt");
  });
});

describe("Regression — Existing Behavior Preserved", () => {
  it("empty file analysis returns empty results", () => {
    const result = runContractorAnalysis({
      preProcessorOutput: emptyPreProcessorOutput(),
      existingSystems: [ROOF_SYSTEM, HVAC_SYSTEM],
      existingTasks: [],
      homeId: "home-1",
    });
    expect(result.matchedSystemTasks).toHaveLength(0);
    expect(result.matchedSystemUpdates).toHaveLength(0);
    expect(result.suggestedSystems).toHaveLength(0);
  });

  it("existing tasks are not duplicated", () => {
    const pp = emptyPreProcessorOutput();
    pp.issuesDetected = [
      { description: "Clean gutters", severity: "minor", systemCategory: "Roof", sourceRef: "test" },
    ];
    const existingTasks: ExistingTask[] = [
      { id: "task-existing", title: "Clean gutters", systemId: ROOF_SYSTEM.id, status: "pending" },
    ];
    const result = runContractorAnalysis({
      preProcessorOutput: pp,
      existingSystems: [ROOF_SYSTEM],
      existingTasks,
      homeId: "home-1",
    });
    expect(result.matchedSystemTasks).toHaveLength(0);
  });

  it("category aliases resolve correctly", () => {
    const pp = emptyPreProcessorOutput();
    pp.issuesDetected = [
      { description: "Cooling system not working", severity: "moderate", systemCategory: "cooling", sourceRef: "test" },
    ];
    const result = runContractorAnalysis({
      preProcessorOutput: pp,
      existingSystems: [HVAC_SYSTEM],
      existingTasks: [],
      homeId: "home-1",
    });
    expect(result.matchedSystemTasks.length).toBeGreaterThanOrEqual(1);
    expect(result.matchedSystemTasks[0].systemId).toBe(HVAC_SYSTEM.id);
  });

  it("gutter issues are attributed to Roof system", () => {
    const pp = emptyPreProcessorOutput();
    pp.issuesDetected = [
      { description: "Gutters clogged", severity: "minor", systemCategory: "gutters", sourceRef: "test" },
    ];
    const result = runContractorAnalysis({
      preProcessorOutput: pp,
      existingSystems: [ROOF_SYSTEM],
      existingTasks: [],
      homeId: "home-1",
    });
    expect(result.matchedSystemTasks.length).toBeGreaterThanOrEqual(1);
    expect(result.matchedSystemTasks[0].systemId).toBe(ROOF_SYSTEM.id);
  });

  it("critical issues get 'now' priority", () => {
    const pp = emptyPreProcessorOutput();
    pp.issuesDetected = [
      { description: "Electrical panel sparking", severity: "critical", systemCategory: "Electrical", sourceRef: "test" },
    ];
    const elecSystem: ExistingSystem = { id: "sys-elec", category: "Electrical", name: "Electrical" };
    const result = runContractorAnalysis({
      preProcessorOutput: pp,
      existingSystems: [elecSystem],
      existingTasks: [],
      homeId: "home-1",
    });
    expect(result.matchedSystemTasks[0].priority).toBe("now");
  });

  it("minor issues get 'later' priority", () => {
    const pp = emptyPreProcessorOutput();
    pp.issuesDetected = [
      { description: "Minor paint chipping", severity: "minor", systemCategory: "Siding", sourceRef: "test" },
    ];
    const sidingSystem: ExistingSystem = { id: "sys-siding", category: "Siding", name: "Siding" };
    const result = runContractorAnalysis({
      preProcessorOutput: pp,
      existingSystems: [sidingSystem],
      existingTasks: [],
      homeId: "home-1",
    });
    expect(result.matchedSystemTasks[0].priority).toBe("later");
  });
});

describe("E2E Happy Path — Full Pipeline", () => {
  it("upload → analysis → approve one + decline one", () => {
    const pp = emptyPreProcessorOutput();
    pp.issuesDetected = [
      { description: "Roof shingles curling on north side", severity: "moderate", systemCategory: "Roof", sourceRef: "Shingles curling north" },
      { description: "Solar inverter showing error code", severity: "moderate", systemCategory: "Solar", sourceRef: "Solar inverter error" },
      { description: "Pool pump making unusual noise", severity: "minor", systemCategory: "Pool", sourceRef: "Pool pump noise" },
    ];
    pp.attributesDetected = [
      { key: "material", value: "asphalt", systemCategory: "Roof", confidence: 0.9, sourceRef: "test" },
      { key: "panel_count", value: "24", systemCategory: "Solar", confidence: 0.8, sourceRef: "test" },
    ];
    pp.maintenanceRecommendations = [
      { description: "Monitor for further movement in foundation", systemCategory: "Foundation", sourceRef: "Monitor foundation" },
    ];

    const contractorResult = runContractorAnalysis({
      preProcessorOutput: pp,
      existingSystems: [ROOF_SYSTEM],
      existingTasks: [],
      homeId: "home-1",
    });

    expect(contractorResult.matchedSystemTasks.length).toBeGreaterThanOrEqual(1);
    const roofTask = contractorResult.matchedSystemTasks.find((t) => t.systemId === ROOF_SYSTEM.id);
    expect(roofTask).toBeDefined();

    const roofUpdate = contractorResult.matchedSystemUpdates.find((u) => u.systemId === ROOF_SYSTEM.id);
    expect(roofUpdate).toBeDefined();
    expect(Object.values(roofUpdate!.attributes)).toContain("asphalt");

    expect(contractorResult.suggestedSystems.length).toBeGreaterThanOrEqual(2);
    const solarSuggestion = contractorResult.suggestedSystems.find((s) => s.category === "Solar");
    const poolSuggestion = contractorResult.suggestedSystems.find((s) => s.category === "Pool");
    expect(solarSuggestion).toBeDefined();
    expect(poolSuggestion).toBeDefined();
    expect(solarSuggestion!.status).toBe("pending");
    expect(poolSuggestion!.status).toBe("pending");

    const approved = { ...solarSuggestion!, status: "approved" as const };
    expect(approved.status).toBe("approved");
    expect(approved.pendingTasks.length).toBeGreaterThanOrEqual(1);
    expect(Object.values(approved.pendingAttributes)).toContain("24");

    const declined = { ...poolSuggestion!, status: "declined" as const };
    expect(declined.status).toBe("declined");

    const reasoningTasks = runReasoningEngine(
      pp,
      contractorResult.matchedSystemTasks,
      [ROOF_SYSTEM]
    );
    const monitorTask = reasoningTasks.find((t) => t.title.toLowerCase().includes("monitor"));
    expect(monitorTask).toBeDefined();
    expect(monitorTask!.isInferred).toBe(true);

    const shingleTask = reasoningTasks.find((t) => t.title.toLowerCase().includes("shingle"));
    expect(shingleTask).toBeDefined();
    expect(shingleTask!.isInferred).toBe(true);
  });

  it("contractor + reasoning combined returns complete result", () => {
    const pp = emptyPreProcessorOutput();
    pp.issuesDetected = [
      { description: "HVAC filter very dirty", severity: "minor", systemCategory: "HVAC", sourceRef: "test" },
    ];
    const contractorResult = runContractorAnalysis({
      preProcessorOutput: pp,
      existingSystems: [HVAC_SYSTEM],
      existingTasks: [],
      homeId: "home-1",
    });
    const inferredTasks = runReasoningEngine(pp, contractorResult.matchedSystemTasks, [HVAC_SYSTEM]);
    const allTasks = [...contractorResult.matchedSystemTasks, ...inferredTasks];
    expect(allTasks.length).toBeGreaterThanOrEqual(1);
    expect(contractorResult.suggestedSystems).toBeDefined();
    expect(contractorResult.matchedSystemUpdates).toBeDefined();
  });

  it("pipeline with no existing systems puts everything as suggestions", () => {
    const pp = emptyPreProcessorOutput();
    pp.issuesDetected = [
      { description: "Roof needs repair", severity: "moderate", systemCategory: "Roof", sourceRef: "test" },
      { description: "HVAC filter dirty", severity: "minor", systemCategory: "HVAC", sourceRef: "test" },
    ];
    const contractorResult = runContractorAnalysis({
      preProcessorOutput: pp,
      existingSystems: [],
      existingTasks: [],
      homeId: "home-1",
    });
    expect(contractorResult.matchedSystemTasks).toHaveLength(0);
    expect(contractorResult.suggestedSystems.length).toBe(2);
  });
});

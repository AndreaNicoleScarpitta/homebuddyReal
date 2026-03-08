import { describe, it, expect, vi } from "vitest";
import { runContractorAnalysis } from "../server/lib/analysis-pipeline/contractor-analysis";
import { runReasoningEngine } from "../server/lib/analysis-pipeline/reasoning-engine";
import type {
  PreProcessorOutput,
  ExistingSystem,
  ExistingTask,
  ProposedTask,
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

const ELECTRICAL_SYSTEM: ExistingSystem = {
  id: "sys-elec-1",
  category: "Electrical",
  name: "Electrical",
  condition: "Unknown",
};

describe("Pre-Processor Output Handling", () => {
  it("handles empty pre-processor output gracefully", () => {
    const result = runContractorAnalysis({
      preProcessorOutput: emptyPreProcessorOutput(),
      existingSystems: [ROOF_SYSTEM],
      existingTasks: [],
      homeId: "home-1",
    });
    expect(result.matchedSystemTasks).toHaveLength(0);
    expect(result.matchedSystemUpdates).toHaveLength(0);
    expect(result.suggestedSystems).toHaveLength(0);
  });

  it("does not invent data when content is vague", () => {
    const pp = emptyPreProcessorOutput();
    pp.issuesDetected = [];
    pp.maintenanceRecommendations = [];
    const result = runContractorAnalysis({
      preProcessorOutput: pp,
      existingSystems: [ROOF_SYSTEM, HVAC_SYSTEM],
      existingTasks: [],
      homeId: "home-1",
    });
    expect(result.matchedSystemTasks).toHaveLength(0);
    expect(result.suggestedSystems).toHaveLength(0);
  });
});

describe("Contractor Analysis — System Matching", () => {
  it("attaches roof findings to existing Roof system", () => {
    const pp = emptyPreProcessorOutput();
    pp.issuesDetected = [
      {
        description: "Roof shingles showing moderate wear",
        severity: "moderate",
        systemCategory: "Roof",
        sourceRef: "Roof shingles showing moderate wear",
      },
    ];
    const result = runContractorAnalysis({
      preProcessorOutput: pp,
      existingSystems: [ROOF_SYSTEM, HVAC_SYSTEM],
      existingTasks: [],
      homeId: "home-1",
    });
    expect(result.matchedSystemTasks.length).toBeGreaterThanOrEqual(1);
    expect(result.matchedSystemTasks[0].systemId).toBe(ROOF_SYSTEM.id);
  });

  it("attaches HVAC findings to existing HVAC system", () => {
    const pp = emptyPreProcessorOutput();
    pp.issuesDetected = [
      {
        description: "HVAC filter needs replacement",
        severity: "minor",
        systemCategory: "HVAC",
        sourceRef: "HVAC filter needs replacement",
      },
    ];
    const result = runContractorAnalysis({
      preProcessorOutput: pp,
      existingSystems: [ROOF_SYSTEM, HVAC_SYSTEM],
      existingTasks: [],
      homeId: "home-1",
    });
    expect(result.matchedSystemTasks.length).toBeGreaterThanOrEqual(1);
    expect(result.matchedSystemTasks[0].systemId).toBe(HVAC_SYSTEM.id);
  });

  it("creates suggested system for unknown system references", () => {
    const pp = emptyPreProcessorOutput();
    pp.issuesDetected = [
      {
        description: "Solar inverter needs inspection",
        severity: "moderate",
        systemCategory: "Solar",
        sourceRef: "Solar inverter needs inspection",
      },
    ];
    const result = runContractorAnalysis({
      preProcessorOutput: pp,
      existingSystems: [ROOF_SYSTEM],
      existingTasks: [],
      homeId: "home-1",
    });
    expect(result.suggestedSystems.length).toBeGreaterThanOrEqual(1);
    const solarSuggestion = result.suggestedSystems.find((s) => s.category === "Solar");
    expect(solarSuggestion).toBeDefined();
    expect(solarSuggestion!.status).toBe("pending");
    expect(solarSuggestion!.pendingTasks.length).toBeGreaterThanOrEqual(1);
  });

  it("tasks always belong to a system (existing or suggested)", () => {
    const pp = emptyPreProcessorOutput();
    pp.issuesDetected = [
      { description: "Roof leak detected", severity: "critical", systemCategory: "Roof", sourceRef: "Roof leak" },
      { description: "Solar panel cracked", severity: "moderate", systemCategory: "Solar", sourceRef: "Solar panel" },
    ];
    const result = runContractorAnalysis({
      preProcessorOutput: pp,
      existingSystems: [ROOF_SYSTEM],
      existingTasks: [],
      homeId: "home-1",
    });
    for (const task of result.matchedSystemTasks) {
      expect(task.systemId).toBeTruthy();
    }
    for (const suggested of result.suggestedSystems) {
      for (const task of suggested.pendingTasks) {
        expect(task.suggestionId).toBe(suggested.id);
      }
    }
  });

  it("tasks are classified into approved categories only", () => {
    const validCategories = ["Repair", "Maintenance", "Inspection", "Replacement", "Improvement"];
    const pp = emptyPreProcessorOutput();
    pp.issuesDetected = [
      { description: "Replace water heater", severity: "moderate", systemCategory: "Water Heater", sourceRef: "test" },
      { description: "Inspect foundation cracks", severity: "minor", systemCategory: "Foundation", sourceRef: "test" },
      { description: "Clean gutters", severity: "minor", systemCategory: "Roof", sourceRef: "test" },
    ];
    const result = runContractorAnalysis({
      preProcessorOutput: pp,
      existingSystems: [ROOF_SYSTEM],
      existingTasks: [],
      homeId: "home-1",
    });
    const allTasks = [
      ...result.matchedSystemTasks,
      ...result.suggestedSystems.flatMap((s) => s.pendingTasks),
    ];
    for (const task of allTasks) {
      expect(validCategories).toContain(task.category);
    }
  });

  it("retains source file references on tasks", () => {
    const pp = emptyPreProcessorOutput();
    pp.issuesDetected = [
      { description: "Foundation crack observed", severity: "moderate", systemCategory: "Foundation", sourceRef: "Page 3: Foundation crack observed in southeast corner" },
    ];
    const result = runContractorAnalysis({
      preProcessorOutput: pp,
      existingSystems: [],
      existingTasks: [],
      homeId: "home-1",
    });
    const allTasks = result.suggestedSystems.flatMap((s) => s.pendingTasks);
    expect(allTasks.length).toBeGreaterThanOrEqual(1);
    expect(allTasks[0].sourceRef).toBeTruthy();
    expect(allTasks[0].sourceRef.length).toBeGreaterThan(0);
  });

  it("does not create duplicate tasks for the same system", () => {
    const pp = emptyPreProcessorOutput();
    pp.issuesDetected = [
      { description: "Roof shingles showing wear", severity: "moderate", systemCategory: "Roof", sourceRef: "test" },
      { description: "Roof shingles showing wear and damage", severity: "moderate", systemCategory: "Roof", sourceRef: "test" },
    ];
    const result = runContractorAnalysis({
      preProcessorOutput: pp,
      existingSystems: [ROOF_SYSTEM],
      existingTasks: [],
      homeId: "home-1",
    });
    expect(result.matchedSystemTasks.length).toBe(1);
  });

  it("does not create tasks that duplicate existing tasks", () => {
    const pp = emptyPreProcessorOutput();
    pp.issuesDetected = [
      { description: "Clean gutters", severity: "minor", systemCategory: "Roof", sourceRef: "test" },
    ];
    const existingTasks: ExistingTask[] = [
      { id: "task-1", title: "Clean gutters", systemId: ROOF_SYSTEM.id, status: "pending" },
    ];
    const result = runContractorAnalysis({
      preProcessorOutput: pp,
      existingSystems: [ROOF_SYSTEM],
      existingTasks,
      homeId: "home-1",
    });
    expect(result.matchedSystemTasks.length).toBe(0);
  });
});

describe("Contractor Analysis — Attributes", () => {
  it("attaches detected attributes to matched system", () => {
    const pp = emptyPreProcessorOutput();
    pp.attributesDetected = [
      { key: "material", value: "asphalt shingles", systemCategory: "Roof", confidence: 0.9, sourceRef: "test" },
    ];
    const result = runContractorAnalysis({
      preProcessorOutput: pp,
      existingSystems: [ROOF_SYSTEM],
      existingTasks: [],
      homeId: "home-1",
    });
    expect(result.matchedSystemUpdates.length).toBeGreaterThanOrEqual(1);
    const roofUpdate = result.matchedSystemUpdates.find((u) => u.systemId === ROOF_SYSTEM.id);
    expect(roofUpdate).toBeDefined();
    const attrValues = Object.values(roofUpdate!.attributes);
    expect(attrValues).toContain("asphalt shingles");
  });

  it("puts attributes for unknown systems into suggested systems", () => {
    const pp = emptyPreProcessorOutput();
    pp.attributesDetected = [
      { key: "material", value: "copper", systemCategory: "Plumbing", confidence: 0.8, sourceRef: "test" },
    ];
    const result = runContractorAnalysis({
      preProcessorOutput: pp,
      existingSystems: [ROOF_SYSTEM],
      existingTasks: [],
      homeId: "home-1",
    });
    const plumbingSuggestion = result.suggestedSystems.find((s) => s.category === "Plumbing");
    expect(plumbingSuggestion).toBeDefined();
    expect(Object.values(plumbingSuggestion!.pendingAttributes)).toContain("copper");
  });
});

describe("Reasoning Engine", () => {
  it("'near end of life' becomes replacement-planning task", () => {
    const pp = emptyPreProcessorOutput();
    pp.issuesDetected = [
      { description: "Water heater near end of life", severity: "moderate", systemCategory: "Water Heater", sourceRef: "Water heater near end of life" },
    ];
    const tasks = runReasoningEngine(pp, [], []);
    const replacement = tasks.find((t) => t.category === "Replacement" || t.category === "Inspection");
    expect(replacement).toBeDefined();
    expect(replacement!.isInferred).toBe(true);
  });

  it("'monitor' becomes inspection/monitor task", () => {
    const pp = emptyPreProcessorOutput();
    pp.issuesDetected = [
      { description: "Monitor for further movement in foundation", severity: "minor", systemCategory: "Foundation", sourceRef: "Monitor for further movement" },
    ];
    const tasks = runReasoningEngine(pp, [], []);
    const monitor = tasks.find((t) => t.category === "Inspection" && t.priority === "monitor");
    expect(monitor).toBeDefined();
    expect(monitor!.isInferred).toBe(true);
  });

  it("'licensed electrician evaluation' becomes inspection task", () => {
    const pp = emptyPreProcessorOutput();
    pp.maintenanceRecommendations = [
      { description: "Recommend licensed electrician evaluation of panel", systemCategory: "Electrical", sourceRef: "licensed electrician evaluation" },
    ];
    const tasks = runReasoningEngine(pp, [], [ELECTRICAL_SYSTEM]);
    const inspection = tasks.find((t) => t.category === "Inspection");
    expect(inspection).toBeDefined();
    expect(inspection!.diyLevel).toBe("Pro-Only");
    expect(inspection!.systemId).toBe(ELECTRICAL_SYSTEM.id);
  });

  it("mild contractor language does not produce extreme recommendations", () => {
    const pp = emptyPreProcessorOutput();
    pp.issuesDetected = [
      { description: "Unit appears operational and in fair condition", severity: "informational", systemCategory: "HVAC", sourceRef: "operational" },
    ];
    const tasks = runReasoningEngine(pp, [], [HVAC_SYSTEM]);
    const extremeTasks = tasks.filter((t) => t.priority === "now" && t.category === "Replacement");
    expect(extremeTasks).toHaveLength(0);
  });

  it("inference remains traceable to source content", () => {
    const pp = emptyPreProcessorOutput();
    pp.issuesDetected = [
      { description: "Shingles are curling on the north side", severity: "moderate", systemCategory: "Roof", sourceRef: "Shingles are curling on the north side" },
    ];
    const tasks = runReasoningEngine(pp, [], [ROOF_SYSTEM]);
    for (const task of tasks) {
      expect(task.isInferred).toBe(true);
      expect(task.inferenceReason).toBeTruthy();
      expect(task.sourceRef).toBeTruthy();
    }
  });

  it("does not fabricate systems not implied by the documents", () => {
    const pp = emptyPreProcessorOutput();
    pp.issuesDetected = [
      { description: "Roof needs repair", severity: "moderate", systemCategory: "Roof", sourceRef: "test" },
    ];
    const tasks = runReasoningEngine(pp, [], [ROOF_SYSTEM]);
    for (const task of tasks) {
      if (task.systemId) {
        expect(task.systemId).toBe(ROOF_SYSTEM.id);
      }
    }
  });

  it("does not duplicate tasks already proposed", () => {
    const pp = emptyPreProcessorOutput();
    pp.issuesDetected = [
      { description: "Shingles are curling badly", severity: "moderate", systemCategory: "Roof", sourceRef: "shingles curling" },
    ];
    const existingTasks: ProposedTask[] = [
      {
        id: "t-1",
        title: "Assess roof shingle condition for repair or replacement",
        description: "",
        category: "Repair",
        priority: "soon",
        urgency: "soon",
        diyLevel: "Pro-Only",
        sourceRef: "test",
        isInferred: false,
        systemId: ROOF_SYSTEM.id,
      },
    ];
    const tasks = runReasoningEngine(pp, existingTasks, [ROOF_SYSTEM]);
    const shingleTasks = tasks.filter((t) => t.title.toLowerCase().includes("shingle"));
    expect(shingleTasks).toHaveLength(0);
  });

  it("gutter debris note becomes maintenance task", () => {
    const pp = emptyPreProcessorOutput();
    pp.issuesDetected = [
      { description: "Debris present in gutters along north side", severity: "minor", systemCategory: "Roof", sourceRef: "Debris present in gutters" },
    ];
    const tasks = runReasoningEngine(pp, [], [ROOF_SYSTEM]);
    const gutterTask = tasks.find((t) => t.title.toLowerCase().includes("gutter"));
    expect(gutterTask).toBeDefined();
    expect(gutterTask!.category).toBe("Maintenance");
  });

  it("installation date reference creates lifecycle task", () => {
    const pp = emptyPreProcessorOutput();
    pp.maintenanceRecommendations = [
      { description: "Unit installed in 2011. Recommend regular service.", systemCategory: "HVAC", sourceRef: "installed in 2011" },
    ];
    const tasks = runReasoningEngine(pp, [], [HVAC_SYSTEM]);
    const lifecycleTask = tasks.find((t) => t.title.toLowerCase().includes("age") || t.title.toLowerCase().includes("history") || t.title.toLowerCase().includes("annual"));
    expect(lifecycleTask).toBeDefined();
  });

  it("water damage reference creates investigation task", () => {
    const pp = emptyPreProcessorOutput();
    pp.issuesDetected = [
      { description: "Water stain visible on ceiling near bathroom", severity: "moderate", systemCategory: "Plumbing", sourceRef: "Water stain visible" },
    ];
    const tasks = runReasoningEngine(pp, [], []);
    const waterTask = tasks.find((t) => t.title.toLowerCase().includes("water"));
    expect(waterTask).toBeDefined();
    expect(waterTask!.category).toBe("Repair");
  });
});

describe("Field Isolation", () => {
  it("setting Roof material does not populate Siding material", () => {
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
  });

  it("task edits for one system do not affect another system", () => {
    const pp = emptyPreProcessorOutput();
    pp.issuesDetected = [
      { description: "Roof needs repair", severity: "moderate", systemCategory: "Roof", sourceRef: "test" },
      { description: "HVAC filter dirty", severity: "minor", systemCategory: "HVAC", sourceRef: "test" },
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
    for (const rt of roofTasks) {
      expect(rt.systemId).not.toBe(HVAC_SYSTEM.id);
    }
    for (const ht of hvacTasks) {
      expect(ht.systemId).not.toBe(ROOF_SYSTEM.id);
    }
  });

  it("pending system attributes do not appear in existing system updates", () => {
    const pp = emptyPreProcessorOutput();
    pp.attributesDetected = [
      { key: "panel_type", value: "monocrystalline", systemCategory: "Solar", confidence: 0.9, sourceRef: "test" },
    ];
    const result = runContractorAnalysis({
      preProcessorOutput: pp,
      existingSystems: [ROOF_SYSTEM, HVAC_SYSTEM],
      existingTasks: [],
      homeId: "home-1",
    });
    for (const update of result.matchedSystemUpdates) {
      const values = Object.values(update.attributes);
      expect(values).not.toContain("monocrystalline");
    }
    expect(result.suggestedSystems.length).toBeGreaterThanOrEqual(1);
  });

  it("backend payloads preserve correct system scoping", () => {
    const pp = emptyPreProcessorOutput();
    pp.attributesDetected = [
      { key: "material", value: "vinyl", systemCategory: "Siding", confidence: 0.9, sourceRef: "test" },
      { key: "material", value: "asphalt", systemCategory: "Roof", confidence: 0.9, sourceRef: "test" },
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
    const roofVals = Object.values(roofUpdate!.attributes);
    const sidingVals = Object.values(sidingUpdate!.attributes);
    expect(roofVals).toContain("asphalt");
    expect(roofVals).not.toContain("vinyl");
    expect(sidingVals).toContain("vinyl");
    expect(sidingVals).not.toContain("asphalt");
  });
});

describe("Sample Scenarios", () => {
  it("Sample A: roof and gutter findings", () => {
    const pp = emptyPreProcessorOutput();
    pp.issuesDetected = [
      {
        description: "Roof shingles are curling and show moderate wear",
        severity: "moderate",
        systemCategory: "Roof",
        sourceRef: "Roof shingles are curling and show moderate wear. Recommend replacement within 3-5 years.",
      },
    ];
    pp.maintenanceRecommendations = [
      {
        description: "Recommend replacement within 3-5 years",
        systemCategory: "Roof",
        timing: "3-5 years",
        sourceRef: "Recommend replacement within 3-5 years.",
      },
    ];
    const contractorResult = runContractorAnalysis({
      preProcessorOutput: pp,
      existingSystems: [ROOF_SYSTEM],
      existingTasks: [],
      homeId: "home-1",
    });
    expect(contractorResult.matchedSystemTasks.length).toBeGreaterThanOrEqual(1);
    expect(contractorResult.matchedSystemTasks[0].systemId).toBe(ROOF_SYSTEM.id);
  });

  it("Sample B: water heater with install date", () => {
    const pp = emptyPreProcessorOutput();
    pp.attributesDetected = [
      { key: "install_date", value: "2012", systemCategory: "Water Heater", confidence: 0.95, sourceRef: "Water heater installed in 2012" },
    ];
    pp.maintenanceRecommendations = [
      { description: "Recommend monitoring for leaks", systemCategory: "Water Heater", sourceRef: "Recommend monitoring for leaks. Unit appears operational." },
    ];
    const waterHeater: ExistingSystem = { id: "sys-wh-1", category: "Water Heater", name: "Water Heater" };
    const contractorResult = runContractorAnalysis({
      preProcessorOutput: pp,
      existingSystems: [waterHeater],
      existingTasks: [],
      homeId: "home-1",
    });
    expect(contractorResult.matchedSystemUpdates.length).toBeGreaterThanOrEqual(1);
    expect(contractorResult.matchedSystemTasks.length).toBeGreaterThanOrEqual(1);
  });

  it("Sample C: solar system not yet existing", () => {
    const pp = emptyPreProcessorOutput();
    pp.systemsDetected = [
      { name: "Solar Inverter", category: "Solar", confidence: 0.9, sourceRef: "Solar inverter located in garage" },
    ];
    pp.maintenanceRecommendations = [
      { description: "Recommend annual inspection of solar system", systemCategory: "Solar", sourceRef: "Recommend annual inspection." },
    ];
    const contractorResult = runContractorAnalysis({
      preProcessorOutput: pp,
      existingSystems: [ROOF_SYSTEM],
      existingTasks: [],
      homeId: "home-1",
    });
    const solarSuggestion = contractorResult.suggestedSystems.find((s) => s.category === "Solar");
    expect(solarSuggestion).toBeDefined();
    expect(solarSuggestion!.status).toBe("pending");
    expect(solarSuggestion!.pendingTasks.length).toBeGreaterThanOrEqual(1);
  });
});

describe("False Positive Guards", () => {
  it("'CO monitor installed' does not create a monitoring task", () => {
    const pp = emptyPreProcessorOutput();
    pp.issuesDetected = [
      { description: "CO monitor installed on each level", severity: "informational", systemCategory: "Other", sourceRef: "CO monitor installed on each level" },
    ];
    const tasks = runReasoningEngine(pp, [], []);
    const monitorTasks = tasks.filter((t) => t.category === "Inspection" && t.priority === "monitor");
    expect(monitorTasks).toHaveLength(0);
  });

  it("'monitoring system' does not create a monitoring task", () => {
    const pp = emptyPreProcessorOutput();
    pp.issuesDetected = [
      { description: "Home security monitoring system present", severity: "informational", systemCategory: "Other", sourceRef: "Home security monitoring system present" },
    ];
    const tasks = runReasoningEngine(pp, [], []);
    const monitorTasks = tasks.filter((t) => t.category === "Inspection" && t.priority === "monitor");
    expect(monitorTasks).toHaveLength(0);
  });

  it("mentioning 'electrician' in a label does not trigger professional eval", () => {
    const pp = emptyPreProcessorOutput();
    pp.issuesDetected = [
      { description: "Panel label shows electrician company name", severity: "informational", systemCategory: "Electrical", sourceRef: "Panel label shows electrician company name" },
    ];
    const tasks = runReasoningEngine(pp, [], [ELECTRICAL_SYSTEM]);
    const proTasks = tasks.filter((t) => t.inferenceReason?.includes("Professional evaluation"));
    expect(proTasks).toHaveLength(0);
  });

  it("'improperly installed flashing' does not trigger code violation (no code context)", () => {
    const pp = emptyPreProcessorOutput();
    pp.issuesDetected = [
      { description: "Flashing appears improperly installed at roof-wall junction", severity: "moderate", systemCategory: "Roof", sourceRef: "Flashing improperly installed" },
    ];
    const tasks = runReasoningEngine(pp, [], [ROOF_SYSTEM]);
    const codeTasks = tasks.filter((t) => t.inferenceReason?.includes("Code violation"));
    expect(codeTasks).toHaveLength(0);
  });

  it("informational findings do not produce urgent tasks", () => {
    const pp = emptyPreProcessorOutput();
    pp.issuesDetected = [
      { description: "Smoke detectors present on all levels", severity: "informational", systemCategory: "Other", sourceRef: "Smoke detectors present" },
      { description: "Gas meter located on east side of home", severity: "informational", systemCategory: "Other", sourceRef: "Gas meter located" },
    ];
    const tasks = runReasoningEngine(pp, [], []);
    const urgentTasks = tasks.filter((t) => t.priority === "now");
    expect(urgentTasks).toHaveLength(0);
  });

  it("'unit appears operational' does not create replacement task", () => {
    const pp = emptyPreProcessorOutput();
    pp.issuesDetected = [
      { description: "Unit appears operational and in fair condition", severity: "informational", systemCategory: "HVAC", sourceRef: "operational" },
    ];
    const tasks = runReasoningEngine(pp, [], [HVAC_SYSTEM]);
    const replacementTasks = tasks.filter((t) => t.category === "Replacement");
    expect(replacementTasks).toHaveLength(0);
  });

  it("diverse report phrasings: 'have it checked' triggers monitoring", () => {
    const pp = emptyPreProcessorOutput();
    pp.maintenanceRecommendations = [
      { description: "Should monitor for further cracking over time", systemCategory: "Foundation", sourceRef: "monitor for further cracking" },
    ];
    const tasks = runReasoningEngine(pp, [], []);
    const monitorTasks = tasks.filter((t) => t.priority === "monitor");
    expect(monitorTasks.length).toBeGreaterThanOrEqual(1);
  });

  it("diverse report phrasings: 'contact a qualified contractor' triggers professional eval", () => {
    const pp = emptyPreProcessorOutput();
    pp.maintenanceRecommendations = [
      { description: "Contact a qualified professional for further evaluation", systemCategory: "Roof", sourceRef: "Contact a qualified professional" },
    ];
    const tasks = runReasoningEngine(pp, [], [ROOF_SYSTEM]);
    const proTasks = tasks.filter((t) => t.diyLevel === "Pro-Only");
    expect(proTasks.length).toBeGreaterThanOrEqual(1);
  });

  it("diverse report phrasings: 'needs to be replaced soon' triggers replacement", () => {
    const pp = emptyPreProcessorOutput();
    pp.issuesDetected = [
      { description: "Water heater needs to be replaced soon due to age", severity: "moderate", systemCategory: "Water Heater", sourceRef: "needs to be replaced soon" },
    ];
    const tasks = runReasoningEngine(pp, [], []);
    const replacementTasks = tasks.filter((t) => t.category === "Replacement");
    expect(replacementTasks.length).toBeGreaterThanOrEqual(1);
  });

  it("diverse report phrasings: 'recommend annual service' triggers periodic inspection", () => {
    const pp = emptyPreProcessorOutput();
    pp.maintenanceRecommendations = [
      { description: "Recommend annual service and inspection of HVAC system", systemCategory: "HVAC", sourceRef: "Recommend annual service" },
    ];
    const tasks = runReasoningEngine(pp, [], [HVAC_SYSTEM]);
    const annualTasks = tasks.filter((t) => t.title.toLowerCase().includes("annual"));
    expect(annualTasks.length).toBeGreaterThanOrEqual(1);
  });

  it("diverse report phrasings: 'moisture damage on ceiling' triggers water investigation", () => {
    const pp = emptyPreProcessorOutput();
    pp.issuesDetected = [
      { description: "Moisture damage visible on bathroom ceiling", severity: "moderate", systemCategory: "Plumbing", sourceRef: "Moisture damage on ceiling" },
    ];
    const tasks = runReasoningEngine(pp, [], []);
    const waterTasks = tasks.filter((t) => t.title.toLowerCase().includes("water"));
    expect(waterTasks.length).toBeGreaterThanOrEqual(1);
  });

  it("diverse report phrasings: 'settling noted in garage slab' triggers structural eval", () => {
    const pp = emptyPreProcessorOutput();
    pp.issuesDetected = [
      { description: "Settling noted in garage slab with minor cracking", severity: "moderate", systemCategory: "Foundation", sourceRef: "Settling noted in garage slab" },
    ];
    const tasks = runReasoningEngine(pp, [], []);
    const structuralTasks = tasks.filter((t) => t.title.toLowerCase().includes("structural"));
    expect(structuralTasks.length).toBeGreaterThanOrEqual(1);
  });

  it("diverse report phrasings: 'negative grade slopes toward house' triggers drainage task", () => {
    const pp = emptyPreProcessorOutput();
    pp.issuesDetected = [
      { description: "Negative grade on south side slopes toward house foundation", severity: "moderate", systemCategory: "Drainage", sourceRef: "Negative grade slopes toward house" },
    ];
    const tasks = runReasoningEngine(pp, [], []);
    const drainageTasks = tasks.filter((t) => t.title.toLowerCase().includes("grading") || t.title.toLowerCase().includes("drainage"));
    expect(drainageTasks.length).toBeGreaterThanOrEqual(1);
  });

  it("diverse report phrasings: 'wood rot at trim boards' triggers repair", () => {
    const pp = emptyPreProcessorOutput();
    pp.issuesDetected = [
      { description: "Wood rot at trim boards along east elevation", severity: "moderate", systemCategory: "Siding", sourceRef: "Wood rot at trim boards" },
    ];
    const tasks = runReasoningEngine(pp, [], []);
    const rotTasks = tasks.filter((t) => t.title.toLowerCase().includes("wood"));
    expect(rotTasks.length).toBeGreaterThanOrEqual(1);
  });

  it("diverse report phrasings: 'polybutylene piping throughout' triggers known-risk eval", () => {
    const pp = emptyPreProcessorOutput();
    pp.issuesDetected = [
      { description: "Polybutylene piping throughout the home supply lines", severity: "critical", systemCategory: "Plumbing", sourceRef: "Polybutylene piping throughout" },
    ];
    const tasks = runReasoningEngine(pp, [], []);
    const riskTasks = tasks.filter((t) => t.inferenceReason?.includes("Known-risk"));
    expect(riskTasks.length).toBeGreaterThanOrEqual(1);
  });
});

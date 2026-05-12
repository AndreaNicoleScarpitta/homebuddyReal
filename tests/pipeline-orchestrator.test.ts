/**
 * Tests for the analysis pipeline orchestrator (the 3-stage coordinator).
 *
 * The orchestrator coordinates:
 *   Stage 1 — runPreProcessor   (OpenAI: extracts signals from document text)
 *   Stage 2 — runContractorAnalysis  (pure: matches signals to systems/tasks)
 *   Stage 3 — runReasoningEngine     (pure: infers additional tasks from language)
 *
 * All three stages are mocked here so this test focuses purely on the
 * orchestration logic: result assembly, inferred-task routing, sourceFiles
 * metadata, and graceful degradation when stages return empty output.
 *
 * Individual stage behaviour is tested in:
 *   - tests/pre-processor.test.ts
 *   - tests/analysis-pipeline.test.ts
 *   - tests/rfb-real-file-analysis.test.ts
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { runAnalysisPipeline } from "../server/lib/analysis-pipeline/orchestrator";
import type {
  PreProcessorOutput,
  ExistingSystem,
  ContractorAnalysisOutput,
  ProposedTask,
  SuggestedSystem,
  MatchedSystemUpdate,
} from "../server/lib/analysis-pipeline/types";

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock("../server/lib/analysis-pipeline/pre-processor", () => ({
  runPreProcessor: vi.fn(),
}));

vi.mock("../server/lib/analysis-pipeline/contractor-analysis", () => ({
  runContractorAnalysis: vi.fn(),
}));

vi.mock("../server/lib/analysis-pipeline/reasoning-engine", () => ({
  runReasoningEngine: vi.fn(),
}));

vi.mock("../server/lib/logger", () => ({
  logInfo: vi.fn(),
  logError: vi.fn(),
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function getMockPreProcessor() {
  const mod = await import("../server/lib/analysis-pipeline/pre-processor");
  return mod.runPreProcessor as ReturnType<typeof vi.fn>;
}

async function getMockContractorAnalysis() {
  const mod = await import("../server/lib/analysis-pipeline/contractor-analysis");
  return mod.runContractorAnalysis as ReturnType<typeof vi.fn>;
}

async function getMockReasoningEngine() {
  const mod = await import("../server/lib/analysis-pipeline/reasoning-engine");
  return mod.runReasoningEngine as ReturnType<typeof vi.fn>;
}

const OPENAI_CONFIG = { apiKey: "test-key", baseURL: "https://api.openai.com/v1" };

function emptyPP(): PreProcessorOutput {
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

function emptyContractorOutput(): ContractorAnalysisOutput {
  return {
    matchedSystemUpdates: [],
    matchedSystemTasks: [],
    suggestedSystems: [],
    warnings: [],
  };
}

function makeTask(id: string, systemId?: string, suggestionId?: string): ProposedTask {
  return {
    id,
    title: `Task ${id}`,
    description: "",
    systemId,
    suggestionId,
    category: "Repair",
    priority: "soon",
    urgency: "soon",
    diyLevel: "Caution",
    sourceRef: `source for ${id}`,
    isInferred: false,
  };
}

function makeSuggestion(id: string, category: string): SuggestedSystem {
  return {
    id,
    name: category,
    category,
    reason: "detected in document",
    status: "pending",
    sourceRef: "test",
    pendingAttributes: {},
    pendingTasks: [],
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("Pipeline Orchestrator", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ─── Output shape ──────────────────────────────────────────────────────────

  describe("Output shape", () => {
    it("always returns the full AnalysisResult shape", async () => {
      const mockPP = await getMockPreProcessor();
      const mockCA = await getMockContractorAnalysis();
      const mockRE = await getMockReasoningEngine();
      mockPP.mockResolvedValueOnce(emptyPP());
      mockCA.mockReturnValueOnce(emptyContractorOutput());
      mockRE.mockReturnValueOnce([]);

      const result = await runAnalysisPipeline(
        [{ text: "test", fileName: "f.txt", fileType: "text/plain" }],
        [],
        [],
        "home-x",
        OPENAI_CONFIG
      );

      expect(result).toHaveProperty("matchedSystemUpdates");
      expect(result).toHaveProperty("matchedSystemTasks");
      expect(result).toHaveProperty("suggestedSystems");
      expect(result).toHaveProperty("analysisWarnings");
      expect(result).toHaveProperty("sourceFiles");
      expect(Array.isArray(result.matchedSystemUpdates)).toBe(true);
      expect(Array.isArray(result.matchedSystemTasks)).toBe(true);
      expect(Array.isArray(result.suggestedSystems)).toBe(true);
      expect(Array.isArray(result.analysisWarnings)).toBe(true);
      expect(Array.isArray(result.sourceFiles)).toBe(true);
    });

    it("records fileName, fileType, and exact textLength in sourceFiles", async () => {
      const mockPP = await getMockPreProcessor();
      const mockCA = await getMockContractorAnalysis();
      const mockRE = await getMockReasoningEngine();
      mockPP.mockResolvedValueOnce(emptyPP());
      mockCA.mockReturnValueOnce(emptyContractorOutput());
      mockRE.mockReturnValueOnce([]);

      const result = await runAnalysisPipeline(
        [{ text: "Some text here", fileName: "report.pdf", fileType: "application/pdf" }],
        [],
        [],
        "home-1",
        OPENAI_CONFIG
      );

      expect(result.sourceFiles).toHaveLength(1);
      expect(result.sourceFiles[0].fileName).toBe("report.pdf");
      expect(result.sourceFiles[0].fileType).toBe("application/pdf");
      expect(result.sourceFiles[0].textLength).toBe("Some text here".length);
    });

    it("records metadata for multiple uploaded files", async () => {
      const mockPP = await getMockPreProcessor();
      const mockCA = await getMockContractorAnalysis();
      const mockRE = await getMockReasoningEngine();
      mockPP.mockResolvedValueOnce(emptyPP());
      mockCA.mockReturnValueOnce(emptyContractorOutput());
      mockRE.mockReturnValueOnce([]);

      const result = await runAnalysisPipeline(
        [
          { text: "File one", fileName: "inspection.pdf", fileType: "application/pdf" },
          { text: "File two content", fileName: "receipt.jpg", fileType: "image/jpeg" },
        ],
        [],
        [],
        "home-multi",
        OPENAI_CONFIG
      );

      expect(result.sourceFiles).toHaveLength(2);
      expect(result.sourceFiles[0].fileName).toBe("inspection.pdf");
      expect(result.sourceFiles[1].fileName).toBe("receipt.jpg");
    });
  });

  // ─── Graceful degradation ──────────────────────────────────────────────────

  describe("Graceful degradation — when Stage 1 (OpenAI) returns empty", () => {
    it("returns all-empty arrays when pre-processor returns empty output", async () => {
      const mockPP = await getMockPreProcessor();
      const mockCA = await getMockContractorAnalysis();
      const mockRE = await getMockReasoningEngine();
      mockPP.mockResolvedValueOnce(emptyPP());
      mockCA.mockReturnValueOnce(emptyContractorOutput());
      mockRE.mockReturnValueOnce([]);

      const result = await runAnalysisPipeline(
        [{ text: "test doc", fileName: "test.txt", fileType: "text/plain" }],
        [],
        [],
        "home-empty",
        OPENAI_CONFIG
      );

      expect(result.matchedSystemTasks).toEqual([]);
      expect(result.matchedSystemUpdates).toEqual([]);
      expect(result.suggestedSystems).toEqual([]);
      expect(result.analysisWarnings).toEqual([]);
    });

    it("still records sourceFiles even when analysis produces nothing", async () => {
      const mockPP = await getMockPreProcessor();
      const mockCA = await getMockContractorAnalysis();
      const mockRE = await getMockReasoningEngine();
      mockPP.mockResolvedValueOnce(emptyPP());
      mockCA.mockReturnValueOnce(emptyContractorOutput());
      mockRE.mockReturnValueOnce([]);

      const result = await runAnalysisPipeline(
        [{ text: "quota fail doc", fileName: "quota-fail.pdf", fileType: "application/pdf" }],
        [],
        [],
        "home-quota",
        OPENAI_CONFIG
      );

      expect(result.sourceFiles).toHaveLength(1);
      expect(result.sourceFiles[0].fileName).toBe("quota-fail.pdf");
    });
  });

  // ─── Stage wiring ──────────────────────────────────────────────────────────

  describe("Stage wiring — pre-processor output is passed to contractor analysis", () => {
    it("passes pre-processor output and existing systems to contractor analysis", async () => {
      const mockPP = await getMockPreProcessor();
      const mockCA = await getMockContractorAnalysis();
      const mockRE = await getMockReasoningEngine();

      const pp = {
        ...emptyPP(),
        issuesDetected: [
          { description: "Roof wear", severity: "moderate" as const, systemCategory: "Roof", sourceRef: "test" },
        ],
      };
      const existingSystems: ExistingSystem[] = [
        { id: "sys-roof", category: "Roof", name: "Roof" },
      ];

      mockPP.mockResolvedValueOnce(pp);
      mockCA.mockReturnValueOnce(emptyContractorOutput());
      mockRE.mockReturnValueOnce([]);

      await runAnalysisPipeline(
        [{ text: "Roof inspection text.", fileName: "r.pdf", fileType: "application/pdf" }],
        existingSystems,
        [],
        "home-wiring",
        OPENAI_CONFIG
      );

      expect(mockCA).toHaveBeenCalledWith(
        expect.objectContaining({
          preProcessorOutput: pp,
          existingSystems,
          homeId: "home-wiring",
        })
      );
    });

    it("passes combined contractor + reasoning tasks to the final result", async () => {
      const mockPP = await getMockPreProcessor();
      const mockCA = await getMockContractorAnalysis();
      const mockRE = await getMockReasoningEngine();

      const contractorTask = makeTask("ct-1", "sys-roof");
      const inferredTask = makeTask("inf-1", "sys-roof");
      inferredTask.isInferred = true;

      mockPP.mockResolvedValueOnce(emptyPP());
      mockCA.mockReturnValueOnce({
        ...emptyContractorOutput(),
        matchedSystemTasks: [contractorTask],
      });
      mockRE.mockReturnValueOnce([inferredTask]);

      const result = await runAnalysisPipeline(
        [{ text: "test", fileName: "t.pdf", fileType: "application/pdf" }],
        [{ id: "sys-roof", category: "Roof", name: "Roof" }],
        [],
        "home-combined",
        OPENAI_CONFIG
      );

      // Both contractor + inferred tasks end up in matchedSystemTasks
      const titles = result.matchedSystemTasks.map((t) => t.id);
      expect(titles).toContain("ct-1");
      expect(titles).toContain("inf-1");
    });

    it("includes contractor warnings in analysisWarnings", async () => {
      const mockPP = await getMockPreProcessor();
      const mockCA = await getMockContractorAnalysis();
      const mockRE = await getMockReasoningEngine();

      mockPP.mockResolvedValueOnce(emptyPP());
      mockCA.mockReturnValueOnce({
        ...emptyContractorOutput(),
        warnings: ["No issues detected in document"],
      });
      mockRE.mockReturnValueOnce([]);

      const result = await runAnalysisPipeline(
        [{ text: "test", fileName: "t.pdf", fileType: "application/pdf" }],
        [],
        [],
        "home-warn",
        OPENAI_CONFIG
      );

      expect(result.analysisWarnings).toContain("No issues detected in document");
    });
  });

  // ─── Inferred task routing ─────────────────────────────────────────────────

  describe("Inferred task routing (Stage 3 output → Stage 2 systems)", () => {
    it("appends inferred tasks with a systemId to matchedSystemTasks", async () => {
      const mockPP = await getMockPreProcessor();
      const mockCA = await getMockContractorAnalysis();
      const mockRE = await getMockReasoningEngine();

      const inferredTask = makeTask("inf-roof", "sys-roof");
      inferredTask.isInferred = true;

      mockPP.mockResolvedValueOnce(emptyPP());
      mockCA.mockReturnValueOnce(emptyContractorOutput());
      mockRE.mockReturnValueOnce([inferredTask]);

      const result = await runAnalysisPipeline(
        [{ text: "test", fileName: "t.pdf", fileType: "application/pdf" }],
        [{ id: "sys-roof", category: "Roof", name: "Roof" }],
        [],
        "home-infer-match",
        OPENAI_CONFIG
      );

      expect(result.matchedSystemTasks.some((t) => t.id === "inf-roof")).toBe(true);
    });

    it("routes inferred tasks (no systemId) to a matching suggested system", async () => {
      const mockPP = await getMockPreProcessor();
      const mockCA = await getMockContractorAnalysis();
      const mockRE = await getMockReasoningEngine();

      const solarSuggestion = makeSuggestion("sug-solar", "Solar");
      const inferredTask = makeTask("inf-solar"); // no systemId
      inferredTask.isInferred = true;
      // Pre-processor output has a solar issue so extractSystemCategory finds "Solar"
      const pp: PreProcessorOutput = {
        ...emptyPP(),
        issuesDetected: [
          { description: "Monitor solar system performance", severity: "minor" as const, systemCategory: "Solar", sourceRef: "solar" },
        ],
      };

      mockPP.mockResolvedValueOnce(pp);
      mockCA.mockReturnValueOnce({
        ...emptyContractorOutput(),
        suggestedSystems: [solarSuggestion],
      });
      mockRE.mockReturnValueOnce([inferredTask]);

      const result = await runAnalysisPipeline(
        [{ text: "Solar monitor.", fileName: "t.pdf", fileType: "application/pdf" }],
        [],
        [],
        "home-infer-solar",
        OPENAI_CONFIG
      );

      const solar = result.suggestedSystems.find((s) => s.id === "sug-solar");
      expect(solar).toBeDefined();
      // Inferred task should have been pushed into the solar suggestion
      expect(solar!.pendingTasks.some((t) => t.id === "inf-solar")).toBe(true);
      expect(solar!.pendingTasks.find((t) => t.id === "inf-solar")!.suggestionId).toBe("sug-solar");
    });

    it("drops inferred tasks with no matching system or suggestion without crashing", async () => {
      const mockPP = await getMockPreProcessor();
      const mockCA = await getMockContractorAnalysis();
      const mockRE = await getMockReasoningEngine();

      const orphanTask = makeTask("orphan"); // no systemId, no suggestionId
      orphanTask.isInferred = true;
      // title/description contain "pool" but no pool system or suggestion exists

      mockPP.mockResolvedValueOnce(emptyPP()); // nothing for extractSystemCategory to match
      mockCA.mockReturnValueOnce(emptyContractorOutput()); // no suggestions
      mockRE.mockReturnValueOnce([orphanTask]);

      let threw = false;
      let result: any;
      try {
        result = await runAnalysisPipeline(
          [{ text: "Pool deck settling.", fileName: "t.pdf", fileType: "application/pdf" }],
          [],
          [],
          "home-orphan",
          OPENAI_CONFIG
        );
      } catch {
        threw = true;
      }

      expect(threw).toBe(false);
      // Orphan task is dropped — not in matchedSystemTasks, not in any suggested system
      expect(result.matchedSystemTasks.some((t: ProposedTask) => t.id === "orphan")).toBe(false);
      for (const s of result.suggestedSystems) {
        expect(s.pendingTasks.some((t: ProposedTask) => t.id === "orphan")).toBe(false);
      }
    });
  });
});

/**
 * Tests for the analysis pipeline pre-processor (Stage 1).
 *
 * The pre-processor is the first stage of the 3-stage analysis pipeline.
 * It calls OpenAI to extract structured signals from uploaded document text.
 * These tests verify correct output on the happy path AND graceful degradation
 * when OpenAI is unavailable (quota exceeded, network error, malformed response).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { runPreProcessor } from "../server/lib/analysis-pipeline/pre-processor";

vi.mock("openai", () => {
  const create = vi.fn();
  return {
    default: class {
      chat = { completions: { create } };
    },
    __mockCreate: create,
  };
});

vi.mock("../server/lib/logger", () => ({
  logInfo: vi.fn(),
  logError: vi.fn(),
}));

async function getMockCreate() {
  const mod = await import("openai");
  return (mod as any).__mockCreate as ReturnType<typeof vi.fn>;
}

const VALID_FILES = [
  {
    text: "Roof shingles showing wear. HVAC filter needs replacement. Electrical panel has double tap.",
    fileName: "inspection.pdf",
    fileType: "application/pdf",
  },
];

const OPENAI_CONFIG = { apiKey: "test-key", baseURL: "https://api.openai.com/v1" };

const VALID_RESPONSE = {
  systemsDetected: [
    { name: "Roof", category: "Roof", confidence: 0.95, sourceRef: "Roof shingles showing wear" },
    { name: "HVAC", category: "HVAC", confidence: 0.9, sourceRef: "HVAC filter needs replacement" },
  ],
  equipmentDetected: [],
  issuesDetected: [
    { description: "Roof shingles showing wear", severity: "moderate", systemCategory: "Roof", sourceRef: "Roof shingles showing wear" },
    { description: "Double tap on electrical panel", severity: "moderate", systemCategory: "Electrical", sourceRef: "Electrical panel has double tap" },
  ],
  maintenanceRecommendations: [
    { description: "Replace HVAC filter", systemCategory: "HVAC", sourceRef: "HVAC filter needs replacement" },
  ],
  attributesDetected: [
    { key: "condition", value: "worn", systemCategory: "Roof", confidence: 0.85, sourceRef: "Roof shingles showing wear" },
  ],
  safetyFindings: [
    { description: "Double tap — fire hazard", systemCategory: "Electrical", severity: "critical", sourceRef: "double tap" },
  ],
  sourceReferences: [
    { text: "Roof shingles showing wear", fileIndex: 0, fileName: "inspection.pdf" },
  ],
};

describe("Pre-Processor (Stage 1)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ─── Happy path ───────────────────────────────────────────────────────────

  describe("Happy path", () => {
    it("returns all structured arrays when OpenAI returns valid JSON", async () => {
      const mockCreate = await getMockCreate();
      mockCreate.mockResolvedValueOnce({
        choices: [{ message: { content: JSON.stringify(VALID_RESPONSE) } }],
      });

      const result = await runPreProcessor(VALID_FILES, OPENAI_CONFIG);

      expect(result.systemsDetected).toHaveLength(2);
      expect(result.issuesDetected).toHaveLength(2);
      expect(result.maintenanceRecommendations).toHaveLength(1);
      expect(result.attributesDetected).toHaveLength(1);
      expect(result.safetyFindings).toHaveLength(1);
      expect(result.sourceReferences).toHaveLength(1);
    });

    it("preserves system categories from OpenAI response", async () => {
      const mockCreate = await getMockCreate();
      mockCreate.mockResolvedValueOnce({
        choices: [{ message: { content: JSON.stringify(VALID_RESPONSE) } }],
      });

      const result = await runPreProcessor(VALID_FILES, OPENAI_CONFIG);

      expect(result.systemsDetected[0].category).toBe("Roof");
      expect(result.systemsDetected[1].category).toBe("HVAC");
    });

    it("preserves severity on detected issues", async () => {
      const mockCreate = await getMockCreate();
      mockCreate.mockResolvedValueOnce({
        choices: [{ message: { content: JSON.stringify(VALID_RESPONSE) } }],
      });

      const result = await runPreProcessor(VALID_FILES, OPENAI_CONFIG);

      const electricalIssue = result.issuesDetected.find((i) => i.systemCategory === "Electrical");
      expect(electricalIssue).toBeDefined();
      expect(electricalIssue!.severity).toBe("moderate");
    });

    it("attaches correct file name and index to source references", async () => {
      const mockCreate = await getMockCreate();
      mockCreate.mockResolvedValueOnce({
        choices: [{ message: { content: JSON.stringify(VALID_RESPONSE) } }],
      });

      const result = await runPreProcessor(VALID_FILES, OPENAI_CONFIG);

      expect(result.sourceReferences[0].fileName).toBe("inspection.pdf");
      expect(result.sourceReferences[0].fileIndex).toBe(0);
    });

    it("normalises null/missing arrays to empty arrays", async () => {
      const mockCreate = await getMockCreate();
      // Response with only issuesDetected, all other arrays absent
      mockCreate.mockResolvedValueOnce({
        choices: [
          {
            message: {
              content: JSON.stringify({
                issuesDetected: [
                  { description: "test", severity: "minor", systemCategory: "Roof", sourceRef: "test" },
                ],
              }),
            },
          },
        ],
      });

      const result = await runPreProcessor(VALID_FILES, OPENAI_CONFIG);

      expect(result.systemsDetected).toEqual([]);
      expect(result.equipmentDetected).toEqual([]);
      expect(result.maintenanceRecommendations).toEqual([]);
      expect(result.attributesDetected).toEqual([]);
      expect(result.safetyFindings).toEqual([]);
      expect(result.issuesDetected).toHaveLength(1);
    });

    it("uses fileName from input when source references omit fileName", async () => {
      const mockCreate = await getMockCreate();
      mockCreate.mockResolvedValueOnce({
        choices: [
          {
            message: {
              content: JSON.stringify({
                ...VALID_RESPONSE,
                sourceReferences: [{ text: "excerpt", fileIndex: 0 }], // no fileName
              }),
            },
          },
        ],
      });

      const result = await runPreProcessor(VALID_FILES, OPENAI_CONFIG);

      expect(result.sourceReferences[0].fileName).toBe("inspection.pdf");
    });
  });

  // ─── Error resilience ─────────────────────────────────────────────────────

  describe("Error resilience — OpenAI failures return empty output, not throws", () => {
    it("returns emptyOutput on OpenAI 429 quota exceeded (the real error we hit)", async () => {
      const mockCreate = await getMockCreate();
      const quotaErr = new Error(
        "429 You exceeded your current quota, please check your plan and billing details."
      );
      (quotaErr as any).status = 429;
      mockCreate.mockRejectedValueOnce(quotaErr);

      const result = await runPreProcessor(VALID_FILES, OPENAI_CONFIG);

      expect(result.systemsDetected).toEqual([]);
      expect(result.issuesDetected).toEqual([]);
      expect(result.maintenanceRecommendations).toEqual([]);
      expect(result.attributesDetected).toEqual([]);
      expect(result.safetyFindings).toEqual([]);
    });

    it("returns emptyOutput on 500 internal server error", async () => {
      const mockCreate = await getMockCreate();
      mockCreate.mockRejectedValueOnce(new Error("500 Internal Server Error"));

      const result = await runPreProcessor(VALID_FILES, OPENAI_CONFIG);

      expect(result.systemsDetected).toEqual([]);
      expect(result.issuesDetected).toEqual([]);
    });

    it("returns emptyOutput on network timeout", async () => {
      const mockCreate = await getMockCreate();
      mockCreate.mockRejectedValueOnce(new Error("Request timed out"));

      const result = await runPreProcessor(VALID_FILES, OPENAI_CONFIG);

      expect(result.systemsDetected).toEqual([]);
    });

    it("returns emptyOutput when OpenAI returns null content", async () => {
      const mockCreate = await getMockCreate();
      mockCreate.mockResolvedValueOnce({
        choices: [{ message: { content: null } }],
      });

      const result = await runPreProcessor(VALID_FILES, OPENAI_CONFIG);

      expect(result.systemsDetected).toEqual([]);
      expect(result.issuesDetected).toEqual([]);
    });

    it("returns emptyOutput when OpenAI returns invalid JSON", async () => {
      const mockCreate = await getMockCreate();
      mockCreate.mockResolvedValueOnce({
        choices: [{ message: { content: "not valid json {{{" } }],
      });

      const result = await runPreProcessor(VALID_FILES, OPENAI_CONFIG);

      expect(result.systemsDetected).toEqual([]);
      expect(result.issuesDetected).toEqual([]);
    });

    it("returns emptyOutput when OpenAI returns an empty object", async () => {
      const mockCreate = await getMockCreate();
      mockCreate.mockResolvedValueOnce({
        choices: [{ message: { content: "{}" } }],
      });

      const result = await runPreProcessor(VALID_FILES, OPENAI_CONFIG);

      expect(result.systemsDetected).toEqual([]);
      expect(result.issuesDetected).toEqual([]);
    });
  });

  // ─── Input guards ─────────────────────────────────────────────────────────

  describe("Input guards — skips OpenAI call for empty/trivial documents", () => {
    it("returns emptyOutput without calling OpenAI for empty text", async () => {
      const mockCreate = await getMockCreate();

      const result = await runPreProcessor(
        [{ text: "", fileName: "empty.pdf", fileType: "application/pdf" }],
        OPENAI_CONFIG
      );

      expect(mockCreate).not.toHaveBeenCalled();
      expect(result.systemsDetected).toEqual([]);
    });

    it("returns emptyOutput without calling OpenAI for whitespace-only text", async () => {
      const mockCreate = await getMockCreate();

      const result = await runPreProcessor(
        [{ text: "   \n\t  ", fileName: "blank.txt", fileType: "text/plain" }],
        OPENAI_CONFIG
      );

      expect(mockCreate).not.toHaveBeenCalled();
      expect(result.issuesDetected).toEqual([]);
    });

    it("truncates each file's text to 12 000 characters before sending to OpenAI", async () => {
      const mockCreate = await getMockCreate();
      mockCreate.mockResolvedValueOnce({
        choices: [{ message: { content: JSON.stringify(VALID_RESPONSE) } }],
      });

      const longText = "A".repeat(20_000);
      await runPreProcessor(
        [{ text: longText, fileName: "huge.txt", fileType: "text/plain" }],
        OPENAI_CONFIG
      );

      const callArgs = mockCreate.mock.calls[0][0];
      const userMessage = callArgs.messages.find((m: any) => m.role === "user");
      // 20 000-char input must have been truncated — combined prompt should be well under 20 000
      expect(userMessage.content.length).toBeLessThan(15_000);
    });

    it("handles multiple files without crashing", async () => {
      const mockCreate = await getMockCreate();
      mockCreate.mockResolvedValueOnce({
        choices: [{ message: { content: JSON.stringify(VALID_RESPONSE) } }],
      });

      const result = await runPreProcessor(
        [
          { text: "File one content about the roof.", fileName: "file1.txt", fileType: "text/plain" },
          { text: "File two content about plumbing.", fileName: "file2.txt", fileType: "text/plain" },
        ],
        OPENAI_CONFIG
      );

      expect(mockCreate).toHaveBeenCalledTimes(1);
      expect(result.systemsDetected.length).toBeGreaterThanOrEqual(0);
    });
  });
});

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  extractTextFromDocument,
  analyzeDocumentWithLLM,
  convertIssuesToTasks,
  documentAnalysisResponseSchema,
  systemNameToPrefix,
  prefixAttribute,
  validateAttributeNamespace,
  enforceAttributeNamespaces,
  type ExtractedIssue,
} from "../server/lib/document-analysis";

vi.mock("openai", () => {
  const create = vi.fn();
  return {
    default: class {
      chat = { completions: { create } };
    },
    __mockCreate: create,
  };
});

vi.mock("../server/storage", () => ({
  storage: {
    getHomeById: vi.fn().mockResolvedValue({
      id: 1,
      city: "Austin",
      state: "TX",
      builtYear: 1995,
      sqFt: 2000,
      type: "Single Family",
    }),
  },
}));

vi.mock("../server/lib/logger", () => ({
  logInfo: vi.fn(),
  logError: vi.fn(),
}));

async function getMockCreate() {
  const mod = await import("openai");
  return (mod as any).__mockCreate as ReturnType<typeof vi.fn>;
}

describe("Document Analysis", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("extractTextFromDocument", () => {
    it("should extract text from a PDF buffer", async () => {
      vi.doMock("pdf-parse", () => ({
        default: vi.fn().mockResolvedValue({ text: "Roof needs repair. Plumbing leak in basement." }),
      }));

      const buffer = Buffer.from("fake pdf content");
      const text = await extractTextFromDocument(buffer, "application/pdf");
      expect(text).toBe("Roof needs repair. Plumbing leak in basement.");
    });

    it("should extract text from a plain text buffer", async () => {
      const content = "The HVAC system is making unusual noises.";
      const buffer = Buffer.from(content, "utf-8");
      const text = await extractTextFromDocument(buffer, "text/plain");
      expect(text).toBe(content);
    });

    it("should throw for unsupported file types", async () => {
      const buffer = Buffer.from("data");
      await expect(
        extractTextFromDocument(buffer, "application/msword")
      ).rejects.toThrow("Unsupported file type");
    });
  });

  describe("analyzeDocumentWithLLM", () => {
    it("should return valid structured JSON with system-scoped attributes from the LLM", async () => {
      const mockCreate = await getMockCreate();
      const mockResponse = {
        issues: [
          {
            title: "Roof shingles deteriorating",
            description: "Multiple shingles showing wear and curling",
            systemName: "roof",
            category: "Roof",
            urgency: "soon",
            diyLevel: "Pro-Only",
            estimatedCost: "$2,000-$5,000",
            safetyWarning: "Do not attempt roof work without proper safety equipment",
            attributes: {
              roof_material: "asphalt shingles",
              roof_condition: "deteriorating",
              roof_installation_year: "2005",
            },
          },
          {
            title: "Slow drain in kitchen sink",
            description: "Kitchen drain is slow, possible partial clog",
            systemName: "plumbing",
            category: "Plumbing",
            urgency: "later",
            diyLevel: "DIY-Safe",
            estimatedCost: "$20-$50",
            safetyWarning: null,
            attributes: {
              plumbing_pipe_material: "PVC",
              plumbing_condition: "partially clogged",
            },
          },
        ],
      };

      mockCreate.mockResolvedValue({
        choices: [{ message: { content: JSON.stringify(mockResponse) } }],
      });

      const result = await analyzeDocumentWithLLM("Roof inspection shows deteriorating shingles. Kitchen drain slow.", 1);

      expect(result.issues).toHaveLength(2);
      expect(result.issues[0].systemName).toBe("roof");
      expect(result.issues[0].attributes.roof_material).toBe("asphalt shingles");
      expect(result.issues[1].systemName).toBe("plumbing");
      expect(result.issues[1].attributes.plumbing_pipe_material).toBe("PVC");
    });

    it("should throw on malformed JSON from LLM", async () => {
      const mockCreate = await getMockCreate();
      mockCreate.mockResolvedValue({
        choices: [{ message: { content: "not valid json {{{" } }],
      });

      await expect(
        analyzeDocumentWithLLM("Some text", 1)
      ).rejects.toThrow("malformed response");
    });

    it("should throw on empty LLM response", async () => {
      const mockCreate = await getMockCreate();
      mockCreate.mockResolvedValue({
        choices: [{ message: { content: null } }],
      });

      await expect(
        analyzeDocumentWithLLM("Some text", 1)
      ).rejects.toThrow("empty response");
    });
  });

  describe("systemNameToPrefix", () => {
    it("should normalize system names to prefixes", () => {
      expect(systemNameToPrefix("Roof")).toBe("roof");
      expect(systemNameToPrefix("HVAC")).toBe("hvac");
      expect(systemNameToPrefix("Siding/Exterior")).toBe("siding");
      expect(systemNameToPrefix("Water Heater")).toBe("water_heater");
      expect(systemNameToPrefix("unknown stuff")).toBe("unknown_stuff");
    });
  });

  describe("prefixAttribute", () => {
    it("should prefix attribute names with system name", () => {
      expect(prefixAttribute("roof", "material")).toBe("roof_material");
      expect(prefixAttribute("roof", "condition")).toBe("roof_condition");
      expect(prefixAttribute("siding", "material")).toBe("siding_material");
    });

    it("should not double-prefix already-prefixed attributes", () => {
      expect(prefixAttribute("roof", "roof_material")).toBe("roof_material");
      expect(prefixAttribute("hvac", "hvac_unit_type")).toBe("hvac_unit_type");
    });
  });

  describe("validateAttributeNamespace — cross-system isolation", () => {
    it("should accept attributes matching the system prefix", () => {
      const attrs = {
        roof_material: "asphalt shingles",
        roof_condition: "good",
        roof_installation_year: "2010",
      };
      const { valid, violations } = validateAttributeNamespace(attrs, "roof");
      expect(Object.keys(valid)).toHaveLength(3);
      expect(valid.roof_material).toBe("asphalt shingles");
      expect(violations).toHaveLength(0);
    });

    it("entering roof_material does NOT populate siding_material", () => {
      const attrs = {
        roof_material: "asphalt shingles",
        siding_material: "vinyl",
      };
      const { valid, violations } = validateAttributeNamespace(attrs, "roof");
      expect(valid.roof_material).toBe("asphalt shingles");
      expect(valid).not.toHaveProperty("siding_material");
      expect(violations.length).toBeGreaterThan(0);
      expect(violations[0]).toContain("siding");
    });

    it("entering siding_material does NOT populate roof_material", () => {
      const attrs = {
        siding_material: "vinyl",
        roof_material: "asphalt",
      };
      const { valid, violations } = validateAttributeNamespace(attrs, "siding");
      expect(valid.siding_material).toBe("vinyl");
      expect(valid).not.toHaveProperty("roof_material");
      expect(violations.length).toBeGreaterThan(0);
      expect(violations[0]).toContain("roof");
    });

    it("should auto-prefix unprefixed generic attributes", () => {
      const attrs = {
        condition: "fair",
        age: "15 years",
      };
      const { valid, violations } = validateAttributeNamespace(attrs, "hvac");
      expect(valid.hvac_condition).toBe("fair");
      expect(valid.hvac_age).toBe("15 years");
      expect(valid).not.toHaveProperty("condition");
      expect(valid).not.toHaveProperty("age");
      expect(violations).toHaveLength(0);
    });

    it("should reject cross-system attributes for any known system", () => {
      const attrs = {
        plumbing_pipe_material: "copper",
        electrical_wiring_type: "romex",
        foundation_crack_type: "hairline",
      };
      const { valid, violations } = validateAttributeNamespace(attrs, "plumbing");
      expect(valid.plumbing_pipe_material).toBe("copper");
      expect(valid).not.toHaveProperty("electrical_wiring_type");
      expect(valid).not.toHaveProperty("foundation_crack_type");
      expect(violations).toHaveLength(2);
    });
  });

  describe("enforceAttributeNamespaces", () => {
    it("should strip cross-system attributes from all issues", () => {
      const issues: ExtractedIssue[] = [
        {
          title: "Roof issue",
          description: "",
          systemName: "roof",
          category: "Roof",
          urgency: "soon",
          diyLevel: "Pro-Only",
          estimatedCost: "$1,000",
          safetyWarning: null,
          attributes: {
            roof_material: "tile",
            siding_material: "brick",
          },
        },
      ];

      const enforced = enforceAttributeNamespaces(issues);
      expect(enforced[0].attributes.roof_material).toBe("tile");
      expect(enforced[0].attributes).not.toHaveProperty("siding_material");
    });

    it("should handle issues with no attributes", () => {
      const issues: ExtractedIssue[] = [
        {
          title: "Generic issue",
          description: "",
          systemName: "other",
          category: "Other",
          urgency: "later",
          diyLevel: "Caution",
          estimatedCost: "Unknown",
          safetyWarning: null,
          attributes: {},
        },
      ];

      const enforced = enforceAttributeNamespaces(issues);
      expect(enforced[0].systemName).toBe("other");
      expect(Object.keys(enforced[0].attributes)).toHaveLength(0);
    });
  });

  describe("AI extraction returns system-scoped attributes", () => {
    it("should enforce namespace on LLM response even if LLM sends cross-system data", async () => {
      const mockCreate = await getMockCreate();
      const mockResponse = {
        issues: [
          {
            title: "Siding damage",
            systemName: "siding",
            category: "Siding/Exterior",
            urgency: "soon",
            diyLevel: "Pro-Only",
            estimatedCost: "$800",
            safetyWarning: null,
            attributes: {
              siding_material: "vinyl",
              siding_condition: "cracked",
              roof_material: "should not be here",
            },
          },
        ],
      };

      mockCreate.mockResolvedValue({
        choices: [{ message: { content: JSON.stringify(mockResponse) } }],
      });

      const result = await analyzeDocumentWithLLM("Siding is cracked vinyl.", 1);
      expect(result.issues[0].attributes.siding_material).toBe("vinyl");
      expect(result.issues[0].attributes.siding_condition).toBe("cracked");
      expect(result.issues[0].attributes).not.toHaveProperty("roof_material");
    });
  });

  describe("documentAnalysisResponseSchema validation", () => {
    it("should validate a correct response with attributes", () => {
      const valid = {
        issues: [
          {
            title: "Fix gutter",
            description: "Gutters are clogged",
            systemName: "roof",
            category: "Roof",
            urgency: "soon",
            diyLevel: "DIY-Safe",
            estimatedCost: "$50-$100",
            safetyWarning: null,
            attributes: { roof_gutter_condition: "clogged" },
          },
        ],
      };
      const result = documentAnalysisResponseSchema.safeParse(valid);
      expect(result.success).toBe(true);
    });

    it("should reject a response with missing title", () => {
      const invalid = {
        issues: [{ description: "Missing title field" }],
      };
      const result = documentAnalysisResponseSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it("should apply defaults for optional fields including systemName and attributes", () => {
      const minimal = {
        issues: [{ title: "Basic issue" }],
      };
      const result = documentAnalysisResponseSchema.safeParse(minimal);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.issues[0].urgency).toBe("later");
        expect(result.data.issues[0].diyLevel).toBe("Caution");
        expect(result.data.issues[0].category).toBe("Other");
        expect(result.data.issues[0].systemName).toBe("unknown_system");
        expect(result.data.issues[0].attributes).toEqual({});
      }
    });
  });

  describe("convertIssuesToTasks", () => {
    it("should correctly convert extracted issues with system-scoped attributes", () => {
      const issues: ExtractedIssue[] = [
        {
          title: "Replace water heater",
          description: "Water heater is 15 years old and showing signs of corrosion",
          systemName: "water_heater",
          category: "Water Heater",
          urgency: "soon",
          diyLevel: "Pro-Only",
          estimatedCost: "$1,500-$3,000",
          safetyWarning: "Involves gas/electrical connections",
          attributes: {
            water_heater_age_years: "15",
            water_heater_condition: "corroded",
            water_heater_type: "tank",
          },
        },
        {
          title: "Clean gutters",
          description: "Gutters filled with debris",
          systemName: "roof",
          category: "Other",
          urgency: "later",
          diyLevel: "DIY-Safe",
          estimatedCost: "$0-$50",
          safetyWarning: null,
          attributes: {},
        },
      ];

      const tasks = convertIssuesToTasks(issues, 42);

      expect(tasks).toHaveLength(2);

      expect(tasks[0].homeId).toBe(42);
      expect(tasks[0].title).toBe("Replace water heater");
      expect(tasks[0].systemName).toBe("water_heater");
      expect(tasks[0].attributes.water_heater_age_years).toBe("15");
      expect(tasks[0].attributes.water_heater_condition).toBe("corroded");
      expect(tasks[0].createdFrom).toBe("document-analysis");
      expect(tasks[0].status).toBe("pending");

      expect(tasks[1].homeId).toBe(42);
      expect(tasks[1].systemName).toBe("roof");
      expect(tasks[1].attributes).toEqual({});
    });

    it("should handle empty issues array", () => {
      const tasks = convertIssuesToTasks([], 1);
      expect(tasks).toEqual([]);
    });
  });

  describe("Database writes preserve system namespace integrity", () => {
    it("convertIssuesToTasks preserves only valid namespaced attributes per task", () => {
      const issues: ExtractedIssue[] = [
        {
          title: "Roof repair",
          description: "",
          systemName: "roof",
          category: "Roof",
          urgency: "soon",
          diyLevel: "Pro-Only",
          estimatedCost: "$1,000",
          safetyWarning: null,
          attributes: { roof_material: "slate", roof_age_years: "20" },
        },
        {
          title: "Siding repair",
          description: "",
          systemName: "siding",
          category: "Siding/Exterior",
          urgency: "later",
          diyLevel: "Caution",
          estimatedCost: "$500",
          safetyWarning: null,
          attributes: { siding_material: "wood", siding_condition: "peeling" },
        },
      ];

      const tasks = convertIssuesToTasks(issues, 1);

      expect(tasks[0].attributes).toHaveProperty("roof_material");
      expect(tasks[0].attributes).not.toHaveProperty("siding_material");

      expect(tasks[1].attributes).toHaveProperty("siding_material");
      expect(tasks[1].attributes).not.toHaveProperty("roof_material");
    });
  });

  describe("UI task review (schema contract)", () => {
    it("should produce tasks with systemName and attributes for UI display before confirmation", () => {
      const issues: ExtractedIssue[] = [
        {
          title: "Foundation crack observed",
          description: "Hairline crack in southeast corner of foundation",
          systemName: "foundation",
          category: "Foundation",
          urgency: "now",
          diyLevel: "Pro-Only",
          estimatedCost: "$500-$2,000",
          safetyWarning: "Structural issue — do not ignore",
          attributes: {
            foundation_crack_type: "hairline",
            foundation_location: "southeast corner",
          },
        },
      ];

      const tasks = convertIssuesToTasks(issues, 10);
      const task = tasks[0];

      expect(task).toHaveProperty("title");
      expect(task).toHaveProperty("description");
      expect(task).toHaveProperty("category");
      expect(task).toHaveProperty("systemName");
      expect(task).toHaveProperty("urgency");
      expect(task).toHaveProperty("diyLevel");
      expect(task).toHaveProperty("estimatedCost");
      expect(task).toHaveProperty("safetyWarning");
      expect(task).toHaveProperty("homeId");
      expect(task).toHaveProperty("createdFrom");
      expect(task).toHaveProperty("status");
      expect(task).toHaveProperty("attributes");

      expect(task.systemName).toBe("foundation");
      expect(task.attributes.foundation_crack_type).toBe("hairline");
      expect(task.attributes.foundation_location).toBe("southeast corner");
      expect(task.status).toBe("pending");
      expect(task.createdFrom).toBe("document-analysis");
    });
  });
});

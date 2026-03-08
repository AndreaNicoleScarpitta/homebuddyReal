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
} from "../server/lib/document-analysis";
import {
  generateInstancePrefix,
  namespaceTaskAttributes,
  denamespaceTaskAttributes,
  validateInstanceNamespace,
  resolveNamespacePrefix,
  type ExtractedIssue,
} from "../server/lib/attribute-namespace";

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

  describe("generateInstancePrefix — instance-level uniqueness", () => {
    it("should create unique prefixes for two HVAC systems with different names", () => {
      const prefix1 = generateInstancePrefix("HVAC", "Main Floor AC");
      const prefix2 = generateInstancePrefix("HVAC", "Upstairs Heat Pump");

      expect(prefix1).not.toBe(prefix2);
      expect(prefix1).toBe("hvac_main_floor_ac");
      expect(prefix2).toBe("hvac_upstairs_heat_pump");
    });

    it("should create unique prefixes for two Plumbing systems", () => {
      const prefix1 = generateInstancePrefix("Plumbing", "Main Bathroom");
      const prefix2 = generateInstancePrefix("Plumbing", "Kitchen");

      expect(prefix1).not.toBe(prefix2);
      expect(prefix1).toBe("plumbing_main_bathroom");
      expect(prefix2).toBe("plumbing_kitchen");
    });

    it("should fall back to category + ID when name matches category", () => {
      const prefix = generateInstancePrefix("HVAC", "HVAC", "abc12345");
      expect(prefix).toContain("hvac_");
      expect(prefix).toContain("abc12345");
    });

    it("should return just the category prefix when no unique name and no ID", () => {
      const prefix = generateInstancePrefix("Roof", "Roof");
      expect(prefix).toBe("roof");
    });
  });

  describe("namespaceTaskAttributes / denamespaceTaskAttributes round-trip", () => {
    it("should namespace standard task attributes with a prefix", () => {
      const attrs = {
        urgency: "soon",
        diy_level: "Pro-Only",
        estimated_cost: "$200-$500",
        description: "Fix the compressor",
      };
      const nsPrefix = "hvac_main_floor_ac";
      const namespaced = namespaceTaskAttributes(attrs, nsPrefix);

      expect(namespaced["hvac_main_floor_ac_urgency"]).toBe("soon");
      expect(namespaced["hvac_main_floor_ac_diy_level"]).toBe("Pro-Only");
      expect(namespaced["hvac_main_floor_ac_estimated_cost"]).toBe("$200-$500");
      expect(namespaced["hvac_main_floor_ac_description"]).toBe("Fix the compressor");
      expect(namespaced).not.toHaveProperty("urgency");
    });

    it("should skip null/undefined values", () => {
      const attrs = { urgency: "soon", safety_warning: null as any };
      const namespaced = namespaceTaskAttributes(attrs, "roof");
      expect(namespaced).toHaveProperty("roof_urgency");
      expect(namespaced).not.toHaveProperty("roof_safety_warning");
    });

    it("should round-trip: denamespace reverses namespace", () => {
      const original = {
        urgency: "now",
        diy_level: "Caution",
        estimated_cost: "$100",
        description: "Check the circuit breaker",
      };
      const prefix = "electrical_main_panel";
      const namespaced = namespaceTaskAttributes(original, prefix);
      const restored = denamespaceTaskAttributes(namespaced, prefix);

      expect(restored.urgency).toBe("now");
      expect(restored.diy_level).toBe("Caution");
      expect(restored.estimated_cost).toBe("$100");
      expect(restored.description).toBe("Check the circuit breaker");
    });
  });

  describe("validateInstanceNamespace — cross-instance isolation", () => {
    it("hvac_main_floor_ac attributes do NOT bleed to hvac_upstairs_heat_pump", () => {
      const attrs = {
        hvac_main_floor_ac_urgency: "soon",
        hvac_main_floor_ac_condition: "failing",
      };
      const { valid, violations } = validateInstanceNamespace(
        attrs,
        "hvac_upstairs_heat_pump",
        "hvac"
      );
      expect(valid).not.toHaveProperty("hvac_main_floor_ac_urgency");
      expect(valid).not.toHaveProperty("hvac_main_floor_ac_condition");
      expect(Object.keys(valid)).toHaveLength(0);
    });

    it("category-prefixed attributes are upgraded to instance prefix", () => {
      const attrs = {
        hvac_condition: "good",
        hvac_filter_size: "16x25",
      };
      const { valid, violations } = validateInstanceNamespace(
        attrs,
        "hvac_main_floor_ac",
        "hvac"
      );
      expect(valid["hvac_main_floor_ac_condition"]).toBe("good");
      expect(valid["hvac_main_floor_ac_filter_size"]).toBe("16x25");
    });

    it("cross-system attributes are rejected at instance level too", () => {
      const attrs = {
        roof_material: "asphalt",
        hvac_main_floor_ac_condition: "good",
      };
      const { valid, violations } = validateInstanceNamespace(
        attrs,
        "hvac_main_floor_ac",
        "hvac"
      );
      expect(valid).not.toHaveProperty("roof_material");
      expect(valid["hvac_main_floor_ac_condition"]).toBe("good");
      expect(violations.length).toBeGreaterThan(0);
    });
  });

  describe("resolveNamespacePrefix", () => {
    it("should use system category + name when available", () => {
      const prefix = resolveNamespacePrefix({ category: "HVAC", name: "Main AC", id: "123" });
      expect(prefix).toBe("hvac_main_ac");
    });

    it("should fall back to category-only when no system name", () => {
      const prefix = resolveNamespacePrefix({ category: "Roof", name: null, id: null });
      expect(prefix).toBe("roof");
    });

    it("should fall back to standalone category string", () => {
      const prefix = resolveNamespacePrefix(null, "Plumbing");
      expect(prefix).toBe("plumbing");
    });

    it("should return unknown_system when nothing provided", () => {
      const prefix = resolveNamespacePrefix(null);
      expect(prefix).toBe("unknown_system");
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

import { logInfo } from "./logger";

export const KNOWN_SYSTEMS = [
  "roof",
  "hvac",
  "plumbing",
  "electrical",
  "windows",
  "siding",
  "foundation",
  "appliances",
  "water_heater",
  "landscaping",
  "pest",
  "other",
] as const;

export type KnownSystem = (typeof KNOWN_SYSTEMS)[number];

const STANDARD_TASK_ATTRIBUTES = [
  "urgency",
  "diy_level",
  "estimated_cost",
  "safety_warning",
  "description",
  "cadence",
  "condition",
  "material",
  "installation_year",
] as const;

function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/\//g, "_")
    .replace(/[^a-z0-9_]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
}

export function systemNameToPrefix(systemName: string): string {
  const normalized = slugify(systemName);

  if (normalized === "siding_exterior" || normalized === "siding") return "siding";
  if (normalized === "water_heater") return "water_heater";

  const matched = KNOWN_SYSTEMS.find((s) => s === normalized);
  return matched || normalized || "unknown_system";
}

export function generateInstancePrefix(
  category: string,
  systemName: string,
  systemId?: string | number | null
): string {
  const categoryPrefix = systemNameToPrefix(category);
  const nameSlug = slugify(systemName);

  if (!nameSlug || nameSlug === categoryPrefix) {
    if (systemId) {
      return `${categoryPrefix}_${String(systemId).slice(-8)}`;
    }
    return categoryPrefix;
  }

  const instancePrefix = `${categoryPrefix}_${nameSlug}`;
  return instancePrefix;
}

export function prefixAttribute(
  systemPrefix: string,
  attributeName: string
): string {
  const cleanAttr = slugify(attributeName);

  if (cleanAttr.startsWith(systemPrefix + "_")) {
    return cleanAttr;
  }

  return `${systemPrefix}_${cleanAttr}`;
}

export function validateAttributeNamespace(
  attributes: Record<string, string>,
  systemPrefix: string
): { valid: Record<string, string>; violations: string[] } {
  const valid: Record<string, string> = {};
  const violations: string[] = [];

  for (const [key, value] of Object.entries(attributes)) {
    const normalizedKey = slugify(key);

    if (normalizedKey.startsWith(systemPrefix + "_")) {
      valid[normalizedKey] = value;
    } else {
      const otherSystem = KNOWN_SYSTEMS.find(
        (s) => s !== systemPrefix && normalizedKey.startsWith(s + "_")
      );
      if (otherSystem) {
        violations.push(
          `Attribute "${normalizedKey}" belongs to system "${otherSystem}", not "${systemPrefix}"`
        );
      } else {
        valid[prefixAttribute(systemPrefix, normalizedKey)] = value;
      }
    }
  }

  return { valid, violations };
}

export function validateInstanceNamespace(
  attributes: Record<string, string>,
  instancePrefix: string,
  categoryPrefix: string
): { valid: Record<string, string>; violations: string[] } {
  const valid: Record<string, string> = {};
  const violations: string[] = [];

  for (const [key, value] of Object.entries(attributes)) {
    const normalizedKey = slugify(key);

    if (normalizedKey.startsWith(instancePrefix + "_")) {
      valid[normalizedKey] = value;
    } else if (normalizedKey.startsWith(categoryPrefix + "_")) {
      const afterCategory = normalizedKey.slice(categoryPrefix.length + 1);

      if (instancePrefix !== categoryPrefix && instancePrefix.startsWith(categoryPrefix + "_")) {
        const instanceSuffix = instancePrefix.slice(categoryPrefix.length + 1);

        if (afterCategory.startsWith(instanceSuffix + "_")) {
          valid[normalizedKey] = value;
          continue;
        }

        const hasInstanceLikePrefix = afterCategory.includes("_") &&
          afterCategory.split("_").length >= 3;

        if (hasInstanceLikePrefix) {
          violations.push(
            `Attribute "${normalizedKey}" belongs to a different ${categoryPrefix} instance, not "${instancePrefix}"`
          );
          continue;
        }
      }

      valid[`${instancePrefix}_${afterCategory}`] = value;
    } else {
      const otherSystem = KNOWN_SYSTEMS.find(
        (s) => s !== categoryPrefix && normalizedKey.startsWith(s + "_")
      );
      if (otherSystem) {
        violations.push(
          `Attribute "${normalizedKey}" belongs to system "${otherSystem}", not "${instancePrefix}"`
        );
      } else {
        valid[prefixAttribute(instancePrefix, normalizedKey)] = value;
      }
    }
  }

  return { valid, violations };
}

export interface ExtractedIssue {
  title: string;
  description: string;
  systemName: string;
  category: string;
  urgency: "now" | "soon" | "later" | "monitor";
  diyLevel: "DIY-Safe" | "Caution" | "Pro-Only";
  estimatedCost: string;
  safetyWarning: string | null;
  attributes: Record<string, string>;
}

export function enforceAttributeNamespaces(
  issues: ExtractedIssue[]
): ExtractedIssue[] {
  return issues.map((issue) => {
    const systemPrefix = systemNameToPrefix(issue.systemName || "unknown_system");
    const normalizedSystemName = systemPrefix;

    if (!issue.attributes || Object.keys(issue.attributes).length === 0) {
      return { ...issue, systemName: normalizedSystemName };
    }

    const { valid, violations } = validateAttributeNamespace(
      issue.attributes,
      systemPrefix
    );

    if (violations.length > 0) {
      logInfo("attribute-namespace", "Dropped cross-system attributes", {
        systemName: normalizedSystemName,
        violations,
      });
    }

    return {
      ...issue,
      systemName: normalizedSystemName,
      attributes: valid,
    };
  });
}

export function namespaceTaskAttributes(
  attrs: Record<string, string | null | undefined>,
  prefix: string
): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(attrs)) {
    if (value == null) continue;
    result[prefixAttribute(prefix, key)] = value;
  }
  return result;
}

export function denamespaceTaskAttributes(
  namespacedAttrs: Record<string, string>,
  prefix: string
): Record<string, string> {
  const result: Record<string, string> = {};
  const prefixWithUnderscore = prefix + "_";

  for (const [key, value] of Object.entries(namespacedAttrs)) {
    if (key.startsWith(prefixWithUnderscore)) {
      result[key.slice(prefixWithUnderscore.length)] = value;
    } else {
      result[key] = value;
    }
  }

  return result;
}

export function resolveNamespacePrefix(
  system: { category?: string | null; name?: string | null; id?: string | number | null } | null,
  category?: string | null
): string {
  if (system && system.category && system.name) {
    return generateInstancePrefix(system.category, system.name, system.id);
  }
  if (system && system.category) {
    return systemNameToPrefix(system.category);
  }
  if (category) {
    return systemNameToPrefix(category);
  }
  return "unknown_system";
}

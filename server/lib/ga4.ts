/**
 * Google Analytics 4 (GA4) Data API wrapper.
 *
 * Configure via env vars:
 *   GA4_PROPERTY_ID           — e.g. "properties/123456789" (or just "123456789")
 *   GA4_SERVICE_ACCOUNT_JSON  — stringified service account key JSON
 *     (the service account must be granted Viewer access in GA4 admin)
 *
 * All helpers return safe defaults when GA4 isn't configured — agents can
 * call them unconditionally and just get empty arrays/zeros.
 */

import { BetaAnalyticsDataClient } from "@google-analytics/data";
import { logger } from "./logger";

let cachedClient: BetaAnalyticsDataClient | null = null;
let configChecked = false;
let configValid = false;

function isConfigured(): boolean {
  if (configChecked) return configValid;
  configChecked = true;
  configValid = !!(process.env.GA4_PROPERTY_ID && process.env.GA4_SERVICE_ACCOUNT_JSON);
  if (!configValid) {
    logger.info("GA4 not configured (GA4_PROPERTY_ID + GA4_SERVICE_ACCOUNT_JSON). GA4 helpers will return empty data.");
  }
  return configValid;
}

function getProperty(): string {
  const raw = process.env.GA4_PROPERTY_ID || "";
  return raw.startsWith("properties/") ? raw : `properties/${raw}`;
}

function getClient(): BetaAnalyticsDataClient | null {
  if (!isConfigured()) return null;
  if (cachedClient) return cachedClient;
  try {
    const credentials = JSON.parse(process.env.GA4_SERVICE_ACCOUNT_JSON!);
    cachedClient = new BetaAnalyticsDataClient({ credentials });
    return cachedClient;
  } catch (err: any) {
    logger.error({ err: err?.message }, "Failed to parse GA4_SERVICE_ACCOUNT_JSON");
    configValid = false;
    return null;
  }
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export interface GA4Summary {
  activeUsers: number;
  sessions: number;
  pageViews: number;
  engagementRate: number;   // 0..1
  conversions: number;
  bounceRate: number;       // 0..1
  avgSessionDuration: number; // seconds
}

export interface GA4PageRow {
  path: string;
  title: string | null;
  pageViews: number;
  activeUsers: number;
  bounceRate: number;
  avgEngagementTime: number; // seconds
  conversions: number;
}

export interface GA4SourceRow {
  source: string;
  medium: string;
  sessions: number;
  activeUsers: number;
  conversions: number;
}

export interface GA4TrendPoint {
  date: string; // YYYYMMDD
  activeUsers: number;
  sessions: number;
  pageViews: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function toNum(v: any): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function dateRange(days: number) {
  return [{ startDate: `${days}daysAgo`, endDate: "today" }];
}

// ---------------------------------------------------------------------------
// Summary metrics for a window (N days)
// ---------------------------------------------------------------------------
export async function getSummary(days = 7): Promise<GA4Summary> {
  const empty: GA4Summary = {
    activeUsers: 0, sessions: 0, pageViews: 0,
    engagementRate: 0, conversions: 0, bounceRate: 0, avgSessionDuration: 0,
  };
  const client = getClient();
  if (!client) return empty;

  try {
    const [resp] = await client.runReport({
      property: getProperty(),
      dateRanges: dateRange(days),
      metrics: [
        { name: "activeUsers" },
        { name: "sessions" },
        { name: "screenPageViews" },
        { name: "engagementRate" },
        { name: "conversions" },
        { name: "bounceRate" },
        { name: "averageSessionDuration" },
      ],
    });
    const row = resp.rows?.[0]?.metricValues;
    if (!row) return empty;
    return {
      activeUsers: toNum(row[0]?.value),
      sessions: toNum(row[1]?.value),
      pageViews: toNum(row[2]?.value),
      engagementRate: toNum(row[3]?.value),
      conversions: toNum(row[4]?.value),
      bounceRate: toNum(row[5]?.value),
      avgSessionDuration: toNum(row[6]?.value),
    };
  } catch (err: any) {
    logger.warn({ err: err?.message }, "GA4 getSummary failed");
    return empty;
  }
}

// ---------------------------------------------------------------------------
// Top pages by pageviews
// ---------------------------------------------------------------------------
export async function getTopPages(days = 7, limit = 20): Promise<GA4PageRow[]> {
  const client = getClient();
  if (!client) return [];
  try {
    const [resp] = await client.runReport({
      property: getProperty(),
      dateRanges: dateRange(days),
      dimensions: [{ name: "pagePath" }, { name: "pageTitle" }],
      metrics: [
        { name: "screenPageViews" },
        { name: "activeUsers" },
        { name: "bounceRate" },
        { name: "userEngagementDuration" },
        { name: "conversions" },
      ],
      orderBys: [{ metric: { metricName: "screenPageViews" }, desc: true }],
      limit,
    });
    return (resp.rows || []).map((r) => ({
      path: r.dimensionValues?.[0]?.value || "",
      title: r.dimensionValues?.[1]?.value || null,
      pageViews: toNum(r.metricValues?.[0]?.value),
      activeUsers: toNum(r.metricValues?.[1]?.value),
      bounceRate: toNum(r.metricValues?.[2]?.value),
      avgEngagementTime: toNum(r.metricValues?.[3]?.value),
      conversions: toNum(r.metricValues?.[4]?.value),
    }));
  } catch (err: any) {
    logger.warn({ err: err?.message }, "GA4 getTopPages failed");
    return [];
  }
}

// ---------------------------------------------------------------------------
// Traffic sources
// ---------------------------------------------------------------------------
export async function getTrafficSources(days = 7, limit = 10): Promise<GA4SourceRow[]> {
  const client = getClient();
  if (!client) return [];
  try {
    const [resp] = await client.runReport({
      property: getProperty(),
      dateRanges: dateRange(days),
      dimensions: [{ name: "sessionSource" }, { name: "sessionMedium" }],
      metrics: [
        { name: "sessions" },
        { name: "activeUsers" },
        { name: "conversions" },
      ],
      orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
      limit,
    });
    return (resp.rows || []).map((r) => ({
      source: r.dimensionValues?.[0]?.value || "(direct)",
      medium: r.dimensionValues?.[1]?.value || "(none)",
      sessions: toNum(r.metricValues?.[0]?.value),
      activeUsers: toNum(r.metricValues?.[1]?.value),
      conversions: toNum(r.metricValues?.[2]?.value),
    }));
  } catch (err: any) {
    logger.warn({ err: err?.message }, "GA4 getTrafficSources failed");
    return [];
  }
}

// ---------------------------------------------------------------------------
// Daily trend (for WoW / anomaly comparison)
// ---------------------------------------------------------------------------
export async function getDailyTrend(days = 14): Promise<GA4TrendPoint[]> {
  const client = getClient();
  if (!client) return [];
  try {
    const [resp] = await client.runReport({
      property: getProperty(),
      dateRanges: dateRange(days),
      dimensions: [{ name: "date" }],
      metrics: [
        { name: "activeUsers" },
        { name: "sessions" },
        { name: "screenPageViews" },
      ],
      orderBys: [{ dimension: { dimensionName: "date" } }],
    });
    return (resp.rows || []).map((r) => ({
      date: r.dimensionValues?.[0]?.value || "",
      activeUsers: toNum(r.metricValues?.[0]?.value),
      sessions: toNum(r.metricValues?.[1]?.value),
      pageViews: toNum(r.metricValues?.[2]?.value),
    }));
  } catch (err: any) {
    logger.warn({ err: err?.message }, "GA4 getDailyTrend failed");
    return [];
  }
}

// ---------------------------------------------------------------------------
// Compare two windows for decay/growth detection
// Returns pages that dropped the most in pageviews week-over-week.
// ---------------------------------------------------------------------------
export interface GA4PageComparison {
  path: string;
  title: string | null;
  currentPageViews: number;
  previousPageViews: number;
  deltaPct: number; // -0.45 = dropped 45%
}

export async function comparePagesWoW(limit = 30): Promise<GA4PageComparison[]> {
  const client = getClient();
  if (!client) return [];
  try {
    const [resp] = await client.runReport({
      property: getProperty(),
      dateRanges: [
        { startDate: "7daysAgo", endDate: "today" },
        { startDate: "14daysAgo", endDate: "8daysAgo" },
      ],
      dimensions: [{ name: "pagePath" }, { name: "pageTitle" }],
      metrics: [{ name: "screenPageViews" }],
      orderBys: [{ metric: { metricName: "screenPageViews" }, desc: true }],
      limit,
    });

    // When multiple dateRanges are present, each row has one metric value per range
    return (resp.rows || []).map((r) => {
      const current = toNum(r.metricValues?.[0]?.value);
      const previous = toNum(r.metricValues?.[1]?.value);
      const deltaPct = previous > 0 ? (current - previous) / previous : (current > 0 ? 1 : 0);
      return {
        path: r.dimensionValues?.[0]?.value || "",
        title: r.dimensionValues?.[1]?.value || null,
        currentPageViews: current,
        previousPageViews: previous,
        deltaPct,
      };
    });
  } catch (err: any) {
    logger.warn({ err: err?.message }, "GA4 comparePagesWoW failed");
    return [];
  }
}

// ---------------------------------------------------------------------------
// Funnel — for a given ordered list of page path prefixes, returns users at each step
// e.g. ["/", "/signup", "/onboarding", "/dashboard"]
// ---------------------------------------------------------------------------
export async function getFunnel(pathPrefixes: string[], days = 7): Promise<{ path: string; users: number }[]> {
  const client = getClient();
  if (!client) return pathPrefixes.map((p) => ({ path: p, users: 0 }));
  try {
    const [resp] = await client.runReport({
      property: getProperty(),
      dateRanges: dateRange(days),
      dimensions: [{ name: "pagePath" }],
      metrics: [{ name: "activeUsers" }],
      limit: 10000,
    });
    const rows = resp.rows || [];
    return pathPrefixes.map((prefix) => {
      const users = rows.reduce((sum, r) => {
        const path = r.dimensionValues?.[0]?.value || "";
        if (path === prefix || path.startsWith(prefix + (prefix.endsWith("/") ? "" : "/"))) {
          return sum + toNum(r.metricValues?.[0]?.value);
        }
        return sum;
      }, 0);
      return { path: prefix, users };
    });
  } catch (err: any) {
    logger.warn({ err: err?.message }, "GA4 getFunnel failed");
    return pathPrefixes.map((p) => ({ path: p, users: 0 }));
  }
}

export function ga4Configured(): boolean {
  return isConfigured();
}

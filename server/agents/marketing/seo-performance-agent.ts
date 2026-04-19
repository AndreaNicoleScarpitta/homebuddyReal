/**
 * SEO Performance Agent
 *
 * Weekly SEO intelligence report: which articles are decaying, which are taking
 * off, which pages get traffic but don't convert, and where the top referrers
 * are sending people.
 *
 * Output: report (HTML email to ADMIN_EMAILS) with actionable recommendations.
 * Schedule: Monday 8am — gives the founder Monday-morning clarity on content
 * priorities for the week.
 */

import { registerAgent, type AgentContext } from "../runner";
import { sendEmail } from "../../lib/email";
import { logInfo, logWarn } from "../../lib/logger";
import { ga4Configured, getSummary, getTopPages, getTrafficSources, comparePagesWoW } from "../../lib/ga4";

const MIN_PAGEVIEWS_FOR_DECAY_ALERT = 20;  // Don't flag pages with tiny samples
const DECAY_THRESHOLD = -0.25;              // Dropped ≥25% WoW
const SURGE_THRESHOLD = 0.5;                // Up ≥50% WoW
const HIGH_BOUNCE_THRESHOLD = 0.8;          // 80%+ bounce rate
const LOW_CONVERSION_VIEWS_THRESHOLD = 50;  // Got meaningful traffic but zero conversions

function escapeHtml(str: string): string {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

registerAgent("seo-performance-agent", async (ctx: AgentContext) => {
  const adminEmails = (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((e) => e.trim())
    .filter(Boolean);

  if (!ga4Configured()) {
    logWarn("agent.seo-performance", "GA4 not configured — agent cannot run. Set GA4_PROPERTY_ID and GA4_SERVICE_ACCOUNT_JSON.");
    await ctx.emit({
      outputType: "report",
      title: "SEO Performance Report — GA4 not configured",
      content: "<p>GA4 credentials not set. See <code>docs/ga4-setup.md</code>.</p>",
      metadata: { ga4Configured: false },
    });
    return;
  }

  logInfo("agent.seo-performance", "Fetching GA4 performance data");

  const [summary, topPages, sources, comparison] = await Promise.all([
    getSummary(7),
    getTopPages(7, 25),
    getTrafficSources(7, 10),
    comparePagesWoW(50),
  ]);

  // ── Analyze: decaying pages ────────────────────────────────────────────
  const decaying = comparison
    .filter((p) =>
      p.previousPageViews >= MIN_PAGEVIEWS_FOR_DECAY_ALERT &&
      p.deltaPct <= DECAY_THRESHOLD
    )
    .sort((a, b) => a.deltaPct - b.deltaPct)
    .slice(0, 10);

  // ── Analyze: surging pages ─────────────────────────────────────────────
  const surging = comparison
    .filter((p) =>
      p.currentPageViews >= MIN_PAGEVIEWS_FOR_DECAY_ALERT &&
      p.deltaPct >= SURGE_THRESHOLD
    )
    .sort((a, b) => b.deltaPct - a.deltaPct)
    .slice(0, 10);

  // ── Analyze: high traffic, low conversion (content that could convert if fixed) ──
  const leakyPages = topPages
    .filter((p) =>
      p.pageViews >= LOW_CONVERSION_VIEWS_THRESHOLD &&
      p.conversions === 0 &&
      p.path.startsWith("/guides/")
    )
    .slice(0, 10);

  // ── Analyze: high bounce pages ─────────────────────────────────────────
  const bouncy = topPages
    .filter((p) => p.pageViews >= LOW_CONVERSION_VIEWS_THRESHOLD && p.bounceRate >= HIGH_BOUNCE_THRESHOLD)
    .slice(0, 10);

  // ── Build recommendations ──────────────────────────────────────────────
  const recommendations: string[] = [];
  if (decaying.length > 0) {
    recommendations.push(`Refresh the ${decaying.length} decaying article${decaying.length > 1 ? "s" : ""} — update stats, add sections, bump the date. Google likes freshness.`);
  }
  if (surging.length > 0) {
    recommendations.push(`Double down on the ${surging.length} surging topic${surging.length > 1 ? "s" : ""} — write adjacent articles, turn them into YouTube scripts, promote on socials.`);
  }
  if (leakyPages.length > 0) {
    recommendations.push(`${leakyPages.length} guide page${leakyPages.length > 1 ? "s are" : " is"} getting traffic but converting nobody. Add stronger CTA blocks, reduce above-the-fold friction.`);
  }
  if (bouncy.length > 0) {
    recommendations.push(`${bouncy.length} page${bouncy.length > 1 ? "s have" : " has"} 80%+ bounce rate. Check page speed, hero clarity, and whether the title matches what searchers expect.`);
  }
  if (recommendations.length === 0) {
    recommendations.push("No urgent SEO issues this week. Focus on new content or backlinks.");
  }

  // ── Build email ────────────────────────────────────────────────────────
  const dateLabel = new Date().toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });

  const tableRows = (items: Array<{ path: string; title?: string | null; a: string | number; b?: string | number; highlight?: string }>) =>
    items.map((it) => `
      <tr>
        <td style="padding:8px 0;border-bottom:1px solid #f3f4f6;">
          <div style="font-size:13px;font-weight:500;color:#1f2937;">${escapeHtml(it.title || it.path)}</div>
          <div style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11px;color:#9ca3af;">${escapeHtml(it.path)}</div>
        </td>
        <td style="padding:8px 0;border-bottom:1px solid #f3f4f6;text-align:right;font-size:13px;font-weight:500;">
          ${it.a}
          ${it.b !== undefined ? `<span style="font-size:11px;color:${it.highlight || "#9ca3af"};margin-left:8px;">${it.b}</span>` : ""}
        </td>
      </tr>
    `).join("");

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#1f2937;">
  <div style="max-width:680px;margin:0 auto;padding:20px;">
    <div style="background:white;border-radius:12px;overflow:hidden;">
      <div style="background:linear-gradient(135deg,#f97316,#ea580c);padding:20px 28px;">
        <div style="color:rgba(255,255,255,0.9);font-size:12px;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:4px;">SEO Performance · Weekly</div>
        <h1 style="color:white;font-size:22px;margin:0;font-weight:700;">${dateLabel}</h1>
      </div>

      <div style="padding:24px 28px;">
        <!-- Headline -->
        <div style="background:#fff7ed;border-left:3px solid #f97316;padding:16px;border-radius:0 8px 8px 0;margin-bottom:24px;">
          <div style="display:flex;gap:24px;flex-wrap:wrap;">
            <div>
              <div style="font-size:11px;text-transform:uppercase;color:#9a3412;">Visitors (7d)</div>
              <div style="font-size:24px;font-weight:700;color:#ea580c;line-height:1.1;">${summary.activeUsers.toLocaleString()}</div>
            </div>
            <div>
              <div style="font-size:11px;text-transform:uppercase;color:#9a3412;">Page views</div>
              <div style="font-size:24px;font-weight:700;color:#ea580c;line-height:1.1;">${summary.pageViews.toLocaleString()}</div>
            </div>
            <div>
              <div style="font-size:11px;text-transform:uppercase;color:#9a3412;">Conversions</div>
              <div style="font-size:24px;font-weight:700;color:#ea580c;line-height:1.1;">${summary.conversions.toLocaleString()}</div>
            </div>
          </div>
        </div>

        <!-- Recommendations -->
        <h2 style="font-size:14px;text-transform:uppercase;letter-spacing:0.05em;color:#6b7280;margin:0 0 12px 0;">This week's focus</h2>
        <ol style="margin:0 0 24px 0;padding-left:22px;color:#1f2937;font-size:14px;line-height:1.7;">
          ${recommendations.map((r) => `<li style="margin-bottom:6px;">${escapeHtml(r)}</li>`).join("")}
        </ol>

        ${decaying.length > 0 ? `
          <h2 style="font-size:14px;text-transform:uppercase;letter-spacing:0.05em;color:#dc2626;margin:24px 0 12px 0;">⬇ Decaying pages</h2>
          <p style="font-size:12px;color:#6b7280;margin:0 0 8px 0;">Pages that dropped ≥25% week-over-week. Refresh these.</p>
          <table style="width:100%;border-collapse:collapse;margin-bottom:24px;">
            ${tableRows(decaying.map((p) => ({
              path: p.path,
              title: p.title,
              a: `${p.currentPageViews.toLocaleString()} views`,
              b: `${Math.round(p.deltaPct * 100)}%`,
              highlight: "#dc2626",
            })))}
          </table>
        ` : ""}

        ${surging.length > 0 ? `
          <h2 style="font-size:14px;text-transform:uppercase;letter-spacing:0.05em;color:#16a34a;margin:24px 0 12px 0;">⬆ Surging pages</h2>
          <p style="font-size:12px;color:#6b7280;margin:0 0 8px 0;">Pages up ≥50% week-over-week. Double down on these topics.</p>
          <table style="width:100%;border-collapse:collapse;margin-bottom:24px;">
            ${tableRows(surging.map((p) => ({
              path: p.path,
              title: p.title,
              a: `${p.currentPageViews.toLocaleString()} views`,
              b: `+${Math.round(p.deltaPct * 100)}%`,
              highlight: "#16a34a",
            })))}
          </table>
        ` : ""}

        ${leakyPages.length > 0 ? `
          <h2 style="font-size:14px;text-transform:uppercase;letter-spacing:0.05em;color:#ea580c;margin:24px 0 12px 0;">💧 Traffic without conversion</h2>
          <p style="font-size:12px;color:#6b7280;margin:0 0 8px 0;">Guide pages getting real traffic but zero conversions. Add stronger CTAs.</p>
          <table style="width:100%;border-collapse:collapse;margin-bottom:24px;">
            ${tableRows(leakyPages.map((p) => ({
              path: p.path,
              title: p.title,
              a: `${p.pageViews.toLocaleString()} views`,
              b: "0 conversions",
              highlight: "#ea580c",
            })))}
          </table>
        ` : ""}

        ${bouncy.length > 0 ? `
          <h2 style="font-size:14px;text-transform:uppercase;letter-spacing:0.05em;color:#dc2626;margin:24px 0 12px 0;">⚠ High bounce</h2>
          <table style="width:100%;border-collapse:collapse;margin-bottom:24px;">
            ${tableRows(bouncy.map((p) => ({
              path: p.path,
              title: p.title,
              a: `${p.pageViews.toLocaleString()} views`,
              b: `${(p.bounceRate * 100).toFixed(0)}% bounce`,
              highlight: "#dc2626",
            })))}
          </table>
        ` : ""}

        ${sources.length > 0 ? `
          <h2 style="font-size:14px;text-transform:uppercase;letter-spacing:0.05em;color:#6b7280;margin:24px 0 12px 0;">Traffic sources</h2>
          <table style="width:100%;border-collapse:collapse;margin-bottom:24px;">
            ${sources.map((s) => `
              <tr>
                <td style="padding:8px 0;border-bottom:1px solid #f3f4f6;font-size:13px;">
                  <strong>${escapeHtml(s.source)}</strong>
                  <span style="color:#9ca3af;margin-left:6px;">/ ${escapeHtml(s.medium)}</span>
                </td>
                <td style="padding:8px 0;border-bottom:1px solid #f3f4f6;text-align:right;font-size:13px;">
                  ${s.sessions.toLocaleString()} sessions
                  ${s.conversions > 0 ? `<span style="color:#16a34a;margin-left:8px;font-size:11px;">${s.conversions} conv</span>` : ""}
                </td>
              </tr>
            `).join("")}
          </table>
        ` : ""}
      </div>

      <div style="background:#f9fafb;padding:16px 28px;border-top:1px solid #e5e7eb;text-align:center;">
        <p style="color:#9ca3af;font-size:11px;margin:0;">
          seo-performance-agent · GA4 data · weekly brief
        </p>
      </div>
    </div>
  </div>
</body>
</html>
  `.trim();

  const subject = `SEO weekly: ${summary.activeUsers.toLocaleString()} visitors, ${decaying.length} decaying, ${surging.length} surging`;

  for (const email of adminEmails) {
    const sent = await sendEmail({ to: email, subject, html });
    if (sent) logInfo("agent.seo-performance", `Report sent to ${email}`);
  }

  await ctx.emit({
    outputType: "report",
    title: subject,
    content: html,
    metadata: {
      summary,
      decayingCount: decaying.length,
      surgingCount: surging.length,
      leakyCount: leakyPages.length,
      bouncyCount: bouncy.length,
      recommendations,
      decaying: decaying.slice(0, 5),
      surging: surging.slice(0, 5),
    },
  });
});

/**
 * Founder Brief Agent
 *
 * Daily morning intelligence report for the founder. Replaces "check 7 dashboards"
 * with "read one email." Sent to every admin in ADMIN_EMAILS.
 *
 * Metrics gathered:
 *   - Total users, new signups (24h, 7d)
 *   - Active users (last 24h)
 *   - Active homes (the unit of value — homes with activity last 7d)
 *   - Open tasks, overdue tasks
 *   - Agent health (runs, failures in last 24h)
 *   - Anomalies (signup drop, failure spike)
 *
 * Output: alert (HTML email).
 */

import { registerAgent, type AgentContext } from "../runner";
import { db } from "../../db";
import { sql } from "drizzle-orm";
import { sendEmail } from "../../lib/email";
import { logInfo, logWarn } from "../../lib/logger";
import { ga4Configured, getSummary, getTopPages, getTrafficSources, getFunnel } from "../../lib/ga4";

function pct(n: number, d: number): string {
  if (d === 0) return "—";
  return `${((n / d) * 100).toFixed(1)}%`;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function safeQuery<T = any>(fn: () => Promise<T>, fallback: T): Promise<T> {
  return fn().catch((err) => {
    logWarn("agent.founder-brief", `Metric query failed: ${err?.message || err}`);
    return fallback;
  });
}

registerAgent("founder-brief-agent", async (ctx: AgentContext) => {
  const adminEmails = (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((e) => e.trim())
    .filter(Boolean);

  if (adminEmails.length === 0) {
    logWarn("agent.founder-brief", "No ADMIN_EMAILS configured — skipping");
    return;
  }

  const now = new Date();
  const h24 = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const d7 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const d14 = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

  // ── USERS ──────────────────────────────────────────────────────────────
  const totalUsers = await safeQuery(async () => {
    const r = await db.execute(sql`SELECT COUNT(*)::int AS n FROM users`);
    return (r.rows[0] as { n: number })?.n ?? 0;
  }, 0);

  const signups24h = await safeQuery(async () => {
    const r = await db.execute(sql`SELECT COUNT(*)::int AS n FROM users WHERE created_at >= ${h24.toISOString()}::timestamptz`);
    return (r.rows[0] as { n: number })?.n ?? 0;
  }, 0);

  const signups7d = await safeQuery(async () => {
    const r = await db.execute(sql`SELECT COUNT(*)::int AS n FROM users WHERE created_at >= ${d7.toISOString()}::timestamptz`);
    return (r.rows[0] as { n: number })?.n ?? 0;
  }, 0);

  const signupsPrev7d = await safeQuery(async () => {
    const r = await db.execute(sql`SELECT COUNT(*)::int AS n FROM users WHERE created_at >= ${d14.toISOString()}::timestamptz AND created_at < ${d7.toISOString()}::timestamptz`);
    return (r.rows[0] as { n: number })?.n ?? 0;
  }, 0);

  const activeUsers24h = await safeQuery(async () => {
    const r = await db.execute(sql`SELECT COUNT(*)::int AS n FROM users WHERE updated_at >= ${h24.toISOString()}::timestamptz`);
    return (r.rows[0] as { n: number })?.n ?? 0;
  }, 0);

  // ── HOMES (the unit of value) ──────────────────────────────────────────
  const totalHomes = await safeQuery(async () => {
    const r = await db.execute(sql`SELECT COUNT(*)::int AS n FROM projection_home`);
    return (r.rows[0] as { n: number })?.n ?? 0;
  }, 0);

  const activeHomes7d = await safeQuery(async () => {
    const r = await db.execute(sql`
      SELECT COUNT(DISTINCT home_id)::int AS n
      FROM projection_task
      WHERE updated_at >= ${d7.toISOString()}::timestamptz
    `);
    return (r.rows[0] as { n: number })?.n ?? 0;
  }, 0);

  // ── TASKS ──────────────────────────────────────────────────────────────
  const openTasks = await safeQuery(async () => {
    const r = await db.execute(sql`
      SELECT COUNT(*)::int AS n FROM projection_task
      WHERE state NOT IN ('completed', 'skipped', 'rejected', 'done')
    `);
    return (r.rows[0] as { n: number })?.n ?? 0;
  }, 0);

  const overdueTasks = await safeQuery(async () => {
    const r = await db.execute(sql`
      SELECT COUNT(*)::int AS n FROM projection_task
      WHERE state NOT IN ('completed', 'skipped', 'rejected', 'done')
        AND due_at IS NOT NULL AND due_at < NOW()
    `);
    return (r.rows[0] as { n: number })?.n ?? 0;
  }, 0);

  const completedTasks24h = await safeQuery(async () => {
    const r = await db.execute(sql`
      SELECT COUNT(*)::int AS n FROM projection_task
      WHERE state IN ('completed', 'done') AND updated_at >= ${h24.toISOString()}::timestamptz
    `);
    return (r.rows[0] as { n: number })?.n ?? 0;
  }, 0);

  // ── AGENT HEALTH ───────────────────────────────────────────────────────
  const agentRuns24h = await safeQuery(async () => {
    const r = await db.execute(sql`SELECT COUNT(*)::int AS n FROM agent_runs WHERE started_at >= ${h24.toISOString()}::timestamptz`);
    return (r.rows[0] as { n: number })?.n ?? 0;
  }, 0);

  const agentFailures24h = await safeQuery(async () => {
    const r = await db.execute(sql`SELECT COUNT(*)::int AS n FROM agent_runs WHERE started_at >= ${h24.toISOString()}::timestamptz AND status = 'failed'`);
    return (r.rows[0] as { n: number })?.n ?? 0;
  }, 0);

  const pendingApprovals = await safeQuery(async () => {
    const r = await db.execute(sql`SELECT COUNT(*)::int AS n FROM agent_outputs WHERE is_approved = false`);
    return (r.rows[0] as { n: number })?.n ?? 0;
  }, 0);

  // ── GA4 (if configured) ────────────────────────────────────────────────
  const gaEnabled = ga4Configured();
  const gaSummary = gaEnabled ? await getSummary(7) : null;
  const gaSummaryPrev = gaEnabled ? await getSummary(14) : null; // includes prev week + this week
  const gaTopPages = gaEnabled ? await getTopPages(7, 5) : [];
  const gaSources = gaEnabled ? await getTrafficSources(7, 5) : [];
  const gaFunnel = gaEnabled
    ? await getFunnel(["/", "/signup", "/onboarding", "/dashboard"], 7)
    : [];

  // ── ANOMALIES ──────────────────────────────────────────────────────────
  const anomalies: string[] = [];
  if (signupsPrev7d > 0 && signups7d < signupsPrev7d * 0.6) {
    anomalies.push(`Signups dropped ${Math.round((1 - signups7d / signupsPrev7d) * 100)}% week-over-week (${signupsPrev7d} → ${signups7d})`);
  }
  if (agentFailures24h > 0 && agentRuns24h > 0 && agentFailures24h / agentRuns24h > 0.2) {
    anomalies.push(`Agent failure rate is ${pct(agentFailures24h, agentRuns24h)} — investigate logs`);
  }
  if (overdueTasks > 0 && totalHomes > 0 && overdueTasks / totalHomes > 5) {
    anomalies.push(`High overdue-task density: ${(overdueTasks / totalHomes).toFixed(1)} per home on average`);
  }

  // GA4-derived anomalies: approximate "this week vs last week" from the 14d sum - 7d sum
  if (gaSummary && gaSummaryPrev) {
    const lastWeekSessions = Math.max(0, gaSummaryPrev.sessions - gaSummary.sessions);
    if (lastWeekSessions > 0 && gaSummary.sessions < lastWeekSessions * 0.7) {
      const drop = Math.round((1 - gaSummary.sessions / lastWeekSessions) * 100);
      anomalies.push(`Site sessions dropped ${drop}% week-over-week (${lastWeekSessions} → ${gaSummary.sessions})`);
    }
    if (gaSummary.bounceRate > 0.75 && gaSummary.sessions > 50) {
      anomalies.push(`Bounce rate is ${(gaSummary.bounceRate * 100).toFixed(0)}% — above healthy threshold`);
    }
  }

  // ── BUILD EMAIL ────────────────────────────────────────────────────────
  const weekOverWeekPct = signupsPrev7d > 0
    ? Math.round(((signups7d - signupsPrev7d) / signupsPrev7d) * 100)
    : null;
  const wowLabel = weekOverWeekPct === null
    ? "—"
    : `${weekOverWeekPct >= 0 ? "+" : ""}${weekOverWeekPct}% WoW`;
  const wowColor = weekOverWeekPct === null ? "#9ca3af" : weekOverWeekPct >= 0 ? "#16a34a" : "#dc2626";

  const dateLabel = now.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#1f2937;">
  <div style="max-width:640px;margin:0 auto;padding:20px;">
    <div style="background:white;border-radius:12px;overflow:hidden;">
      <div style="background:linear-gradient(135deg,#f97316,#ea580c);padding:20px 28px;">
        <div style="color:rgba(255,255,255,0.9);font-size:12px;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:4px;">Founder Brief</div>
        <h1 style="color:white;font-size:22px;margin:0;font-weight:700;">${dateLabel}</h1>
      </div>

      <div style="padding:24px 28px;">
        <!-- Headline metric: Active Homes -->
        <div style="background:#fff7ed;border-left:3px solid #f97316;padding:16px;border-radius:0 8px 8px 0;margin-bottom:24px;">
          <div style="font-size:11px;text-transform:uppercase;letter-spacing:0.05em;color:#9a3412;margin-bottom:6px;">The Only Metric That Matters</div>
          <div style="font-size:32px;font-weight:700;color:#ea580c;line-height:1;">${activeHomes7d}</div>
          <div style="font-size:13px;color:#6b7280;margin-top:4px;">active homes (last 7d) · of ${totalHomes} total</div>
        </div>

        <!-- Growth -->
        <h2 style="font-size:14px;text-transform:uppercase;letter-spacing:0.05em;color:#6b7280;margin:0 0 12px 0;">Growth</h2>
        <table style="width:100%;border-collapse:collapse;margin-bottom:24px;">
          <tr>
            <td style="padding:10px 0;border-bottom:1px solid #f3f4f6;">New signups (24h)</td>
            <td style="padding:10px 0;border-bottom:1px solid #f3f4f6;text-align:right;font-weight:600;">${signups24h}</td>
          </tr>
          <tr>
            <td style="padding:10px 0;border-bottom:1px solid #f3f4f6;">New signups (7d)</td>
            <td style="padding:10px 0;border-bottom:1px solid #f3f4f6;text-align:right;">
              <span style="font-weight:600;">${signups7d}</span>
              <span style="color:${wowColor};font-size:12px;margin-left:8px;">${wowLabel}</span>
            </td>
          </tr>
          <tr>
            <td style="padding:10px 0;border-bottom:1px solid #f3f4f6;">Total users</td>
            <td style="padding:10px 0;border-bottom:1px solid #f3f4f6;text-align:right;font-weight:600;">${totalUsers}</td>
          </tr>
          <tr>
            <td style="padding:10px 0;">Active users (24h)</td>
            <td style="padding:10px 0;text-align:right;font-weight:600;">${activeUsers24h} <span style="color:#9ca3af;font-size:12px;">(${pct(activeUsers24h, totalUsers)})</span></td>
          </tr>
        </table>

        <!-- Engagement -->
        <h2 style="font-size:14px;text-transform:uppercase;letter-spacing:0.05em;color:#6b7280;margin:0 0 12px 0;">Engagement</h2>
        <table style="width:100%;border-collapse:collapse;margin-bottom:24px;">
          <tr>
            <td style="padding:10px 0;border-bottom:1px solid #f3f4f6;">Open tasks</td>
            <td style="padding:10px 0;border-bottom:1px solid #f3f4f6;text-align:right;font-weight:600;">${openTasks}</td>
          </tr>
          <tr>
            <td style="padding:10px 0;border-bottom:1px solid #f3f4f6;">Overdue tasks</td>
            <td style="padding:10px 0;border-bottom:1px solid #f3f4f6;text-align:right;font-weight:600;color:${overdueTasks > 0 ? "#dc2626" : "#1f2937"};">${overdueTasks}</td>
          </tr>
          <tr>
            <td style="padding:10px 0;">Tasks completed (24h)</td>
            <td style="padding:10px 0;text-align:right;font-weight:600;color:#16a34a;">${completedTasks24h}</td>
          </tr>
        </table>

        <!-- Agent Health -->
        <h2 style="font-size:14px;text-transform:uppercase;letter-spacing:0.05em;color:#6b7280;margin:0 0 12px 0;">Agent Workforce</h2>
        <table style="width:100%;border-collapse:collapse;margin-bottom:24px;">
          <tr>
            <td style="padding:10px 0;border-bottom:1px solid #f3f4f6;">Runs (24h)</td>
            <td style="padding:10px 0;border-bottom:1px solid #f3f4f6;text-align:right;font-weight:600;">${agentRuns24h}</td>
          </tr>
          <tr>
            <td style="padding:10px 0;border-bottom:1px solid #f3f4f6;">Failures (24h)</td>
            <td style="padding:10px 0;border-bottom:1px solid #f3f4f6;text-align:right;font-weight:600;color:${agentFailures24h > 0 ? "#dc2626" : "#1f2937"};">${agentFailures24h}</td>
          </tr>
          <tr>
            <td style="padding:10px 0;">Pending your approval</td>
            <td style="padding:10px 0;text-align:right;font-weight:600;color:${pendingApprovals > 0 ? "#ea580c" : "#1f2937"};">${pendingApprovals}</td>
          </tr>
        </table>

        ${gaSummary ? `
          <h2 style="font-size:14px;text-transform:uppercase;letter-spacing:0.05em;color:#6b7280;margin:0 0 12px 0;">Site Traffic (last 7d)</h2>
          <table style="width:100%;border-collapse:collapse;margin-bottom:16px;">
            <tr>
              <td style="padding:10px 0;border-bottom:1px solid #f3f4f6;">Visitors</td>
              <td style="padding:10px 0;border-bottom:1px solid #f3f4f6;text-align:right;font-weight:600;">${gaSummary.activeUsers.toLocaleString()}</td>
            </tr>
            <tr>
              <td style="padding:10px 0;border-bottom:1px solid #f3f4f6;">Sessions</td>
              <td style="padding:10px 0;border-bottom:1px solid #f3f4f6;text-align:right;font-weight:600;">${gaSummary.sessions.toLocaleString()}</td>
            </tr>
            <tr>
              <td style="padding:10px 0;border-bottom:1px solid #f3f4f6;">Page views</td>
              <td style="padding:10px 0;border-bottom:1px solid #f3f4f6;text-align:right;font-weight:600;">${gaSummary.pageViews.toLocaleString()}</td>
            </tr>
            <tr>
              <td style="padding:10px 0;border-bottom:1px solid #f3f4f6;">Engagement rate</td>
              <td style="padding:10px 0;border-bottom:1px solid #f3f4f6;text-align:right;font-weight:600;">${(gaSummary.engagementRate * 100).toFixed(0)}%</td>
            </tr>
            <tr>
              <td style="padding:10px 0;border-bottom:1px solid #f3f4f6;">Bounce rate</td>
              <td style="padding:10px 0;border-bottom:1px solid #f3f4f6;text-align:right;font-weight:600;color:${gaSummary.bounceRate > 0.7 ? "#dc2626" : "#1f2937"};">${(gaSummary.bounceRate * 100).toFixed(0)}%</td>
            </tr>
            <tr>
              <td style="padding:10px 0;">Conversions</td>
              <td style="padding:10px 0;text-align:right;font-weight:600;color:#16a34a;">${gaSummary.conversions.toLocaleString()}</td>
            </tr>
          </table>

          ${gaTopPages.length > 0 ? `
            <h3 style="font-size:12px;text-transform:uppercase;letter-spacing:0.05em;color:#9ca3af;margin:16px 0 8px 0;">Top pages</h3>
            <table style="width:100%;border-collapse:collapse;margin-bottom:16px;font-size:13px;">
              ${gaTopPages.map((p) => `
                <tr>
                  <td style="padding:6px 0;border-bottom:1px solid #f3f4f6;">
                    <span style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px;color:#6b7280;">${escapeHtml(p.path)}</span>
                  </td>
                  <td style="padding:6px 0;border-bottom:1px solid #f3f4f6;text-align:right;font-weight:500;">${p.pageViews.toLocaleString()}</td>
                </tr>
              `).join("")}
            </table>
          ` : ""}

          ${gaSources.length > 0 ? `
            <h3 style="font-size:12px;text-transform:uppercase;letter-spacing:0.05em;color:#9ca3af;margin:16px 0 8px 0;">Traffic sources</h3>
            <table style="width:100%;border-collapse:collapse;margin-bottom:16px;font-size:13px;">
              ${gaSources.map((s) => `
                <tr>
                  <td style="padding:6px 0;border-bottom:1px solid #f3f4f6;">
                    <span style="font-weight:500;">${escapeHtml(s.source)}</span>
                    <span style="color:#9ca3af;margin-left:6px;">/ ${escapeHtml(s.medium)}</span>
                  </td>
                  <td style="padding:6px 0;border-bottom:1px solid #f3f4f6;text-align:right;">${s.sessions.toLocaleString()} sessions</td>
                </tr>
              `).join("")}
            </table>
          ` : ""}

          ${gaFunnel.length > 0 && gaFunnel.some((s) => s.users > 0) ? `
            <h3 style="font-size:12px;text-transform:uppercase;letter-spacing:0.05em;color:#9ca3af;margin:16px 0 8px 0;">Funnel (last 7d)</h3>
            <table style="width:100%;border-collapse:collapse;margin-bottom:24px;font-size:13px;">
              ${gaFunnel.map((step, i) => {
                const prev = i > 0 ? gaFunnel[i - 1].users : 0;
                const dropoff = prev > 0 ? Math.round((1 - step.users / prev) * 100) : null;
                return `
                  <tr>
                    <td style="padding:6px 0;border-bottom:1px solid #f3f4f6;">
                      <span style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px;color:#6b7280;">${escapeHtml(step.path)}</span>
                    </td>
                    <td style="padding:6px 0;border-bottom:1px solid #f3f4f6;text-align:right;">
                      <span style="font-weight:500;">${step.users.toLocaleString()}</span>
                      ${dropoff !== null && dropoff > 0 ? `<span style="color:${dropoff > 50 ? "#dc2626" : "#ea580c"};font-size:11px;margin-left:8px;">−${dropoff}%</span>` : ""}
                    </td>
                  </tr>
                `;
              }).join("")}
            </table>
          ` : ""}
        ` : `
          <div style="background:#f9fafb;border:1px dashed #d1d5db;border-radius:8px;padding:16px;margin-bottom:20px;font-size:12px;color:#6b7280;">
            <strong style="color:#374151;">GA4 not connected.</strong> Set <code>GA4_PROPERTY_ID</code> and <code>GA4_SERVICE_ACCOUNT_JSON</code> to see traffic, top pages, sources, and funnel metrics in this brief. See <code>docs/ga4-setup.md</code>.
          </div>
        `}

        ${anomalies.length > 0 ? `
          <h2 style="font-size:14px;text-transform:uppercase;letter-spacing:0.05em;color:#dc2626;margin:0 0 12px 0;">⚠ Anomalies</h2>
          <ul style="margin:0 0 24px 0;padding-left:18px;color:#7f1d1d;font-size:13px;line-height:1.6;">
            ${anomalies.map((a) => `<li>${a}</li>`).join("")}
          </ul>
        ` : ""}

        ${pendingApprovals > 0 ? `
          <div style="text-align:center;margin-top:24px;">
            <a href="${process.env.REPLIT_DEPLOYMENT_URL || "http://localhost:5000"}/admin/approvals"
               style="display:inline-block;background:#f97316;color:white;text-decoration:none;padding:12px 28px;border-radius:8px;font-weight:600;font-size:14px;">
              Review ${pendingApprovals} pending approvals
            </a>
          </div>
        ` : ""}
      </div>

      <div style="background:#f9fafb;padding:16px 28px;border-top:1px solid #e5e7eb;text-align:center;">
        <p style="color:#9ca3af;font-size:11px;margin:0;">
          Generated by founder-brief-agent · ${now.toISOString()}
        </p>
      </div>
    </div>
  </div>
</body>
</html>
  `.trim();

  const subject = `Home Buddy · ${activeHomes7d} active homes · ${signups24h} new signups · ${dateLabel}`;

  for (const email of adminEmails) {
    const sent = await sendEmail({ to: email, subject, html });
    if (sent) {
      logInfo("agent.founder-brief", `Brief sent to ${email}`);
    }
  }

  await ctx.emit({
    outputType: "report",
    title: subject,
    content: html,
    metadata: {
      totalUsers, signups24h, signups7d, signupsPrev7d, activeUsers24h,
      totalHomes, activeHomes7d, openTasks, overdueTasks, completedTasks24h,
      agentRuns24h, agentFailures24h, pendingApprovals, anomalies,
      ga4: gaSummary ? {
        summary: gaSummary,
        topPages: gaTopPages,
        sources: gaSources,
        funnel: gaFunnel,
      } : null,
    },
  });
});

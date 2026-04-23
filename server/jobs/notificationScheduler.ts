import { db } from "../db";
import { sql } from "drizzle-orm";
import { sendEmail } from "../lib/email";
import { logInfo, logError, logWarn } from "../lib/logger";
import { isFeatureEnabled } from "../lib/env-validation";

interface TaskRow {
  task_id: string;
  title: string;
  state: string;
  due_at: string | null;
  home_id: string;
}

interface UserDigestData {
  userId: string;
  email: string;
  firstName: string | null;
  homeName: string | null;
  overdueTasks: TaskRow[];
  dueTodayTasks: TaskRow[];
  dueSoonTasks: TaskRow[];
}

const DIGEST_INTERVAL_MS = 60 * 60 * 1000;
const MIN_HOURS_BETWEEN_DIGESTS = 20;

let schedulerTimer: ReturnType<typeof setInterval> | null = null;

export function startNotificationScheduler(): void {
  if (schedulerTimer) return;

  logInfo("notification.scheduler", "Starting notification scheduler", {
    intervalMs: DIGEST_INTERVAL_MS,
    minHoursBetween: MIN_HOURS_BETWEEN_DIGESTS,
  });

  schedulerTimer = setInterval(() => {
    runDigestCycle().catch((err) => {
      logError("notification.scheduler", err);
    });
  }, DIGEST_INTERVAL_MS);

  setTimeout(() => {
    runDigestCycle().catch((err) => {
      logError("notification.scheduler", err);
    });
  }, 30_000);
}

export function stopNotificationScheduler(): void {
  if (schedulerTimer) {
    clearInterval(schedulerTimer);
    schedulerTimer = null;
    logInfo("notification.scheduler", "Notification scheduler stopped");
  }
}

async function runDigestCycle(): Promise<void> {
  if (!isFeatureEnabled("email")) {
    return;
  }

  logInfo("notification.scheduler", "Running daily digest cycle");

  try {
    const cutoff = new Date(Date.now() - MIN_HOURS_BETWEEN_DIGESTS * 60 * 60 * 1000);

    const eligibleUsers = await db.execute(sql`
      SELECT 
        u.id AS user_id,
        u.email,
        u.first_name,
        np.id AS pref_id
      FROM users u
      JOIN notification_preferences np ON np.user_id = u.id
      WHERE np.email_enabled = true
        AND np.maintenance_reminders = true
        AND u.email IS NOT NULL
        AND u.email != ''
        AND (np.last_digest_sent_at IS NULL OR np.last_digest_sent_at < ${cutoff.toISOString()}::timestamptz)
    `);

    if (eligibleUsers.rows.length === 0) {
      logInfo("notification.scheduler", "No eligible users for digest");
      return;
    }

    logInfo("notification.scheduler", `Found ${eligibleUsers.rows.length} eligible users`);

    for (const row of eligibleUsers.rows) {
      const userRow = row as { user_id: string; email: string; first_name: string | null; pref_id: number };

      try {
        await processUserDigest(userRow.user_id, userRow.email, userRow.first_name, userRow.pref_id);
      } catch (err) {
        logError("notification.scheduler", err, { userId: userRow.user_id });
      }
    }
  } catch (err) {
    logError("notification.scheduler", err);
  }
}

async function processUserDigest(
  userId: string,
  email: string,
  firstName: string | null,
  prefId: number,
): Promise<void> {
  const homes = await db.execute(sql`
    SELECT home_id, 
           COALESCE(attrs->>'name', attrs->>'address', 'My Home') AS home_name
    FROM projection_home
    WHERE user_id = ${userId}
    LIMIT 1
  `);

  if (homes.rows.length === 0) return;

  const homeRow = homes.rows[0] as { home_id: string; home_name: string };
  const homeId = homeRow.home_id;

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);
  const soonEnd = new Date(todayEnd);
  soonEnd.setDate(soonEnd.getDate() + 7);

  const tasks = await db.execute(sql`
    SELECT task_id, title, state, due_at, home_id
    FROM projection_task
    WHERE home_id = ${homeId}
      AND state NOT IN ('completed', 'skipped', 'rejected', 'done')
      AND due_at IS NOT NULL
      AND due_at <= ${soonEnd.toISOString()}::timestamptz
    ORDER BY due_at ASC
    LIMIT 50
  `);

  const overdueTasks: TaskRow[] = [];
  const dueTodayTasks: TaskRow[] = [];
  const dueSoonTasks: TaskRow[] = [];

  for (const t of tasks.rows as unknown as TaskRow[]) {
    if (!t.due_at) continue;
    const dueDate = new Date(t.due_at);
    if (dueDate < todayStart) {
      overdueTasks.push(t);
    } else if (dueDate <= todayEnd) {
      dueTodayTasks.push(t);
    } else {
      dueSoonTasks.push(t);
    }
  }

  if (overdueTasks.length === 0 && dueTodayTasks.length === 0 && dueSoonTasks.length === 0) {
    return;
  }

  const digestData: UserDigestData = {
    userId,
    email,
    firstName,
    homeName: homeRow.home_name,
    overdueTasks,
    dueTodayTasks,
    dueSoonTasks,
  };

  const html = buildDigestEmail(digestData);
  const subject = buildSubjectLine(digestData);

  const sent = await sendEmail({
    to: email,
    subject,
    html,
  });

  if (sent) {
    await db.execute(sql`
      UPDATE notification_preferences 
      SET last_digest_sent_at = NOW(), updated_at = NOW()
      WHERE id = ${prefId}
    `);

    logInfo("notification.scheduler", "Digest sent", {
      userId,
      overdue: overdueTasks.length,
      dueToday: dueTodayTasks.length,
      dueSoon: dueSoonTasks.length,
    });
  }
}

function buildSubjectLine(data: UserDigestData): string {
  const parts: string[] = [];
  if (data.overdueTasks.length > 0) {
    parts.push(`${data.overdueTasks.length} overdue`);
  }
  if (data.dueTodayTasks.length > 0) {
    parts.push(`${data.dueTodayTasks.length} due today`);
  }
  if (data.dueSoonTasks.length > 0) {
    parts.push(`${data.dueSoonTasks.length} coming up`);
  }

  return `Home Buddy: ${parts.join(", ")} — ${data.homeName || "Your Home"}`;
}

function buildDigestEmail(data: UserDigestData): string {
  const greeting = data.firstName ? `Hi ${data.firstName}` : "Hi there";

  let taskSections = "";

  if (data.overdueTasks.length > 0) {
    taskSections += `
      <div style="margin-bottom: 24px;">
        <h3 style="color: #dc2626; font-size: 16px; margin: 0 0 12px 0; font-weight: 600;">
          Overdue (${data.overdueTasks.length})
        </h3>
        ${data.overdueTasks.map((t) => taskRow(t, "#fef2f2", "#dc2626")).join("")}
      </div>
    `;
  }

  if (data.dueTodayTasks.length > 0) {
    taskSections += `
      <div style="margin-bottom: 24px;">
        <h3 style="color: #ea580c; font-size: 16px; margin: 0 0 12px 0; font-weight: 600;">
          Due Today (${data.dueTodayTasks.length})
        </h3>
        ${data.dueTodayTasks.map((t) => taskRow(t, "#fff7ed", "#ea580c")).join("")}
      </div>
    `;
  }

  if (data.dueSoonTasks.length > 0) {
    taskSections += `
      <div style="margin-bottom: 24px;">
        <h3 style="color: #2563eb; font-size: 16px; margin: 0 0 12px 0; font-weight: 600;">
          Coming Up This Week (${data.dueSoonTasks.length})
        </h3>
        ${data.dueSoonTasks.map((t) => taskRow(t, "#eff6ff", "#2563eb")).join("")}
      </div>
    `;
  }

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="margin: 0; padding: 0; background-color: #f5f5f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
      <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
          <div style="background: linear-gradient(135deg, #f97316, #ea580c); padding: 24px 32px;">
            <h1 style="color: white; font-size: 20px; margin: 0; font-weight: 700;">Home Buddy</h1>
            <p style="color: rgba(255,255,255,0.9); font-size: 14px; margin: 8px 0 0 0;">Your daily maintenance digest</p>
          </div>
          
          <div style="padding: 32px;">
            <p style="color: #374151; font-size: 15px; margin: 0 0 24px 0; line-height: 1.5;">
              ${greeting}, here's what needs attention for <strong>${data.homeName || "your home"}</strong>:
            </p>

            ${taskSections}

            <div style="text-align: center; margin-top: 32px;">
              <a href="${getAppUrl()}/maintenance-log" 
                 style="display: inline-block; background: #f97316; color: white; text-decoration: none; padding: 12px 32px; border-radius: 8px; font-weight: 600; font-size: 14px;">
                View Maintenance Log
              </a>
            </div>
          </div>

          <div style="background: #f9fafb; padding: 20px 32px; border-top: 1px solid #e5e7eb;">
            <p style="color: #9ca3af; font-size: 12px; margin: 0; text-align: center;">
              You're receiving this because you have maintenance reminders enabled.
              Visit your Profile to update notification preferences.
            </p>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;
}

function taskRow(task: TaskRow, bgColor: string, accentColor: string): string {
  const dueText = task.due_at
    ? new Date(task.due_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })
    : "";

  return `
    <div style="background: ${bgColor}; border-left: 3px solid ${accentColor}; padding: 12px 16px; margin-bottom: 8px; border-radius: 0 8px 8px 0;">
      <p style="margin: 0; font-size: 14px; font-weight: 500; color: #1f2937;">${escapeHtml(task.title || "Untitled task")}</p>
      ${dueText ? `<p style="margin: 4px 0 0 0; font-size: 12px; color: #6b7280;">${dueText}</p>` : ""}
    </div>
  `;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function getAppUrl(): string {
  if (process.env.REPLIT_DEPLOYMENT_URL) {
    return process.env.REPLIT_DEPLOYMENT_URL;
  }
  if (process.env.REPLIT_DEV_DOMAIN) {
    return `https://${process.env.REPLIT_DEV_DOMAIN}`;
  }
  return "http://localhost:5000";
}

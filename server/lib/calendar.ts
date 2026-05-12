/**
 * iCalendar (RFC 5545) subscription feed.
 *
 * Users subscribe once to a URL like:
 *   https://homebuddy.space/api/calendar/<token>.ics
 *
 * Calendar clients (Google Calendar, Apple Calendar, Outlook) poll that
 * URL on their own schedule — typically every few hours for Google/Apple,
 * daily for Outlook — and merge the events into the user's normal
 * calendar. This turns maintenance reminders from "another inbox full of
 * emails" into "tasks sitting next to your dentist appointment," which
 * is dramatically stickier.
 *
 * Auth: calendar clients don't send cookies, so we can't rely on session
 * auth for the feed URL. We use an HMAC-signed token embedded in the path.
 * The token is stateless — no DB column required — and tied to the user's
 * id + SESSION_SECRET. Rotating SESSION_SECRET also invalidates existing
 * feed URLs, which is the right thing if a secret ever leaks.
 *
 * Format choices:
 *   - All-day events (no specific hour). Home maintenance tasks aren't
 *     "at 3pm" — they're "on this day." All-day events show up cleanly
 *     in every client.
 *   - UID is stable and scoped to task id + homebuddy.space, so updates
 *     merge rather than duplicate.
 *   - Stripped line lengths to ≤75 octets per RFC 5545 §3.1.
 */

import crypto from "crypto";

// ---------------------------------------------------------------------------
// Token — HMAC-signed, stateless, per-user
// ---------------------------------------------------------------------------

/**
 * Domain-separated HMAC key. If SESSION_SECRET is ever reused for
 * something else, we still want calendar tokens to be uniquely derived
 * so a token leaked elsewhere can't be replayed here (and vice versa).
 */
function hmacKey(): Buffer {
  const secret =
    process.env.SESSION_SECRET ||
    // Dev fallback — a calendar URL generated here won't be valid in prod,
    // which is exactly what we want. Warn loudly in production startup
    // elsewhere if SESSION_SECRET is missing.
    "homebuddy-dev-session-secret";
  return crypto.createHmac("sha256", secret)
    .update("calendar-feed-v1")
    .digest();
}

function base64url(buf: Buffer | string): string {
  return Buffer.from(buf as any)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function base64urlDecode(s: string): Buffer {
  s = s.replace(/-/g, "+").replace(/_/g, "/");
  while (s.length % 4) s += "=";
  return Buffer.from(s, "base64");
}

/**
 * Produce a stable, opaque token for a user's calendar subscription URL.
 * Format: `<base64url(userId)>.<base64url(sig)>`. Stable across restarts
 * as long as SESSION_SECRET doesn't change.
 */
export function generateCalendarToken(userId: string): string {
  const idPart = base64url(Buffer.from(userId, "utf8"));
  const sig = crypto.createHmac("sha256", hmacKey()).update(idPart).digest();
  return `${idPart}.${base64url(sig)}`;
}

/**
 * Verify a token and extract the userId. Returns null if the signature
 * is invalid or malformed. Uses timingSafeEqual to defeat timing oracles
 * — a leak would let an attacker grind signatures offline, but let's
 * not hand out free side channels.
 */
export function verifyCalendarToken(token: string): string | null {
  if (!token || typeof token !== "string") return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [idPart, sigPart] = parts;
  const expected = crypto.createHmac("sha256", hmacKey()).update(idPart).digest();
  let given: Buffer;
  try {
    given = base64urlDecode(sigPart);
  } catch {
    return null;
  }
  if (given.length !== expected.length) return null;
  if (!crypto.timingSafeEqual(given, expected)) return null;
  try {
    return base64urlDecode(idPart).toString("utf8");
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// iCalendar builder (RFC 5545)
// ---------------------------------------------------------------------------

export interface CalendarTaskInput {
  id: number | string;
  title: string;
  description: string | null;
  dueDate: Date | string | null;
  /** ISO datetime string — when set, emits a timed event instead of all-day */
  scheduledProDate?: string | null;
  /** Contractor name shown in the event title when scheduled */
  contractorName?: string | null;
  urgency?: string | null;
  category?: string | null;
  estimatedCost?: string | null;
  quotedCost?: string | null;
  status?: string | null;
  homeNickname?: string | null;
}

/**
 * Escape per RFC 5545 §3.3.11 — backslash, comma, semicolon, and
 * newlines must all be escaped inside TEXT values.
 */
function escICS(s: string): string {
  return s
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

/** Fold a content line to ≤75 octets per RFC 5545 §3.1. */
function fold(line: string): string {
  // Simple 75-char fold — imperfect for multi-byte UTF-8 runs but
  // good enough for our English-primarily content. Continuation lines
  // start with a single space.
  if (line.length <= 75) return line;
  const parts: string[] = [];
  let rest = line;
  parts.push(rest.slice(0, 75));
  rest = rest.slice(75);
  while (rest.length > 74) {
    parts.push(" " + rest.slice(0, 74));
    rest = rest.slice(74);
  }
  if (rest.length > 0) parts.push(" " + rest);
  return parts.join("\r\n");
}

/** Format a date as YYYYMMDD (all-day event). */
function toICSDate(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}${m}${day}`;
}

/** Format a datetime as YYYYMMDDTHHMMSSZ. */
function toICSDateTime(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  const h = String(d.getUTCHours()).padStart(2, "0");
  const mi = String(d.getUTCMinutes()).padStart(2, "0");
  const s = String(d.getUTCSeconds()).padStart(2, "0");
  return `${y}${m}${day}T${h}${mi}${s}Z`;
}

export interface BuildCalendarOptions {
  tasks: CalendarTaskInput[];
  /** Used for the calendar name shown in subscribers. */
  displayName?: string;
  /** Base URL to link back to the task inside Home Buddy. */
  appBaseUrl?: string;
}

/**
 * Build a VCALENDAR document from a list of tasks. Tasks without a
 * dueDate are skipped — a calendar event without a date is useless.
 */
export function buildICalendar(opts: BuildCalendarOptions): string {
  const now = new Date();
  const dtstamp = toICSDateTime(now);
  const name = opts.displayName || "Home Buddy";
  const appBase = opts.appBaseUrl || "https://homebuddy.space";

  const lines: string[] = [];
  lines.push("BEGIN:VCALENDAR");
  lines.push("VERSION:2.0");
  lines.push("PRODID:-//Home Buddy//Maintenance Feed//EN");
  lines.push("CALSCALE:GREGORIAN");
  lines.push("METHOD:PUBLISH");
  lines.push(fold(`X-WR-CALNAME:${escICS(name)} Maintenance`));
  lines.push(fold(`X-WR-CALDESC:${escICS("Home maintenance tasks from Home Buddy")}`));
  // Tell clients to refresh at least daily. Many clients honour this.
  lines.push("REFRESH-INTERVAL;VALUE=DURATION:PT6H");
  lines.push("X-PUBLISHED-TTL:PT6H");

  for (const t of opts.tasks) {
    // Need at least one date to anchor the event.
    if (!t.dueDate && !t.scheduledProDate) continue;

    const descParts: string[] = [];
    if (t.description) descParts.push(t.description);
    if (t.category) descParts.push(`Category: ${t.category}`);
    const cost = t.quotedCost || t.estimatedCost;
    if (cost) descParts.push(`${t.quotedCost ? "Quoted" : "Estimated"}: ${cost}`);
    if (t.contractorName) descParts.push(`Contractor: ${t.contractorName}`);
    descParts.push(`Open in Home Buddy: ${appBase}/tasks/${t.id}`);
    const description = descParts.join("\\n");

    const statusLine =
      t.status === "completed" || t.status === "skipped"
        ? "STATUS:CANCELLED"
        : "STATUS:CONFIRMED";
    const priorityLine =
      t.urgency === "now" ? "PRIORITY:1"
      : t.urgency === "soon" ? "PRIORITY:5"
      : "PRIORITY:9";

    // ── Timed contractor-appointment event ──────────────────────────────────
    // When a contractor is booked (scheduledProDate is set), we emit a 1-hour
    // TIMED event so it shows as a proper block in the user's day view instead
    // of a grey all-day banner. The UID is suffixed with "-appt" so it
    // coexists with (rather than replaces) the due-date event.
    if (t.scheduledProDate) {
      const apptStart = new Date(t.scheduledProDate);
      if (!isNaN(apptStart.getTime())) {
        const apptEnd = new Date(apptStart.getTime() + 60 * 60 * 1000); // 1 hr

        const summaryParts: string[] = ["📅"];
        summaryParts.push(t.title);
        if (t.contractorName) summaryParts.push(`— ${t.contractorName}`);
        else if (t.homeNickname) summaryParts.push(`— ${t.homeNickname}`);
        const apptSummary = summaryParts.join(" ");

        lines.push("BEGIN:VEVENT");
        lines.push(fold(`UID:task-${t.id}-appt@homebuddy.space`));
        lines.push(`DTSTAMP:${dtstamp}`);
        lines.push(`DTSTART:${toICSDateTime(apptStart)}`);
        lines.push(`DTEND:${toICSDateTime(apptEnd)}`);
        lines.push(fold(`SUMMARY:${escICS(apptSummary)}`));
        lines.push(fold(`DESCRIPTION:${escICS(description).replace(/\\\\n/g, "\\n")}`));
        lines.push(fold(`URL:${appBase}/tasks/${t.id}`));
        lines.push(statusLine);
        lines.push(priorityLine);
        lines.push("TRANSP:OPAQUE"); // timed appts block time — show as busy
        lines.push("END:VEVENT");
      }
    }

    // ── All-day due-date event ───────────────────────────────────────────────
    // Always emit the due-date banner even when a contractor is scheduled —
    // it gives users the "this is due by X" context at the top of the day.
    // Skip if there is no dueDate.
    if (t.dueDate) {
      const due = t.dueDate instanceof Date ? t.dueDate : new Date(t.dueDate);
      if (!isNaN(due.getTime())) {
        const dueDay = toICSDate(due);
        const endDay = toICSDate(new Date(Date.UTC(
          due.getUTCFullYear(), due.getUTCMonth(), due.getUTCDate() + 1,
        )));

        const summaryParts: string[] = [];
        if (t.urgency === "now") summaryParts.push("🔴");
        else if (t.urgency === "soon") summaryParts.push("🟠");
        summaryParts.push(t.title);
        if (t.homeNickname) summaryParts.push(`— ${t.homeNickname}`);
        const summary = summaryParts.join(" ");

        lines.push("BEGIN:VEVENT");
        lines.push(fold(`UID:task-${t.id}@homebuddy.space`));
        lines.push(`DTSTAMP:${dtstamp}`);
        lines.push(`DTSTART;VALUE=DATE:${dueDay}`);
        lines.push(`DTEND;VALUE=DATE:${endDay}`);
        lines.push(fold(`SUMMARY:${escICS(summary)}`));
        lines.push(fold(`DESCRIPTION:${escICS(description).replace(/\\\\n/g, "\\n")}`));
        lines.push(fold(`URL:${appBase}/tasks/${t.id}`));
        lines.push(statusLine);
        lines.push(priorityLine);
        lines.push("TRANSP:TRANSPARENT"); // all-day banners don't block time
        lines.push("END:VEVENT");
      }
    }
  }

  lines.push("END:VCALENDAR");
  return lines.join("\r\n") + "\r\n";
}

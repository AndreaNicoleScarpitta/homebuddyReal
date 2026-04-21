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
  id: number;
  title: string;
  description: string | null;
  dueDate: Date | string | null;
  urgency?: string | null;
  category?: string | null;
  estimatedCost?: string | null;
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
    if (!t.dueDate) continue;
    const due = t.dueDate instanceof Date ? t.dueDate : new Date(t.dueDate);
    if (isNaN(due.getTime())) continue;

    const dueDay = toICSDate(due);

    // The "next day" value for DTEND (all-day events use exclusive end).
    const endDate = new Date(Date.UTC(
      due.getUTCFullYear(),
      due.getUTCMonth(),
      due.getUTCDate() + 1,
    ));
    const endDay = toICSDate(endDate);

    const summaryParts: string[] = [];
    if (t.urgency === "now") summaryParts.push("🔴");
    else if (t.urgency === "soon") summaryParts.push("🟠");
    summaryParts.push(t.title);
    if (t.homeNickname) summaryParts.push(`— ${t.homeNickname}`);
    const summary = summaryParts.join(" ");

    const descParts: string[] = [];
    if (t.description) descParts.push(t.description);
    if (t.category) descParts.push(`Category: ${t.category}`);
    if (t.estimatedCost) descParts.push(`Estimated: ${t.estimatedCost}`);
    descParts.push(`Open in Home Buddy: ${appBase}/tasks/${t.id}`);
    const description = descParts.join("\\n");

    lines.push("BEGIN:VEVENT");
    lines.push(fold(`UID:task-${t.id}@homebuddy.space`));
    lines.push(`DTSTAMP:${dtstamp}`);
    lines.push(`DTSTART;VALUE=DATE:${dueDay}`);
    lines.push(`DTEND;VALUE=DATE:${endDay}`);
    lines.push(fold(`SUMMARY:${escICS(summary)}`));
    lines.push(fold(`DESCRIPTION:${escICS(description).replace(/\\\\n/g, "\\n")}`));
    lines.push(fold(`URL:${appBase}/tasks/${t.id}`));
    // Mark completed tasks as CANCELLED so clients fade them out.
    if (t.status === "completed") lines.push("STATUS:CANCELLED");
    else if (t.status === "skipped") lines.push("STATUS:CANCELLED");
    else lines.push("STATUS:CONFIRMED");
    if (t.urgency === "now") lines.push("PRIORITY:1");
    else if (t.urgency === "soon") lines.push("PRIORITY:5");
    else lines.push("PRIORITY:9");
    lines.push("TRANSP:TRANSPARENT");
    lines.push("END:VEVENT");
  }

  lines.push("END:VCALENDAR");
  return lines.join("\r\n") + "\r\n";
}

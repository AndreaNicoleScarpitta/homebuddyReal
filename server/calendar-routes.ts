/**
 * Calendar subscription routes.
 *
 * Two endpoints:
 *
 *   GET /api/me/calendar-feed    (authed)
 *     Returns the user's personal feed URL + token. UI reads this once
 *     and shows the URL with a Copy button for the user to paste into
 *     their calendar app's "Subscribe" dialog.
 *
 *   GET /api/calendar/:token.ics (NOT cookie-authed, token-authed)
 *     The feed itself. Calendar clients (Google/Apple/Outlook) poll this
 *     URL periodically with no cookies; the signed token in the path IS
 *     the authentication. See server/lib/calendar.ts for token details.
 *
 * Why this lives here rather than inside registerRoutes:
 *   The .ics endpoint must NOT require cookies or CSRF, and must return
 *   a specific Content-Type. Keeping it in its own file makes the
 *   intentional skip-auth posture obvious to future readers.
 */

import type { Express, Request, Response } from "express";
import { isAuthenticated } from "./replit_integrations/auth";
import { db } from "./db";
import { sql } from "drizzle-orm";
import { logger } from "./lib/logger";
import {
  generateCalendarToken,
  verifyCalendarToken,
  buildICalendar,
  type CalendarTaskInput,
} from "./lib/calendar";

function appBaseUrl(req: Request): string {
  if (process.env.REPLIT_DEPLOYMENT_URL) return process.env.REPLIT_DEPLOYMENT_URL;
  if (process.env.REPLIT_DEV_DOMAIN) return `https://${process.env.REPLIT_DEV_DOMAIN}`;
  // Fall back to the request's own host — correct behind Railway, local
  // dev, or any other deployment that doesn't set a known env var.
  const host = req.get("host");
  if (host) return `${req.protocol}://${host}`;
  return "http://localhost:5000";
}

export function registerCalendarRoutes(app: Express): void {
  /**
   * Returns the authenticated user's personal calendar subscription URL.
   * The token is deterministic — calling this twice yields the same URL —
   * so we can always surface it without any DB writes.
   */
  app.get("/api/me/calendar-feed", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      if (!user?.id) {
        res.status(401).json({ error: "Not authenticated" });
        return;
      }
      const token = generateCalendarToken(user.id);
      const base = appBaseUrl(req);
      const url = `${base}/api/calendar/${token}.ics`;
      // Also return a webcal:// variant — many calendar apps handle this
      // as a "subscribe" intent, which is nicer UX than raw HTTP copy-paste.
      const webcal = url.replace(/^https?:\/\//, "webcal://");
      res.json({ url, webcalUrl: webcal, token });
    } catch (err: any) {
      logger.error({ err: err?.message }, "Failed to build calendar feed URL");
      res.status(500).json({ error: "Unable to build calendar URL" });
    }
  });

  /**
   * The actual iCalendar feed.
   *
   * NO cookie auth — calendar clients don't send cookies on subscribe.
   * The token in the path is the whole authentication story.
   *
   * Response headers:
   *   - Content-Type: text/calendar — required for "Subscribe" intents
   *     in Apple / Google Calendar to work
   *   - Cache-Control: private, max-age=300 — let clients cache briefly
   *     to avoid hammering us, but not so long that new tasks take hours
   *     to appear
   */
  app.get("/api/calendar/:tokenWithExt", async (req: Request, res: Response) => {
    try {
      const raw = req.params.tokenWithExt || "";
      // Accept both `<token>.ics` and bare `<token>` (some clients normalize).
      const token = raw.endsWith(".ics") ? raw.slice(0, -4) : raw;

      const userId = verifyCalendarToken(token);
      if (!userId) {
        // Return a minimal empty calendar rather than 401 so client apps
        // don't silently drop the subscription — they'll still show an
        // empty calendar with the user's chosen name. Also avoids leaking
        // "is this token valid" signal to probes.
        res.setHeader("Content-Type", "text/calendar; charset=utf-8");
        res.send(
          "BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//Home Buddy//Maintenance//EN\r\nEND:VCALENDAR\r\n"
        );
        return;
      }

      // Pull all maintenance tasks for this user that have a due date
      // and aren't already closed out. We deliberately include `completed`
      // tasks from the last 60 days so users can see "done this week"
      // crossed out in their calendar — useful social proof to themselves.
      const result = await db.execute(sql`
        SELECT
          t.id,
          t.title,
          t.description,
          t.due_date,
          t.urgency,
          t.category,
          t.estimated_cost,
          t.status,
          h.address_line_1,
          h.street_address,
          h.city
        FROM maintenance_tasks t
        JOIN homes h ON h.id = t.home_id
        WHERE h.user_id = ${userId}
          AND t.due_date IS NOT NULL
          AND (
            COALESCE(t.status, 'pending') IN ('pending', 'scheduled')
            OR (t.status = 'completed' AND t.due_date >= NOW() - INTERVAL '60 days')
          )
        ORDER BY t.due_date
        LIMIT 500
      `);

      const tasks: CalendarTaskInput[] = result.rows.map((row: any) => {
        // Prefer an address line as the home nickname — more informative
        // than "Home #3" if a user has multiple properties.
        const homeLabel =
          row.street_address || row.address_line_1 || row.city || null;
        return {
          id: Number(row.id),
          title: String(row.title || "Maintenance task"),
          description: row.description || null,
          dueDate: row.due_date,
          urgency: row.urgency || null,
          category: row.category || null,
          estimatedCost: row.estimated_cost || null,
          status: row.status || null,
          homeNickname: homeLabel,
        };
      });

      const ics = buildICalendar({
        tasks,
        displayName: "Home Buddy",
        appBaseUrl: appBaseUrl(req),
      });

      res.setHeader("Content-Type", "text/calendar; charset=utf-8");
      // Let clients cache briefly — Google/Apple refresh on their own
      // cadence and there's no point pounding the DB on every poll.
      res.setHeader("Cache-Control", "private, max-age=300");
      // Hint for clients that download-as-file — Apple Calendar respects this.
      res.setHeader("Content-Disposition", 'inline; filename="homebuddy.ics"');
      res.send(ics);
    } catch (err: any) {
      logger.error({ err: err?.message }, "Failed to serve calendar feed");
      // Don't 500 hard — return an empty-but-valid calendar so the
      // subscription doesn't break on transient errors.
      res.setHeader("Content-Type", "text/calendar; charset=utf-8");
      res.status(200).send(
        "BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//Home Buddy//Maintenance//EN\r\nEND:VCALENDAR\r\n"
      );
    }
  });
}

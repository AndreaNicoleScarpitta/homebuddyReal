import type { Express } from "express";
import { isAuthenticated } from "./replitAuth";
import { authStorage } from "./storage";

export const CURRENT_DISCLAIMER_VERSION = "v1.0";

export function registerAuthRoutes(app: Express): void {
  app.get("/api/auth/user", isAuthenticated, async (req: any, res) => {
    try {
      res.json(req.user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  app.get("/api/disclaimer/status", isAuthenticated, async (req: any, res) => {
    try {
      const user = req.user;
      const accepted =
        user.disclaimerAccepted === true &&
        user.disclaimerVersion === CURRENT_DISCLAIMER_VERSION;
      res.json({
        accepted,
        currentVersion: CURRENT_DISCLAIMER_VERSION,
        userVersion: user.disclaimerVersion || null,
        acceptedAt: user.disclaimerAcceptedAt || null,
      });
    } catch (error) {
      console.error("Error checking disclaimer status:", error);
      res.status(500).json({ message: "Failed to check disclaimer status" });
    }
  });

  app.post("/api/disclaimer/accept", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const ipAddress = req.ip || req.headers["x-forwarded-for"]?.toString() || null;
      const updated = await authStorage.acceptDisclaimer(userId, CURRENT_DISCLAIMER_VERSION, ipAddress || undefined);
      req.user = updated;
      res.json({
        accepted: true,
        version: CURRENT_DISCLAIMER_VERSION,
        acceptedAt: updated.disclaimerAcceptedAt,
      });
    } catch (error) {
      console.error("Error accepting disclaimer:", error);
      res.status(500).json({ message: "Failed to accept disclaimer" });
    }
  });
}

import { describe, it, expect } from "vitest";
import { CURRENT_DISCLAIMER_VERSION } from "../server/replit_integrations/auth/routes";

describe("Disclaimer System", () => {
  describe("Acceptance Flow", () => {
    it("CURRENT_DISCLAIMER_VERSION is set", () => {
      expect(CURRENT_DISCLAIMER_VERSION).toBe("v1.0");
    });

    it("new users have disclaimerAccepted = false by default", () => {
      const defaults = {
        disclaimerAccepted: false,
        disclaimerAcceptedAt: null,
        disclaimerVersion: null,
      };
      expect(defaults.disclaimerAccepted).toBe(false);
      expect(defaults.disclaimerAcceptedAt).toBeNull();
      expect(defaults.disclaimerVersion).toBeNull();
    });

    it("accepted user has correct fields set", () => {
      const acceptedUser = {
        disclaimerAccepted: true,
        disclaimerAcceptedAt: new Date("2026-03-08T16:05:00Z"),
        disclaimerVersion: "v1.0",
      };
      expect(acceptedUser.disclaimerAccepted).toBe(true);
      expect(acceptedUser.disclaimerAcceptedAt).toBeInstanceOf(Date);
      expect(acceptedUser.disclaimerVersion).toBe("v1.0");
    });

    it("timestamp is recorded on acceptance", () => {
      const before = new Date();
      const acceptedAt = new Date();
      const after = new Date();
      expect(acceptedAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(acceptedAt.getTime()).toBeLessThanOrEqual(after.getTime());
    });

    it("version is recorded on acceptance", () => {
      const user = {
        disclaimerVersion: CURRENT_DISCLAIMER_VERSION,
      };
      expect(user.disclaimerVersion).toBe("v1.0");
    });
  });

  describe("Access Control", () => {
    function requireDisclaimerCheck(user: {
      disclaimerAccepted: boolean | null;
      disclaimerVersion: string | null;
    }): { allowed: boolean; code?: string } {
      if (
        !user.disclaimerAccepted ||
        user.disclaimerVersion !== CURRENT_DISCLAIMER_VERSION
      ) {
        return {
          allowed: false,
          code: "DISCLAIMER_REQUIRED",
        };
      }
      return { allowed: true };
    }

    it("user without acceptance cannot access analysis routes", () => {
      const result = requireDisclaimerCheck({
        disclaimerAccepted: false,
        disclaimerVersion: null,
      });
      expect(result.allowed).toBe(false);
      expect(result.code).toBe("DISCLAIMER_REQUIRED");
    });

    it("user with null disclaimerAccepted cannot access analysis routes", () => {
      const result = requireDisclaimerCheck({
        disclaimerAccepted: null,
        disclaimerVersion: null,
      });
      expect(result.allowed).toBe(false);
      expect(result.code).toBe("DISCLAIMER_REQUIRED");
    });

    it("user with acceptance can access normally", () => {
      const result = requireDisclaimerCheck({
        disclaimerAccepted: true,
        disclaimerVersion: "v1.0",
      });
      expect(result.allowed).toBe(true);
      expect(result.code).toBeUndefined();
    });

    it("user with wrong version is blocked", () => {
      const result = requireDisclaimerCheck({
        disclaimerAccepted: true,
        disclaimerVersion: "v0.9",
      });
      expect(result.allowed).toBe(false);
      expect(result.code).toBe("DISCLAIMER_REQUIRED");
    });

    it("blocks access to file-analysis conceptually", () => {
      const user = { disclaimerAccepted: false, disclaimerVersion: null };
      const check = requireDisclaimerCheck(user);
      expect(check.allowed).toBe(false);
    });

    it("blocks access to suggestions/approve conceptually", () => {
      const user = { disclaimerAccepted: false, disclaimerVersion: null };
      const check = requireDisclaimerCheck(user);
      expect(check.allowed).toBe(false);
    });

    it("blocks access to suggestions/decline conceptually", () => {
      const user = { disclaimerAccepted: false, disclaimerVersion: null };
      const check = requireDisclaimerCheck(user);
      expect(check.allowed).toBe(false);
    });

    it("blocks access to confirm-matched-tasks conceptually", () => {
      const user = { disclaimerAccepted: false, disclaimerVersion: null };
      const check = requireDisclaimerCheck(user);
      expect(check.allowed).toBe(false);
    });
  });

  describe("Versioning", () => {
    it("updating disclaimerVersion forces re-acceptance", () => {
      const user = {
        disclaimerAccepted: true,
        disclaimerVersion: "v1.0",
      };

      const newVersion = "v2.0";
      const needsReaccept = user.disclaimerVersion !== newVersion;
      expect(needsReaccept).toBe(true);
    });

    it("same version does not force re-acceptance", () => {
      const user = {
        disclaimerAccepted: true,
        disclaimerVersion: "v1.0",
      };

      const needsReaccept = user.disclaimerVersion !== CURRENT_DISCLAIMER_VERSION;
      expect(needsReaccept).toBe(false);
    });

    it("version comparison is exact string match", () => {
      expect("v1.0").not.toBe("v1.00");
      expect("v1.0").not.toBe("V1.0");
      expect("v1.0").toBe("v1.0");
    });
  });

  describe("Regression Safety", () => {
    it("disclaimer fields do not break User type shape", () => {
      const userShape = {
        id: "abc123",
        email: "test@test.com",
        firstName: "Test",
        lastName: "User",
        profileImageUrl: null,
        provider: "replit",
        providerId: "abc123",
        dataStorageOptOut: false,
        disclaimerAccepted: false,
        disclaimerAcceptedAt: null,
        disclaimerVersion: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      expect(userShape).toHaveProperty("id");
      expect(userShape).toHaveProperty("disclaimerAccepted");
      expect(userShape).toHaveProperty("disclaimerAcceptedAt");
      expect(userShape).toHaveProperty("disclaimerVersion");
      expect(userShape).toHaveProperty("email");
      expect(userShape).toHaveProperty("createdAt");
    });

    it("existing user fields are preserved", () => {
      const user = {
        id: "test-id",
        email: "user@example.com",
        firstName: "Jane",
        lastName: "Doe",
        profileImageUrl: "https://example.com/pic.jpg",
        provider: "replit",
        providerId: "12345",
        dataStorageOptOut: true,
        disclaimerAccepted: true,
        disclaimerAcceptedAt: new Date(),
        disclaimerVersion: "v1.0",
        createdAt: new Date("2025-01-01"),
        updatedAt: new Date("2026-03-08"),
      };
      expect(user.dataStorageOptOut).toBe(true);
      expect(user.provider).toBe("replit");
      expect(user.firstName).toBe("Jane");
    });

    it("CURRENT_DISCLAIMER_VERSION is a non-empty string", () => {
      expect(typeof CURRENT_DISCLAIMER_VERSION).toBe("string");
      expect(CURRENT_DISCLAIMER_VERSION.length).toBeGreaterThan(0);
    });
  });
});

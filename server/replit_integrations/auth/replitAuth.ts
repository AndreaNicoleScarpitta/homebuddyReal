import * as client from "openid-client";
import session from "express-session";
import type { Express, RequestHandler } from "express";
import connectPg from "connect-pg-simple";
import { authStorage } from "./storage";

declare module "express-session" {
  interface SessionData {
    code_verifier?: string;
    state?: string;
    userId?: string;
  }
}

export function getSession() {
  const sessionTtl = 7 * 24 * 60 * 60 * 1000;

  const sessionSecret = process.env.SESSION_SECRET;
  if (!sessionSecret) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("SESSION_SECRET environment variable is required in production");
    }
    console.warn("SESSION_SECRET not set — using insecure default for local development only");
  }
  const resolvedSecret = sessionSecret || "local-dev-secret-DO-NOT-USE-IN-PRODUCTION";

  const pgStore = connectPg(session);
  const sessionStore = new pgStore({
    conString: process.env.DATABASE_URL,
    createTableIfMissing: true,
    ttl: sessionTtl,
    tableName: "sessions",
  });
  return session({
    secret: resolvedSecret,
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: sessionTtl,
    },
  });
}

export function getExternalUrl(reqHeaders?: { host?: string; "x-forwarded-proto"?: string; "x-forwarded-host"?: string }): string {
  if (reqHeaders) {
    const host = reqHeaders["x-forwarded-host"] || reqHeaders.host;
    if (host) {
      const proto = reqHeaders["x-forwarded-proto"] || "https";
      return `${proto}://${host}`;
    }
  }

  if (process.env.REPLIT_DEPLOYMENT_URL) {
    return process.env.REPLIT_DEPLOYMENT_URL;
  }
  if (process.env.REPLIT_DEV_DOMAIN) {
    return `https://${process.env.REPLIT_DEV_DOMAIN}`;
  }
  return `http://localhost:5000`;
}

let oidcConfig: client.Configuration;

export async function setupAuth(app: Express) {
  app.set("trust proxy", 1);
  app.use(getSession());

  const clientId = process.env.REPL_ID;

  if (clientId) {
    try {
      const issuerUrl = new URL("https://replit.com/oidc");
      oidcConfig = await client.discovery(issuerUrl, clientId);
    } catch (error) {
      console.warn("Replit OIDC discovery failed (non-fatal, use test login):", (error as Error).message);
    }
  } else {
    console.warn("REPL_ID not set — Replit OAuth disabled, use test login instead");
  }

  app.get("/api/login", async (req, res) => {
    if (!oidcConfig) {
      return res.status(503).json({ message: "Replit OAuth not available. Use test login." });
    }
    try {
      const code_verifier = client.randomPKCECodeVerifier();
      const code_challenge = await client.calculatePKCECodeChallenge(code_verifier);
      const state = client.randomState();

      const callbackURL = `${getExternalUrl(req.headers as any)}/api/callback`;

      req.session.code_verifier = code_verifier;
      req.session.state = state;

      req.session.save((err) => {
        if (err) {
          console.error("Session save error:", err);
          return res.status(500).send("Failed to save session");
        }

        const authorizationUrl = client.buildAuthorizationUrl(oidcConfig, {
          redirect_uri: callbackURL,
          scope: "openid email profile",
          code_challenge,
          code_challenge_method: "S256",
          state,
        });

        res.redirect(authorizationUrl.href);
      });
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).send("Login failed");
    }
  });

  app.get("/api/callback", async (req, res) => {
    if (!oidcConfig) {
      return res.redirect("/?error=auth_not_available");
    }
    try {
      const { code_verifier, state } = req.session;

      if (!code_verifier || !state) {
        console.error("Missing session data in callback");
        return res.redirect("/?error=auth_failed");
      }

      const currentUrl = new URL(
        req.originalUrl,
        getExternalUrl(req.headers as any)
      );

      const tokens = await client.authorizationCodeGrant(
        oidcConfig,
        currentUrl,
        {
          pkceCodeVerifier: code_verifier,
          expectedState: state,
        }
      );

      const claims = tokens.claims();
      const userInfo = await client.fetchUserInfo(
        oidcConfig,
        tokens.access_token!,
        claims?.sub!
      );

      const user = await authStorage.upsertUser({
        id: userInfo.sub,
        email: (userInfo.email as string) || null,
        firstName: (userInfo.first_name as string) || (userInfo.given_name as string) || null,
        lastName: (userInfo.last_name as string) || (userInfo.family_name as string) || null,
        profileImageUrl: (userInfo.profile_image_url as string) || (userInfo.picture as string) || null,
        provider: "replit",
        providerId: userInfo.sub,
      });

      await authStorage.incrementLoginCount(user.id);

      delete req.session.code_verifier;
      delete req.session.state;
      req.session.userId = user.id;

      req.session.save((err) => {
        if (err) {
          console.error("Session save error after login:", err);
          return res.status(500).send("Failed to save session");
        }
        res.redirect("/?auth=success");
      });
    } catch (error) {
      console.error("Callback error:", error);
      res.redirect("/?error=auth_failed");
    }
  });

  app.post("/api/auth/test-login", async (req, res) => {
    if (process.env.NODE_ENV === "production") {
      return res.status(404).json({ message: "Not found" });
    }
    try {
      const { username, password } = req.body;
      if (username !== "test" || password !== "password123") {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      const testUserId = "test-user-001";
      const user = await authStorage.upsertUser({
        id: testUserId,
        email: "test@homebuddy.app",
        firstName: "Test",
        lastName: "User",
        profileImageUrl: null,
        provider: "local",
        providerId: testUserId,
      });

      await authStorage.incrementLoginCount(user.id);
      req.session.userId = user.id;

      req.session.save((err) => {
        if (err) {
          console.error("Session save error after test login:", err);
          return res.status(500).json({ message: "Failed to save session" });
        }
        res.json({ success: true, user });
      });
    } catch (error) {
      console.error("Test login error:", error);
      res.status(500).json({ message: "Login failed" });
    }
  });

  app.get("/api/logout", (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        console.error("Logout error:", err);
      }
      res.redirect("/");
    });
  });
}

export const isAuthenticated: RequestHandler = async (req, res, next) => {
  const userId = req.session?.userId;
  if (!userId) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  try {
    const user = await authStorage.getUser(userId);
    if (!user) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    (req as any).user = user;
    return next();
  } catch (err) {
    return res.status(401).json({ message: "Unauthorized" });
  }
};

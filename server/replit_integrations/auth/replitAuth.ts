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
    throw new Error("SESSION_SECRET environment variable is required");
  }

  const pgStore = connectPg(session);
  const sessionStore = new pgStore({
    conString: process.env.DATABASE_URL,
    createTableIfMissing: false,
    ttl: sessionTtl,
    tableName: "sessions",
  });
  return session({
    secret: sessionSecret,
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: sessionTtl,
    },
  });
}

function getExternalUrl(): string {
  if (process.env.REPLIT_DEV_DOMAIN) {
    return `https://${process.env.REPLIT_DEV_DOMAIN}`;
  }
  const replSlug = process.env.REPL_SLUG;
  const replOwner = process.env.REPL_OWNER;
  if (replSlug && replOwner) {
    return `https://${replSlug}.${replOwner}.repl.co`;
  }
  return `http://localhost:5000`;
}

let oidcConfig: client.Configuration;

export async function setupAuth(app: Express) {
  app.set("trust proxy", 1);
  app.use(getSession());

  const issuerUrl = new URL("https://replit.com/oidc");
  const clientId = process.env.REPL_ID!;

  oidcConfig = await client.discovery(issuerUrl, clientId, undefined, undefined, {
    execute: [client.allowInsecureRequests],
  });

  const callbackURL = `${getExternalUrl()}/api/callback`;

  app.get("/api/login", async (req, res) => {
    try {
      const code_verifier = client.randomPKCECodeVerifier();
      const code_challenge = await client.calculatePKCECodeChallenge(code_verifier);
      const state = client.randomState();

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
    try {
      const { code_verifier, state } = req.session;

      if (!code_verifier || !state) {
        console.error("Missing session data in callback");
        return res.redirect("/?error=auth_failed");
      }

      const currentUrl = new URL(
        req.originalUrl,
        getExternalUrl()
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

      delete req.session.code_verifier;
      delete req.session.state;
      req.session.userId = user.id;

      req.session.save((err) => {
        if (err) {
          console.error("Session save error after login:", err);
          return res.status(500).send("Failed to save session");
        }
        res.redirect("/");
      });
    } catch (error) {
      console.error("Callback error:", error);
      res.redirect("/?error=auth_failed");
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

import express, { type Express } from "express";
import fs from "fs";
import path from "path";

export function serveStatic(app: Express) {
  const distPath = path.resolve(__dirname, "public");
  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`,
    );
  }

  // Hashed assets (JS, CSS) — immutable, cache for 1 year
  app.use(
    "/assets",
    express.static(path.join(distPath, "assets"), {
      maxAge: "1y",
      immutable: true,
    }),
  );

  // Static files (images, icons, manifest) — cache for 1 day, revalidate
  app.use(
    express.static(distPath, {
      maxAge: "1d",
      setHeaders(res, filePath) {
        // Hashed files get immutable cache
        if (filePath.match(/\.[a-f0-9]{8,}\.(js|css)$/)) {
          res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
        }
      },
    }),
  );

  // SPA fallback — serve index.html for client routes
  // For known 404 patterns, return 404 status (avoid soft 404s for SEO)
  app.use("*", (req, res) => {
    const reqPath = req.originalUrl;

    // API routes that weren't matched should 404 properly
    if (reqPath.startsWith("/api/") || reqPath.startsWith("/v2/")) {
      return res.status(404).json({ message: "Not found" });
    }

    // Known file extensions that don't exist — return real 404
    if (reqPath.match(/\.(js|css|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|map|json)$/)) {
      return res.status(404).send("Not found");
    }

    // All other paths — serve SPA shell (client-side router handles 404 display)
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}

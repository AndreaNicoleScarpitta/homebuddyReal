/**
 * CI-only local TLS reverse proxy for real browser tests.
 * The production server uses Secure session cookies. An HTTP-only CI host
 * cannot exercise that contract: Express will not set a Secure cookie unless
 * req.secure is true behind a trusted proxy. Do not weaken cookie security to
 * make a test pass. Run real HTTPS with a disposable self-signed local cert.
 */
import https from "node:https";
import http from "node:http";
import fs from "node:fs";

if (process.env.CI !== "true") {
  throw new Error("This local TLS proxy is permitted only inside CI.");
}

const key = fs.readFileSync(process.env.CI_TLS_KEY || "/tmp/homebuddy-ci.key");
const cert = fs.readFileSync(process.env.CI_TLS_CERT || "/tmp/homebuddy-ci.crt");
const targetPort = Number(process.env.PORT || 5000);
const proxyPort = Number(process.env.CI_HTTPS_PORT || 5443);

const server = https.createServer({ key, cert }, (req, res) => {
  const headers = {
    ...req.headers,
    "x-forwarded-proto": "https",
    "x-forwarded-host": req.headers.host || `localhost:${proxyPort}`,
    "x-forwarded-for": req.socket.remoteAddress || "127.0.0.1",
  };
  const upstream = http.request({
    hostname: "127.0.0.1",
    port: targetPort,
    method: req.method,
    path: req.url,
    headers,
  }, (response) => {
    res.writeHead(response.statusCode || 502, response.headers);
    response.pipe(res);
  });
  upstream.on("error", (error) => {
    if (!res.headersSent) res.writeHead(502, { "content-type": "text/plain" });
    res.end("Upstream unavailable: " + error.message);
  });
  req.pipe(upstream);
});
server.listen(proxyPort, "127.0.0.1", () => {
  console.info(`[ci-https-proxy] listening at https://localhost:${proxyPort}`);
});

/**
 * Boot-time database connectivity check.
 *
 * Without this, the server logs "serving on port N" even when DATABASE_URL
 * points at an unreachable — or wrong — database, and every request then
 * fails with an opaque 500. (Locally this happened when another project's
 * postgres container was bound to port 5432: the app connected to it and got
 * "password authentication failed".) Fail the boot loudly instead so the
 * deploy log and the terminal say exactly what is broken.
 *
 * Escape hatch: SKIP_DB_BOOT_CHECK=1 skips the check (e.g. for tooling that
 * boots the server without a database).
 */
import { pool } from "../db";
import { logInfo, logWarn, logError } from "./logger";

/** Host:port/dbname from DATABASE_URL — never includes credentials. */
function describeDatabaseTarget(): string {
  try {
    const url = new URL(process.env.DATABASE_URL!);
    const dbName = url.pathname.replace(/^\//, "") || "<no database>";
    return `${url.hostname}:${url.port || "5432"}/${dbName}`;
  } catch {
    return "<unparseable DATABASE_URL>";
  }
}

/** Postgres error codes that mean "we reached a server, but it's the wrong
 *  one / wrong credentials" — retrying won't help, so fail immediately. */
const NON_RETRYABLE_CODES = new Set([
  "28P01", // invalid_password
  "28000", // invalid_authorization_specification
  "3D000", // invalid_catalog_name (database does not exist)
]);

export async function verifyDatabaseConnection(
  { attempts = 5, delayMs = 2000 }: { attempts?: number; delayMs?: number } = {},
): Promise<void> {
  if (process.env.SKIP_DB_BOOT_CHECK === "1") {
    logWarn("db.check", "SKIP_DB_BOOT_CHECK=1 — skipping database connectivity check");
    return;
  }

  const target = describeDatabaseTarget();
  let lastError: (Error & { code?: string }) | null = null;

  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      await pool.query("SELECT 1");
      logInfo("db.check", `[on ] database reachable at ${target}`);
      return;
    } catch (err) {
      lastError = err as Error & { code?: string };
      if (lastError.code && NON_RETRYABLE_CODES.has(lastError.code)) {
        break; // reached a postgres, but wrong credentials or wrong database
      }
      if (attempt < attempts) {
        logWarn(
          "db.check",
          `Database not reachable at ${target} (attempt ${attempt}/${attempts}): ${lastError.message} — retrying in ${delayMs / 1000}s`,
        );
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
  }

  logError(
    "db.check",
    new Error(`FATAL: cannot use database at ${target}: ${lastError?.message ?? "unknown error"}`),
  );
  if (lastError?.code && NON_RETRYABLE_CODES.has(lastError.code)) {
    logError(
      "db.check",
      new Error(
        `A postgres server answered at ${target}, but rejected this app's credentials or database name. ` +
          `This usually means DATABASE_URL points at the wrong server — locally, check with "docker ps" that ` +
          `homebuddy-postgres is the container actually publishing this port, not another project's database.`,
      ),
    );
  }
  process.exit(1);
}

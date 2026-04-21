/**
 * One-time DB reset triggered by RESET_DB=true env var.
 *
 * Drops and recreates the `public` and `drizzle` schemas. Used only to
 * recover from partial-schema states that block `drizzle-kit push`.
 * After running successfully once, unset RESET_DB in Railway so this
 * no-ops on every subsequent deploy.
 */
import pg from "pg";

async function main() {
  if (process.env.RESET_DB !== "true") {
    return;
  }
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("RESET_DB=true but DATABASE_URL is not set");
    process.exit(1);
  }
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  console.log("RESET_DB=true — wiping public + drizzle schemas");
  await client.query("DROP SCHEMA IF EXISTS public CASCADE");
  await client.query("DROP SCHEMA IF EXISTS drizzle CASCADE");
  await client.query("CREATE SCHEMA public");
  await client.query("GRANT ALL ON SCHEMA public TO public");
  await client.end();
  console.log("RESET_DB done — remove the RESET_DB variable in Railway now");
}

main().catch((err) => {
  console.error("Reset failed:", err);
  process.exit(1);
});

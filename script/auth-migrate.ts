import { Pool } from "pg";
import { getMigrations } from "better-auth/db/migration";
import { createBetterAuth } from "../server/better-auth-config";

// Never called by application startup. Preview by default; --apply is explicit.
// Back up and test on a separate database/branch before applying to production.
async function main() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required.");
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 2 });
  try {
    const auth = createBetterAuth(pool);
    const migration = await getMigrations(auth.options);
    const sql = await migration.compileMigrations();
    if (!sql.replace(/;/g, "").trim()) {
      console.log("Better Auth storage is already current.");
      return;
    }
    // Better Auth qualifies all migration tables with database.schemaName.
    // Do not allow a CLI/schema change to silently target content or managed auth.
    if (!sql.includes('"app_auth"') || /\bDROP\b|\bTRUNCATE\b|"public"\.|"neon_auth"\./i.test(sql)) {
      throw new Error("Unsafe migration refused; inspect the schema change manually.");
    }
    if (!process.argv.includes("--apply")) {
      console.log(sql);
      console.log("\nPreview only. Back up first, then use --apply on the intended database.");
      return;
    }
    // Apply the library's schema-specific migration; no startup drizzle push.
    await migration.runMigrations();
    console.log("Better Auth app_auth schema migration complete.");
  } finally {
    await pool.end();
  }
}

main().catch(() => {
  console.error("Auth migration failed. Check configuration/database access; existing content tables were not targeted.");
  process.exitCode = 1;
});

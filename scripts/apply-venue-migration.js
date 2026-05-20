#!/usr/bin/env node
/**
 * Applies the venue portal migration to Supabase.
 *
 * Get your DB password from:
 *   Supabase Dashboard → Project Settings → Database → Connection string
 *   (the password between postgres: and @db.)
 *
 * Usage:
 *   node scripts/apply-venue-migration.js <DB_PASSWORD>
 */

const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const https = require("https");

const PROJECT_REF = "ttqmrgtmwspmcyuongas";
const SQL_FILE = path.join(__dirname, "../supabase/migrations/20260520120000_venue_portal.sql");

const dbPassword = process.argv[2];
if (!dbPassword) {
  console.error("Usage: node scripts/apply-venue-migration.js <DB_PASSWORD>");
  console.error("\nGet your DB password from:");
  console.error("  Supabase Dashboard → Project Settings → Database → Connection string");
  process.exit(1);
}

const sql = fs.readFileSync(SQL_FILE, "utf8");
const dbUrl = `postgresql://postgres:${encodeURIComponent(dbPassword)}@db.${PROJECT_REF}.supabase.co:5432/postgres`;

console.log("Applying venue portal migration...");

try {
  execSync(`npx supabase db push --db-url "${dbUrl}"`, {
    cwd: path.join(__dirname, ".."),
    stdio: "inherit",
  });
  console.log("\n✓ Migration applied successfully!");
} catch (e) {
  console.error("\nFailed. Try running the SQL manually in:");
  console.error(`  https://supabase.com/dashboard/project/${PROJECT_REF}/sql/new`);
  process.exit(1);
}

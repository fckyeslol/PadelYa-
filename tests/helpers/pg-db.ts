/**
 * Helper to give each DB test file its OWN ephemeral database, so the files can
 * run in parallel (vitest forks per file) without clobbering each other's tables
 * (they all live in `public` and several share names like `profiles`).
 *
 * Usage:
 *   const { client, drop } = await createIsolatedDb("claim");
 *   ... // beforeAll
 *   await drop();                                   // afterAll
 */
import { Client } from "pg";

export async function createIsolatedDb(label: string): Promise<{
  client: Client;
  drop: () => Promise<void>;
}> {
  const base = process.env.TEST_DATABASE_URL;
  if (!base) throw new Error("TEST_DATABASE_URL is not set");

  // Unique, valid identifier (label + pid). Sanitize to be safe.
  const dbName = `test_${label.replace(/[^a-z0-9]/gi, "")}_${process.pid}`.toLowerCase();

  const admin = new Client({ connectionString: base });
  await admin.connect();
  await admin.query(`drop database if exists ${dbName} with (force)`);
  await admin.query(`create database ${dbName}`);
  await admin.end();

  const url = new URL(base);
  url.pathname = `/${dbName}`;
  const client = new Client({ connectionString: url.toString() });
  await client.connect();

  const drop = async () => {
    await client.end();
    const a = new Client({ connectionString: base });
    await a.connect();
    await a.query(`drop database if exists ${dbName} with (force)`);
    await a.end();
  };

  return { client, drop };
}

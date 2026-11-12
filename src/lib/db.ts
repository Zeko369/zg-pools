import { Pool } from "pg";

const globalDb = globalThis as typeof globalThis & { poolsDb?: Pool };

export function database() {
  if (!process.env.DATABASE_URL)
    throw new Error("DATABASE_URL is not configured");
  return (globalDb.poolsDb ??= new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 5,
    connectionTimeoutMillis: 5_000,
    idleTimeoutMillis: 30_000,
    application_name: "zg-pools",
  }).on("error", () => console.error("Idle Postgres connection failed")));
}

export async function closeDatabase() {
  const pool = globalDb.poolsDb;
  delete globalDb.poolsDb;
  await pool?.end();
}

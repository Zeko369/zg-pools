import { createHash, randomUUID } from "node:crypto";
import { database } from "./db";
import { getWeekDates } from "./dates";
import { PARSER_MODEL, parsePoolAvailability } from "./ai";
import { POOLS, scrapePoolContent } from "./pools";

// Bump when extraction rules, source selection or the output schema change.
export const PARSER_VERSION = "luna-v5-postgres";
export const REFRESH_COOLDOWN_MS = 60_000;
export const scheduleScope = (now = new Date()) =>
  `${PARSER_VERSION}:${getWeekDates(now).currentWeek.monday}`;

export function sourceHash(body: string) {
  return createHash("sha256").update(body).digest("hex");
}

// Injectable source/parser enable real-Postgres tests without paid model requests.
export async function refreshPool(
  poolId: string,
  dependencies = { scrape: scrapePoolContent, parse: parsePoolAvailability },
  now = new Date(),
  context: { jobId?: string; trigger?: string } = {},
) {
  const pool = POOLS.find((p) => p.id === poolId);
  if (!pool) throw new Error(`Pool not found: ${poolId}`);
  const client = await database().connect();
  let locked = false;
  let attempted = false;
  let transaction = false;
  const runId = randomUUID();
  let outcome = "failed";
  let hash: string | null = null;
  try {
    await client.query(
      "INSERT INTO pool_refresh_runs (id,pool_id,job_id,trigger,status) VALUES ($1,$2,$3,$4,'running')",
      [runId, poolId, context.jobId ?? null, context.trigger ?? "manual"],
    );
    const lock = await client.query<{ locked: boolean }>(
      "SELECT pg_try_advisory_lock(885231, hashtext($1)) AS locked",
      [poolId],
    );
    locked = lock.rows[0].locked;
    if (!locked) {
      outcome = "busy";
      return { status: "busy" as const };
    }
    await client.query(
      "INSERT INTO pool_state (pool_id) VALUES ($1) ON CONFLICT DO NOTHING",
      [poolId],
    );
    const {
      rows: [previous],
    } = await client.query("SELECT * FROM pool_state WHERE pool_id = $1", [
      poolId,
    ]);
    if (
      previous.attempted_at &&
      now.getTime() - previous.attempted_at.getTime() < REFRESH_COOLDOWN_MS
    ) {
      outcome = "cooldown";
      return { status: "cooldown" as const };
    }
    await client.query(
      "UPDATE pool_state SET attempted_at = $2 WHERE pool_id = $1",
      [poolId, now],
    );
    attempted = true;
    const body = await dependencies.scrape(pool.url);
    hash = sourceHash(body);
    const scope = scheduleScope(now);
    // Persist a changed source even if parsing subsequently fails, so it can be inspected.
    await client.query(
      `INSERT INTO pool_source_versions (pool_id, source_hash, body, observed_at)
      VALUES ($1, $2, $3, $4) ON CONFLICT (pool_id, source_hash) DO NOTHING`,
      [poolId, hash, body, now],
    );
    if (
      previous.source_hash === hash &&
      previous.scope === scope &&
      previous.availability
    ) {
      await client.query(
        "UPDATE pool_state SET checked_at = $2, last_error = NULL WHERE pool_id = $1",
        [poolId, now],
      );
      outcome = "unchanged";
      return { status: "unchanged" as const, sourceHash: hash };
    }
    const { availability, usage } = await dependencies.parse(
      pool.name,
      body,
      now,
      runId,
      client,
    );
    await client.query("BEGIN");
    transaction = true;
    await client.query(
      `INSERT INTO pool_extractions (pool_id, source_hash, scope, availability, model, usage, extracted_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [poolId, hash, scope, availability, PARSER_MODEL, usage, now],
    );
    await client.query(
      `UPDATE pool_state SET source_hash = $2, scope = $3, availability = $4,
      model = $5, extracted_at = $6, checked_at = $6, last_error = NULL WHERE pool_id = $1`,
      [poolId, hash, scope, availability, PARSER_MODEL, now],
    );
    await client.query(
      "UPDATE pool_refresh_runs SET status='updated',source_hash=$2,finished_at=now() WHERE id=$1",
      [runId, hash],
    );
    await client.query("COMMIT");
    transaction = false;
    outcome = "updated";
    return { status: "updated" as const, sourceHash: hash };
  } catch (error) {
    if (transaction) await client.query("ROLLBACK");
    if (attempted)
      await client.query(
        "UPDATE pool_state SET last_error = $2 WHERE pool_id = $1",
        [poolId, "Source check or extraction failed"],
      );
    throw error;
  } finally {
    let discard = false;
    try {
      await client.query(
        "UPDATE pool_refresh_runs SET status=$2,source_hash=$3,finished_at=now(),error=$4 WHERE id=$1",
        [
          runId,
          outcome,
          hash,
          outcome === "failed" ? "Source check or extraction failed" : null,
        ],
      );
    } catch {
      console.error("Could not finish source check metrics");
    }
    try {
      if (locked)
        await client.query("SELECT pg_advisory_unlock(885231, hashtext($1))", [
          poolId,
        ]);
    } catch {
      discard = true;
    } finally {
      // Discard the connection if unlock failed; never return a session lock to the pool.
      client.release(discard);
    }
  }
}

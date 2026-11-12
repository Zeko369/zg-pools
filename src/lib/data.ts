import "server-only";
import { POOLS, type Pool } from "./pools";
import type { PoolAvailability } from "./ai";
import { database } from "./db";
import { refreshPool, scheduleScope } from "./refresh";
import { sourceCheckIsStale } from "./cache-policy";

export interface PoolData {
  pool: Pool;
  availability: PoolAvailability;
  /** Last successful source check, including checks that reused an extraction. */
  fetchedAt: string;
  stale: boolean;
  model: string;
}
export interface PoolResult {
  pool: Pool;
  data: PoolData | null;
  error: string | null;
}

export async function getPoolData(
  poolId: string,
  options: { force?: boolean } = {},
): Promise<PoolData> {
  const pool = POOLS.find((p) => p.id === poolId);
  if (!pool) throw new Error(`Pool not found: ${poolId}`);
  if (options.force) {
    // Owner checks use the database lock, cooldown and content fingerprint too.
    try {
      await refreshPool(poolId);
    } catch {
      /* Read the retained snapshot below. */
    }
  }
  const {
    rows: [row],
  } = await database().query(
    `SELECT availability, model, checked_at, extracted_at, last_error
    FROM pool_state WHERE pool_id = $1 AND scope = $2 AND availability IS NOT NULL`,
    [poolId, scheduleScope()],
  );
  if (!row)
    throw new Error(
      "Schedules have not been loaded by the background worker yet",
    );
  return {
    pool,
    availability: row.availability,
    fetchedAt: (row.checked_at ?? row.extracted_at).toISOString(),
    stale:
      !!row.last_error ||
      sourceCheckIsStale(row.checked_at ?? row.extracted_at),
    model: row.model,
  };
}

export async function getPoolResults(
  options: { force?: boolean; poolId?: string } = {},
): Promise<PoolResult[]> {
  return Promise.all(
    POOLS.filter((p) => !options.poolId || p.id === options.poolId).map(
      async (pool) => {
        try {
          return {
            pool,
            data: await getPoolData(pool.id, options),
            error: null,
          };
        } catch {
          return {
            pool,
            data: null,
            error:
              "Raspored trenutačno nije dostupan. Provjerite službeni izvor.",
          };
        }
      },
    ),
  );
}

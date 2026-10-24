import "server-only";
import { POOLS, scrapePoolContent, type Pool } from "./pools";
import {
  PARSER_MODEL,
  parsePoolAvailability,
  type PoolAvailability,
} from "./ai";
import { getWeekDates } from "./dates";
import { RequestCache } from "./request-cache";
export interface PoolData {
  pool: Pool;
  availability: PoolAvailability;
  fetchedAt: string;
  stale: boolean;
  model: string;
}
export interface PoolResult {
  pool: Pool;
  data: PoolData | null;
  error: string | null;
}
// Shared across route bundles in a single server process. Nothing runs on import.
const globalCache = globalThis as typeof globalThis & {
  poolScheduleCache?: RequestCache<Omit<PoolData, "stale">>;
};
const cache = (globalCache.poolScheduleCache ??= new RequestCache<
  Omit<PoolData, "stale">
>());
export async function getPoolData(
  poolId: string,
  options: { force?: boolean } = {},
): Promise<PoolData> {
  const pool = POOLS.find((p) => p.id === poolId);
  if (!pool) throw new Error(`Pool not found: ${poolId}`);
  const scope = `luna-v3:${getWeekDates().currentWeek.monday}`;
  const result = await cache.get(
    poolId,
    scope,
    async () => {
      const rawContent = await scrapePoolContent(pool.url);
      const availability = await parsePoolAvailability(pool.name, rawContent);
      return {
        pool,
        availability,
        fetchedAt: new Date().toISOString(),
        model: PARSER_MODEL,
      };
    },
    options.force,
  );
  return { ...result.value, stale: result.stale };
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
        } catch (error) {
          console.error(
            `Pool schedule failed (${pool.id}):`,
            error instanceof Error ? error.message : "Unknown error",
          );
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

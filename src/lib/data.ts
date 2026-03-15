import "server-only";
import { cacheTag, cacheLife } from "next/cache";
import { POOLS, scrapePoolContent, type Pool } from "./pools";
import { parsePoolAvailability, type PoolAvailability } from "./ai";

export interface PoolData {
  pool: Pool;
  availability: PoolAvailability;
  fetchedAt: string;
}

export async function getPoolData(poolId: string): Promise<PoolData> {
  "use cache";
  cacheTag("pools", `pool-${poolId}`);
  cacheLife("hours");

  const pool = POOLS.find((p) => p.id === poolId);
  if (!pool) {
    throw new Error(`Pool not found: ${poolId}`);
  }

  const rawContent = await scrapePoolContent(pool.url);
  const availability = await parsePoolAvailability(pool.name, rawContent);

  return {
    pool,
    availability,
    fetchedAt: new Date().toISOString(),
  };
}

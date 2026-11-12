import { randomUUID } from "node:crypto";
import { database } from "./db";
import type { PoolClient } from "pg";

type HttpFetch = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;
const tokens = (value: unknown) =>
  typeof value === "number" && Number.isInteger(value) && value >= 0
    ? value
    : null;

/** Observe the real SDK HTTP boundary so automatic retries are separate calls. */
export function trackedModelFetch(
  model: string,
  runId?: string,
  fetcher: HttpFetch = globalThis.fetch,
  db: Pick<PoolClient, "query"> = database(),
): typeof globalThis.fetch {
  const instrumented: HttpFetch = async (input, init) => {
    const id = randomUUID();
    await db.query(
      "INSERT INTO pool_ai_calls (id, run_id, model) VALUES ($1,$2,$3)",
      [id, runId ?? null, model],
    );
    let response: Response;
    try {
      response = await fetcher(input, init);
    } catch (error) {
      try {
        await db.query(
          "UPDATE pool_ai_calls SET finished_at=now(), error=$2 WHERE id=$1",
          [id, "Network request failed or timed out"],
        );
      } catch {
        console.error("Could not finish AI request metrics");
      }
      throw error;
    }
    // Never let reporting failures make the SDK retry an already paid request.
    try {
      const body = await response
        .clone()
        .json()
        .catch(() => null);
      const usage = body?.usage;
      await db.query(
        `UPDATE pool_ai_calls SET finished_at=now(), http_status=$2,
        input_tokens=$3, output_tokens=$4, reasoning_tokens=$5, cached_input_tokens=$6, error=$7 WHERE id=$1`,
        [
          id,
          response.status,
          tokens(usage?.input_tokens),
          tokens(usage?.output_tokens),
          tokens(usage?.output_tokens_details?.reasoning_tokens),
          tokens(usage?.input_tokens_details?.cached_tokens),
          response.ok && !body?.error
            ? null
            : `Model API returned HTTP ${response.status}`,
        ],
      );
    } catch {
      console.error("Could not finish AI request metrics");
    }
    return response;
  };
  return Object.assign(instrumented, {
    preconnect: globalThis.fetch.preconnect,
  });
}

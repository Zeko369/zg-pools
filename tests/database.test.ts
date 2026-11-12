import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  mock,
  test,
} from "bun:test";
import { database, closeDatabase } from "../src/lib/db";
import { migrate } from "../src/lib/migrate";
import { refreshPool, scheduleScope } from "../src/lib/refresh";
import { availabilityFromExtraction } from "../src/lib/ai";
import { getWeekDates } from "../src/lib/dates";
import {
  startJobs,
  CHECK_POOL_QUEUE,
  CHECK_ALL_QUEUE,
  REFRESH_SCHEDULES,
} from "../src/lib/jobs";
import { POOLS } from "../src/lib/pools";
import { trackedModelFetch } from "../src/lib/model-metrics";
import { getJobReport } from "../src/lib/job-report";

mock.module("server-only", () => ({}));
const { getPoolData } = await import("../src/lib/data");
const integration = process.env.TEST_DATABASE_URL ? describe : describe.skip;
const poolId = "bazen-spansko";
const usage = {
  inputTokens: 100,
  outputTokens: 200,
  reasoningTokens: 50,
  cachedInputTokens: 0,
};
const base = new Date();
const later = (minutes: number) => new Date(base.getTime() + minutes * 60_000);
function parsed(name: string, now = base) {
  const weeks = getWeekDates(now);
  return {
    availability: availabilityFromExtraction(
      name,
      {
        days: [...weeks.currentWeek.days, ...weeks.nextWeek.days].map((d) => ({
          date: d.date,
          status: "closed",
          pools: [],
          reason: { hr: "Obnova", en: "Renovation" },
        })),
        alerts: [],
        notices: [],
      },
      now,
    ),
    usage,
  };
}

integration(
  "durable cache and pg-boss (isolated Postgres database, no model calls)",
  () => {
    beforeAll(async () => {
      const url = new URL(process.env.TEST_DATABASE_URL!);
      if (!url.pathname.endsWith("_test"))
        throw new Error(
          "TEST_DATABASE_URL must name a dedicated _test database",
        );
      await closeDatabase();
      process.env.DATABASE_URL = url.href;
      await database().query("DROP SCHEMA IF EXISTS pgboss CASCADE");
      await migrate();
      await migrate(); // Idempotent migration startup.
    });
    beforeEach(async () => {
      await database().query(
        "TRUNCATE pool_ai_calls, pool_refresh_runs, pool_extractions, pool_source_versions, pool_state RESTART IDENTITY",
      );
    });
    afterAll(closeDatabase);

    test("unchanged sources cost no further extractions and cache survives a connection/process restart", async () => {
      let calls = 0;
      const dependencies = {
        scrape: async () => "Public hours 06:30 - 20:00",
        parse: async (name: string) => {
          calls++;
          return parsed(name);
        },
      };
      expect((await refreshPool(poolId, dependencies, base)).status).toBe(
        "updated",
      );
      expect((await refreshPool(poolId, dependencies, later(1))).status).toBe(
        "unchanged",
      );
      expect(calls).toBe(1);
      await closeDatabase();
      const result = await getPoolData(poolId);
      expect(result.availability.currentWeek.days[0].status).toBe("closed");
      expect(result.fetchedAt).toBe(later(1).toISOString());
      expect(result.stale).toBe(false);
      expect(calls).toBe(1);
      const history = await database().query(
        "SELECT usage FROM pool_extractions",
      );
      expect(history.rows).toEqual([{ usage }]);
      expect(
        (
          await database().query(
            "SELECT count(*)::int AS n FROM pool_source_versions",
          )
        ).rows[0].n,
      ).toBe(1);
    });

    test("changed source failure retains last good data and retries the new body without losing the revision", async () => {
      const dependencies = {
        scrape: async () => "Original body",
        parse: async (name: string) => parsed(name),
      };
      await refreshPool(poolId, dependencies, base);
      await expect(
        refreshPool(
          poolId,
          {
            scrape: async () => "Changed body",
            parse: async () => {
              throw new Error("Extraction failed");
            },
          },
          later(1),
        ),
      ).rejects.toThrow("Extraction failed");
      expect((await getPoolData(poolId)).stale).toBe(true);
      expect(
        (
          await database().query(
            "SELECT count(*)::int AS n FROM pool_source_versions",
          )
        ).rows[0].n,
      ).toBe(2);
      expect(
        (
          await database().query(
            "SELECT count(*)::int AS n FROM pool_extractions",
          )
        ).rows[0].n,
      ).toBe(1);
      expect(
        (
          await refreshPool(
            poolId,
            { ...dependencies, scrape: async () => "Changed body" },
            later(2),
          )
        ).status,
      ).toBe("updated");
      expect((await getPoolData(poolId)).stale).toBe(false);
    });

    test("two simultaneous workers share a database lock and owner checks honor the cooldown", async () => {
      const entered = Promise.withResolvers<void>();
      const resume = Promise.withResolvers<void>();
      let calls = 0;
      const dependencies = {
        scrape: async () => "Same body",
        parse: async (name: string) => {
          calls++;
          entered.resolve();
          await resume.promise;
          return parsed(name);
        },
      };
      const first = refreshPool(poolId, dependencies, base);
      await entered.promise;
      expect((await refreshPool(poolId, dependencies, base)).status).toBe(
        "busy",
      );
      resume.resolve();
      await first;
      expect((await refreshPool(poolId, dependencies, base)).status).toBe(
        "cooldown",
      );
      expect(calls).toBe(1);
    });

    test("a new Zagreb week reinterprets unchanged content and never returns last week's dates", async () => {
      let calls = 0;
      const dependencies = {
        scrape: async () => "Same body",
        parse: async (name: string, _: string, now = base) => {
          calls++;
          return parsed(name, now);
        },
      };
      await refreshPool(poolId, dependencies, base);
      const nextWeek = new Date(base.getTime() + 7 * 86400_000);
      expect((await refreshPool(poolId, dependencies, nextWeek)).status).toBe(
        "updated",
      );
      expect(calls).toBe(2);
      expect(
        (
          await database().query(
            "SELECT scope FROM pool_state WHERE pool_id = $1",
            [poolId],
          )
        ).rows[0].scope,
      ).toBe(scheduleScope(nextWeek));
      await expect(getPoolData(poolId)).rejects.toThrow("background worker");
    });

    test("source outcomes stay distinct and real model HTTP attempts include failed calls and validation failures", async () => {
      const dependencies = {
        scrape: async () => "Original",
        parse: async (name: string) => parsed(name),
      };
      await refreshPool(poolId, dependencies, base);
      await refreshPool(poolId, dependencies, later(1));
      await refreshPool(poolId, dependencies, later(1));
      await expect(
        refreshPool(
          poolId,
          {
            scrape: async () => "Changed",
            parse: async (
              _name: string,
              _body: string,
              _now = base,
              runId?: string,
              db?: Parameters<typeof trackedModelFetch>[3],
            ) => {
              const failed = trackedModelFetch(
                "test-model",
                runId,
                async () =>
                  Response.json(
                    {
                      error: { message: "private-payload-must-not-be-stored" },
                    },
                    { status: 429 },
                  ),
                db,
              );
              expect(
                (await failed("https://api.example/responses")).status,
              ).toBe(429);
              const retry = trackedModelFetch(
                "test-model",
                runId,
                async () =>
                  Response.json({
                    usage: {
                      input_tokens: 100,
                      output_tokens: 200,
                      input_tokens_details: { cached_tokens: 10 },
                      output_tokens_details: { reasoning_tokens: 50 },
                    },
                  }),
                db,
              );
              const response = await retry("https://api.example/responses");
              expect((await response.json()).usage.output_tokens).toBe(200);
              throw new Error("Invalid model output after a paid response");
            },
          },
          later(2),
        ),
      ).rejects.toThrow("Invalid model output");
      const report = await getJobReport();
      expect(report.summary).toMatchObject({
        checks: 4,
        cache_hits: 1,
        extractions: 1,
        failures: 1,
        skipped: 1,
      });
      expect(report.summary.ai).toMatchObject({
        requests: 2,
        failures: 1,
        input_tokens: 100,
        output_tokens: 200,
        cached_input_tokens: 10,
        reasoning_tokens: 50,
        unknown_usage: 1,
      });
      expect(report.runs.find((r) => r.status === "failed")?.ai_requests).toBe(
        2,
      );
      expect(
        JSON.stringify(
          (await database().query("SELECT * FROM pool_ai_calls")).rows,
        ),
      ).not.toContain("private-payload");
      expect((await getPoolData(poolId)).stale).toBe(true);
    });

    test("all eight parallel checks can report AI usage without starving their own database pool", async () => {
      const results = await Promise.all(
        POOLS.map((p) =>
          refreshPool(
            p.id,
            {
              scrape: async () => "Source",
              parse: async (
                name: string,
                _body: string,
                now = base,
                runId?: string,
                db?: Parameters<typeof trackedModelFetch>[3],
              ) => {
                await trackedModelFetch(
                  "test",
                  runId,
                  async () =>
                    Response.json({
                      usage: { input_tokens: 1, output_tokens: 2 },
                    }),
                  db,
                )("https://api.example/responses");
                return parsed(name, now);
              },
            },
            base,
          ),
        ),
      );
      expect(results.every((r) => r.status === "updated")).toBe(true);
      expect((await getJobReport()).summary.ai.requests).toBe(8);
    });

    test("pg-boss stores timezone-aware cron, executes fan-out, deduplicates and persists the schedules", async () => {
      const seen = new Set<string>();
      const completed = Promise.withResolvers<void>();
      const timer = setTimeout(
        () => completed.reject(new Error("Worker did not process all pools")),
        20_000,
      );
      let boss = await startJobs(async (id) => {
        seen.add(id);
        if (seen.size === POOLS.length) completed.resolve();
        return { status: "unchanged" as const, sourceHash: "fixture" };
      });
      try {
        await completed.promise;
        const schedules = await boss.getSchedules(CHECK_ALL_QUEUE);
        expect(schedules.map((s) => [s.key, s.cron, s.timezone])).toEqual(
          [...REFRESH_SCHEDULES]
            .sort((a, b) => a.key.localeCompare(b.key))
            .map((s) => [s.key, s.cron, "Europe/Zagreb"]),
        );
        const next = boss.previewSchedule("*/15 5-20 * * *", {
          tz: "Europe/Zagreb",
          from: new Date("2026-10-25T02:00:00Z"),
          count: 1,
        });
        expect(next[0].toISOString()).toBe("2026-10-25T04:00:00.000Z"); // DST ended: 05:00 CET.
        const future = { singletonKey: "dedupe-test", startAfter: 3600 };
        expect(
          await boss.send(CHECK_POOL_QUEUE, { poolId }, future),
        ).toBeString();
        expect(
          await boss.send(CHECK_POOL_QUEUE, { poolId }, future),
        ).toBeNull();
        await boss.deleteQueuedJobs(CHECK_POOL_QUEUE);
        await boss.stop();
        boss = await startJobs(async () => ({
          status: "unchanged" as const,
          sourceHash: "fixture",
        }));
        expect(await boss.getSchedules(CHECK_ALL_QUEUE)).toHaveLength(2);
      } finally {
        clearTimeout(timer);
        await boss.stop();
      }
    }, 30_000);
  },
);

import { database } from "./db";
import { zagrebDate } from "./dates";

export async function getJobReport() {
  const db = database();
  const [meta, runs, calls, recent, daily, pools, queueExists] =
    await Promise.all([
      db.query(
        "SELECT tracking_since FROM pool_metrics_metadata WHERE id=true",
      ),
      db.query(`SELECT count(*)::int AS checks,
      count(*) FILTER (WHERE status='unchanged')::int AS cache_hits,
      count(*) FILTER (WHERE status='updated')::int AS extractions,
      count(*) FILTER (WHERE status='failed')::int AS failures,
      count(*) FILTER (WHERE status IN ('busy','cooldown'))::int AS skipped
      FROM pool_refresh_runs WHERE started_at>=now()-interval '24 hours'`),
      db.query(`SELECT count(*)::int AS requests, count(*) FILTER (WHERE error IS NOT NULL)::int AS failures,
      count(*) FILTER (WHERE input_tokens IS NULL OR output_tokens IS NULL)::int AS unknown_usage,
      coalesce(sum(input_tokens),0)::float8 AS input_tokens, coalesce(sum(output_tokens),0)::float8 AS output_tokens,
      coalesce(sum(reasoning_tokens),0)::float8 AS reasoning_tokens, coalesce(sum(cached_input_tokens),0)::float8 AS cached_input_tokens
      FROM pool_ai_calls WHERE started_at>=now()-interval '24 hours'`),
      db.query(`SELECT r.id,r.pool_id,r.trigger,r.status,r.started_at,r.finished_at,r.error,r.source_hash,r.job_id,
      count(a.id)::int AS ai_requests, coalesce(sum(a.input_tokens),0)::float8 AS input_tokens,
      coalesce(sum(a.output_tokens),0)::float8 AS output_tokens
      FROM (SELECT * FROM pool_refresh_runs ORDER BY started_at DESC LIMIT 50) r
      LEFT JOIN pool_ai_calls a ON a.run_id=r.id GROUP BY r.id,r.pool_id,r.trigger,r.status,r.started_at,r.finished_at,r.error,r.source_hash,r.job_id
      ORDER BY r.started_at DESC`),
      db.query(`WITH days AS (SELECT generate_series((now() AT TIME ZONE 'Europe/Zagreb')::date-6,
      (now() AT TIME ZONE 'Europe/Zagreb')::date, interval '1 day')::date AS day),
      hits AS (SELECT (started_at AT TIME ZONE 'Europe/Zagreb')::date AS day,count(*)::int AS cache_hits
        FROM pool_refresh_runs WHERE status='unchanged' AND started_at>=now()-interval '7 days' GROUP BY 1),
      ai AS (SELECT (started_at AT TIME ZONE 'Europe/Zagreb')::date AS day,count(*)::int AS ai_requests
        FROM pool_ai_calls WHERE started_at>=now()-interval '7 days' GROUP BY 1)
      SELECT to_char(days.day,'YYYY-MM-DD') AS day,coalesce(hits.cache_hits,0) AS cache_hits,coalesce(ai.ai_requests,0) AS ai_requests
      FROM days LEFT JOIN hits USING(day) LEFT JOIN ai USING(day) ORDER BY day`),
      db.query(
        "SELECT pool_id,checked_at,extracted_at,last_error FROM pool_state ORDER BY pool_id",
      ),
      db.query("SELECT to_regclass('pgboss.job') IS NOT NULL AS ready"),
    ]);
  const [queues, jobs, schedules] = queueExists.rows[0].ready
    ? await Promise.all([
        db.query(
          "SELECT name,state,count(*)::int AS count FROM pgboss.job WHERE name IN ('pools-check-all','pools-check-source') GROUP BY name,state ORDER BY name,state",
        ),
        db.query(`SELECT id,data->>'poolId' AS pool_id,state,retry_count,created_on,started_on,completed_on,output->>'status' AS result
      FROM pgboss.job WHERE name='pools-check-source' ORDER BY created_on DESC LIMIT 25`),
        db.query(
          "SELECT cron,timezone FROM pgboss.schedule WHERE name='pools-check-all' ORDER BY cron",
        ),
      ])
    : [{ rows: [] }, { rows: [] }, { rows: [] }];
  return JSON.parse(
    JSON.stringify({
      generatedAt: new Date().toISOString(),
      trackingSince: meta.rows[0]?.tracking_since ?? null,
      windowHours: 24,
      summary: { ...runs.rows[0], ai: calls.rows[0] },
      daily: daily.rows.map((day) => ({
        ...day,
        tracked:
          !!meta.rows[0]?.tracking_since &&
          day.day >= zagrebDate(meta.rows[0].tracking_since),
      })),
      runs: recent.rows,
      pools: pools.rows,
      queues: queues.rows,
      jobs: jobs.rows,
      schedules: schedules.rows,
    }),
  ) as {
    generatedAt: string;
    trackingSince: string | null;
    windowHours: number;
    summary: {
      checks: number;
      cache_hits: number;
      extractions: number;
      failures: number;
      skipped: number;
      ai: {
        requests: number;
        failures: number;
        unknown_usage: number;
        input_tokens: number;
        output_tokens: number;
        reasoning_tokens: number;
        cached_input_tokens: number;
      };
    };
    daily: {
      day: string;
      cache_hits: number;
      ai_requests: number;
      tracked: boolean;
    }[];
    runs: {
      id: string;
      pool_id: string;
      trigger: string;
      status: string;
      started_at: string;
      finished_at: string | null;
      error: string | null;
      source_hash: string | null;
      job_id: string | null;
      ai_requests: number;
      input_tokens: number;
      output_tokens: number;
    }[];
    pools: {
      pool_id: string;
      checked_at: string | null;
      extracted_at: string | null;
      last_error: string | null;
    }[];
    queues: { name: string; state: string; count: number }[];
    jobs: {
      id: string;
      pool_id: string | null;
      state: string;
      retry_count: number;
      created_on: string;
      started_on: string | null;
      completed_on: string | null;
      result: string | null;
    }[];
    schedules: { cron: string; timezone: string }[];
  };
}
export type JobReport = Awaited<ReturnType<typeof getJobReport>>;

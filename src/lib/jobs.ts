import { PgBoss } from "pg-boss";
import { POOLS } from "./pools";
import { TIME_ZONE } from "./dates";
import { refreshPool } from "./refresh";

export const CHECK_ALL_QUEUE = "pools-check-all";
export const CHECK_POOL_QUEUE = "pools-check-source";
export const REFRESH_SCHEDULES = [
  { key: "quarter-hour", cron: "*/15 5-20 * * *" },
  { key: "last-check", cron: "0 21 * * *" },
];

export async function startJobs(handler = refreshPool) {
  if (!process.env.DATABASE_URL)
    throw new Error("DATABASE_URL is not configured");
  const boss = new PgBoss({
    connectionString: process.env.DATABASE_URL,
    max: 3,
  });
  boss.on("error", () => console.error("pg-boss database/worker error"));
  try {
    await boss.start();
    const queueOptions = {
      policy: "exclusive" as const,
      retryLimit: 2,
      retryDelay: 90,
      retryBackoff: true,
      expireInSeconds: 300,
      retentionSeconds: 24 * 3600,
      deleteAfterSeconds: 7 * 24 * 3600,
    };
    await boss.createQueue(CHECK_ALL_QUEUE, queueOptions);
    await boss.createQueue(CHECK_POOL_QUEUE, queueOptions);
    const enqueueAll = async (jobs: { data: { trigger?: string } }[]) => {
      for (const pool of POOLS)
        await boss.send(
          CHECK_POOL_QUEUE,
          { poolId: pool.id, trigger: jobs[0]?.data.trigger ?? "scheduled" },
          { singletonKey: pool.id },
        );
    };
    await boss.work<{ trigger?: string }>(CHECK_ALL_QUEUE, enqueueAll);
    await boss.work<{ poolId: string; trigger?: string }>(
      CHECK_POOL_QUEUE,
      { localConcurrency: 2 },
      async ([job]) => {
        const result = await handler(job.data.poolId, undefined, undefined, {
          jobId: job.id,
          trigger: job.data.trigger ?? "scheduled",
        });
        console.log(JSON.stringify({ poolId: job.data.poolId, ...result }));
        return result;
      },
    );
    for (const schedule of REFRESH_SCHEDULES)
      await boss.schedule(
        CHECK_ALL_QUEUE,
        schedule.cron,
        { trigger: "scheduled" },
        {
          key: schedule.key,
          tz: TIME_ZONE,
          singletonKey: "all",
          missed: "once",
        },
      );
    // Warm on boot; fingerprints and the shared cooldown prevent paid duplicate work.
    await boss.send(
      CHECK_ALL_QUEUE,
      { trigger: "startup" },
      { singletonKey: "all" },
    );
    return boss;
  } catch (error) {
    await boss.stop();
    throw error;
  }
}

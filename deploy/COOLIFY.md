# Production services

All three resources live in the existing zg-pools project/environment on
`coolify-worker-01`. Keep them together on the private `coolify` Docker network.

| Resource | Coolify UUID | Configuration |
| --- | --- | --- |
| Web: `zg-pools` | `ws08kwwkcg0sock8cgw48ckk` | GitHub `Zeko369/zg-pools`, `main`, Dockerfile `runner` target, port 3000 |
| Worker: `zg-pools-worker` | `jswzb3xxrfjkslklczimaknl` | Same repo and branch, Dockerfile `worker` target, no public domain or HTTP health check, 300-second stop grace period |
| Database: `zg-pools-postgres` | `0cueioiywd9qvryylrsasanq` | Managed `postgres:17-alpine`, database/user `pools`, persistent volume, public access disabled |

Configure the same internal `DATABASE_URL` as a **runtime-only** secret on web and
worker. Keep `OPENAI_API_KEY` runtime-only too; it is used by the worker and by an
authenticated manual source check on web. Neither secret belongs in Git, build
arguments, or images. The optional owner key `POOLS_API_SECRET` is configured only
on web. Coolify stores and injects the credentials.

The worker applies `db/migrations` before starting pg-boss. Both services should
auto-deploy from `main`; build and update the worker before switching a fresh
website to database reads. Later schema migrations must remain compatible with
both services during a rolling deployment. The initial production database was
populated from locally verified **real official-source schedules**, not test
fixtures. No pg-boss jobs or instance records were copied.

Check `pool_state` for source-check freshness and failures, `pool_source_versions`
for relevant source body changes, and `pool_extractions` for outputs and reported
usage. `pgboss.schedule` holds the two Europe/Zagreb cron entries; `pgboss.job`
holds completion/retry/failure history. pg-boss prunes its jobs after seven days;
source revisions and extraction history remain durable.

Public schedule GETs never trigger scraping or AI. An unchanged source check
advances `checked_at` without adding a `pool_extractions` row. The worker checks
on boot as well as every 15 minutes from 05:00 through 21:00. It retries source or
validation failures while keeping the last good schedule.

For rollback, retain the previous web/worker images and the database volume. A
web rollback to the previous implementation temporarily restores its old
request-driven cache; the database remains recoverable for the next release.

# Bazeni Zagreb

Find public swimming times across Zagreb in one place. Bazeni Zagreb brings together the published schedules for eight Sportski objekti facilities, covering the current and next week.

**[Open the live app →](https://zg-pools.zeko.run/agenda)** · [Weekly calendar](https://zg-pools.zeko.run/calendar)

## What it does

- **Weekly calendar:** browse one facility, choose **Svi objekti** to compare all eight, or **Omiljeni bazeni / Starred pools** to overlay just your favorites. Filter by pool type (in the three-dot menu beside the heading), hide facilities, and select a time block for details.
- **Daily agenda:** the default view. Pick a date and see each pool's public swimming slots. Star favorites to pin them first; favorites are saved in this browser.
- **Schedule details:** see holiday changes, closure notices, pool types, and lane restrictions when published by the official source.

The app reads official facility pages and linked timetable PDFs, then uses **GPT-6 Luna** to turn them into structured schedules. A Postgres-backed pg-boss worker checks the official sources every 15 minutes between 05:00 and 21:00 Europe/Zagreb. The website reads saved schedules immediately; unchanged relevant content does not invoke the model.

All times use **Europe/Zagreb**, including daylight saving time. This is an unofficial schedule viewer; check the official source before travelling. An `open` day means published swimming slots exist for that date, so check the slot times before visiting. `closed` and `unknown` are distinct.

## Languages

The app supports **English and Croatian**. The first visit uses the HTTP `Accept-Language` header, respecting preference weights and regional variants such as `en-US` and `hr-HR`. English is the fallback when neither supported language is requested.

Use the language button in the header (also available on `/owner`) to switch. Your explicit choice is remembered in a cookie for one year and takes precedence over browser preferences. Navigation, dates, holidays, errors, accessibility labels, owner access, and schedule notices use the selected language. Official facility names stay unchanged, and times always remain in Zagreb's timezone.

Both translations of source notices, closure reasons, and lane restrictions are produced by the same schedule extraction and cached together. Switching language preserves the current view and does not trigger another schedule request or model call.

## Appearance

Use the three-way theme control in the header to choose **Light**, **Dark**, or **System**. System is the default and follows your device's appearance, including changes while the app is open. Explicit choices are saved in this browser and apply across the agenda, calendar, and owner pages.

## Pools

Each facility links to its official Sportski objekti source.

| Facility | Area |
| --- | --- |
| [Bazenski kompleks Svetice](https://www.sportskiobjekti.hr/bazenski-kompleks-svetice/1366) | Maksimir |
| [Bazen Špansko](https://www.sportskiobjekti.hr/bazen-spansko/2311?tab=2316) | Zapad |
| [Bazen Jelkovec](https://www.sportskiobjekti.hr/bazen-jelkovec/1370) | Sesvete |
| [Sportski park Mladost](https://www.sportskiobjekti.hr/sportski-park-mladost/1345?tab=1355) | Jarun |
| [Bazenski kompleks Utrina](https://www.sportskiobjekti.hr/bazenski-kompleks-utrina/1368) | Novi Zagreb |
| [Zimsko plivalište Mladost](https://www.sportskiobjekti.hr/zimsko-plivaliste-mladost/1369?tab=1493) | Trešnjevka |
| [Bazen Iver](https://www.sportskiobjekti.hr/bazen-iver-1388/1388) | Sesvetski Kraljevec |
| [SRC Šalata](https://www.sportskiobjekti.hr/sportsko-rekreacijski-centar-salata/1346?tab=1361) | Šalata (outdoor, seasonal) |

Šalata's dated season-end notices take precedence over its summer timetable. It remains in the catalog when closed for the season.

## Local development

Built with Next.js 16, React 19, TypeScript, Tailwind CSS, and the Vercel AI SDK. Use Bun to install dependencies and run the app:

```sh
bun install --frozen-lockfile
cp .env.example .env.local
# Set OPENAI_API_KEY, a URL-safe POSTGRES_PASSWORD, and the matching DATABASE_URL.
bun run db:up
bun run db:migrate
bun run worker # keep running in its own terminal
# In another terminal:
bun dev
```

Open [localhost:3000](http://localhost:3000). The home page redirects to `/agenda`; `/calendar` provides the weekly view. View links preserve the selected date, week, facility and pool type in the URL. The former `/compare` route also redirects to `/calendar`.

`OPENAI_API_KEY` stays on the server. `POOLS_API_SECRET` is optional and enables owner access and authenticated API refreshes, as described below.

## Owner-only refresh

Set a long random `POOLS_API_SECRET` on the server, then open [`/owner`](https://zg-pools.zeko.run/owner) and enter that key. This unlocks the refresh button in that browser for 30 days. Return to `/owner` to sign out.

Guests have no manual refresh button. The server action checks owner access on every refresh, so calling it directly cannot bypass the restriction. The session uses a signed, HttpOnly, SameSite=Strict cookie (Secure in production); the key is never stored in the cookie or browser storage. Rotating `POOLS_API_SECRET` invalidates existing sessions and API bearer tokens. Without it, manual refresh is disabled.

**Manual refresh cooldown: 60 seconds per pool, shared across all web and worker processes through Postgres.** An owner refresh checks the source immediately; it still skips AI if the relevant content and week are unchanged.

## Background refresh and durable cache

Postgres stores the last successful bilingual schedule, its source fingerprint, extraction time, last successful source-check time, last attempt and failure state. Public GET requests only read these saved snapshots; they never scrape or invoke AI, including when a snapshot is missing. Start the worker to populate an empty database. Cache expiry, builds, server startup and browser prefetch do not run model calls in the web process.

Run one or more persistent workers with `bun run worker`. The worker applies versioned migrations, initializes pg-boss in its own `pgboss` schema, registers the schedules and queues one initial source check on boot. pg-boss stores its jobs and schedules in Postgres; the scheduler itself needs a running worker process. No `pg_cron` extension or system crontab is needed.

The schedule uses `*/15 5-20 * * *` plus `0 21 * * *`, both in **Europe/Zagreb**, so it checks every 15 minutes from 05:00 through exactly 21:00, including daylight saving changes. A missed schedule catches up once after an outage, rather than replaying every missed interval. Boot and authenticated owner checks can also run outside the scheduled hours.

Each run fans out one job per facility. Queue singleton keys and per-pool Postgres advisory locks prevent concurrent extraction across workers and manual requests. Jobs retry twice with backoff; failed attempts have a shared 60-second cooldown. The application uses a five-connection pool and pg-boss a separate three-connection pool per process. Use a direct Postgres connection (or session pooling) because the per-pool locks are session-scoped.

A worker downloads the official HTML, selects only the relevant facility tab bodies and linked citizen-hours PDFs, then normalizes their text and hashes it with SHA-256. Website headers, footers, other tabs, event-calendar/price widgets, HTML formatting, link query strings and PDF metadata do not enter that fingerprint. A PDF is still checked when the HTML is unchanged, so replacing a PDF at the same URL is detected. The model receives only that facility's relevant normalized text. An unrelated facility never causes the others to be reinterpreted.

Unchanged text reuses the saved extraction, including closed pools. AI runs only on the first check, changed relevant content, a new Zagreb week, or an explicit parser-version bump. Weekly re-extraction is required because the current parser produces 14 concrete dates, not perpetual timetable rules; closures are not hard-coded indefinitely. Changing the model or parsing rules requires bumping `PARSER_VERSION` in `src/lib/refresh.ts`.

Refreshing never removes the last successful snapshot. Reads remain immediate while work runs; a failed check marks retained same-week data `stale: true`. A stopped daytime worker also marks data stale after 45 minutes, allowing the intentional overnight pause. Earlier-week snapshots are never returned as the new week's schedule. `fetchedAt` now means the last successful source check, even when no AI was needed.

Inspect changes and usage with SQL:

```sql
-- Current source-check and extraction status.
SELECT pool_id, source_hash, checked_at, extracted_at, last_error FROM pool_state;

-- Relevant source bodies, saved only when a new fingerprint is seen.
SELECT pool_id, source_hash, body, observed_at
FROM pool_source_versions ORDER BY observed_at DESC;

-- Every successful extraction, its output and reported token usage.
SELECT pool_id, source_hash, scope, usage, extracted_at
FROM pool_extractions ORDER BY extracted_at DESC;
```

## Deployment

The existing production deployment uses a managed Postgres database and separate Coolify web/worker applications; see [`deploy/COOLIFY.md`](deploy/COOLIFY.md) for resource identities and rollout details.

`compose.yaml` provides persistent Postgres 17 plus separate web and worker containers. For the complete stack, set the variables from `.env.example` in a protected env file and run:

```sh
docker compose --env-file .env.production --profile app up -d --build
```

The database and web ports bind to loopback; put your existing reverse proxy in front of the web service. The worker and web services share the internal Postgres URL. An existing deployment can instead provision Postgres separately, set `DATABASE_URL` on both services and use the Dockerfile's `runner` target for web and `worker` target for jobs. Keep the worker running and give the database user permission to create the application tables and pg-boss schema. `.env` files are excluded from Docker builds. Back up the `postgres-data` volume using your normal Postgres backup process; do not remove that volume during redeployment.

## Source handling

Source definitions live in [`src/lib/pools.ts`](src/lib/pools.ts). Špansko uses the actual `?tab=2316` hours tab and notices, excluding its wellness tab. Jelkovec uses its citizen-hours page, preserving both the dated temporary timetable and the regular one. Svetice's supplied `/bazenski-kompleks-svetice/1366` page links to the current PDF; the scraper discovers that link on each refresh, downloads it and extracts the timetable. It does not pin a PDF filename that will become stale. Table boundaries, merged-cell annotations and lane restrictions are preserved. Wellness and club-program tabs are excluded. Luna receives exact requested dates and deterministic Croatian holiday facts, including Easter, Easter Monday and Corpus Christi. Children-only hours are separate from the warm-up pool.

## Agent API

Agent entry point: **[`GET /llms.txt`](https://zg-pools.zeko.run/llms.txt)**, with endpoint links, response interpretation and on-demand refresh guidance. It is a static file and never triggers extraction.

Machine-readable documentation: **[`GET /api/openapi`](https://zg-pools.zeko.run/api/openapi)** (OpenAPI 3.1, no AI call). The [pool catalog](https://zg-pools.zeko.run/api/pools/catalog) lists supported facilities without triggering extraction.

| Request                          | Behavior                                             |
| -------------------------------- | ---------------------------------------------------- |
| `GET /api/pools/catalog`         | List IDs and official source URLs; no AI call        |
| `GET /api/pools`                 | Read all pools for the current and next week         |
| `GET /api/pools?week=current`    | Current week only (`next` and `both` also supported) |
| `GET /api/pools?date=2026-10-24` | One ISO date within the current/next week            |
| `GET /api/pools?compact=true`    | Today only                                           |
| `GET /api/pools/today`           | Today in Zagreb                                      |
| `GET /api/pools/bazen-spansko`   | One pool; supports the same query filters            |
| `POST /api/pools/refresh`        | Check sources now; reuse unchanged extractions; Bearer token required     |

Set a long random `POOLS_API_SECRET` on the server to enable agent refresh. Agents send it via `Authorization: Bearer ...`. Keep it out of browser code and URLs. The website uses an authenticated, same-origin Next server action for its owner-only refresh button. Both paths use the same per-pool cooldown.

```sh
curl 'https://zg-pools.zeko.run/api/pools/bazen-spansko?week=both'
curl -X POST 'https://zg-pools.zeko.run/api/pools/refresh' \
  -H "Authorization: Bearer $POOLS_API_SECRET" \
  -H 'Content-Type: application/json' \
  -d '{"poolId":"bazen-jelkovec"}'
# Send {} to refresh all pools. Allow up to 180 seconds for a changed-source extraction.
```

Responses use `{ timezone, generatedAt, partial, results }`. Each result is `{ pool, data, error }`; `data` contains `availability`, `fetchedAt`, `stale` and `model`. Availability has `currentWeek`/`nextWeek` (or `day` for date/compact reads), alerts and notices. Slots contain normalized `HH:MM - HH:MM` hours and optional lane restrictions. Existing `reason`, `lanes`, `alerts`, and `notices` text stays Croatian; additive `reasonEn`, `lanesEn`, `alertsEn`, and `noticesEn` fields provide English translations, with arrays in the same order. API dates, day names, IDs, and status values are independent of the website language. Types are `olympic` (main/large pool, regardless of length), `small` (small/warm-up) `children` (explicitly children-only) and `diving` (bazen za skokove). Partial failures return HTTP 200 with per-pool errors; all failures return 503. Bad parameters return 400, unknown IDs 404, invalid refresh credentials 401. Responses use `Cache-Control: no-store`; the application cache handles deduplication.

For an agent: discover pools with catalog, read schedules on demand, inspect `error`/`stale`, and call the authenticated refresh endpoint only when the user requests an immediate check. Background checks are already handled by pg-boss; agents do not need their own polling schedule.

## Swagger UI and MCP

Interactive API explorer: **[`/docs`](https://zg-pools.zeko.run/docs)**. It loads the live `/api/openapi` specification and supports trying requests against this server. Swagger's official prebuilt assets are served locally, with no external validator or CDN. Authorization is not persisted in browser storage.

Remote MCP endpoint: **`https://zg-pools.zeko.run/mcp`**, using stateless Streamable HTTP (POST, JSON responses). Connect with an MCP client that supports remote HTTP servers:

```json
{"mcpServers":{"zg-pools":{"url":"https://zg-pools.zeko.run/mcp"}}}
```

Public tools are `list_pools`, `get_schedules` (optional `poolId`, `week`, `date`, `compact`) and `get_openapi`; the catalog is also a `pools://catalog` resource. These tools only read saved data. Sending a valid `Authorization: Bearer ...` header matching `POOLS_API_SECRET` enables `get_job_runs` and `check_sources`. Owner credentials are checked on every request, and anonymous clients cannot discover or invoke owner tools. Source checks still obey content fingerprints and the shared cooldown.

## Job runs and cache/AI metrics

Open **[`/owner/jobs`](https://zg-pools.zeko.run/owner/jobs)** and sign in with the owner key. The read-only dashboard shows 24-hour counters, a seven-day cache/AI chart, individual source checks, pool freshness, scheduled cron entries and recent pg-boss jobs. `GET /api/jobs` returns the same report with an owner cookie or Bearer token. A separate pg-boss dashboard service is not required for these metrics. For process/build logs, use the existing `zg-pools-worker` application in Coolify.

A **cache hit** is a source check whose relevant normalized content, week and parser version match the saved extraction. **Cooldown** and **busy** skips are counted separately. Visitor/API reads only read Postgres and do not count as source checks.

**AI requests** count actual SDK HTTP attempts, including automatic retries, HTTP/network failures, and responses whose output later fails local validation. Token usage is captured from the model response before schedule validation. Missing usage is reported explicitly; requests are not necessarily billable simply because an attempt was made. Provider cached-input tokens are different from source-cache hits; reasoning tokens are already included in output tokens.

Tracking begins at the `trackingSince` timestamp created by migration 002. Earlier request counts, including failures and retries, cannot be reconstructed. The native queue history still shows older pg-boss jobs for their seven-day retention period. `pool_refresh_runs` and `pool_ai_calls` retain application metrics independently of queue cleanup; raw prompts, credentials and model response bodies are never saved in these metrics tables.

## Verification

```sh
bun run type
bun test tests/core.test.ts
# Set TEST_DATABASE_URL to a dedicated database whose name ends in _test.
bun run test:db # real Postgres/pg-boss tests; mocked extraction, no model costs
bun run test:e2e # Playwright Chromium; mocked data, no model costs
bun run build   # no OPENAI_API_KEY required; no scraping or AI calls
```

For a live parser check against all eight official sources (incurs model costs on first/changed/week checks), start the worker with `OPENAI_API_KEY` configured or call the authenticated refresh API. Test fixtures are never used as production schedules.

## Favicons

Three alternatives generated with GPT Image Gen are in [`public/favicon-options/`](public/favicon-options/) (512px PNG and multi-resolution ICO). The wave is installed as the app favicon, 512px app icon, Apple touch icon, and header mark. See [`design/favicon-options.md`](design/favicon-options.md) for the generation briefs.

# Bazeni Zagreb

Public swimming schedules from Sportski objekti, parsed with **GPT-6 Luna** (`gpt-6-luna`, Responses API, medium reasoning, structured output). Six facilities: Svetice, Špansko, Jelkovec, Sportski park Mladost, Utrina and Zimsko plivalište Mladost.

```sh
bun install --frozen-lockfile
cp .env.example .env.local # fill in OPENAI_API_KEY
bun dev
```

Two working views share the same data:

- `/calendar` — a weekly calendar with a single-facility view and **Svi objekti**, a layered all-facility view. Hover or focus a time block to raise it, click for details, hide facilities with sidebar checkboxes, or use the arrow to isolate one. Events, markers and selected controls share one palette.
- `/agenda` — pick a date, search facilities and read each pool's slots.
- The former `/compare` view redirects to `/calendar`; it is no longer in navigation.
- `/` redirects to `/calendar`.

All times and week boundaries use **Europe/Zagreb**, including DST. An `open` day has published swimming slots; it does not mean the facility is open at the current instant. `closed` and `unknown` are distinct. Check the official source before travelling.

## When extraction runs

**Nothing runs on a timer.** Builds, server startup, route prefetches and hidden/unopened browser pages do not trigger extraction. A visible page requests schedules once on mount. GET schedule API calls also count as explicit requests. No browser polling, cron, scheduled revalidation or stale-while-revalidate work is used.

Successful data is cached for one hour **per server process**. Expiry itself does nothing; the next request refreshes it. Concurrent requests share one in-flight task per pool. Clicking refresh or calling POST refresh requests a fresh scrape, subject to a 60-second cooldown. Failed requests also have a 60-second retry cooldown. Refresh failure retains the last same-week result with `stale: true`; data from an earlier week is never served for the new week. A failed facility does not hide successful facilities.

The cache is memory-only, clears on process restart and is not shared between replicas/serverless instances. For a busy multi-instance deployment, move the request cache and locks to a shared durable store. There is no cross-instance cost cap in this version. Public GET requests may incur model costs on cache misses.

## Source handling

Source definitions live in `src/lib/pools.ts`. Špansko uses the actual `?tab=2316` hours tab and notices, excluding its wellness tab. Jelkovec uses its citizen-hours page, preserving both the dated temporary timetable and the regular one. Svetice's supplied `/bazenski-kompleks-svetice/1366` page links to the current PDF; the scraper discovers that link on each refresh, downloads it and extracts the timetable. It does not pin a PDF filename that will become stale. Table boundaries, merged-cell annotations and lane restrictions are preserved. Wellness and club-program tabs are excluded. Luna receives exact requested dates and deterministic Croatian holiday facts, including Easter, Easter Monday and Corpus Christi. Children-only hours are separate from the warm-up pool.

## Agent API

Agent entry point: **`GET /llms.txt`**, with endpoint links, response interpretation and on-demand refresh guidance. It is a static file and never triggers extraction.

Machine-readable documentation: **`GET /api/openapi`** (OpenAPI 3.1, no AI call).

| Request                          | Behavior                                             |
| -------------------------------- | ---------------------------------------------------- |
| `GET /api/pools/catalog`         | List IDs and official source URLs; no AI call        |
| `GET /api/pools`                 | Read all pools for the current and next week         |
| `GET /api/pools?week=current`    | Current week only (`next` and `both` also supported) |
| `GET /api/pools?date=2026-10-24` | One ISO date within the current/next week            |
| `GET /api/pools?compact=true`    | Today only                                           |
| `GET /api/pools/today`           | Today in Zagreb                                      |
| `GET /api/pools/bazen-spansko`   | One pool; supports the same query filters            |
| `POST /api/pools/refresh`        | Force an on-demand update; Bearer token required     |

Set a long random `POOLS_API_SECRET` on the server to enable agent refresh. Agents send it via `Authorization: Bearer ...`. Keep it out of browser code. The website uses a same-origin Next server action for its refresh button. Both paths use the same per-pool cooldown.

```sh
curl 'https://your-host/api/pools/bazen-spansko?week=both'
curl -X POST 'https://your-host/api/pools/refresh' \
  -H "Authorization: Bearer $POOLS_API_SECRET" \
  -H 'Content-Type: application/json' \
  -d '{"poolId":"bazen-jelkovec"}'
# Send {} to refresh all pools. Allow up to 150 seconds for a cold extraction.
```

Responses use `{ timezone, generatedAt, partial, results }`. Each result is `{ pool, data, error }`; `data` contains `availability`, `fetchedAt`, `stale` and `model`. Availability has `currentWeek`/`nextWeek` (or `day` for date/compact reads), alerts and notices. Slots contain normalized `HH:MM - HH:MM` hours and optional lane restrictions. Types are `olympic` (main/large pool, regardless of length), `small` (small/warm-up) `children` (explicitly children-only) and `diving` (bazen za skokove). Partial failures return HTTP 200 with per-pool errors; all failures return 503. Bad parameters return 400, unknown IDs 404, invalid refresh credentials 401. Responses use `Cache-Control: no-store`; the application cache handles deduplication.

For an agent: discover pools with catalog, read schedules on demand, inspect `error`/`stale`, and call the authenticated refresh endpoint only when the user requests a new check. Do not schedule polling unless you intentionally want recurring API/model calls.

## Verification

```sh
bun run type
bun test tests/core.test.ts
bun run test:e2e # Playwright Chromium; mocked data, no model costs
bun run build   # no OPENAI_API_KEY required; no scraping or AI calls
```

For a live parser check against all six official sources (incurs model costs), open a view or call the schedule API with `OPENAI_API_KEY` configured. Test fixtures are never used as production schedules.

## Favicons

Three alternatives generated with GPT Image Gen are in `public/favicon-options/` (512px PNG and multi-resolution ICO). The wave is installed as the app favicon, 512px app icon, Apple touch icon, and header mark. See `design/favicon-options.md` for the generation briefs.

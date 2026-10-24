# Bazeni Zagreb

Find public swimming times across Zagreb in one place. Bazeni Zagreb brings together the published schedules for eight Sportski objekti facilities, covering the current and next week.

**[Open the live app →](https://zg-pools.zeko.run/calendar)** · [Daily agenda](https://zg-pools.zeko.run/agenda)

## What it does

- **Weekly calendar:** browse one facility or choose **Svi objekti** to compare all eight. Filter by pool type, hide facilities, and select a time block for details.
- **Daily agenda:** pick a date, search facilities, and see each pool's public swimming slots.
- **Schedule details:** see holiday changes, closure notices, pool types, and lane restrictions when published by the official source.

The app reads official facility pages and linked timetable PDFs, then uses **GPT-6 Luna** to turn them into structured schedules. Data is fetched on demand; the owner can also request a manual refresh.

All times use **Europe/Zagreb**, including daylight saving time. This is an unofficial schedule viewer; check the official source before travelling. An `open` day means published swimming slots exist for that date, so check the slot times before visiting. `closed` and `unknown` are distinct.

## Languages

The app supports **English and Croatian**. The first visit uses the HTTP `Accept-Language` header, respecting preference weights and regional variants such as `en-US` and `hr-HR`. English is the fallback when neither supported language is requested.

Use the language button in the header (also available on `/owner`) to switch. Your explicit choice is remembered in a cookie for one year and takes precedence over browser preferences. Navigation, dates, holidays, errors, accessibility labels, owner access, and schedule notices use the selected language. Official facility names stay unchanged, and times always remain in Zagreb's timezone.

Both translations of source notices, closure reasons, and lane restrictions are produced by the same schedule extraction and cached together. Switching language preserves the current view and does not trigger another schedule request or model call.

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
# Set OPENAI_API_KEY in .env.local to load schedules.
bun dev
```

Open [localhost:3000](http://localhost:3000). The home page redirects to `/calendar`; `/agenda` provides the daily view. The former `/compare` route also redirects to `/calendar`.

`OPENAI_API_KEY` stays on the server. `POOLS_API_SECRET` is optional and enables owner access and authenticated API refreshes, as described below.

## Owner-only refresh

Set a long random `POOLS_API_SECRET` on the server, then open [`/owner`](https://zg-pools.zeko.run/owner) and enter that key. This unlocks the refresh button in that browser for 30 days. Return to `/owner` to sign out.

Guests have no manual refresh button. The server action checks owner access on every refresh, so calling it directly cannot bypass the restriction. The session uses a signed, HttpOnly, SameSite=Strict cookie (Secure in production); the key is never stored in the cookie or browser storage. Rotating `POOLS_API_SECRET` invalidates existing sessions and API bearer tokens. Without it, manual refresh is disabled.

**Default cache: one hour. Manual refresh cooldown: 60 seconds per pool.** These limits are per server process and shared by the owner button and authenticated API. Requests during the cooldown reuse cached data rather than starting another scrape. Public schedule reads can still refresh an expired or missing cache.

## When extraction runs

**Nothing runs on a timer.** Builds, server startup, route prefetches and hidden/unopened browser pages do not trigger extraction. A visible page requests schedules once on mount. GET schedule API calls also count as explicit requests. No browser polling, cron, scheduled revalidation or stale-while-revalidate work is used.

Successful data is cached for one hour **per server process**. Expiry itself does nothing; the next request refreshes it. Concurrent requests share one in-flight task per pool. An authenticated owner-button or API refresh requests a fresh scrape, subject to a 60-second cooldown. Failed requests also have a 60-second retry cooldown. Refresh failure retains the last same-week result with `stale: true`; data from an earlier week is never served for the new week. A failed facility does not hide successful facilities.

The cache is memory-only, clears on process restart and is not shared between replicas/serverless instances. For a busy multi-instance deployment, move the request cache and locks to a shared durable store. There is no cross-instance cost cap in this version. Public GET requests may incur model costs on cache misses.

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
| `POST /api/pools/refresh`        | Force an on-demand update; Bearer token required     |

Set a long random `POOLS_API_SECRET` on the server to enable agent refresh. Agents send it via `Authorization: Bearer ...`. Keep it out of browser code and URLs. The website uses an authenticated, same-origin Next server action for its owner-only refresh button. Both paths use the same per-pool cooldown.

```sh
curl 'https://zg-pools.zeko.run/api/pools/bazen-spansko?week=both'
curl -X POST 'https://zg-pools.zeko.run/api/pools/refresh' \
  -H "Authorization: Bearer $POOLS_API_SECRET" \
  -H 'Content-Type: application/json' \
  -d '{"poolId":"bazen-jelkovec"}'
# Send {} to refresh all pools. Allow up to 150 seconds for a cold extraction.
```

Responses use `{ timezone, generatedAt, partial, results }`. Each result is `{ pool, data, error }`; `data` contains `availability`, `fetchedAt`, `stale` and `model`. Availability has `currentWeek`/`nextWeek` (or `day` for date/compact reads), alerts and notices. Slots contain normalized `HH:MM - HH:MM` hours and optional lane restrictions. Existing `reason`, `lanes`, `alerts`, and `notices` text stays Croatian; additive `reasonEn`, `lanesEn`, `alertsEn`, and `noticesEn` fields provide English translations, with arrays in the same order. API dates, day names, IDs, and status values are independent of the website language. Types are `olympic` (main/large pool, regardless of length), `small` (small/warm-up) `children` (explicitly children-only) and `diving` (bazen za skokove). Partial failures return HTTP 200 with per-pool errors; all failures return 503. Bad parameters return 400, unknown IDs 404, invalid refresh credentials 401. Responses use `Cache-Control: no-store`; the application cache handles deduplication.

For an agent: discover pools with catalog, read schedules on demand, inspect `error`/`stale`, and call the authenticated refresh endpoint only when the user requests a new check. Do not schedule polling unless you intentionally want recurring API/model calls.

## Verification

```sh
bun run type
bun test tests/core.test.ts
bun run test:e2e # Playwright Chromium; mocked data, no model costs
bun run build   # no OPENAI_API_KEY required; no scraping or AI calls
```

For a live parser check against all eight official sources (incurs model costs), open a view or call the schedule API with `OPENAI_API_KEY` configured. Test fixtures are never used as production schedules.

## Favicons

Three alternatives generated with GPT Image Gen are in [`public/favicon-options/`](public/favicon-options/) (512px PNG and multi-resolution ICO). The wave is installed as the app favicon, 512px app icon, Apple touch icon, and header mark. See [`design/favicon-options.md`](design/favicon-options.md) for the generation briefs.

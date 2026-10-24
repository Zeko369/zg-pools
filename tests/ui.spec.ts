import { expect, test } from "@playwright/test";
import { POOLS } from "../src/lib/pools";
import { getWeekDates, type DayInfo } from "../src/lib/dates";
import type { WeekSchedule } from "../src/lib/ai";
const runtimeErrors: string[] = [];
test.beforeEach(({ page }) => {
  runtimeErrors.length = 0;
  page.on("pageerror", (error) => runtimeErrors.push(error.message));
});
test.afterEach(() => {
  expect(runtimeErrors).toEqual([]);
});

function fixture() {
  const weeks = getWeekDates();
  return {
    results: POOLS.map((pool) => ({
      pool,
      error: null,
      data: {
        pool,
        model: "gpt-6-luna",
        fetchedAt: new Date().toISOString(),
        stale: false,
        availability: {
          poolName: pool.name,
          alerts: [],
          notices: [],
          ...(Object.fromEntries(
            Object.entries(weeks).map(([key, week]) => [
              key,
              {
                weekStart: week.monday,
                weekEnd: week.sunday,
                days: week.days.map((d: DayInfo) => ({
                  day: d.name,
                  date: d.date,
                  status: ["zimsko-plivaliste-mladost", "src-salata"].includes(
                    pool.id,
                  )
                    ? "closed"
                    : "open",
                  isHoliday: false,
                  pools: ["zimsko-plivaliste-mladost", "src-salata"].includes(
                    pool.id,
                  )
                    ? []
                    : [
                        {
                          poolType: "olympic",
                          slots: [{ hours: "06:30 - 20:00" }],
                        },
                        {
                          poolType: "small",
                          slots: [{ hours: "06:30 - 21:30" }],
                        },
                      ],
                })),
              },
            ]),
          ) as Record<"currentWeek" | "nextWeek", WeekSchedule>),
        },
      },
    })),
  };
}
test("hidden page does no extraction; visibility triggers one request per pool, never polling", async ({
  page,
}) => {
  let requests = 0;
  await page.addInitScript(() => {
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get: () =>
        (window as unknown as { qaVisible: boolean }).qaVisible
          ? "visible"
          : "hidden",
    });
  });
  await page.route("**/api/pools/*", (route) => {
    requests++;
    return route.fulfill({ json: fixture() });
  });
  await page.goto("/calendar");
  await expect(
    page.getByRole("heading", { name: "Raspored plivanja" }),
  ).toBeVisible();
  expect(requests).toBe(0);
  await page.evaluate(() => {
    (window as unknown as { qaVisible: boolean }).qaVisible = true;
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expect(page.locator(".swim-event").first()).toBeVisible();
  expect(requests).toBe(POOLS.length);
  await page.evaluate(() =>
    document.dispatchEvent(new Event("visibilitychange")),
  );
  expect(requests).toBe(POOLS.length);
});
test("calendar pool/type/week controls use real state and source URLs", async ({
  page,
}) => {
  await page.route("**/api/pools/*", (route) =>
    route.fulfill({ json: fixture() }),
  );
  await page.goto("/calendar");
  await expect(page.locator(".swim-event").first()).toBeVisible();
  await page
    .locator(".pool-tabs")
    .getByRole("button", { name: "Špansko", exact: true })
    .click();
  await page.locator(".swim-event").first().click();
  await expect(page.locator(".slot-detail a")).toHaveAttribute(
    "href",
    POOLS[1].url,
  );
  await page.getByRole("button", { name: "Mali bazen", exact: true }).click();
  await expect(page.locator(".swim-event").first()).toContainText(
    "06:30–21:30",
  );
  await page
    .getByRole("button", { name: "Sljedeći tjedan", exact: true })
    .click();
  await expect(page.locator(".date-navigation")).toContainText(
    "Sljedeći tjedan",
  );
  await page
    .locator(".pool-tabs")
    .getByRole("button", { name: "Zimsko Mladost", exact: true })
    .click();
  await expect(page.locator(".swim-event")).toHaveCount(0);
  await expect(page.locator(".no-event").first()).toContainText("Zatvoreno");
});
test("agenda is the default, favorites persist first, and view links preserve URL selections", async ({
  page,
}) => {
  await page.route("**/api/pools/*", (route) =>
    route.fulfill({ json: fixture() }),
  );
  await page.goto("/");
  await expect(page).toHaveURL(/\/agenda$/);
  await expect(page.locator(".agenda-item")).toHaveCount(8);
  await expect(
    page.getByRole("textbox", { name: "Pronađi bazen" }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "Dodaj u omiljene: Jelkovec", exact: true })
    .click();
  await expect(page.locator(".agenda-item").first()).toHaveAttribute(
    "data-pool-id",
    "bazen-jelkovec",
  );
  await expect(
    page.getByRole("heading", { name: "Omiljeni bazeni", exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(page.locator(".agenda-item").first()).toHaveAttribute(
    "data-pool-id",
    "bazen-jelkovec",
  );
  await page
    .getByRole("button", { name: "Sljedeći tjedan", exact: true })
    .click();
  await page.locator(".agenda-dates button").nth(2).click();
  await page.getByRole("button", { name: "Mali bazen", exact: true }).click();
  const selection = new URL(page.url()).search;
  await page.getByRole("link", { name: "Kalendar", exact: true }).click();
  await expect(page).toHaveURL(/\/calendar\?/);
  expect(new URL(page.url()).search).toBe(selection);
  await expect(page.locator(".pool-tabs button[aria-pressed=true]")).toHaveText(
    "Jelkovec",
  );
  await page.getByRole("link", { name: "Dnevni pregled", exact: true }).click();
  await expect(page.locator(".agenda-dates button").nth(2)).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await page.goBack();
  await expect(page).toHaveURL(new RegExp("/calendar"));
  await page.goForward();
  await expect(page.locator(".agenda-dates button").nth(2)).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await page
    .getByRole("button", { name: "Ukloni iz omiljenih: Jelkovec", exact: true })
    .click();
  await expect(page.locator(".agenda-item").first()).toHaveAttribute(
    "data-pool-id",
    POOLS[0].id,
  );
});
test("all-pool overlap shares colors with sidebar, filters facilities and shows details", async ({
  page,
}) => {
  await page.route("**/api/pools/*", (route) =>
    route.fulfill({ json: fixture() }),
  );
  await page.goto("/calendar");
  await expect(page.locator(".swim-event").first()).toBeVisible();
  await page.getByRole("button", { name: "Svi objekti", exact: true }).click();
  await expect(
    page.getByRole("region", { name: "Tjedni kalendar: svi objekti" }),
  ).toBeVisible();
  const events = page.locator(".swim-event");
  await expect(events).toHaveCount(42);
  const firstDayRects = await page
    .locator(".time-day")
    .first()
    .locator(".swim-event")
    .evaluateAll((elements) =>
      elements.map((el) => {
        const rect = el.getBoundingClientRect();
        return { left: rect.left, right: rect.right, top: rect.top };
      }),
    );
  expect(firstDayRects).toHaveLength(6);
  expect(firstDayRects[0].top).toBe(firstDayRects[1].top);
  expect(Math.max(firstDayRects[0].left, firstDayRects[1].left)).toBeLessThan(
    Math.min(firstDayRects[0].right, firstDayRects[1].right),
  );
  for (const pool of POOLS.filter(
    (p) => !["zimsko-plivaliste-mladost", "src-salata"].includes(p.id),
  )) {
    const border = await events
      .filter({ has: page.locator("strong", { hasText: pool.shortName }) })
      .first()
      .evaluate((el) => getComputedStyle(el).borderLeftColor);
    const dot = await page
      .locator(`.pool-source-row[data-pool-id="${pool.id}"] .color-dot`)
      .evaluate((el) => getComputedStyle(el).backgroundColor);
    expect(border).toBe(dot);
  }
  await page.getByRole("button", { name: "Sve vrste", exact: true }).click();
  await expect(events).toHaveCount(84);
  const railPositions = await page
    .locator(".time-day")
    .first()
    .locator(".swim-event")
    .evaluateAll((elements) =>
      elements.map((el) => (el as HTMLElement).style.left),
    );
  expect(new Set(railPositions).size).toBe(12);
  await page.getByRole("button", { name: "Veliki bazen", exact: true }).click();
  await page
    .getByRole("checkbox", { name: "Prikaži Špansko", exact: true })
    .uncheck();
  await expect(
    page.locator('.swim-event[data-pool-id="bazen-spansko"]'),
  ).toHaveCount(0);
  await expect(events).toHaveCount(35);
  await page
    .locator('.swim-event[data-pool-id="bazenski-kompleks-utrina"]')
    .first()
    .focus();
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("region", { name: "Detalji termina" }),
  ).toContainText("Utrina");
  await page.getByRole("button", { name: "Zatvori detalje termina" }).click();
  await expect(
    page.getByRole("region", { name: "Detalji termina" }),
  ).toHaveCount(0);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth))
    .toBe(390);
  await page
    .getByRole("button", { name: "Izdvoji Jelkovec", exact: true })
    .click();
  await expect(page.locator(".overlap-calendar")).toHaveCount(0);
  await expect(page.locator(".swim-event").first()).toContainText("Jelkovec");
});
test("comparison navigation is gone and its old URL redirects to calendar", async ({
  page,
}) => {
  await page.route("**/api/pools/*", (route) =>
    route.fulfill({ json: fixture() }),
  );
  await page.goto("/compare");
  await expect(page).toHaveURL(/\/calendar$/);
  await expect(page.locator(".view-navigation a")).toHaveCount(2);
  await expect(
    page.getByRole("link", { name: "Usporedba", exact: true }),
  ).toHaveCount(0);
});
test("the generated favicon replaces the Next icon and alternatives are downloadable", async ({
  page,
  request,
}) => {
  await page.route("**/api/pools/*", (route) =>
    route.fulfill({ json: fixture() }),
  );
  await page.goto("/calendar");
  await expect(
    page.locator('link[rel="icon"][href^="/favicon.ico"]'),
  ).toHaveCount(1);
  for (const name of ["wave", "lanes", "calendar"]) {
    const image = await request.get(`/favicon-options/${name}.png`);
    expect(image.status()).toBe(200);
    expect(image.headers()["content-type"]).toContain("image/png");
    const icon = await request.get(`/favicon-options/${name}.ico`);
    expect(icon.status()).toBe(200);
    const buffer = await icon.body();
    expect(buffer.readUInt16LE(2)).toBe(1);
    expect(buffer.readUInt16LE(4)).toBe(4);
  }
});
test("source failure is presented as unknown, preserves facilities and links", async ({
  page,
}) => {
  await page.route("**/api/pools/*", (route) =>
    route.fulfill({
      status: 503,
      json: {
        results: POOLS.map((pool) => ({
          pool,
          data: null,
          error: "Raspored nije dostupan.",
        })),
      },
    }),
  );
  await page.goto("/calendar");
  await expect(
    page.getByText("Rasporedi trenutačno nisu dostupni", { exact: false }),
  ).toBeVisible();
  await expect(page.locator(".pool-source-row")).toHaveCount(8);
  await expect(page.locator(".no-event").first()).toContainText(
    "Nema potvrđenih termina",
  );
  await expect(
    page.getByRole("link", { name: "Otvori službeni raspored" }),
  ).toHaveAttribute("href", POOLS[0].url);
});
test("API catalog/OpenAPI and validation paths do not need an extraction", async ({
  request,
}) => {
  const catalog = await request.get("/api/pools/catalog");
  expect(catalog.status()).toBe(200);
  expect((await catalog.json()).pools).toHaveLength(8);
  const schema = await request.get("/api/openapi");
  expect(schema.status()).toBe(200);
  expect((await schema.json()).paths["/pools/refresh"].post.security).toEqual([
    { bearerAuth: [] },
  ]);
  expect((await request.get("/api/pools?week=invalid")).status()).toBe(400);
  expect((await request.get("/api/pools?date=2025-01-01")).status()).toBe(400);
  expect((await request.get("/api/pools/not-a-pool")).status()).toBe(404);
  expect(
    (await request.post("/api/pools/refresh", { data: {} })).status(),
  ).toBe(401);
});

test("Iver has its official source and Šalata can show a seasonal closure", async ({
  page,
}) => {
  await page.route("**/api/pools/*", (route) =>
    route.fulfill({ json: fixture() }),
  );
  await page.goto("/calendar");
  await page
    .locator(".pool-tabs")
    .getByRole("button", { name: "Iver", exact: true })
    .click();
  await expect(page.locator(".swim-event").first()).toContainText("Iver");
  await expect(
    page.getByRole("link", { name: "Otvori službeni raspored" }),
  ).toHaveAttribute("href", POOLS.find((p) => p.id === "bazen-iver")!.url);
  await page
    .locator(".pool-tabs")
    .getByRole("button", { name: "Šalata", exact: true })
    .click();
  await expect(page.locator(".swim-event")).toHaveCount(0);
  await expect(page.locator(".no-event").first()).toContainText("Zatvoreno");
  await expect(
    page.getByRole("link", { name: "Otvori službeni raspored" }),
  ).toHaveAttribute("href", POOLS.find((p) => p.id === "src-salata")!.url);
});

test("only the signed-in owner sees refresh; invalid keys fail and logout removes access", async ({
  page,
  context,
}) => {
  await page.route("**/api/pools/*", (route) =>
    route.fulfill({ json: fixture() }),
  );
  await page.goto("/calendar");
  await expect(page.locator(".refresh-button")).toHaveCount(0);
  await page.goto("/owner");
  await expect(
    page.getByRole("heading", { name: "Vlasnički pristup" }),
  ).toBeVisible();
  await page.getByLabel("Ključ za osvježavanje").fill("wrong-key");
  await page.getByRole("button", { name: "Omogući osvježavanje" }).click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "Ključ nije ispravan",
  );
  expect(
    (await context.cookies()).find((c) => c.name === "pools-owner"),
  ).toBeUndefined();

  await page
    .getByLabel("Ključ za osvježavanje")
    .fill("playwright-only-owner-key");
  await page.getByRole("button", { name: "Omogući osvježavanje" }).click();
  await expect(page).toHaveURL(/\/agenda$/);
  await expect(
    page.getByRole("button", { name: "Osvježi podatke", exact: true }),
  ).toBeEnabled();
  const cookie = (await context.cookies()).find(
    (c) => c.name === "pools-owner",
  )!;
  expect(cookie.httpOnly).toBe(true);
  expect(cookie.sameSite).toBe("Strict");
  expect(cookie.value).not.toContain("playwright-only-owner-key");
  await page.getByRole("link", { name: "Vlasnički pristup" }).click();
  await expect(
    page.getByText("Ručno osvježavanje je omogućeno u ovom pregledniku."),
  ).toBeVisible();
  await page.getByRole("button", { name: "Odjavi se" }).click();
  await expect(page).toHaveURL(/\/agenda$/);
  await expect(page.locator(".refresh-button")).toHaveCount(0);
  expect(
    (await context.cookies()).find((c) => c.name === "pools-owner"),
  ).toBeUndefined();
});

test("a direct refresh action call without the owner cookie is denied before extraction", async ({
  page,
  request,
}) => {
  await page.route("**/api/pools/*", (route) =>
    route.fulfill({ json: fixture() }),
  );
  await page.goto("/owner");
  await page
    .getByLabel("Ključ za osvježavanje")
    .fill("playwright-only-owner-key");
  await page.getByRole("button", { name: "Omogući osvježavanje" }).click();
  await expect(page).toHaveURL(/\/agenda$/);
  await expect(
    page.getByRole("button", { name: "Osvježi podatke", exact: true }),
  ).toBeEnabled();

  // Capture the real action ID without allowing this test to scrape sources.
  await page.route("**/agenda", (route) =>
    route.request().headers()["next-action"] ? route.abort() : route.continue(),
  );
  const actionRequest = page.waitForRequest(
    (req) => !!req.headers()["next-action"],
  );
  await page
    .getByRole("button", { name: "Osvježi podatke", exact: true })
    .click();
  const captured = await actionRequest;
  const response = await request.post("/agenda", {
    headers: {
      "Next-Action": captured.headers()["next-action"],
      "Content-Type": "text/plain;charset=UTF-8",
      Origin: "http://127.0.0.1:3017",
    },
    data: captured.postData()!,
  });
  expect(response.status()).toBe(200);
  expect(await response.text()).toContain("owner_required");
});

test("a raw API key in the session cookie does not unlock the owner button", async ({
  page,
  context,
}) => {
  await context.addCookies([
    {
      name: "pools-owner",
      value: "playwright-only-owner-key",
      url: "http://127.0.0.1:3017",
    },
  ]);
  await page.route("**/api/pools/*", (route) =>
    route.fulfill({ json: fixture() }),
  );
  await page.goto("/calendar");
  await expect(page.locator(".refresh-button")).toHaveCount(0);
});

test("HTTP language preferences select translated HTML and metadata before JavaScript", async ({
  request,
}) => {
  for (const [header, language, title] of [
    ["en-US,en;q=0.9", "en", "Swimming schedules"],
    ["hr-HR,hr;q=0.9,en;q=0.8", "hr", "Raspored plivanja"],
    ["hr;q=0.4,en-GB;q=0.9", "en", "Swimming schedules"],
    ["de-DE,de;q=0.9,hr;q=0.8", "hr", "Raspored plivanja"],
    ["de-DE,fr;q=0.8", "en", "Swimming schedules"],
  ]) {
    const response = await request.get("/calendar", {
      headers: { "Accept-Language": header },
    });
    expect(response.status()).toBe(200);
    const html = await response.text();
    expect(html).toContain(`<html lang="${language}">`);
    expect(html).toContain(`<title>Bazeni Zagreb · ${title}</title>`);
  }
});

test("switching language preserves selection, uses cached schedules, and persists across pages and reloads", async ({
  page,
  context,
}) => {
  let reads = 0;
  await page.route("**/api/pools/*", (route) => {
    reads++;
    return route.fulfill({ json: fixture() });
  });
  await page.goto("/calendar");
  await expect(page.locator("html")).toHaveAttribute("lang", "hr");
  await expect(page.locator(".swim-event").first()).toBeVisible();
  await page
    .locator(".pool-tabs")
    .getByRole("button", { name: "Iver", exact: true })
    .click();
  await page.locator(".swim-event").first().click();
  expect(reads).toBe(POOLS.length);
  await page
    .getByRole("button", { name: "Switch to English", exact: true })
    .click();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(
    page.getByRole("heading", { name: "Swimming schedules", exact: true }),
  ).toBeVisible();
  await expect(page).toHaveTitle("Bazeni Zagreb · Swimming schedules");
  await expect(page.locator(".day-heading span").first()).toHaveText("Mon");
  await expect(
    page.getByRole("region", { name: "Swim time details" }),
  ).toContainText("Iver");
  await expect(
    page.getByRole("region", { name: "Swim time details" }),
  ).toContainText("Main pool");
  expect(reads).toBe(POOLS.length);
  expect(
    (await context.cookies()).find((c) => c.name === "pools-language")?.value,
  ).toBe("en");
  await page.getByRole("link", { name: "Daily agenda", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Daily agenda", exact: true }),
  ).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page.locator(".agenda-item")).toHaveCount(8);
  await page
    .getByRole("button", { name: "Prebaci na hrvatski", exact: true })
    .click();
  await expect(page.locator("html")).toHaveAttribute("lang", "hr");
  await expect(
    page.getByRole("heading", { name: "Dnevni pregled", exact: true }),
  ).toBeVisible();
});

test("an English browser gets translated notices, lane restrictions, errors and owner access", async ({
  browser,
}) => {
  const context = await browser.newContext({
    locale: "en-US",
    viewport: { width: 390, height: 844 },
  });
  const page = await context.newPage();
  const data = fixture();
  const pool = data.results[0].data;
  Object.assign(pool.availability, {
    alerts: ["Bazen radi skraćeno"],
    alertsEn: ["Reduced swimming hours"],
    notices: ["Kapa je obavezna"],
    noticesEn: ["A swimming cap is required"],
  });
  for (const day of [
    ...pool.availability.currentWeek.days,
    ...pool.availability.nextWeek.days,
  ]) {
    Object.assign(day, {
      reason: "Dio bazena je zatvoren",
      reasonEn: "Part of the pool is closed",
    });
    for (const group of day.pools) {
      for (const slot of group.slots)
        Object.assign(slot, { lanes: "3 pruge", lanesEn: "3 lanes" });
    }
  }
  await page.route("**/api/pools/*", (route) => route.fulfill({ json: data }));
  await page.goto("/calendar");
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(
    page.getByText("Reduced swimming hours", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("A swimming cap is required", { exact: true }),
  ).toBeVisible();
  await page.locator(".swim-event").first().click();
  await expect(
    page.getByRole("region", { name: "Swim time details" }),
  ).toContainText("3 lanes");
  await expect(
    page.getByRole("region", { name: "Swim time details" }),
  ).toContainText("Part of the pool is closed");
  await page.getByRole("button", { name: "Close swim time details" }).click();
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth))
    .toBe(390);
  await page.getByRole("link", { name: "Daily agenda", exact: true }).click();
  await expect(
    page.getByRole("region", { name: "Swim times by pool" }),
  ).toContainText("3 lanes");
  await page.goto("/owner");
  await expect(
    page.getByRole("heading", { name: "Owner access" }),
  ).toBeVisible();
  await expect(page).toHaveTitle("Owner access · Bazeni Zagreb");
  await page.getByLabel("Refresh key").fill("wrong-key");
  await page.getByRole("button", { name: "Enable refresh" }).click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "That key is incorrect",
  );
  await page.getByLabel("Refresh key").fill("playwright-only-owner-key");
  await page.getByRole("button", { name: "Enable refresh" }).click();
  await expect(page).toHaveURL(/\/agenda$/);
  await expect(
    page.getByRole("button", { name: "Refresh schedules", exact: true }),
  ).toBeEnabled();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth))
    .toBe(390);
  await context.close();
});

test("English source failures remain understandable without Croatian error text", async ({
  browser,
}) => {
  const context = await browser.newContext({ locale: "en-US" });
  const page = await context.newPage();
  await page.route("**/api/pools/*", (route) =>
    route.fulfill({
      status: 503,
      json: {
        results: POOLS.map((pool) => ({
          pool,
          data: null,
          error: "Raspored nije dostupan.",
        })),
      },
    }),
  );
  await page.goto("/calendar");
  await expect(
    page.getByText("Schedules are currently unavailable", { exact: false }),
  ).toBeVisible();
  await page.locator(".schedule-errors summary").click();
  await expect(
    page
      .getByText(
        "The schedule is currently unavailable. Check the official source.",
        { exact: true },
      )
      .first(),
  ).toBeVisible();
  await expect(page.locator(".no-event").first()).toContainText(
    "No confirmed swim times",
  );
  await context.close();
});

test("one slow pool does not delay other schedules and failed pools can be retried", async ({
  page,
}) => {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  let failed = true;
  await page.route("**/api/pools/*", async (route) => {
    const id = route.request().url().split("/").pop();
    if (id === POOLS[7].id) await gate;
    const result = fixture().results.find((r) => r.pool.id === id)!;
    return route.fulfill({
      status: id === POOLS[1].id && failed ? 503 : 200,
      json: {
        results: [
          id === POOLS[1].id && failed
            ? { pool: result.pool, data: null, error: "unavailable" }
            : result,
        ],
      },
    });
  });
  await page.goto("/agenda");
  await expect(
    page.locator(`.agenda-item[data-pool-id="${POOLS[0].id}"] .time-pill`),
  ).toBeVisible();
  await expect(
    page.locator(`.agenda-item[data-pool-id="${POOLS[7].id}"]`),
  ).toContainText("Učitavanje");
  release();
  await expect(page.locator(".schedule-errors summary")).toBeVisible();
  failed = false;
  await page.locator(".schedule-errors summary").click();
  await page
    .getByRole("button", { name: "Pokušaj ponovno", exact: true })
    .click();
  await expect(
    page.locator(`.agenda-item[data-pool-id="${POOLS[1].id}"] .time-pill`),
  ).toBeVisible();
  await expect(page.locator(".schedule-errors")).toHaveCount(0);
});

test("mobile week starts around today, controls sit above views, and storage errors are harmless", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  // Match the Saturday report regardless of the date when the test runs.
  await page.clock.setFixedTime(new Date("2026-10-24T12:00:00Z"));
  const weeks = getWeekDates(new Date("2026-10-24T12:00:00Z"));
  const data = fixture();
  for (const result of data.results) {
    for (const key of ["currentWeek", "nextWeek"] as const) {
      const dates = weeks[key];
      result.data.availability[key].weekStart = dates.monday;
      result.data.availability[key].weekEnd = dates.sunday;
      result.data.availability[key].days.forEach((day, i) => {
        day.date = dates.days[i].date;
        day.day = dates.days[i].name;
      });
    }
  }
  await page.addInitScript(() => {
    localStorage.setItem("zg-pools:favorites:v1", "invalid json");
  });
  await page.route("**/api/pools/*", (route) => route.fulfill({ json: data }));
  await page.goto("/calendar");
  await expect(page.locator(".swim-event").first()).toBeAttached();
  await expect
    .poll(() =>
      page.locator(".calendar-scroll").evaluate((el) => el.scrollLeft),
    )
    .toBeGreaterThan(500);
  const today = page.locator('.day-heading[data-date="2026-10-24"]');
  const bounds = await today.boundingBox();
  expect(bounds!.x).toBeGreaterThan(16);
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(390);
  const week = await page.locator(".date-navigation").boundingBox();
  const views = await page.locator(".view-navigation").boundingBox();
  expect(week!.y + week!.height).toBeLessThanOrEqual(views!.y);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(
    390,
  );
  await page.screenshot({ path: "/tmp/zg-pools-mobile-calendar.png" });
  await page.getByRole("link", { name: "Dnevni pregled", exact: true }).click();
  await page
    .getByRole("button", { name: "Dodaj u omiljene: Jelkovec", exact: true })
    .click();
  await expect(page.locator(".agenda-item").first()).toHaveAttribute(
    "data-pool-id",
    "bazen-jelkovec",
  );
  await page.screenshot({ path: "/tmp/zg-pools-mobile-agenda.png" });
});

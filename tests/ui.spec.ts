import { expect, test } from "@playwright/test";
import { POOLS } from "../src/lib/pools";
import { getWeekDates, type DayInfo } from "../src/lib/dates";
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
          ...Object.fromEntries(
            Object.entries(weeks).map(([key, week]) => [
              key,
              {
                weekStart: week.monday,
                weekEnd: week.sunday,
                days: week.days.map((d: DayInfo) => ({
                  day: d.name,
                  date: d.date,
                  status:
                    pool.id === "zimsko-plivaliste-mladost" ? "closed" : "open",
                  isHoliday: false,
                  pools:
                    pool.id === "zimsko-plivaliste-mladost"
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
          ),
        },
      },
    })),
  };
}
test("hidden page does no extraction; visibility triggers just one request, never polling", async ({
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
  await page.route("**/api/pools", (route) => {
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
  expect(requests).toBe(1);
  await page.evaluate(() =>
    document.dispatchEvent(new Event("visibilitychange")),
  );
  expect(requests).toBe(1);
});
test("calendar pool/type/week controls use real state and source URLs", async ({
  page,
}) => {
  await page.route("**/api/pools", (route) =>
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
test("agenda switches date, searches pools, and handles empty searches", async ({
  page,
}) => {
  await page.route("**/api/pools", (route) =>
    route.fulfill({ json: fixture() }),
  );
  await page.goto("/agenda");
  await expect(page.locator(".time-pill").first()).toBeVisible();
  await page.locator(".agenda-dates button").first().click();
  await expect(page.locator(".agenda-dates button").first()).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await page.getByRole("textbox", { name: "Pronađi bazen" }).fill("Jelkovec");
  await expect(page.locator(".agenda-item")).toHaveCount(1);
  await page
    .getByRole("textbox", { name: "Pronađi bazen" })
    .fill("does not exist");
  await expect(
    page.getByText("Nema bazena za ovaj odabir", { exact: true }),
  ).toBeVisible();
});
test("all-pool overlap shares colors with sidebar, filters facilities and shows details", async ({
  page,
}) => {
  await page.route("**/api/pools", (route) =>
    route.fulfill({ json: fixture() }),
  );
  await page.goto("/calendar");
  await expect(page.locator(".swim-event").first()).toBeVisible();
  await page.getByRole("button", { name: "Svi objekti", exact: true }).click();
  await expect(
    page.getByRole("region", { name: "Tjedni kalendar: svi objekti" }),
  ).toBeVisible();
  const events = page.locator(".swim-event");
  await expect(events).toHaveCount(35);
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
  expect(firstDayRects).toHaveLength(5);
  expect(firstDayRects[0].top).toBe(firstDayRects[1].top);
  expect(Math.max(firstDayRects[0].left, firstDayRects[1].left)).toBeLessThan(
    Math.min(firstDayRects[0].right, firstDayRects[1].right),
  );
  for (const pool of POOLS.slice(0, 5)) {
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
  await expect(events).toHaveCount(70);
  const railPositions = await page
    .locator(".time-day")
    .first()
    .locator(".swim-event")
    .evaluateAll((elements) =>
      elements.map((el) => (el as HTMLElement).style.left),
    );
  expect(new Set(railPositions).size).toBe(10);
  await page.getByRole("button", { name: "Veliki bazen", exact: true }).click();
  await page
    .getByRole("checkbox", { name: "Prikaži Špansko", exact: true })
    .uncheck();
  await expect(
    page.locator('.swim-event[data-pool-id="bazen-spansko"]'),
  ).toHaveCount(0);
  await expect(events).toHaveCount(28);
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
  await page.route("**/api/pools", (route) =>
    route.fulfill({ json: fixture() }),
  );
  await page.goto("/compare");
  await expect(page).toHaveURL(/\/calendar$/);
  await expect(page.locator(".header-inner nav a")).toHaveCount(2);
  await expect(
    page.getByRole("link", { name: "Usporedba", exact: true }),
  ).toHaveCount(0);
});
test("the generated favicon replaces the Next icon and alternatives are downloadable", async ({
  page,
  request,
}) => {
  await page.route("**/api/pools", (route) =>
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
  await page.route("**/api/pools", (route) =>
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
    page.getByText("6 rasporeda trebaju provjeru.", { exact: false }),
  ).toBeVisible();
  await expect(page.locator(".pool-source-row")).toHaveCount(6);
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
  expect((await catalog.json()).pools).toHaveLength(6);
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

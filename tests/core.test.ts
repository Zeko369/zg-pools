import { describe, expect, test } from "bun:test";
import { getWeekDates, holidayForDate, zagrebDate } from "../src/lib/dates";
import { extractPageContent, POOLS } from "../src/lib/pools";
import {
  availabilityFromExtraction,
  intervalMinutes,
  PARSER_MODEL,
  type Extraction,
} from "../src/lib/ai";
import { RequestCache } from "../src/lib/request-cache";
const now = new Date("2026-10-24T08:00:00Z");
function extraction(): Extraction {
  const week = getWeekDates(now);
  return {
    days: [...week.currentWeek.days, ...week.nextWeek.days].map((d) => ({
      date: d.date,
      status: "open",
      reason: null,
      pools: [
        {
          poolType: "olympic",
          slots: [{ hours: "06:30 - 20:00", lanes: null }],
        },
      ],
    })),
    alerts: [],
    notices: [],
  };
}
describe("sources and dates", () => {
  test("six unique pools, verified public-hours URLs", () => {
    expect(POOLS).toHaveLength(6);
    expect(new Set(POOLS.map((p) => p.id)).size).toBe(6);
    expect(POOLS.find((p) => p.id === "bazen-spansko")?.url).toEndWith(
      "?tab=2316",
    );
    expect(
      POOLS.find((p) => p.id === "bazenski-kompleks-svetice")?.url,
    ).toEndWith("/1366");
    expect(PARSER_MODEL).toBe("gpt-6-luna");
  });
  test("Zagreb week rolls on local Monday, even on UTC Sunday", () => {
    const date = new Date("2026-10-25T23:15:00Z");
    expect(zagrebDate(date)).toBe("2026-10-26");
    expect(getWeekDates(date).currentWeek.monday).toBe("26.10.2026");
    expect(getWeekDates(now).nextWeek.sunday).toBe("01.11.2026");
    expect(
      getWeekDates(new Date("2026-12-31T23:30:00Z")).currentWeek.monday,
    ).toBe("28.12.2026");
  });
  test("fixed and movable holidays retain the correct year", () => {
    expect(holidayForDate("05.04.2026")).toBe("Uskrs");
    expect(holidayForDate("06.04.2026")).toBe("Uskrsni ponedjeljak");
    expect(holidayForDate("04.06.2026")).toBe("Tijelovo");
    expect(holidayForDate("28.03.2027")).toBe("Uskrs");
    expect(holidayForDate("01.11.2026")).toBe("Svi sveti");
    expect(holidayForDate("24.10.2026")).toBeNull();
  });
  test("scraper isolates hours/notices and preserves blank and merged table cells", () => {
    const html = `<button class="nav-link" data-bs-target="#objekt-tab2-pane">Wellness</button><button class="nav-link" data-bs-target="#objekt-tab3-pane">Obavijesti</button><div id="objekt-content"><div class="tab-pane active" id="objekt-tab1-pane"><h2>Građanstvo</h2><table><tr><th rowspan="2">Pon</th><td></td><td colspan="2">06:30 - 20:00</td></tr></table></div><div class="tab-pane" id="objekt-tab2-pane">Wellness 08:00 - 21:30</div><div class="tab-pane" id="objekt-tab3-pane"><p>24.10.2026. ne radi</p></div><div class="tab-pane" id="classes">Tečaj 19:00</div></div>`;
    const result = extractPageContent(
      html,
      "https://www.sportskiobjekti.hr/bazen/1?tab=1",
    );
    expect(result.text).toContain(
      "Pon [rowspan=2] | (empty) | 06:30 - 20:00 [colspan=2]",
    );
    expect(result.text).toContain("24.10.2026. ne radi");
    expect(result.text).not.toContain("Wellness");
    expect(result.text).not.toContain("Tečaj");
  });
  test("PDF is discovered from official page each time, not a pinned filename", () => {
    const page = `<div class="page-intro"><p>Radno vrijeme</p><a href="/UserDocsImages/new.pdf?vel=123">Radno vrijeme bazena za građanstvo</a></div>`;
    expect(
      extractPageContent(page, "https://www.sportskiobjekti.hr/bazen/1")
        .pdfUrls,
    ).toEqual([
      "https://www.sportskiobjekti.hr/UserDocsImages/new.pdf?vel=123",
    ]);
    expect(() =>
      extractPageContent(
        "<h1>Not found</h1>",
        "https://www.sportskiobjekti.hr/x",
      ),
    ).toThrow();
  });
});
describe("model output validation", () => {
  test("dates and holiday metadata come from deterministic Zagreb calendar", () => {
    const data = availabilityFromExtraction("Špansko", extraction(), now);
    expect(data.currentWeek.days[0].day).toBe("Ponedjeljak");
    expect(data.nextWeek.days[6].holidayName).toBe("Svi sveti");
  });
  test("rejects duplicate dates and incorrect years", () => {
    let raw = extraction();
    raw.days[0].date = raw.days[1].date;
    expect(() => availabilityFromExtraction("x", raw, now)).toThrow("dates");
    raw = extraction();
    raw.days[0].date = "19.10.2025";
    expect(() => availabilityFromExtraction("x", raw, now)).toThrow("dates");
  });
  test("does not confuse unknown with closed, or publish hours on either", () => {
    const raw = extraction();
    raw.days[0] = {
      date: raw.days[0].date,
      status: "unknown",
      pools: [],
      reason: "Raspored nije objavljen",
    };
    expect(
      availabilityFromExtraction("x", raw, now).currentWeek.days[0].status,
    ).toBe("unknown");
    raw.days[0].pools = raw.days[1].pools;
    expect(() => availabilityFromExtraction("x", raw, now)).toThrow(
      "Closed/unknown",
    );
  });
  test("rejects invalid and overlapping intervals", () => {
    expect(intervalMinutes("06:30 - 24:00")).toEqual([390, 1440]);
    for (const hours of [
      "06:00 - 25:00",
      "20:00 - 06:00",
      "06:60 - 20:00",
      "6:00-20:00",
    ])
      expect(intervalMinutes(hours)).toBeNull();
    const raw = extraction();
    raw.days[0].pools[0].slots.push({ hours: "08:00 - 09:00", lanes: null });
    expect(() => availabilityFromExtraction("x", raw, now)).toThrow(
      "Overlapping",
    );
  });
  test("children's hours are preserved separately from warm-up pool", () => {
    const raw = extraction();
    raw.days[0].pools.push(
      {
        poolType: "small",
        slots: [{ hours: "13:00 - 19:00", lanes: "3 pruge" }],
      },
      {
        poolType: "children",
        slots: [{ hours: "13:00 - 15:00", lanes: null }],
      },
    );
    expect(
      availabilityFromExtraction("Svetice", raw, now).currentWeek.days[0].pools,
    ).toHaveLength(3);
  });
});
describe("request-only cache", () => {
  test("expiry does no work; next request refreshes and concurrent calls coalesce", async () => {
    let now = 0,
      calls = 0;
    const cache = new RequestCache<number>(1000, 100, () => now);
    const load = async () => {
      calls++;
      await Promise.resolve();
      return calls;
    };
    expect(calls).toBe(0);
    const values = await Promise.all([
      cache.get("a", "week1", load),
      cache.get("a", "week1", load),
    ]);
    expect(calls).toBe(1);
    expect(values.map((v) => v.value)).toEqual([1, 1]);
    now = 2000;
    expect(calls).toBe(1);
    expect((await cache.get("a", "week1", load)).value).toBe(2);
  });
  test("force refresh has cooldown, retains original fetched data", async () => {
    let now = 0,
      calls = 0;
    const cache = new RequestCache<number>(1000, 100, () => now);
    const load = async () => ++calls;
    await cache.get("a", "w1", load);
    await cache.get("a", "w1", load, true);
    expect(calls).toBe(1);
    now = 101;
    expect((await cache.get("a", "w1", load, true)).value).toBe(2);
  });
  test("failure backs off, preserves stale same-week data, never serves wrong week", async () => {
    let now = 0,
      calls = 0;
    const cache = new RequestCache<number>(1000, 100, () => now);
    await cache.get("a", "w1", async () => 1);
    now = 1001;
    const fail = async () => {
      calls++;
      throw new Error("upstream unavailable");
    };
    expect(await cache.get("a", "w1", fail)).toEqual({ value: 1, stale: true });
    expect(await cache.get("a", "w1", fail, true)).toEqual({
      value: 1,
      stale: true,
    });
    expect(calls).toBe(1);
    await expect(cache.get("a", "w2", fail)).rejects.toThrow(
      "upstream unavailable",
    );
    now += 101;
    await expect(cache.get("a", "w2", fail)).rejects.toThrow();
    expect(calls).toBe(2);
  });
});

test("failed forced refresh remains marked stale on subsequent ordinary reads", async () => {
  let now = 0;
  const cache = new RequestCache<number>(1000, 100, () => now);
  await cache.get("pool", "week", async () => 1);
  now = 101;
  await cache.get(
    "pool",
    "week",
    async () => {
      throw new Error("Source unavailable");
    },
    true,
  );
  const result = await cache.get("pool", "week", async () => 2);
  expect(result).toEqual({ value: 1, stale: true });
});

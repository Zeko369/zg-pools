import { describe, expect, test } from "bun:test";
import { zodSchema } from "ai";
import { getWeekDates, holidayForDate, zagrebDate } from "../src/lib/dates";
import { extractPageContent, POOLS } from "../src/lib/pools";
import {
  availabilityFromExtraction,
  ExtractionSchema,
  intervalMinutes,
  PARSER_MODEL,
  type Extraction,
} from "../src/lib/ai";
import { RequestCache } from "../src/lib/request-cache";
import {
  detectLanguage,
  holidayName,
  weekday,
  weekLabel,
  sourceTexts,
} from "../src/lib/i18n";
import {
  createOwnerSession,
  matchesSecret,
  OWNER_SESSION_SECONDS,
  validOwnerSession,
} from "../src/lib/owner-session";
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
  test("eight unique pools, verified public-hours URLs", () => {
    expect(POOLS).toHaveLength(8);
    expect(new Set(POOLS.map((p) => p.id)).size).toBe(8);
    expect(POOLS.find((p) => p.id === "bazen-spansko")?.url).toEndWith(
      "?tab=2316",
    );
    expect(
      POOLS.find((p) => p.id === "bazenski-kompleks-svetice")?.url,
    ).toEndWith("/1366");
    expect(POOLS.find((p) => p.id === "bazen-iver")?.url).toEndWith("/1388");
    expect(POOLS.find((p) => p.id === "src-salata")?.url).toEndWith(
      "?tab=1361",
    );
    expect(new Set(POOLS.map((p) => p.color)).size).toBe(8);
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
  test("Šalata extraction includes the season closure and swimming tab, excluding skating", () => {
    const html = `<button class="nav-link" data-bs-target="#objekt-tab2-pane">Obavijesti</button><div id="objekt-content"><div class="tab-pane active" id="objekt-tab3-pane">Klizalište 09:00 - 22:00</div><div class="tab-pane" id="objekt-tab1361-pane">Radno vrijeme bazena za građanstvo 13:30 - 18:00</div><div class="tab-pane" id="objekt-tab2-pane">Kupališna sezona završava 13.rujna 2026.</div></div>`;
    const result = extractPageContent(
      html,
      POOLS.find((p) => p.id === "src-salata")!.url,
    );
    expect(result.text).toContain("13:30 - 18:00");
    expect(result.text).toContain("sezona završava 13.rujna 2026.");
    expect(result.text).not.toContain("Klizalište");
  });
});

describe("owner access", () => {
  const secret = "unit-test-owner-key";
  const issuedAt = now.getTime();
  test("signed sessions expire and rotating the key invalidates them", () => {
    const session = createOwnerSession(secret, issuedAt);
    expect(session).not.toContain(secret);
    expect(validOwnerSession(session, secret, issuedAt)).toBe(true);
    expect(validOwnerSession(session, "rotated-test-key", issuedAt)).toBe(
      false,
    );
    expect(
      validOwnerSession(
        session,
        secret,
        issuedAt + OWNER_SESSION_SECONDS * 1000,
      ),
    ).toBe(false);
  });
  test("missing keys, raw keys, tampered signatures and changed expiry fail closed", () => {
    const session = createOwnerSession(secret, issuedAt);
    expect(matchesSecret(secret, undefined)).toBe(false);
    expect(matchesSecret("wrong-key", secret)).toBe(false);
    expect(matchesSecret(secret, secret)).toBe(true);
    expect(validOwnerSession(session, undefined, issuedAt)).toBe(false);
    expect(validOwnerSession(undefined, secret, issuedAt)).toBe(false);
    expect(validOwnerSession(secret, secret, issuedAt)).toBe(false);
    const parts = session.split(".");
    parts[1] = String(Number(parts[1]) + 86400000);
    expect(validOwnerSession(parts.join("."), secret, issuedAt)).toBe(false);
    expect(
      validOwnerSession(
        `${session.slice(0, -1)}${session.endsWith("0") ? "1" : "0"}`,
        secret,
        issuedAt,
      ),
    ).toBe(false);
  });
});

describe("language preferences and display", () => {
  test("negotiates supported regional tags by HTTP quality and preference order", () => {
    expect(detectLanguage("en-US,en;q=0.9")).toBe("en");
    expect(detectLanguage("hr-HR,hr;q=0.9,en;q=0.8")).toBe("hr");
    expect(detectLanguage("hr;q=0.4,en-GB;q=0.9")).toBe("en");
    expect(detectLanguage("de-DE,de;q=0.9,hr-HR;q=0.8,en;q=0.7")).toBe("hr");
    expect(detectLanguage("hr,en")).toBe("hr");
    expect(detectLanguage("en;q=0,hr;q=0.5")).toBe("hr");
    expect(detectLanguage("hr;q=invalid,en;q=0.8")).toBe("en");
    expect(detectLanguage("en;q=2,hr;q=0.5")).toBe("hr");
  });
  test("explicit saved language wins; unsupported or missing preferences fall back to English", () => {
    expect(detectLanguage("hr-HR", "en")).toBe("en");
    expect(detectLanguage("en-GB", "hr")).toBe("hr");
    expect(detectLanguage("hr-HR", "de")).toBe("hr");
    expect(detectLanguage("de-DE,fr;q=0.8")).toBe("en");
    expect(detectLanguage(null)).toBe("en");
    expect(detectLanguage("*")).toBe("en");
  });
  test("weekdays, date ranges and all holiday names are localized", () => {
    expect(weekday("19.10.2026", "en")).toBe("Monday");
    expect(weekday("19.10.2026", "hr")).toBe("ponedjeljak");
    expect(weekLabel("19.10.2026", "25.10.2026", "en")).toContain("Oct");
    expect(weekLabel("19.10.2026", "25.10.2026", "hr")).toContain("lis");
    expect(holidayName("01.11.2026", "en")).toBe("All Saints’ Day");
    expect(holidayName("05.04.2026", "en")).toBe("Easter Sunday");
    expect(holidayName("04.06.2026", "en")).toBe("Corpus Christi");
    expect(holidayName("01.11.2026", "hr")).toBe("Svi sveti");
    expect(holidayName("24.10.2026", "en")).toBeNull();
    expect(sourceTexts(["Izvor"], ["Source"], "en")).toEqual(["Source"]);
    expect(sourceTexts(["Izvor"], ["Source"], "hr")).toEqual(["Izvor"]);
  });
});
describe("model output validation", () => {
  test("one extraction preserves Croatian API text and its aligned English translations", () => {
    const raw = extraction();
    raw.days[0].reason = { hr: "Samo 3 pruge", en: "Only 3 lanes" };
    raw.days[0].pools[0].slots[0].lanes = { hr: "3 pruge", en: "3 lanes" };
    raw.alerts = [
      { hr: "Radovi do 25.10.2026.", en: "Maintenance until 25.10.2026." },
    ];
    raw.notices = [
      { hr: "Kapa je obavezna", en: "A swimming cap is required" },
    ];
    const data = availabilityFromExtraction("Iver", raw, now);
    expect(data.currentWeek.days[0].reason).toBe("Samo 3 pruge");
    expect(data.currentWeek.days[0].reasonEn).toBe("Only 3 lanes");
    expect(data.currentWeek.days[0].pools[0].slots[0]).toMatchObject({
      hours: "06:30 - 20:00",
      lanes: "3 pruge",
      lanesEn: "3 lanes",
    });
    expect(data.alerts).toEqual(["Radovi do 25.10.2026."]);
    expect(data.alertsEn).toEqual(["Maintenance until 25.10.2026."]);
    expect(data.noticesEn).toEqual(["A swimming cap is required"]);
    raw.notices[0].en = "";
    expect(() => availabilityFromExtraction("Iver", raw, now)).toThrow();
  });
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
      reason: {
        hr: "Raspored nije objavljen",
        en: "The schedule has not been published",
      },
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
        slots: [
          { hours: "13:00 - 19:00", lanes: { hr: "3 pruge", en: "3 lanes" } },
        ],
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

// Verify the actual SDK conversion, including objects inside nullable anyOf branches.
test("every structured-output object forbids additional properties", () => {
  function check(value: unknown) {
    if (!value || typeof value !== "object") return;
    if (Array.isArray(value)) {
      value.forEach(check);
      return;
    }
    const schema = value as Record<string, unknown>;
    if (schema.type === "object")
      expect(schema.additionalProperties).toBe(false);
    Object.values(schema).forEach(check);
  }
  check(zodSchema(ExtractionSchema).jsonSchema);
});

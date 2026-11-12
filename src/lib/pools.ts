import * as cheerio from "cheerio";
export {
  getWeekDates,
  type DayInfo,
  type WeekDates,
  type WeekInfo,
} from "./dates";
export interface Pool {
  id: string;
  name: string;
  shortName: string;
  area: string;
  url: string;
  color: string;
}
export const POOLS: Pool[] = [
  {
    id: "bazenski-kompleks-svetice",
    name: "Bazenski kompleks Svetice",
    shortName: "Svetice",
    area: "Maksimir",
    color: "teal",
    url: "https://www.sportskiobjekti.hr/bazenski-kompleks-svetice/1366",
  },
  {
    id: "bazen-spansko",
    name: "Bazen Špansko",
    shortName: "Špansko",
    area: "Zapad",
    color: "blue",
    url: "https://www.sportskiobjekti.hr/bazen-spansko/2311?tab=2316",
  },
  {
    id: "bazen-jelkovec",
    name: "Bazen Jelkovec",
    shortName: "Jelkovec",
    area: "Sesvete",
    color: "purple",
    url: "https://www.sportskiobjekti.hr/bazen-jelkovec/1370",
  },
  {
    id: "sportski-park-mladost",
    name: "Sportski park Mladost",
    shortName: "Mladost",
    area: "Jarun",
    color: "orange",
    url: "https://www.sportskiobjekti.hr/sportski-park-mladost/1345?tab=1355",
  },
  {
    id: "bazenski-kompleks-utrina",
    name: "Bazenski kompleks Utrina",
    shortName: "Utrina",
    area: "Novi Zagreb",
    color: "green",
    url: "https://www.sportskiobjekti.hr/bazenski-kompleks-utrina/1368",
  },
  {
    id: "zimsko-plivaliste-mladost",
    name: "Zimsko plivalište Mladost",
    shortName: "Zimsko Mladost",
    area: "Trešnjevka",
    color: "pink",
    url: "https://www.sportskiobjekti.hr/zimsko-plivaliste-mladost/1369?tab=1493",
  },
  {
    id: "bazen-iver",
    name: "Bazen Iver",
    shortName: "Iver",
    area: "Sesvetski Kraljevec",
    color: "indigo",
    url: "https://www.sportskiobjekti.hr/bazen-iver-1388/1388",
  },
  {
    id: "src-salata",
    name: "SRC Šalata",
    shortName: "Šalata",
    area: "Šalata",
    color: "red",
    url: "https://www.sportskiobjekti.hr/sportsko-rekreacijski-centar-salata/1346?tab=1361",
  },
];
const MAX_SOURCE_SIZE = 3_000_000;
async function sourceResponse(url: string) {
  const parsed = new URL(url);
  if (
    parsed.protocol !== "https:" ||
    parsed.hostname !== "www.sportskiobjekti.hr"
  )
    throw new Error("Unexpected official source host");
  const response = await fetch(parsed, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; ZagrebPoolHours/1.0)" },
    cache: "no-store",
    signal: AbortSignal.timeout(20_000),
    redirect: "error",
  });
  if (!response.ok)
    throw new Error(`Official source returned HTTP ${response.status}`);
  if (Number(response.headers.get("content-length")) > MAX_SOURCE_SIZE)
    throw new Error("Official source is too large");
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.length > MAX_SOURCE_SIZE)
    throw new Error("Official source is too large");
  return bytes;
}
export function normalizeSource(text: string) {
  return text
    .normalize("NFC")
    .replace(/\u00a0/g, " ")
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join("\n");
}
/** Only hours/about and notices tab bodies. Page chrome never enters the fingerprint. */
export function extractPageContent(
  html: string,
  url: string,
): { text: string; pdfUrls: string[] } {
  const $ = cheerio.load(html);
  const container = $("#objekt-content").length
    ? $("#objekt-content")
    : $(".page-intro");
  if (!container.length)
    throw new Error("Official page is missing facility content");
  const selected = new Set<string>();
  const tabId = new URL(url).searchParams.get("tab");
  if (tabId && /^\d+$/.test(tabId)) selected.add(`objekt-tab${tabId}-pane`);
  $(".nav-link").each((_, el) => {
    if (/radno vrijeme|obavijesti/i.test($(el).text())) {
      const target = $(el).attr("data-bs-target");
      if (target?.startsWith("#")) selected.add(target.slice(1));
    }
  });
  if (!tabId)
    container.children(".tab-pane.active").each((_, el) => {
      const id = $(el).attr("id");
      if (id) selected.add(id);
    });
  const root = $("<div></div>");
  const panes = container.children(".tab-pane");
  if (panes.length) {
    panes.each((_, el) => {
      if (selected.has($(el).attr("id") ?? "")) root.append($(el).clone());
    });
    if (!root.children().length)
      throw new Error("Official page is missing schedule tabs");
  } else {
    // Svetice publishes its timetable link in a standalone article, without tabs.
    root.append(container.clone());
  }
  root
    .find("script,style,nav,footer,iframe,.event-calendar,.cjenik-wrapper")
    .remove();
  const pdfUrls = root
    .find("a[href]")
    .filter((_, el) => /radno vrijeme.*(bazen|građanstvo)/i.test($(el).text()))
    .map((_, el) => new URL($(el).attr("href")!, url).href)
    .get()
    .filter((href) => /\.pdf(?:\?|$)/i.test(href));
  root.find("table").each((_, table) => {
    const rows = $(table)
      .find("tr")
      .map((_, row) =>
        $(row)
          .children("th,td")
          .map((_, cell) => {
            const attrs = ["rowspan", "colspan"]
              .filter((a) => $(cell).attr(a))
              .map((a) => `${a}=${$(cell).attr(a)}`)
              .join(" ");
            return `${$(cell).text().replace(/\s+/g, " ").trim() || "(empty)"}${attrs ? ` [${attrs}]` : ""}`;
          })
          .get()
          .join(" | "),
      )
      .get();
    $(table).replaceWith(
      $("<pre></pre>").text(`\nTABLE\n${rows.join("\n")}\nEND TABLE\n`),
    );
  });
  root.find("br").replaceWith("\n");
  root.find("p,li,h1,h2,h3,h4").append("\n");
  const text = normalizeSource(root.text());
  if (text.length > 50_000)
    throw new Error(
      "Schedule content exceeds extraction limit; refusing to silently truncate",
    );
  return { text, pdfUrls: [...new Set(pdfUrls)].sort() };
}
async function pdfText(bytes: Uint8Array) {
  // Lazy import keeps PDF/canvas work out of app startup and non-PDF requests.
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const task = pdfjs.getDocument({ data: bytes, useSystemFonts: true });
  const doc = await task.promise;
  try {
    if (doc.numPages > 12) throw new Error("Unexpectedly long timetable PDF");
    const pages: string[] = [];
    for (let n = 1; n <= doc.numPages; n++) {
      const page = await doc.getPage(n),
        content = await page.getTextContent();
      pages.push(
        content.items
          .map((item) =>
            "str" in item ? item.str + (item.hasEOL ? "\n" : " | ") : "",
          )
          .join(""),
      );
    }
    return pages.join("\n");
  } finally {
    await task.destroy();
  }
}
export async function scrapePoolContent(url: string): Promise<string> {
  const { text, pdfUrls } = extractPageContent(
    new TextDecoder().decode(await sourceResponse(url)),
    url,
  );
  const documents = await Promise.all(
    pdfUrls
      .slice(0, 3)
      .map(
        async (href) =>
          `OFFICIAL CITIZEN HOURS PDF:\n${normalizeSource(await pdfText(await sourceResponse(href)))}`,
      ),
  );
  // Hash semantic text, not HTML, PDF metadata, URLs or cache-busting query strings.
  const result = `OFFICIAL FACILITY TAB CONTENT:\n${text}\n${documents.join("\n")}`;
  if (result.length > 100_000)
    throw new Error("Combined timetable exceeds extraction limit");
  if (!/\d{1,2}[:.]\d{2}|zatvoren|ne radi/i.test(result))
    throw new Error("No timetable or closure found on official source");
  return result;
}

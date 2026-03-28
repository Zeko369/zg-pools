import * as cheerio from "cheerio";

export interface Pool {
  id: string;
  name: string;
  url: string;
}

export const POOLS: Pool[] = [
  {
    id: "sportski-park-mladost",
    name: "Sportski Park Mladost",
    url: "https://www.sportskiobjekti.hr/sportski-park-mladost/1345?tab=1355",
  },
  {
    id: "bazenski-kompleks-utrina",
    name: "Bazenski Kompleks Utrina",
    url: "https://www.sportskiobjekti.hr/bazenski-kompleks-utrina/1368",
  },
  {
    id: "zimsko-plivaliste-mladost",
    name: "Zimsko Plivalište Mladost",
    url: "https://www.sportskiobjekti.hr/zimsko-plivaliste-mladost/1369?tab=1493",
  },
  {
    id: "bazenski-kompleks-svetice",
    name: "Bazenski Kompleks Svetice",
    url: "https://www.sportskiobjekti.hr/sportsko-rekreacijski-centar-svetice-i-bazenski-kompleks-svetice/1358?tab=1366",
  },
];

export async function scrapePoolContent(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status}`);
  }

  const html = await response.text();
  const $ = cheerio.load(html);

  const content = $("#objekt-content");

  if (!content.length) {
    throw new Error("Could not find #objekt-content on page");
  }

  // Get the text content, preserving some structure
  const textContent = content
    .find("*")
    .map((_, el) => {
      const $el = $(el);
      if (
        $el.is("h1, h2, h3, h4, h5, h6") ||
        $el.is("p") ||
        $el.is("li") ||
        $el.is("td, th") ||
        $el.is("div.alert, div.notice") ||
        $el.is("strong, b") // Important notices are often in bold
      ) {
        return $el.text().trim();
      }
      return null;
    })
    .get()
    .filter(Boolean)
    .join("\n");

  // Also get the raw HTML for tables which contain schedule info
  const tables = content
    .find("table")
    .map((_, el) => $(el).text().trim())
    .get()
    .join("\n\n");

  return `${textContent}\n\nTables:\n${tables}`;
}

export interface DayInfo {
  name: string;
  date: string;
}

export interface WeekDates {
  monday: string;
  sunday: string;
  days: DayInfo[];
}

export interface WeekInfo {
  currentWeek: WeekDates;
  nextWeek: WeekDates;
}

const DAY_NAMES = [
  "Ponedjeljak",
  "Utorak",
  "Srijeda",
  "Četvrtak",
  "Petak",
  "Subota",
  "Nedjelja",
];

export function getWeekDates(): WeekInfo {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;

  const currentMonday = new Date(now);
  currentMonday.setDate(now.getDate() + diffToMonday);

  const nextMonday = new Date(currentMonday);
  nextMonday.setDate(currentMonday.getDate() + 7);

  const format = (date: Date) =>
    date.toLocaleDateString("hr-HR", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });

  const getWeekDays = (monday: Date): DayInfo[] => {
    return DAY_NAMES.map((name, i) => {
      const day = new Date(monday);
      day.setDate(monday.getDate() + i);
      return { name, date: format(day) };
    });
  };

  const currentDays = getWeekDays(currentMonday);
  const nextDays = getWeekDays(nextMonday);

  return {
    currentWeek: {
      monday: currentDays[0].date,
      sunday: currentDays[6].date,
      days: currentDays,
    },
    nextWeek: {
      monday: nextDays[0].date,
      sunday: nextDays[6].date,
      days: nextDays,
    },
  };
}

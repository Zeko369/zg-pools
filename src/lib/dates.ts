export const TIME_ZONE = "Europe/Zagreb";
export const DAY_NAMES = [
  "Ponedjeljak",
  "Utorak",
  "Srijeda",
  "Četvrtak",
  "Petak",
  "Subota",
  "Nedjelja",
];
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
export function zagrebDate(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}
export function formatDate(date: Date) {
  return `${String(date.getUTCDate()).padStart(2, "0")}.${String(date.getUTCMonth() + 1).padStart(2, "0")}.${date.getUTCFullYear()}`;
}
export function parseDate(value: string): Date {
  const [day, month, year] = value.split(".").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}
export function getWeekDates(now = new Date()): WeekInfo {
  const base = new Date(`${zagrebDate(now)}T12:00:00Z`);
  base.setUTCDate(base.getUTCDate() - ((base.getUTCDay() + 6) % 7));
  const makeWeek = (offset: number): WeekDates => {
    const days = DAY_NAMES.map((name, index) => {
      const d = new Date(base);
      d.setUTCDate(d.getUTCDate() + offset + index);
      return { name, date: formatDate(d) };
    });
    return { monday: days[0].date, sunday: days[6].date, days };
  };
  return { currentWeek: makeWeek(0), nextWeek: makeWeek(7) };
}
const FIXED: Record<string, string> = {
  "01.01.": "Nova godina",
  "06.01.": "Sveta tri kralja",
  "01.05.": "Praznik rada",
  "30.05.": "Dan državnosti",
  "22.06.": "Dan antifašističke borbe",
  "05.08.": "Dan pobjede",
  "15.08.": "Velika Gospa",
  "01.11.": "Svi sveti",
  "18.11.": "Dan sjećanja",
  "25.12.": "Božić",
  "26.12.": "Sveti Stjepan",
};
export function holidayForDate(date: string): string | null {
  if (FIXED[date.slice(0, 6)]) return FIXED[date.slice(0, 6)];
  const year = parseDate(date).getUTCFullYear();
  // Gregorian Easter (Meeus/Jones/Butcher), then Easter Monday and Corpus Christi.
  const a = year % 19,
    b = Math.floor(year / 100),
    c = year % 100;
  const d = Math.floor(b / 4),
    e = b % 4,
    f = Math.floor((b + 8) / 25),
    g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30,
    i = Math.floor(c / 4),
    k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7,
    m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31),
    day = ((h + l - 7 * m + 114) % 31) + 1;
  for (const [offset, name] of [
    [0, "Uskrs"],
    [1, "Uskrsni ponedjeljak"],
    [60, "Tijelovo"],
  ] as const) {
    const candidate = new Date(Date.UTC(year, month - 1, day + offset));
    if (formatDate(candidate) === date) return name;
  }
  return null;
}

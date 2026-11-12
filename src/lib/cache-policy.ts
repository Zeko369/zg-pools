import { zagrebDate, TIME_ZONE } from "./dates";

const hour = (date: Date) =>
  Number(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: TIME_ZONE,
      hour: "2-digit",
      hourCycle: "h23",
    }).format(date),
  );

/** Allow the intentional overnight pause, but flag a stopped daytime worker. */
export function sourceCheckIsStale(checked: Date, now = new Date()) {
  if (now.getTime() - checked.getTime() <= 45 * 60_000) return false;
  const currentHour = hour(now);
  if (currentHour >= 5 && currentHour < 21) return true;
  const latestEvening = new Date(`${zagrebDate(now)}T12:00:00Z`);
  if (currentHour < 5) latestEvening.setUTCDate(latestEvening.getUTCDate() - 1);
  const expectedDate = latestEvening.toISOString().slice(0, 10);
  return (
    zagrebDate(checked) < expectedDate ||
    (zagrebDate(checked) === expectedDate && hour(checked) < 21)
  );
}

import { NextResponse } from "next/server";
import { getPoolResults, type PoolResult } from "./data";
import { POOLS } from "./pools";
import { formatDate, getWeekDates, TIME_ZONE, zagrebDate } from "./dates";
export const NO_STORE = { "Cache-Control": "no-store" };
export async function schedulesResponse(
  request: Request,
  poolId?: string,
  force = false,
) {
  const params = new URL(request.url).searchParams;
  const week = params.get("week") ?? "both",
    isoDate = params.get("date");
  if (!["current", "next", "both"].includes(week))
    return NextResponse.json(
      { error: "week must be current, next or both" },
      { status: 400 },
    );
  if (poolId && !POOLS.some((p) => p.id === poolId))
    return NextResponse.json(
      { error: "Unknown pool", available: POOLS.map((p) => p.id) },
      { status: 404 },
    );
  const weeks = getWeekDates();
  const date = isoDate
    ? /^\d{4}-\d{2}-\d{2}$/.test(isoDate)
      ? formatDate(new Date(`${isoDate}T12:00:00Z`))
      : ""
    : null;
  if (
    isoDate &&
    (!date ||
      ![...weeks.currentWeek.days, ...weeks.nextWeek.days].some(
        (d) => d.date === date,
      ))
  )
    return NextResponse.json(
      {
        error: "date must be an ISO date within the current or next week",
        weeks,
      },
      { status: 400 },
    );
  const results = await getPoolResults({ force, poolId });
  const serialize = (result: PoolResult) => {
    if (!result.data) return result;
    const { availability, ...rest } = result.data;
    const selected =
      date ??
      (params.get("compact") === "true"
        ? formatDate(new Date(`${zagrebDate()}T12:00:00Z`))
        : null);
    if (selected)
      return {
        ...result,
        data: {
          ...rest,
          availability: {
            poolName: availability.poolName,
            day: [
              ...availability.currentWeek.days,
              ...availability.nextWeek.days,
            ].find((d) => d.date === selected),
            alerts: availability.alerts,
            alertsEn: availability.alertsEn,
            notices: availability.notices,
            noticesEn: availability.noticesEn,
          },
        },
      };
    return {
      ...result,
      data: {
        ...rest,
        availability: {
          poolName: availability.poolName,
          ...(week !== "next" ? { currentWeek: availability.currentWeek } : {}),
          ...(week !== "current" ? { nextWeek: availability.nextWeek } : {}),
          alerts: availability.alerts,
          alertsEn: availability.alertsEn,
          notices: availability.notices,
          noticesEn: availability.noticesEn,
        },
      },
    };
  };
  const success = results.filter((r) => r.data).length;
  return NextResponse.json(
    {
      timezone: TIME_ZONE,
      generatedAt: new Date().toISOString(),
      partial: results.some((r) => !r.data || r.data.stale),
      results: results.map(serialize),
    },
    { status: success ? 200 : 503, headers: NO_STORE },
  );
}

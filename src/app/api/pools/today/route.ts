import { NextResponse } from "next/server";
import { POOLS } from "@/lib/pools";
import { getPoolData } from "@/lib/data";

export const dynamic = "force-dynamic";

/**
 * GET /api/pools/today
 * Quick endpoint: returns today's schedule for all pools.
 * Designed for bot/assistant use — minimal, actionable output.
 */
export async function GET() {
  const now = new Date();
  const dayNames = [
    "Nedjelja",
    "Ponedjeljak",
    "Utorak",
    "Srijeda",
    "Četvrtak",
    "Petak",
    "Subota",
  ];
  const todayName = dayNames[now.getDay()];
  const todayDate = now.toLocaleDateString("hr-HR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

  try {
    const results = await Promise.all(
      POOLS.map(async (pool) => {
        const data = await getPoolData(pool.id);
        const todaySchedule = data.availability.currentWeek.days.find(
          (d) => d.day === todayName
        );

        if (!todaySchedule || todaySchedule.pools.length === 0) {
          return {
            name: pool.name,
            status: todaySchedule?.isHoliday ? "closed_holiday" : "closed",
            holidayName: todaySchedule?.holidayName,
            slots: [],
          };
        }

        return {
          name: pool.name,
          status: "open",
          slots: todaySchedule.pools.flatMap((p) =>
            p.slots.map((s) => ({
              pool: p.poolType,
              hours: s.hours,
              lanes: s.lanes,
            }))
          ),
        };
      })
    );

    return NextResponse.json({
      date: todayDate,
      day: todayName,
      pools: results,
    });
  } catch (error) {
    console.error("Error fetching today's pools:", error);
    return NextResponse.json(
      { error: "Failed to fetch today's pool data" },
      { status: 500 }
    );
  }
}

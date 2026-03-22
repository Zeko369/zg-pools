import { NextResponse } from "next/server";
import { POOLS } from "@/lib/pools";
import { getPoolData } from "@/lib/data";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const week = searchParams.get("week") || "current"; // "current" | "next" | "both"
  const compact = searchParams.get("compact") === "true"; // minimal output for bot use

  try {
    const allData = await Promise.all(
      POOLS.map(async (pool) => {
        const data = await getPoolData(pool.id);

        if (compact) {
          // Compact mode: just today's schedule + alerts
          const today = new Date().toLocaleDateString("hr-HR", {
            weekday: "long",
          });
          const todaySchedule =
            data.availability.currentWeek.days.find((d) => {
              const dayMap: Record<string, string> = {
                ponedjeljak: "Ponedjeljak",
                utorak: "Utorak",
                srijeda: "Srijeda",
                četvrtak: "Četvrtak",
                petak: "Petak",
                subota: "Subota",
                nedjelja: "Nedjelja",
              };
              return d.day === dayMap[today.toLowerCase()];
            }) ?? null;

          return {
            id: pool.id,
            name: pool.name,
            today: todaySchedule,
            alerts: data.availability.alerts,
          };
        }

        const result: Record<string, unknown> = {
          id: pool.id,
          name: pool.name,
          url: pool.url,
          fetchedAt: data.fetchedAt,
          alerts: data.availability.alerts,
          notices: data.availability.notices,
        };

        if (week === "current" || week === "both") {
          result.currentWeek = data.availability.currentWeek;
        }
        if (week === "next" || week === "both") {
          result.nextWeek = data.availability.nextWeek;
        }

        return result;
      })
    );

    return NextResponse.json({ pools: allData });
  } catch (error) {
    console.error("Error fetching pools:", error);
    return NextResponse.json(
      { error: "Failed to fetch pool data" },
      { status: 500 }
    );
  }
}

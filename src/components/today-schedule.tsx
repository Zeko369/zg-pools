"use client";

import { Badge } from "@/components/ui/badge";
import type { PoolType, WeekSchedule, DaySchedule } from "@/lib/ai";

const POOL_TYPE_LABELS: Record<PoolType, string> = {
  olympic: "Olimpijski/Veliki",
  small: "Mali",
};

function isTodayDate(dateStr: string): boolean {
  const match = dateStr.match(/(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})/);
  if (!match) return false;

  const now = new Date();
  return (
    parseInt(match[1]) === now.getDate() &&
    parseInt(match[2]) === now.getMonth() + 1 &&
    parseInt(match[3]) === now.getFullYear()
  );
}

function findTodaySchedule(schedule: WeekSchedule): DaySchedule | null {
  return schedule.days.find((day) => isTodayDate(day.date)) ?? null;
}

function parseTimeRange(
  hours: string,
): { start: number; end: number } | null {
  const match = hours.match(/(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})/);
  if (!match) return null;
  return {
    start: parseInt(match[1]) * 60 + parseInt(match[2]),
    end: parseInt(match[3]) * 60 + parseInt(match[4]),
  };
}

type SlotStatus = "active" | "next" | "past" | "future";

function getSlotStatus(
  hours: string,
  nowMinutes: number,
): "active" | "past" | "future" {
  const range = parseTimeRange(hours);
  if (!range) return "future";
  if (nowMinutes >= range.start && nowMinutes < range.end) return "active";
  if (nowMinutes >= range.end) return "past";
  return "future";
}

export function TodaySchedule({
  schedule,
  poolFilter,
}: {
  schedule: WeekSchedule;
  poolFilter: PoolType | "all";
}) {
  const today = findTodaySchedule(schedule);

  if (!today) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        Današnji raspored nije dostupan u ovom tjednu.
      </div>
    );
  }

  const now = new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  const filteredPools =
    poolFilter === "all"
      ? today.pools
      : today.pools.filter((p) => p.poolType === poolFilter);

  if (today.isHoliday && filteredPools.length === 0) {
    return (
      <div className="text-center py-8">
        <Badge variant="outline" className="text-base px-4 py-2">
          {today.holidayName || "Blagdan"} — Zatvoreno
        </Badge>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <span className="font-medium">{today.day}</span>
        <span className="text-sm text-muted-foreground">{today.date}</span>
        {today.isHoliday && (
          <Badge variant="outline">{today.holidayName || "Blagdan"}</Badge>
        )}
      </div>

      {filteredPools.length === 0 ? (
        <div className="text-sm text-muted-foreground">
          Nema rasporeda za danas.
        </div>
      ) : (
        <div className="space-y-4">
          {filteredPools.map((pool, j) => {
            let foundNext = false;
            return (
              <div key={j} className="space-y-2">
                <div className="text-sm font-medium text-muted-foreground">
                  {POOL_TYPE_LABELS[pool.poolType]}
                </div>
                <div className="grid gap-2">
                  {pool.slots.map((slot, k) => {
                    let status: SlotStatus = getSlotStatus(
                      slot.hours,
                      nowMinutes,
                    );
                    if (status === "future" && !foundNext) {
                      status = "next";
                      foundNext = true;
                    }

                    return (
                      <div
                        key={k}
                        className={`rounded-lg border p-3 ${
                          status === "active"
                            ? "border-green-500 bg-green-500/10"
                            : status === "next"
                              ? "border-blue-500/50 bg-blue-500/5"
                              : status === "past"
                                ? "opacity-50"
                                : ""
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-medium">
                            {slot.hours}
                          </span>
                          {status === "active" && (
                            <Badge className="bg-green-600 text-white">
                              Sada
                            </Badge>
                          )}
                          {status === "next" && (
                            <Badge
                              variant="outline"
                              className="border-blue-500 text-blue-600"
                            >
                              Sljedeće
                            </Badge>
                          )}
                        </div>
                        {slot.lanes && (
                          <span className="text-xs text-muted-foreground mt-1 block">
                            {slot.lanes}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

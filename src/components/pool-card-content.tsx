"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useViewMode } from "@/components/view-mode";
import { TodaySchedule } from "@/components/today-schedule";
import type { PoolData } from "@/lib/data";
import type { PoolType, WeekSchedule } from "@/lib/ai";

interface PoolCardContentProps {
  data: PoolData;
}

const POOL_TYPE_LABELS: Record<PoolType, string> = {
  olympic: "Olimpijski/Veliki",
  small: "Mali",
};

function ScheduleTable({
  schedule,
  poolFilter,
}: {
  schedule: WeekSchedule;
  poolFilter: PoolType | "all";
}) {
  const filteredDays = schedule.days.map((day) => ({
    ...day,
    pools:
      poolFilter === "all"
        ? day.pools
        : day.pools.filter((p) => p.poolType === poolFilter),
  }));

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-[160px]">Dan</TableHead>
          <TableHead>Raspored</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {filteredDays.map((day, i) => (
          <TableRow key={i} className={day.isHoliday ? "bg-muted/50" : ""}>
            <TableCell className="font-medium align-top">
              <div>
                <span>{day.day}</span>
                <span className="text-xs text-muted-foreground ml-2">
                  {day.date}
                </span>
              </div>
              {day.isHoliday && (
                <Badge variant="outline" className="mt-1 text-xs">
                  {day.holidayName || "Blagdan"}
                </Badge>
              )}
            </TableCell>
            <TableCell>
              {day.isHoliday && day.pools.length === 0 ? (
                <span className="text-xs text-muted-foreground">Zatvoreno</span>
              ) : (
                <div className="space-y-2">
                  {day.pools.map((pool, j) => (
                    <div key={j} className="space-y-1">
                      {pool.slots.map((slot, k) => (
                        <div
                          key={k}
                          className="flex flex-wrap items-center gap-2"
                        >
                          <Badge
                            variant="secondary"
                            className="text-xs font-mono"
                          >
                            {slot.hours}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {POOL_TYPE_LABELS[pool.poolType]}
                            {slot.lanes && ` · ${slot.lanes}`}
                          </span>
                        </div>
                      ))}
                    </div>
                  ))}
                  {day.pools.length === 0 && !day.isHoliday && (
                    <span className="text-xs text-muted-foreground">-</span>
                  )}
                </div>
              )}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

export function PoolCardContent({ data }: PoolCardContentProps) {
  const { pool, availability, fetchedAt } = data;
  const { viewMode } = useViewMode();
  const [noticesOpen, setNoticesOpen] = useState(false);
  const [selectedWeek, setSelectedWeek] = useState<"current" | "next">(
    "current",
  );
  const [poolFilter, setPoolFilter] = useState<PoolType | "all">("all");

  const hasNotices = availability.notices && availability.notices.length > 0;
  const currentSchedule =
    selectedWeek === "current"
      ? availability.currentWeek
      : availability.nextWeek;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-xl">{pool.name}</CardTitle>
            <CardDescription>
              Ažurirano: {new Date(fetchedAt).toLocaleString("hr-HR")}
            </CardDescription>
          </div>
          <a
            href={pool.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-muted-foreground hover:underline"
          >
            Izvor →
          </a>
        </div>
        {availability.alerts.length > 0 && (
          <div className="mt-4 space-y-2">
            {availability.alerts.map((alert, i) => (
              <div
                key={i}
                className="rounded-md bg-destructive/10 p-3 text-sm text-destructive"
              >
                ⚠️ {alert}
              </div>
            ))}
          </div>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {viewMode === "week" && (
            <div className="flex gap-1">
              <Button
                variant={selectedWeek === "current" ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedWeek("current")}
              >
                Ovaj tjedan
              </Button>
              <Button
                variant={selectedWeek === "next" ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedWeek("next")}
              >
                Sljedeći tjedan
              </Button>
            </div>
          )}
          <div className="flex gap-1 ml-auto">
            <Button
              variant={poolFilter === "all" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setPoolFilter("all")}
            >
              Svi
            </Button>
            <Button
              variant={poolFilter === "olympic" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setPoolFilter("olympic")}
            >
              Olimpijski
            </Button>
            <Button
              variant={poolFilter === "small" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setPoolFilter("small")}
            >
              Mali
            </Button>
          </div>
        </div>

        {viewMode === "today" ? (
          <TodaySchedule
            schedule={availability.currentWeek}
            poolFilter={poolFilter}
          />
        ) : (
          <>
            <div className="text-xs text-muted-foreground">
              {currentSchedule.weekStart} - {currentSchedule.weekEnd}
            </div>
            <ScheduleTable schedule={currentSchedule} poolFilter={poolFilter} />
          </>
        )}

        {hasNotices && (
          <Collapsible open={noticesOpen} onOpenChange={setNoticesOpen}>
            <CollapsibleTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-between"
              >
                <span>Dodatne informacije ({availability.notices.length})</span>
                <ChevronDown
                  className={`h-4 w-4 transition-transform ${noticesOpen ? "rotate-180" : ""}`}
                />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-2 space-y-2">
              {availability.notices.map((notice, i) => (
                <div
                  key={i}
                  className="rounded-md bg-muted p-3 text-sm text-muted-foreground"
                >
                  {notice}
                </div>
              ))}
            </CollapsibleContent>
          </Collapsible>
        )}

        {availability._debug && (
          <Collapsible>
            <CollapsibleTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-between text-orange-600"
              >
                <span>🐛 Debug: Raw AI Output</span>
                <ChevronDown className="h-4 w-4" />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-2 space-y-4">
              <div>
                <h4 className="text-sm font-medium mb-2">
                  Weekly Schedule (from table):
                </h4>
                <pre className="rounded-md bg-muted p-3 text-xs overflow-auto max-h-64">
                  {JSON.stringify(availability._debug.weeklySchedule, null, 2)}
                </pre>
              </div>
              <div>
                <h4 className="text-sm font-medium mb-2">
                  Overrides (from notices):
                </h4>
                <pre className="rounded-md bg-muted p-3 text-xs overflow-auto max-h-64">
                  {JSON.stringify(availability._debug.overrides, null, 2)}
                </pre>
              </div>
            </CollapsibleContent>
          </Collapsible>
        )}
      </CardContent>
    </Card>
  );
}

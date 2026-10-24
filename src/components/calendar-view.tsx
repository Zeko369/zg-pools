"use client";
import type { CSSProperties } from "react";
import { X, ExternalLink, Clock3, Layers } from "lucide-react";
import type { Pool } from "@/lib/pools";
import type { PoolResult } from "@/lib/data";
import type { PoolType } from "@/lib/ai";
import { parseDate, type WeekDates } from "@/lib/dates";
import { overlapPlacement } from "@/lib/calendar-layout";
import { poolColorStyle } from "@/lib/pool-colors";
import { dayOf, StateLabel, TYPE_LABELS } from "./schedule-views";

export interface CalendarSlot {
  id: string;
  pool: Pool;
  date: string;
  dayName: string;
  poolType: PoolType;
  hours: string;
  lanes?: string;
  reason?: string;
}
function toMinute(time: string) {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}
export function CalendarView({
  pools,
  results,
  week,
  type,
  today,
  loading,
  overlap,
  highlightedPool,
  selectedSlot,
  onSelectSlot,
  onHighlight,
}: {
  pools: Pool[];
  results: PoolResult[];
  week: WeekDates;
  type: PoolType | "all";
  today: string;
  loading: boolean;
  overlap: boolean;
  highlightedPool: string | null;
  selectedSlot: CalendarSlot | null;
  onSelectSlot: (slot: CalendarSlot | null) => void;
  onHighlight: (id: string | null) => void;
}) {
  const slotsForDay = (date: string, dayName: string): CalendarSlot[] =>
    pools.flatMap((pool) => {
      const day = dayOf(
        results.find((r) => r.pool.id === pool.id),
        date,
      );
      return (
        day?.pools
          .filter((group) => type === "all" || group.poolType === type)
          .flatMap((group) =>
            group.slots.map((slot, i) => ({
              id: `${pool.id}-${date}-${group.poolType}-${i}`,
              pool,
              date,
              dayName,
              poolType: group.poolType,
              ...slot,
              reason: day.reason,
            })),
          ) ?? []
      );
    });
  const days = week.days.map((info) => ({
    ...info,
    slots: slotsForDay(info.date, info.name),
  }));
  const intervals = days.flatMap((day) =>
    day.slots.map((slot) => slot.hours.split(" - ").map(toMinute)),
  );
  const start =
    Math.floor(Math.min(360, ...intervals.map((i) => i[0])) / 60) * 60;
  const end =
    Math.ceil(Math.max(1320, ...intervals.map((i) => i[1])) / 60) * 60;
  const hours = (end - start) / 60;
  const activePools = pools.filter((pool) =>
    days.some((day) => day.slots.some((slot) => slot.pool.id === pool.id)),
  );
  const singleTypes = [
    ...new Set(days.flatMap((day) => day.slots.map((slot) => slot.poolType))),
  ];
  // A separate rail per facility/type keeps identical small/large-pool hours
  // reachable instead of painting them at exactly the same coordinates.
  const overlapTracks = activePools.flatMap((pool) =>
    singleTypes
      .filter((poolType) =>
        days.some((day) =>
          day.slots.some(
            (slot) => slot.pool.id === pool.id && slot.poolType === poolType,
          ),
        ),
      )
      .map((poolType) => `${pool.id}:${poolType}`),
  );
  const minWidth = overlap
    ? 950
    : Math.max(720, 58 + 7 * Math.max(1, singleTypes.length) * 90);
  return (
    <section
      className={`week-calendar ${overlap ? "overlap-calendar" : ""}`}
      onKeyDown={(event) => {
        if (event.key === "Escape") onSelectSlot(null);
      }}
      aria-label={
        overlap
          ? "Tjedni kalendar: svi objekti"
          : `Tjedni kalendar: ${pools[0]?.shortName ?? "bazeni"}`
      }
    >
      {overlap && (
        <div className="overlap-intro">
          <Layers size={15} />
          <span>{pools.length} objekata u jednom kalendaru</span>
          <small>Prijeđi preko termina za pregled · klikni za detalje</small>
        </div>
      )}
      <div
        className="calendar-scroll"
        tabIndex={0}
        aria-label="Tjedni raspored; pomaknite vodoravno za ostale dane"
      >
        <div className="calendar-inner" style={{ minWidth }}>
          <div className="calendar-day-head">
            <div className="time-zone">SATI</div>
            {days.map((info) => (
              <div
                key={info.date}
                className={`day-heading ${parseDate(info.date).toISOString().startsWith(today) ? "is-today" : ""}`}
              >
                <span>{info.name.slice(0, 3)}</span>
                <b>{info.date.slice(0, 2)}</b>
              </div>
            ))}
          </div>
          <div
            className="time-canvas"
            style={{ backgroundSize: `100% ${100 / hours}%` }}
          >
            <div className="time-axis">
              {Array.from({ length: hours + 1 }, (_, i) => (
                <span key={i} style={{ top: `${(i / hours) * 100}%` }}>
                  {String(i + start / 60).padStart(2, "0")}:00
                </span>
              ))}
            </div>
            {days.map((info) => {
              const singleDay = dayOf(
                results.find((r) => r.pool.id === pools[0]?.id),
                info.date,
              );
              const allClosed =
                pools.length > 0 &&
                pools.every(
                  (pool) =>
                    dayOf(
                      results.find((r) => r.pool.id === pool.id),
                      info.date,
                    )?.status === "closed",
                );
              return (
                <div
                  className={`time-day ${parseDate(info.date).toISOString().startsWith(today) ? "is-today" : ""}`}
                  key={info.date}
                >
                  {info.slots.map((slot) => {
                    const [from, to] = slot.hours.split(" - ").map(toMinute);
                    const y = Math.max(start, from),
                      bottom = Math.min(end, to);
                    if (bottom <= y) return null;
                    const index = overlap
                      ? overlapTracks.indexOf(
                          `${slot.pool.id}:${slot.poolType}`,
                        )
                      : singleTypes.indexOf(slot.poolType);
                    const count = overlap
                      ? overlapTracks.length
                      : singleTypes.length;
                    const position = overlap
                      ? overlapPlacement(index, count)
                      : { left: (index / count) * 100, width: 100 / count };
                    const selected = selectedSlot?.id === slot.id;
                    return (
                      <button
                        type="button"
                        key={slot.id}
                        data-pool-id={slot.pool.id}
                        className={`swim-event ${bottom - y <= 60 ? "compact-event" : ""} ${bottom - y < 40 ? "short-event" : ""} ${selected ? "event-selected" : ""} ${highlightedPool && highlightedPool !== slot.pool.id ? "event-muted" : ""} ${highlightedPool === slot.pool.id ? "event-highlighted" : ""}`}
                        aria-label={`${slot.pool.shortName}, ${slot.dayName} ${slot.date}, ${TYPE_LABELS[slot.poolType]}, ${slot.hours}`}
                        aria-pressed={selected}
                        onClick={() => onSelectSlot(selected ? null : slot)}
                        onMouseEnter={() => onHighlight(slot.pool.id)}
                        onMouseLeave={() => onHighlight(null)}
                        onFocus={() => onHighlight(slot.pool.id)}
                        onBlur={() => onHighlight(null)}
                        title={`${slot.pool.shortName} · ${TYPE_LABELS[slot.poolType]} · ${slot.hours}${slot.lanes ? ` · ${slot.lanes}` : ""}`}
                        style={
                          {
                            ...poolColorStyle(slot.pool.color),
                            top: `${((y - start) / (end - start)) * 100}%`,
                            height: `${((bottom - y) / (end - start)) * 100}%`,
                            left: `calc(${position.left}% + 3px)`,
                            width: `calc(${position.width}% - 6px)`,
                            "--event-layer": index + 1,
                          } as CSSProperties
                        }
                      >
                        <strong>{slot.pool.shortName}</strong>
                        <span>{slot.hours.replace(" - ", "–")}</span>
                        <small>{TYPE_LABELS[slot.poolType]}</small>
                        {slot.lanes && <small>{slot.lanes}</small>}
                      </button>
                    );
                  })}
                  {!info.slots.length && (
                    <div className="no-event">
                      <StateLabel
                        day={
                          overlap
                            ? allClosed
                              ? { status: "closed" }
                              : undefined
                            : singleDay?.status === "open"
                              ? undefined
                              : singleDay
                        }
                        loading={loading}
                      />
                    </div>
                  )}
                  {singleDay?.holidayName && (
                    <span className="holiday-tag">{singleDay.holidayName}</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
      {selectedSlot && (
        <div
          className="slot-detail"
          style={poolColorStyle(selectedSlot.pool.color)}
          role="region"
          aria-label="Detalji termina"
        >
          <div className="slot-detail-heading">
            <i className="color-dot" />
            <strong>{selectedSlot.pool.shortName}</strong>
            <span>
              {selectedSlot.dayName} · {selectedSlot.date}
            </span>
            <button
              aria-label="Zatvori detalje termina"
              onClick={() => onSelectSlot(null)}
            >
              <X size={16} />
            </button>
          </div>
          <div className="slot-detail-body">
            <span>
              <Clock3 size={15} />
              {selectedSlot.hours}
            </span>
            <span>{TYPE_LABELS[selectedSlot.poolType]}</span>
            {selectedSlot.lanes && <span>{selectedSlot.lanes}</span>}
            <a href={selectedSlot.pool.url} target="_blank" rel="noreferrer">
              Službeni raspored <ExternalLink size={13} />
            </a>
          </div>
          {selectedSlot.reason && <p>{selectedSlot.reason}</p>}
        </div>
      )}
      <div className="calendar-legend">
        {pools.map((pool) => (
          <button
            key={pool.id}
            style={poolColorStyle(pool.color)}
            onMouseEnter={() => onHighlight(pool.id)}
            onMouseLeave={() => onHighlight(null)}
            onFocus={() => onHighlight(pool.id)}
            onBlur={() => onHighlight(null)}
            onClick={() => onHighlight(pool.id)}
            aria-pressed={highlightedPool === pool.id}
          >
            <i className="color-dot" />
            {pool.shortName}
          </button>
        ))}
        {!pools.length && (
          <span>Odaberi barem jedan objekt s desne strane.</span>
        )}
      </div>
    </section>
  );
}

"use client";
import { ExternalLink, Waves, Clock3 } from "lucide-react";
import type { Pool } from "@/lib/pools";
import type { PoolResult } from "@/lib/data";
import type { DaySchedule, PoolType } from "@/lib/ai";
import { poolColorStyle } from "@/lib/pool-colors";

export const TYPE_LABELS = {
  olympic: "Veliki bazen",
  small: "Mali / srednji bazen",
  children: "Dječji bazen",
  diving: "Bazen za skokove",
};
export function dayOf(
  result: PoolResult | undefined,
  date: string,
): DaySchedule | undefined {
  return (
    (result?.data &&
      [
        ...result.data.availability.currentWeek.days,
        ...result.data.availability.nextWeek.days,
      ].find((d) => d.date === date)) ||
    undefined
  );
}
export function StateLabel({
  day,
  loading,
}: {
  day?: Pick<DaySchedule, "status">;
  loading?: boolean;
}) {
  return (
    <span className={`state-label ${day?.status ?? "unknown"}`}>
      {loading
        ? "Učitavanje…"
        : day?.status === "closed"
          ? "Zatvoreno"
          : "Nema potvrđenih termina"}
    </span>
  );
}
export function AgendaView({
  catalog,
  results,
  date,
  loading,
  type,
}: {
  catalog: Pool[];
  results: PoolResult[];
  date: string;
  loading: boolean;
  type: PoolType | "all";
}) {
  return (
    <section className="agenda-list" aria-label="Termini po bazenima">
      {catalog.map((pool, i) => {
        const result = results.find((r) => r.pool.id === pool.id),
          day = dayOf(result, date);
        const groups =
          day?.pools.filter((p) => type === "all" || p.poolType === type) ?? [];
        return (
          <article className="agenda-item" key={pool.id}>
            <div className="agenda-number">
              {String(i + 1).padStart(2, "0")}
            </div>
            <div className="agenda-title">
              <h2>
                <i className="color-dot" style={poolColorStyle(pool.color)} />
                {pool.shortName}
              </h2>
              <p>{pool.area}</p>
              <a
                className="source-link"
                href={pool.url}
                target="_blank"
                rel="noreferrer"
              >
                Službeni raspored <ExternalLink size={12} />
              </a>
            </div>
            <div className="agenda-hours">
              {groups.length ? (
                groups.map((group) => (
                  <div className="slot-group" key={group.poolType}>
                    <span className="pool-type-label">
                      {TYPE_LABELS[group.poolType]}
                    </span>
                    <div className="time-pills">
                      {group.slots.map((slot, index) => (
                        <span
                          className="time-pill"
                          style={poolColorStyle(pool.color)}
                          key={index}
                        >
                          <Clock3 size={13} />
                          {slot.hours}
                          {slot.lanes && <small>{slot.lanes}</small>}
                        </span>
                      ))}
                    </div>
                  </div>
                ))
              ) : (
                <StateLabel
                  day={day?.status === "open" ? undefined : day}
                  loading={loading}
                />
              )}
              {day?.reason && <p className="day-reason">{day.reason}</p>}
              {result?.error && <p className="day-reason">{result.error}</p>}
              {result?.data?.stale && (
                <p className="day-reason">
                  Sačuvan raspored · zadnja provjera nije uspjela
                </p>
              )}
            </div>
          </article>
        );
      })}
      {!catalog.length && (
        <div className="empty-state">
          <Waves />
          <h2>Nema bazena za ovaj odabir</h2>
          <p>Promijenite pretragu ili uključite drugi bazen.</p>
        </div>
      )}
    </section>
  );
}

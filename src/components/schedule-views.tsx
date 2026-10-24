"use client";
import { Fragment } from "react";
import { FavoriteButton } from "./favorite-button";
import { ExternalLink, Waves, Clock3 } from "lucide-react";
import type { Pool } from "@/lib/pools";
import type { PoolResult } from "@/lib/data";
import type { DaySchedule, PoolType } from "@/lib/ai";
import { poolColorStyle } from "@/lib/pool-colors";
import { areaName, sourceText } from "@/lib/i18n";
import { useLanguage } from "./language-provider";
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
  const { t } = useLanguage();
  return (
    <span className={`state-label ${day?.status ?? "unknown"}`}>
      {loading
        ? `${t.loading}…`
        : day?.status === "closed"
          ? t.closed
          : t.noConfirmedSlots}
    </span>
  );
}
export function AgendaView({
  catalog,
  results,
  date,
  loading,
  type,
  favorites,
  onToggleFavorite,
}: {
  catalog: Pool[];
  results: PoolResult[];
  date: string;
  loading: boolean;
  type: PoolType | "all";
  favorites: string[];
  onToggleFavorite: (id: string) => void;
}) {
  const { language, t } = useLanguage();
  return (
    <section className="agenda-list" aria-label={t.agendaRegion}>
      {catalog.map((pool, i) => {
        const result = results.find((r) => r.pool.id === pool.id),
          day = dayOf(result, date);
        const groups =
          day?.pools.filter((p) => type === "all" || p.poolType === type) ?? [];
        return (
          <Fragment key={pool.id}>
            {favorites.length > 0 &&
              (i === 0 ||
                favorites.includes(catalog[i - 1].id) !==
                  favorites.includes(pool.id)) && (
                <h2 className="agenda-group-heading">
                  {favorites.includes(pool.id) ? t.favoritePools : t.otherPools}
                </h2>
              )}
            <article className="agenda-item" data-pool-id={pool.id}>
              <div className="agenda-number">
                <FavoriteButton
                  pool={pool}
                  favorite={favorites.includes(pool.id)}
                  onToggle={() => onToggleFavorite(pool.id)}
                />
              </div>
              <div className="agenda-title">
                <h2>
                  <i className="color-dot" style={poolColorStyle(pool.color)} />
                  {pool.shortName}
                </h2>
                <p>{areaName(pool.area, language)}</p>
                <a
                  className="source-link"
                  href={pool.url}
                  target="_blank"
                  rel="noreferrer"
                >
                  {t.officialSchedule} <ExternalLink size={12} />
                </a>
              </div>
              <div className="agenda-hours">
                {groups.length ? (
                  groups.map((group) => (
                    <div className="slot-group" key={group.poolType}>
                      <span className="pool-type-label">
                        {t.poolTypes[group.poolType]}
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
                            {slot.lanes && (
                              <small>
                                {sourceText(slot.lanes, slot.lanesEn, language)}
                              </small>
                            )}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))
                ) : (
                  <StateLabel
                    day={day?.status === "open" ? undefined : day}
                    loading={loading && !result}
                  />
                )}
                {day?.reason && (
                  <p className="day-reason">
                    {sourceText(day.reason, day.reasonEn, language)}
                  </p>
                )}
                {result?.error && (
                  <p className="day-reason">{t.sourceUnavailable}</p>
                )}
                {result?.data?.stale && <p className="day-reason">{t.stale}</p>}
              </div>
            </article>
          </Fragment>
        );
      })}
      {!catalog.length && (
        <div className="empty-state">
          <Waves />
          <h2>{t.noPools}</h2>
          <p>{t.changeSearch}</p>
        </div>
      )}
    </section>
  );
}

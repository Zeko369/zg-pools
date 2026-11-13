"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  ArrowUpRight,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Info,
  Layers,
  List,
  MoreHorizontal,
  RefreshCw,
  Star,
  Waves,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { revalidatePools } from "@/lib/actions";
import type { Pool } from "@/lib/pools";
import type { PoolResult } from "@/lib/data";
import type { PoolType } from "@/lib/ai";
import { parseDate, zagrebDate, type WeekInfo } from "@/lib/dates";
import { AgendaView, dayOf } from "./schedule-views";
import {
  areaName,
  LOCALES,
  sourceTexts,
  weekday,
  weekLabel,
  type NoticeKey,
} from "@/lib/i18n";
import { useLanguage } from "./language-provider";
import { LanguageSwitcher } from "./language-switcher";
import { ThemeSwitcher } from "./theme-switcher";

import { CalendarView, type CalendarSlot } from "./calendar-view";
import { poolColorStyle } from "@/lib/pool-colors";
import { useFavoritePools } from "./use-favorite-pools";
import { FavoriteButton } from "./favorite-button";

type Mode = "calendar" | "agenda";
const scheduleCache = new Map<
  string,
  { result: PoolResult; loadedAt: number }
>();
const pending = new Map<string, Promise<PoolResult>>();
function rememberResults(results: PoolResult[]) {
  for (const result of results) {
    if (result.data)
      scheduleCache.set(result.pool.id, { result, loadedAt: Date.now() });
  }
}
function loadResult(pool: Pool): Promise<PoolResult> {
  const cached = scheduleCache.get(pool.id);
  if (cached && Date.now() - cached.loadedAt < 60_000)
    return Promise.resolve(cached.result);
  const active = pending.get(pool.id);
  if (active) return active;
  const request = fetch(`/api/pools/${pool.id}`, { cache: "no-store" })
    .then(async (response) => {
      const body = await response.json();
      const result = body.results?.find(
        (item: PoolResult) => item.pool.id === pool.id,
      );
      if (!result) throw new Error("Schedule request failed");
      rememberResults([result]);
      return result as PoolResult;
    })
    .catch(() => ({ pool, data: null, error: "unavailable" }))
    .finally(() => pending.delete(pool.id));
  pending.set(pool.id, request);
  return request;
}
const NAV = [
  { mode: "agenda", href: "/agenda", label: "agenda", Icon: List },
  {
    mode: "calendar",
    href: "/calendar",
    label: "calendar",
    Icon: CalendarDays,
  },
] as const;
export function PoolDashboard({
  catalog,
  mode,
  weeks,
  today: initialToday,
  canRefresh,
}: {
  catalog: Pool[];
  mode: Mode;
  weeks: WeekInfo;
  today: string;
  canRefresh: boolean;
}) {
  const { language, t } = useLanguage();
  const [today, setToday] = useState(initialToday);
  const [results, setResults] = useState<PoolResult[]>([]),
    [loading, setLoading] = useState(true);
  const params = useSearchParams();
  const { favorites, toggleFavorite } = useFavoritePools(catalog);
  const orderedCatalog = [...catalog].sort(
    (a, b) =>
      Number(favorites.includes(b.id)) - Number(favorites.includes(a.id)),
  );
  const weekIndex = params.get("week") === "next" ? 1 : 0;
  const selectedPool =
    params.get("pool") === "all" ||
    params.get("pool") === "favorites" ||
    catalog.some((p) => p.id === params.get("pool"))
      ? params.get("pool")!
      : orderedCatalog[0].id;
  const requestedType = params.get("type");
  const type: PoolType | "all" = [
    "olympic",
    "small",
    "children",
    "diving",
    "all",
  ].includes(requestedType ?? "")
    ? (requestedType as PoolType | "all")
    : "olympic";
  const selectedDate = params.get("date") ?? today;
  const typeOptions = (
    ["olympic", "small", "children", "diving", "all"] as const
  ).map((value) => ({
    value,
    label:
      value === "all"
        ? t.allTypes
        : value === "diving"
          ? t.divingFilter
          : value === "small"
            ? t.smallFilter
            : t.poolTypes[value],
  }));
  const [notice, setNotice] = useState<NoticeKey | null>(null);
  function updateParams(values: Record<string, string>) {
    const next = new URLSearchParams(params.toString());
    for (const [key, value] of Object.entries(values)) next.set(key, value);
    window.history.pushState(null, "", `?${next}`);
  }
  const [selectedSlot, setSelectedSlot] = useState<CalendarSlot | null>(null);
  const [highlightedPool, setHighlightedPool] = useState<string | null>(null);
  function selectType(value: string) {
    updateParams({ type: value });
    setSelectedSlot(null);
    setHighlightedPool(null);
  }
  function changeFavorite(id: string) {
    toggleFavorite(id);
    setSelectedSlot(null);
    setHighlightedPool(null);
  }
  function selectPool(id: string) {
    updateParams({ pool: id });
    setSelectedSlot(null);
    setHighlightedPool(null);
  }
  const [hiddenPools, setHiddenPools] = useState<string[]>([]);
  useEffect(() => {
    let mounted = true,
      started = false;
    function start() {
      if (document.visibilityState !== "visible" || started) return;
      started = true;
      Promise.all(
        catalog.map(async (pool) => {
          const result = await loadResult(pool);
          if (mounted) {
            setResults((previous) => [
              ...previous.filter((item) => item.pool.id !== pool.id),
              result,
            ]);
            setToday(zagrebDate());
          }
        }),
      ).finally(() => {
        if (mounted) setLoading(false);
      });
    }
    start();
    document.addEventListener("visibilitychange", start);
    return () => {
      mounted = false;
      document.removeEventListener("visibilitychange", start);
    };
  }, []);
  async function refresh() {
    setLoading(true);
    setNotice(null);
    try {
      const response = await revalidatePools();
      if (response.error !== undefined) {
        setNotice("ownerRequired");
        return;
      }
      const data = response.results;
      rememberResults(data);
      setResults(data);
      setSelectedSlot(null);
      setToday(zagrebDate());
      setNotice(
        data.some((r) => !r.data || r.data.stale)
          ? "partialRefresh"
          : "refreshed",
      );
    } catch {
      setNotice("refreshFailed");
    } finally {
      setLoading(false);
    }
  }
  const available = results.find((r) => r.data)?.data?.availability;
  const liveWeeks = available
    ? {
        currentWeek: {
          monday: available.currentWeek.weekStart,
          sunday: available.currentWeek.weekEnd,
          days: available.currentWeek.days.map((d) => ({
            name: d.day,
            date: d.date,
          })),
        },
        nextWeek: {
          monday: available.nextWeek.weekStart,
          sunday: available.nextWeek.weekEnd,
          days: available.nextWeek.days.map((d) => ({
            name: d.day,
            date: d.date,
          })),
        },
      }
    : weeks;
  const week = weekIndex === 0 ? liveWeeks.currentWeek : liveWeeks.nextWeek;
  const activeDate = week.days.some(
    (d) => parseDate(d.date).toISOString().slice(0, 10) === selectedDate,
  )
    ? selectedDate
    : week.days.some(
          (d) => parseDate(d.date).toISOString().slice(0, 10) === today,
        )
      ? today
      : parseDate(week.monday).toISOString().slice(0, 10);
  const showAll = selectedPool === "all";
  const showFavorites = selectedPool === "favorites";
  const showOverlay = showAll || showFavorites;
  const selected = catalog.find((p) => p.id === selectedPool);
  const activeResult = results.find((r) => r.pool.id === selected?.id);
  const calendarPools = showFavorites
    ? catalog.filter((p) => favorites.includes(p.id))
    : showAll
      ? catalog.filter((p) => !hiddenPools.includes(p.id))
      : selected
        ? [selected]
        : [];
  const visible = orderedCatalog.filter((p) => !hiddenPools.includes(p.id));
  async function retryFailed() {
    setLoading(true);
    await Promise.all(
      catalog
        .filter((pool) => !results.find((r) => r.pool.id === pool.id)?.data)
        .map(async (pool) => {
          const result = await loadResult(pool);
          setResults((previous) => [
            ...previous.filter((item) => item.pool.id !== pool.id),
            result,
          ]);
        }),
    );
    setLoading(false);
  }
  const fetched = results
    .flatMap((r) => (r.data ? [r.data.fetchedAt] : []))
    .sort()[0];
  const failures = results.filter((r) => !r.data || r.data.stale);
  const dateLabel = weekLabel(week.monday, week.sunday, language);
  function changeWeek(index: number) {
    updateParams({
      week: index ? "next" : "current",
      date: index
        ? parseDate(liveWeeks.nextWeek.monday).toISOString().slice(0, 10)
        : today,
    });
    setSelectedSlot(null);
    setHighlightedPool(null);
  }
  return (
    <div className={`pool-app view-${mode}`}>
      <header className="app-header">
        <div className="header-inner">
          <Link href="/agenda" prefetch={false} className="brand">
            <img
              className="brand-symbol"
              src="/favicon-options/wave-72.png"
              alt=""
              width="36"
              height="36"
            />
            <span className="brand-wordmark">
              <strong>Bazeni</strong>
              <span>Zagreb</span>
            </span>
          </Link>
          <div className="header-actions">
            <ThemeSwitcher />
            <LanguageSwitcher />
            {canRefresh && (
              <Button
                variant="outline"
                onClick={refresh}
                disabled={loading}
                className="refresh-button"
                aria-label={loading ? t.loading : t.refresh}
              >
                <RefreshCw className={loading ? "animate-spin" : ""} />
                <span>{loading ? t.loading : t.refresh}</span>
              </Button>
            )}
          </div>
        </div>
      </header>
      <main className="app-main">
        <div className="schedule-navigation">
          <div className="date-navigation">
            <Button
              variant="outline"
              size="icon"
              aria-label={t.previousWeek}
              disabled={weekIndex === 0}
              onClick={() => changeWeek(0)}
            >
              <ChevronLeft />
            </Button>
            <div>
              <strong>{dateLabel}</strong>
              <span>{weekIndex === 0 ? t.currentWeek : t.nextWeek}</span>
            </div>
            <Button
              variant="outline"
              size="icon"
              aria-label={t.nextWeek}
              disabled={weekIndex === 1}
              onClick={() => changeWeek(1)}
            >
              <ChevronRight />
            </Button>
          </div>
          <nav className="view-navigation" aria-label={t.scheduleNavigation}>
            {NAV.map(({ href, label, mode: item, Icon }) => (
              <Link
                prefetch={false}
                key={item}
                href={`${href}?${params.toString()}`}
                aria-current={mode === item ? "page" : undefined}
              >
                <Icon size={16} />
                {t[label]}
              </Link>
            ))}
          </nav>
        </div>
        <section className="page-intro">
          <div className="intro-copy">
            <div className="intro-title-row">
              <h1>{mode === "agenda" ? t.agenda : t.scheduleTitle}</h1>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon-lg"
                    className="pool-type-menu"
                    aria-label={`${t.poolType}: ${typeOptions.find((option) => option.value === type)?.label}`}
                  >
                    <MoreHorizontal />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="min-w-56">
                  <DropdownMenuGroup>
                    <DropdownMenuLabel>{t.poolType}</DropdownMenuLabel>
                    <DropdownMenuRadioGroup
                      value={type}
                      onValueChange={selectType}
                    >
                      {typeOptions.map(({ value, label }) => (
                        <DropdownMenuRadioItem
                          key={value}
                          value={value}
                          className="min-h-11"
                        >
                          {label}
                        </DropdownMenuRadioItem>
                      ))}
                    </DropdownMenuRadioGroup>
                  </DropdownMenuGroup>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            <p>{mode === "agenda" ? t.agendaIntro : t.calendarIntro}</p>
          </div>
          <div className="intro-side">
            <span className={`live-dot ${loading ? "pending" : ""}`} />
            {loading
              ? t.checking
              : fetched
                ? `${t.checked} ${new Date(fetched).toLocaleString(LOCALES[language], { timeZone: "Europe/Zagreb", hour: "2-digit", minute: "2-digit", day: "numeric", month: "short" })}`
                : t.onDemand}
          </div>
        </section>
        {notice && (
          <div className="status-callout" role="status">
            <Info size={16} />
            {t[notice]}
          </div>
        )}
        {!loading && failures.length > 0 && (
          <details className="schedule-errors">
            <summary>
              <Info size={16} />
              {results.every((r) => !r.data)
                ? t.allFailed
                : t.failures(failures.length)}
            </summary>
            <div className="error-sources">
              <p>{t.sourceUnavailable}</p>
              {failures.map(({ pool }) => (
                <a
                  key={pool.id}
                  href={pool.url}
                  target="_blank"
                  rel="noreferrer"
                >
                  {pool.shortName} <ExternalLink size={12} />
                </a>
              ))}
              {failures.some((r) => !r.data) && (
                <Button variant="outline" size="sm" onClick={retryFailed}>
                  {t.retry}
                </Button>
              )}
            </div>
          </details>
        )}
        {mode === "calendar" ? (
          <div className="pool-tabs" aria-label={t.chooseFacility}>
            <button
              className="all-pools-tab"
              aria-pressed={showAll}
              aria-label={t.allFacilities}
              title={t.allFacilities}
              onClick={() => selectPool("all")}
            >
              <Layers size={14} aria-hidden="true" />
              {showAll && <span>{t.allFacilities}</span>}
            </button>
            <button
              className="all-pools-tab starred-pools-tab"
              aria-pressed={showFavorites}
              aria-label={t.starredPools}
              title={t.starredPools}
              onClick={() => selectPool("favorites")}
            >
              <Star
                size={14}
                fill={showFavorites ? "currentColor" : "none"}
                aria-hidden="true"
              />
              {showFavorites && <span>{t.starredPools}</span>}
            </button>
            {orderedCatalog.map((pool) => (
              <button
                aria-pressed={pool.id === selectedPool}
                key={pool.id}
                onClick={() => selectPool(pool.id)}
                style={poolColorStyle(pool.color)}
              >
                <i className="color-dot" style={poolColorStyle(pool.color)} />
                {pool.shortName}
                {favorites.includes(pool.id) && (
                  <Star size={12} fill="currentColor" aria-hidden="true" />
                )}
              </button>
            ))}
          </div>
        ) : null}
        {mode === "calendar" && showFavorites && favorites.length === 0 && (
          <div className="status-callout" role="status">
            <Star size={16} />
            {t.starredPoolsHelp}
          </div>
        )}
        {mode === "agenda" && (
          <div className="agenda-dates">
            {week.days.map((info) => {
              const iso = parseDate(info.date).toISOString().slice(0, 10);
              return (
                <button
                  key={iso}
                  aria-pressed={activeDate === iso}
                  onClick={() => updateParams({ date: iso })}
                >
                  <span>{weekday(info.date, language, "short")}</span>
                  <b>{info.date.slice(0, 2)}</b>
                  {iso === today && <small>{t.today}</small>}
                </button>
              );
            })}
          </div>
        )}
        <div
          className={mode === "calendar" ? "calendar-layout" : "wide-layout"}
          aria-busy={loading}
        >
          {mode === "calendar" ? (
            <CalendarView
              pools={calendarPools}
              results={results}
              overlap={showOverlay}
              overlapLabel={showFavorites ? t.starredPools : t.allFacilities}
              emptyMessage={showFavorites ? t.starredPoolsHelp : t.chooseOne}
              highlightedPool={highlightedPool}
              selectedSlot={selectedSlot}
              onSelectSlot={setSelectedSlot}
              onHighlight={setHighlightedPool}
              week={week}
              type={type}
              today={today}
              focusDate={activeDate}
              loading={loading}
            />
          ) : (
            <AgendaView
              catalog={visible}
              results={results}
              date={activeDate.split("-").reverse().join(".")}
              loading={loading}
              type={type}
              favorites={favorites}
              onToggleFavorite={changeFavorite}
            />
          )}
          {mode === "calendar" && (
            <aside className="pool-sidebar">
              <div className="sidebar-heading">
                <h2>
                  {showFavorites
                    ? t.starredPools
                    : showAll
                      ? t.calendarFacilities
                      : t.cityPools}
                </h2>
                <span>
                  {t.facilities(
                    showOverlay ? calendarPools.length : catalog.length,
                  )}
                </span>
              </div>
              <div className="pool-source-list">
                {orderedCatalog.map((pool) => {
                  const result = results.find((r) => r.pool.id === pool.id);
                  const day = dayOf(
                    result,
                    today.split("-").reverse().join("."),
                  );
                  const visible = calendarPools.some((p) => p.id === pool.id);
                  const status =
                    loading && !result
                      ? `${t.loading}…`
                      : result?.error
                        ? t.checkSource
                        : day?.status === "open"
                          ? t.slotsToday
                          : day?.status === "closed"
                            ? t.closedToday
                            : t.unconfirmed;
                  return (
                    <div
                      className={`pool-source-row ${visible ? "selected" : ""}`}
                      data-pool-id={pool.id}
                      key={pool.id}
                      style={poolColorStyle(pool.color)}
                      onMouseEnter={() => {
                        if (showOverlay && visible) setHighlightedPool(pool.id);
                      }}
                      onMouseLeave={() => setHighlightedPool(null)}
                    >
                      {showAll ? (
                        <label className="pool-visibility-label">
                          <input
                            type="checkbox"
                            aria-label={`${t.show} ${pool.shortName}`}
                            checked={visible}
                            onChange={() => {
                              setHiddenPools((ids) =>
                                ids.includes(pool.id)
                                  ? ids.filter((id) => id !== pool.id)
                                  : [...ids, pool.id],
                              );
                              setSelectedSlot(null);
                            }}
                          />
                          <i className="color-dot" />
                          <span>
                            <strong>{pool.shortName}</strong>
                            <small>{status}</small>
                          </span>
                        </label>
                      ) : (
                        <button
                          className="pool-select-button"
                          onClick={() => selectPool(pool.id)}
                          aria-pressed={visible}
                        >
                          <i className="color-dot" />
                          <span>
                            <strong>{pool.shortName}</strong>
                            <small>{status}</small>
                          </span>
                        </button>
                      )}
                      <FavoriteButton
                        pool={pool}
                        favorite={favorites.includes(pool.id)}
                        onToggle={() => changeFavorite(pool.id)}
                      />
                      <button
                        className="isolate-pool"
                        aria-label={`${t.isolate} ${pool.shortName}`}
                        onClick={() => selectPool(pool.id)}
                      >
                        <ChevronRight size={15} />
                      </button>
                    </div>
                  );
                })}
              </div>
              {showOverlay && (
                <div className="overlap-help">
                  <Layers size={20} />
                  <h3>{t.overlapTitle}</h3>
                  <p>{t.overlapHelp}</p>
                  <p>
                    {showFavorites ? t.starredPoolsHelp : t.overlapControls}
                  </p>
                </div>
              )}
              {selected && (
                <>
                  {" "}
                  <div
                    className="selected-source"
                    style={poolColorStyle(selected.color)}
                  >
                    <div>
                      <Waves size={19} />
                      <h3>{selected.shortName}</h3>
                    </div>
                    <p>
                      {selected.name}
                      <br />
                      {areaName(selected.area, language)}
                    </p>
                    <a href={selected.url} target="_blank" rel="noreferrer">
                      {t.openSource} <ArrowUpRight size={15} />
                    </a>
                    {activeResult?.error && (
                      <p className="source-error">{t.sourceUnavailable}</p>
                    )}
                    {activeResult?.data?.stale && (
                      <p className="source-error">{t.stale}</p>
                    )}
                    {activeResult?.data &&
                      sourceTexts(
                        activeResult.data.availability.alerts,
                        activeResult.data.availability.alertsEn,
                        language,
                      ).map((text, i) => (
                        <p className="source-alert" key={i}>
                          <Info size={14} />
                          {text}
                        </p>
                      ))}
                  </div>
                </>
              )}
              <p className="source-note">
                <Info size={15} />
                {t.sourceNote}
              </p>
            </aside>
          )}
        </div>
        {mode !== "calendar" &&
          results.some((r) => r.data?.availability.alerts.length) && (
            <section className="notices-section">
              <h2>{t.importantNotices}</h2>
              {results
                .filter((r) => visible.some((p) => p.id === r.pool.id))
                .flatMap(
                  (r) =>
                    (r.data &&
                      sourceTexts(
                        r.data.availability.alerts,
                        r.data.availability.alertsEn,
                        language,
                      ).map((alert, i) => (
                        <p key={`${r.pool.id}-${i}`}>
                          <strong>{r.pool.shortName}</strong> {alert}
                        </p>
                      ))) ??
                    [],
                )}
            </section>
          )}
        {mode === "calendar" &&
        activeResult?.data?.availability.notices.length ? (
          <section className="notices-section">
            <h2>{t.goodToKnow}</h2>
            {sourceTexts(
              activeResult.data.availability.notices,
              activeResult.data.availability.noticesEn,
              language,
            ).map((text, i) => (
              <p key={i}>{text}</p>
            ))}
          </section>
        ) : null}
        <footer className="app-footer">
          <span>
            <Waves size={17} />
            {t.footer}
          </span>
          <span>
            {t.zagrebTime} ·{" "}
            <a href="/docs" target="_blank" rel="noreferrer">
              {t.agentApi} <ExternalLink size={11} />
            </a>
          </span>
        </footer>
      </main>
    </div>
  );
}

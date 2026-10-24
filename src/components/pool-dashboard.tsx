"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Info,
  Layers,
  List,
  RefreshCw,
  Search,
  Waves,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { revalidatePools } from "@/lib/actions";
import type { Pool } from "@/lib/pools";
import type { PoolResult } from "@/lib/data";
import type { PoolType } from "@/lib/ai";
import { parseDate, zagrebDate, type WeekInfo } from "@/lib/dates";
import { AgendaView, dayOf, TYPE_LABELS } from "./schedule-views";

import { CalendarView, type CalendarSlot } from "./calendar-view";
import { poolColorStyle } from "@/lib/pool-colors";

type Mode = "calendar" | "agenda";
let lastResults: PoolResult[] | null = null;
let lastLoadedAt = 0;
let pending: Promise<PoolResult[]> | null = null;
function loadResults() {
  if (lastResults && Date.now() - lastLoadedAt < 60_000)
    return Promise.resolve(lastResults);
  return (pending ??= fetch("/api/pools", { cache: "no-store" })
    .then(async (response) => {
      const body = await response.json();
      if (!Array.isArray(body.results))
        throw new Error("Dohvat rasporeda nije uspio.");
      lastResults = body.results;
      lastLoadedAt = Date.now();
      return lastResults!;
    })
    .finally(() => {
      pending = null;
    }));
}
const NAV = [
  {
    mode: "calendar",
    href: "/calendar",
    label: "Kalendar",
    Icon: CalendarDays,
  },
  { mode: "agenda", href: "/agenda", label: "Dnevni pregled", Icon: List },
] as const;
export function PoolDashboard({
  catalog,
  mode,
  weeks,
  today: initialToday,
}: {
  catalog: Pool[];
  mode: Mode;
  weeks: WeekInfo;
  today: string;
}) {
  const [today, setToday] = useState(initialToday);
  const [results, setResults] = useState<PoolResult[]>([]),
    [loading, setLoading] = useState(true);
  const [weekIndex, setWeekIndex] = useState(0),
    [selectedPool, setSelectedPool] = useState(catalog[0].id);
  const [type, setType] = useState<PoolType | "all">("olympic"),
    [search, setSearch] = useState("");
  const [selectedDate, setSelectedDate] = useState(today),
    [notice, setNotice] = useState("");
  const [selectedSlot, setSelectedSlot] = useState<CalendarSlot | null>(null);
  const [highlightedPool, setHighlightedPool] = useState<string | null>(null);
  function selectPool(id: string) {
    setSelectedPool(id);
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
      loadResults()
        .then((data) => {
          if (mounted) {
            setResults(data);
            setToday(zagrebDate());
          }
        })
        .catch(() => {
          if (mounted)
            setNotice(
              "Dohvat nije uspio. Pokušajte ponovno ili otvorite službeni raspored.",
            );
        })
        .finally(() => {
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
    setNotice("");
    try {
      const data = await revalidatePools();
      lastResults = data;
      lastLoadedAt = Date.now();
      setResults(data);
      setSelectedSlot(null);
      setToday(zagrebDate());
      setNotice(
        data.some((r) => !r.data || r.data.stale)
          ? "Neki rasporedi nisu ažurirani. Dostupne podatke i izvore možete pregledati u nastavku."
          : "Rasporedi su provjereni. Ponovni dohvat ograničen je na jednom u minuti.",
      );
    } catch {
      setNotice("Osvježavanje nije uspjelo. Prethodni raspored je sačuvan.");
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
  const selected = catalog.find((p) => p.id === selectedPool);
  const activeResult = results.find((r) => r.pool.id === selected?.id);
  const calendarPools = showAll
    ? catalog.filter((p) => !hiddenPools.includes(p.id))
    : selected
      ? [selected]
      : [];
  const visible = catalog.filter(
    (p) =>
      !hiddenPools.includes(p.id) &&
      p.name.toLocaleLowerCase("hr").includes(search.toLocaleLowerCase("hr")),
  );
  const fetched = results
    .flatMap((r) => (r.data ? [r.data.fetchedAt] : []))
    .sort()[0];
  const failures = results.filter((r) => !r.data || r.data.stale);
  const dateLabel = `${week.monday.slice(0, 6)} – ${week.sunday}`;
  function changeWeek(index: number) {
    setWeekIndex(index);
    setSelectedSlot(null);
    setHighlightedPool(null);
    if (mode === "agenda")
      setSelectedDate(
        parseDate((index ? liveWeeks.nextWeek : liveWeeks.currentWeek).monday)
          .toISOString()
          .slice(0, 10),
      );
  }
  return (
    <div className={`pool-app view-${mode}`}>
      <header className="app-header">
        <div className="header-inner">
          <Link href="/calendar" prefetch={false} className="brand">
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
          <nav aria-label="Prikaz rasporeda">
            {NAV.map(({ href, label, mode: item, Icon }) => (
              <Link
                prefetch={false}
                key={item}
                href={href}
                aria-current={mode === item ? "page" : undefined}
              >
                <Icon size={16} />
                {label}
              </Link>
            ))}
          </nav>
          <Button
            variant="outline"
            onClick={refresh}
            disabled={loading}
            className="refresh-button"
            aria-label={loading ? "Učitavanje" : "Osvježi podatke"}
          >
            <RefreshCw className={loading ? "animate-spin" : ""} />
            <span>{loading ? "Učitavanje" : "Osvježi podatke"}</span>
          </Button>
        </div>
      </header>
      <main className="app-main">
        <section className="page-intro">
          <div>
            <h1>
              {mode === "agenda" ? "Dnevni pregled" : "Raspored plivanja"}
            </h1>
            <p>
              {mode === "agenda"
                ? "Odaberi dan i pronađi svoj termin."
                : "Jedan bazen ili cijeli grad. Tvoj tjedan za plivanje."}
            </p>
          </div>
          <div className="intro-side">
            <span className={`live-dot ${loading ? "pending" : ""}`} />
            {loading
              ? "Provjeravamo službene rasporede"
              : fetched
                ? `Provjereno ${new Date(fetched).toLocaleString("hr-HR", { timeZone: "Europe/Zagreb", hour: "2-digit", minute: "2-digit", day: "numeric", month: "short" })}`
                : "Rasporedi se dohvaćaju na zahtjev"}
          </div>
        </section>
        {notice && (
          <div className="status-callout" role="status">
            <Info size={16} />
            {notice}
          </div>
        )}
        {!loading && failures.length > 0 && (
          <div className="status-callout warning" role="status">
            <Info size={16} />
            {failures.length}{" "}
            {failures.length === 1 ? "raspored treba" : "rasporeda trebaju"}{" "}
            provjeru. Dostupni rasporedi su prikazani; za ostale otvorite
            službeni izvor.
          </div>
        )}
        <div className="schedule-toolbar">
          <div className="date-navigation">
            <Button
              variant="outline"
              size="icon"
              aria-label="Prethodni tjedan"
              disabled={weekIndex === 0}
              onClick={() => changeWeek(0)}
            >
              <ChevronLeft />
            </Button>
            <div>
              <strong>{dateLabel}</strong>
              <span>{weekIndex === 0 ? "Ovaj tjedan" : "Sljedeći tjedan"}</span>
            </div>
            <Button
              variant="outline"
              size="icon"
              aria-label="Sljedeći tjedan"
              disabled={weekIndex === 1}
              onClick={() => changeWeek(1)}
            >
              <ChevronRight />
            </Button>
          </div>
          <div className="type-switch" aria-label="Vrsta bazena">
            {(["olympic", "small", "children", "diving", "all"] as const).map(
              (value) => (
                <button
                  key={value}
                  aria-pressed={type === value}
                  onClick={() => {
                    setType(value);
                    setSelectedSlot(null);
                  }}
                >
                  {value === "all"
                    ? "Sve vrste"
                    : value === "diving"
                      ? "Skokovi"
                      : value === "small"
                        ? "Mali bazen"
                        : TYPE_LABELS[value]}
                </button>
              ),
            )}
          </div>
        </div>
        {mode === "calendar" ? (
          <div className="pool-tabs" aria-label="Odaberite objekt">
            <button
              className="all-pools-tab"
              aria-pressed={showAll}
              onClick={() => selectPool("all")}
            >
              <Layers size={14} />
              Svi objekti
            </button>
            {catalog.map((pool) => (
              <button
                aria-pressed={pool.id === selectedPool}
                key={pool.id}
                onClick={() => selectPool(pool.id)}
                style={poolColorStyle(pool.color)}
              >
                <i className="color-dot" style={poolColorStyle(pool.color)} />
                {pool.shortName}
              </button>
            ))}
          </div>
        ) : (
          <div className="filter-toolbar">
            <label className="search-field">
              <Search size={17} />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Pronađi bazen…"
                aria-label="Pronađi bazen"
              />
            </label>
            <span>{visible.length} objekata</span>
            {hiddenPools.length > 0 && (
              <button onClick={() => setHiddenPools([])}>Prikaži sve</button>
            )}
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
                  onClick={() => setSelectedDate(iso)}
                >
                  <span>{info.name.slice(0, 3)}</span>
                  <b>{info.date.slice(0, 2)}</b>
                  {iso === today && <small>Danas</small>}
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
              overlap={showAll}
              highlightedPool={highlightedPool}
              selectedSlot={selectedSlot}
              onSelectSlot={setSelectedSlot}
              onHighlight={setHighlightedPool}
              week={week}
              type={type}
              today={today}
              loading={loading}
            />
          ) : (
            <AgendaView
              catalog={visible}
              results={results}
              date={activeDate.split("-").reverse().join(".")}
              loading={loading}
              type={type}
            />
          )}
          {mode === "calendar" && (
            <aside className="pool-sidebar">
              <div className="sidebar-heading">
                <h2>{showAll ? "Objekti u kalendaru" : "Bazeni u gradu"}</h2>
                <span>
                  {showAll ? calendarPools.length : catalog.length} objekata
                </span>
              </div>
              <div className="pool-source-list">
                {catalog.map((pool) => {
                  const result = results.find((r) => r.pool.id === pool.id);
                  const day = dayOf(
                    result,
                    today.split("-").reverse().join("."),
                  );
                  const visible = showAll
                    ? !hiddenPools.includes(pool.id)
                    : selectedPool === pool.id;
                  const status =
                    loading && !result
                      ? "Učitavanje…"
                      : result?.error
                        ? "Provjerite izvor"
                        : day?.status === "open"
                          ? "Danas ima termina"
                          : day?.status === "closed"
                            ? "Danas zatvoreno"
                            : "Termini nisu potvrđeni";
                  return (
                    <div
                      className={`pool-source-row ${visible ? "selected" : ""}`}
                      data-pool-id={pool.id}
                      key={pool.id}
                      style={poolColorStyle(pool.color)}
                      onMouseEnter={() => {
                        if (showAll) setHighlightedPool(pool.id);
                      }}
                      onMouseLeave={() => setHighlightedPool(null)}
                    >
                      {showAll ? (
                        <label className="pool-visibility-label">
                          <input
                            type="checkbox"
                            aria-label={`Prikaži ${pool.shortName}`}
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
                      <button
                        className="isolate-pool"
                        aria-label={`Izdvoji ${pool.shortName}`}
                        onClick={() => selectPool(pool.id)}
                      >
                        <ChevronRight size={15} />
                      </button>
                    </div>
                  );
                })}
              </div>
              {showAll && (
                <div className="overlap-help">
                  <Layers size={20} />
                  <h3>Svi termini, u slojevima.</h3>
                  <p>
                    Boje povezuju objekte i termine. Prijeđi preko boje za
                    isticanje ili klikni termin za detalje.
                  </p>
                  <p>
                    Isključi objekt kvačicom, a strelicom izdvoji samo jedan.
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
                      {selected.area}
                    </p>
                    <a href={selected.url} target="_blank" rel="noreferrer">
                      Otvori službeni raspored <ArrowUpRight size={15} />
                    </a>
                    {activeResult?.error && (
                      <p className="source-error">{activeResult.error}</p>
                    )}
                    {activeResult?.data?.stale && (
                      <p className="source-error">
                        Prikazujemo raniji raspored. Nova provjera nije uspjela.
                      </p>
                    )}
                    {activeResult?.data?.availability.alerts.map((text, i) => (
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
                Plan se može promijeniti. Provjeri službeni raspored prije
                dolaska.
              </p>
            </aside>
          )}
        </div>
        {mode !== "calendar" && (
          <div className="pool-visibility">
            <span>Prikaz objekata</span>
            {catalog.map((pool) => (
              <label key={pool.id}>
                <input
                  type="checkbox"
                  checked={!hiddenPools.includes(pool.id)}
                  onChange={() =>
                    setHiddenPools((current) =>
                      current.includes(pool.id)
                        ? current.filter((id) => id !== pool.id)
                        : [...current, pool.id],
                    )
                  }
                />
                {pool.shortName}
              </label>
            ))}
          </div>
        )}
        {mode !== "calendar" &&
          results.some((r) => r.data?.availability.alerts.length) && (
            <section className="notices-section">
              <h2>Važne obavijesti</h2>
              {results
                .filter((r) => visible.some((p) => p.id === r.pool.id))
                .flatMap(
                  (r) =>
                    r.data?.availability.alerts.map((alert, i) => (
                      <p key={`${r.pool.id}-${i}`}>
                        <strong>{r.pool.shortName}</strong> {alert}
                      </p>
                    )) ?? [],
                )}
            </section>
          )}
        {mode === "calendar" &&
        activeResult?.data?.availability.notices.length ? (
          <section className="notices-section">
            <h2>Dobro je znati</h2>
            {activeResult.data.availability.notices.map((text, i) => (
              <p key={i}>{text}</p>
            ))}
          </section>
        ) : null}
        <footer className="app-footer">
          <span>
            <Waves size={17} />
            Zagreb, vidimo se na plivanju.
          </span>
          <span>
            Vrijeme u Zagrebu ·{" "}
            <a href="/api/openapi" target="_blank" rel="noreferrer">
              API za agente <ExternalLink size={11} />
            </a>
          </span>
        </footer>
      </main>
    </div>
  );
}

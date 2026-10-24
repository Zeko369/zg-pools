import { holidayForDate, parseDate, TIME_ZONE } from "./dates";

export type Language = "en" | "hr";
export const LANGUAGE_COOKIE = "pools-language";
export const LOCALES = { en: "en-GB", hr: "hr-HR" } as const;

export function isLanguage(value: unknown): value is Language {
  return value === "en" || value === "hr";
}

export function detectLanguage(
  header: string | null,
  saved?: string,
): Language {
  if (isLanguage(saved)) return saved;
  const preferences = (header ?? "")
    .split(",")
    .map((entry, index) => {
      const [tag, ...parameters] = entry.trim().toLowerCase().split(";");
      const quality = parameters.find((part) => part.trim().startsWith("q="));
      const q = quality ? Number(quality.trim().slice(2)) : 1;
      return { language: tag.split("-")[0], q, index };
    })
    .filter(
      ({ language, q }) =>
        isLanguage(language) && Number.isFinite(q) && q > 0 && q <= 1,
    )
    .sort((a, b) => b.q - a.q || a.index - b.index);
  return (preferences[0]?.language as Language | undefined) ?? "en";
}

const hr = {
  title: "Bazeni Zagreb · Raspored plivanja",
  description: "Dostupnost javnih bazena u Zagrebu",
  calendar: "Kalendar",
  agenda: "Dnevni pregled",
  scheduleNavigation: "Prikaz rasporeda",
  scheduleTitle: "Raspored plivanja",
  calendarIntro: "Jedan bazen ili cijeli grad. Tvoj tjedan za plivanje.",
  agendaIntro: "Odaberi dan i pronađi svoj termin.",
  loading: "Učitavanje",
  checking: "Provjeravamo službene rasporede",
  checked: "Provjereno",
  onDemand: "Rasporedi se dohvaćaju na zahtjev",
  refresh: "Osvježi podatke",
  loadFailed:
    "Dohvat nije uspio. Pokušajte ponovno ili otvorite službeni raspored.",
  refreshFailed: "Osvježavanje nije uspjelo. Prethodni raspored je sačuvan.",
  partialRefresh:
    "Neki rasporedi nisu ažurirani. Dostupne podatke i izvore možete pregledati u nastavku.",
  refreshed:
    "Rasporedi su provjereni. Ponovni dohvat ograničen je na jednom u minuti.",
  ownerRequired: "Za ručno osvježavanje prijavi se na /owner.",
  failures: (count: number) =>
    `${count} ${count === 1 ? "raspored treba" : "rasporeda trebaju"} provjeru. Dostupni rasporedi su prikazani; za ostale otvorite službeni izvor.`,
  previousWeek: "Prethodni tjedan",
  nextWeek: "Sljedeći tjedan",
  currentWeek: "Ovaj tjedan",
  poolType: "Vrsta bazena",
  poolTypes: {
    olympic: "Veliki bazen",
    small: "Mali / srednji bazen",
    children: "Dječji bazen",
    diving: "Bazen za skokove",
  },
  smallFilter: "Mali bazen",
  divingFilter: "Skokovi",
  allTypes: "Sve vrste",
  chooseFacility: "Odaberite objekt",
  allFacilities: "Svi objekti",
  findPool: "Pronađi bazen",
  facilities: (count: number) =>
    `${count} ${count === 1 ? "objekt" : count > 1 && count < 5 ? "objekta" : "objekata"}`,
  showAll: "Prikaži sve",
  today: "Danas",
  calendarFacilities: "Objekti u kalendaru",
  cityPools: "Bazeni u gradu",
  checkSource: "Provjerite izvor",
  slotsToday: "Danas ima termina",
  closedToday: "Danas zatvoreno",
  unconfirmed: "Termini nisu potvrđeni",
  show: "Prikaži",
  isolate: "Izdvoji",
  overlapTitle: "Svi termini, u slojevima.",
  overlapHelp:
    "Boje povezuju objekte i termine. Prijeđi preko boje za isticanje ili klikni termin za detalje.",
  overlapControls: "Isključi objekt kvačicom, a strelicom izdvoji samo jedan.",
  openSource: "Otvori službeni raspored",
  officialSchedule: "Službeni raspored",
  sourceUnavailable:
    "Raspored trenutačno nije dostupan. Provjerite službeni izvor.",
  stale: "Prikazujemo raniji raspored. Nova provjera nije uspjela.",
  sourceNote:
    "Plan se može promijeniti. Provjeri službeni raspored prije dolaska.",
  facilityVisibility: "Prikaz objekata",
  importantNotices: "Važne obavijesti",
  goodToKnow: "Dobro je znati",
  footer: "Zagreb, vidimo se na plivanju.",
  zagrebTime: "Vrijeme u Zagrebu",
  agentApi: "API za agente",
  closed: "Zatvoreno",
  noConfirmedSlots: "Nema potvrđenih termina",
  agendaRegion: "Termini po bazenima",
  noPools: "Nema bazena za ovaj odabir",
  changeSearch: "Promijenite pretragu ili uključite drugi bazen.",
  weeklyCalendar: "Tjedni kalendar",
  pools: "bazeni",
  overlapSummary: (count: number) => `${count} objekata u jednom kalendaru`,
  overlapHint: "Prijeđi preko termina za pregled · klikni za detalje",
  scrollCalendar: "Tjedni raspored; pomaknite vodoravno za ostale dane",
  hours: "SATI",
  slotDetails: "Detalji termina",
  closeDetails: "Zatvori detalje termina",
  chooseOne: "Odaberi barem jedan objekt s desne strane.",
  ownerAccess: "Vlasnički pristup",
  backToSchedule: "Natrag na raspored",
  ownerEnabled: "Ručno osvježavanje je omogućeno u ovom pregledniku.",
  signOut: "Odjavi se",
  ownerIntro:
    "Unesi svoj ključ za ručno osvježavanje rasporeda. Pristup traje 30 dana u ovom pregledniku.",
  ownerKey: "Ključ za osvježavanje",
  invalidKey: "Ključ nije ispravan. Pokušaj ponovno.",
  enableRefresh: "Omogući osvježavanje",
  ownerUnconfigured: "Vlasnički pristup još nije postavljen.",
};

const en: typeof hr = {
  title: "Bazeni Zagreb · Swimming schedules",
  description: "Public swimming schedules for Zagreb pools",
  calendar: "Calendar",
  agenda: "Daily agenda",
  scheduleNavigation: "Schedule views",
  scheduleTitle: "Swimming schedules",
  calendarIntro: "One pool or the whole city. Your week of swimming.",
  agendaIntro: "Pick a day and find your swim.",
  loading: "Loading",
  checking: "Checking official schedules",
  checked: "Checked",
  onDemand: "Schedules are loaded on demand",
  refresh: "Refresh schedules",
  loadFailed:
    "Could not load schedules. Try again or open the official schedule.",
  refreshFailed: "Refresh failed. The previous schedule has been kept.",
  partialRefresh:
    "Some schedules could not be updated. Available data and official sources are shown below.",
  refreshed: "Schedules checked. Refreshing is limited to once per minute.",
  ownerRequired: "Sign in at /owner to refresh schedules manually.",
  failures: (count) =>
    `${count} ${count === 1 ? "schedule needs" : "schedules need"} checking. Available schedules are shown; check the official sources for the rest.`,
  previousWeek: "Previous week",
  nextWeek: "Next week",
  currentWeek: "This week",
  poolType: "Pool type",
  poolTypes: {
    olympic: "Main pool",
    small: "Small / warm-up pool",
    children: "Children’s pool",
    diving: "Diving pool",
  },
  smallFilter: "Small pool",
  divingFilter: "Diving",
  allTypes: "All types",
  chooseFacility: "Choose a facility",
  allFacilities: "All facilities",
  findPool: "Find a pool",
  facilities: (count) => `${count} ${count === 1 ? "facility" : "facilities"}`,
  showAll: "Show all",
  today: "Today",
  calendarFacilities: "Facilities in this calendar",
  cityPools: "Pools in Zagreb",
  checkSource: "Check official source",
  slotsToday: "Swim times today",
  closedToday: "Closed today",
  unconfirmed: "Times unconfirmed",
  show: "Show",
  isolate: "Show only",
  overlapTitle: "Every swim, in layers.",
  overlapHelp:
    "Colors connect facilities and swim times. Hover to highlight or select a time for details.",
  overlapControls:
    "Uncheck a facility to hide it, or use its arrow to show just that pool.",
  openSource: "Open official schedule",
  officialSchedule: "Official schedule",
  sourceUnavailable:
    "The schedule is currently unavailable. Check the official source.",
  stale: "Showing an earlier schedule. The latest check failed.",
  sourceNote:
    "Schedules can change. Check the official schedule before visiting.",
  facilityVisibility: "Visible facilities",
  importantNotices: "Important notices",
  goodToKnow: "Good to know",
  footer: "Zagreb, see you in the pool.",
  zagrebTime: "Zagreb time",
  agentApi: "Agent API",
  closed: "Closed",
  noConfirmedSlots: "No confirmed swim times",
  agendaRegion: "Swim times by pool",
  noPools: "No pools match your selection",
  changeSearch: "Try a different search or enable another pool.",
  weeklyCalendar: "Weekly calendar",
  pools: "pools",
  overlapSummary: (count) => `${count} facilities in one calendar`,
  overlapHint: "Hover to preview · select for details",
  scrollCalendar: "Weekly schedule; scroll horizontally for more days",
  hours: "TIME",
  slotDetails: "Swim time details",
  closeDetails: "Close swim time details",
  chooseOne: "Select at least one facility from the sidebar.",
  ownerAccess: "Owner access",
  backToSchedule: "Back to schedules",
  ownerEnabled: "Manual refresh is enabled in this browser.",
  signOut: "Sign out",
  ownerIntro:
    "Enter your key to refresh schedules manually. Access lasts 30 days in this browser.",
  ownerKey: "Refresh key",
  invalidKey: "That key is incorrect. Try again.",
  enableRefresh: "Enable refresh",
  ownerUnconfigured: "Owner access has not been set up yet.",
};

export const messages = { en, hr };
export type NoticeKey =
  | "loadFailed"
  | "refreshFailed"
  | "partialRefresh"
  | "refreshed"
  | "ownerRequired";

export function weekday(
  date: string,
  language: Language,
  style: "short" | "long" = "long",
) {
  return new Intl.DateTimeFormat(LOCALES[language], {
    weekday: style,
    timeZone: TIME_ZONE,
  }).format(parseDate(date));
}

export function weekLabel(start: string, end: string, language: Language) {
  return new Intl.DateTimeFormat(LOCALES[language], {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: TIME_ZONE,
  }).formatRange(parseDate(start), parseDate(end));
}

export function sourceText(
  original: string | undefined,
  english: string | undefined,
  language: Language,
) {
  return language === "en" ? (english ?? original) : original;
}

export function sourceTexts(
  original: string[],
  english: string[] | undefined,
  language: Language,
) {
  return original.map((text, index) =>
    sourceText(text, english?.[index], language)!,
  );
}

export function areaName(area: string, language: Language) {
  return language === "en" && area === "Zapad" ? "West Zagreb" : area;
}

const ENGLISH_HOLIDAYS: Record<string, string> = {
  "Nova godina": "New Year’s Day",
  "Sveta tri kralja": "Epiphany",
  "Praznik rada": "Labour Day",
  "Dan državnosti": "Statehood Day",
  "Dan antifašističke borbe": "Anti-Fascist Struggle Day",
  "Dan pobjede": "Victory Day",
  "Velika Gospa": "Assumption Day",
  "Svi sveti": "All Saints’ Day",
  "Dan sjećanja": "Remembrance Day",
  Božić: "Christmas Day",
  "Sveti Stjepan": "St Stephen’s Day",
  Uskrs: "Easter Sunday",
  "Uskrsni ponedjeljak": "Easter Monday",
  Tijelovo: "Corpus Christi",
};
export function holidayName(date: string, language: Language) {
  const name = holidayForDate(date);
  return name && language === "en" ? (ENGLISH_HOLIDAYS[name] ?? name) : name;
}

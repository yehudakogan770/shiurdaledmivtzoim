/**
 * Dates are stored as local YYYY-MM-DD strings. A mivtzoim week runs from
 * Friday 5:00am to the next Friday 5:00am, and is named by the date of its
 * starting Friday (YYYY-MM-DD).
 */

export function toISODate(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function today() {
  return toISODate(new Date());
}

export function parseDate(s: string) {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

const WEEK_START_DAY = 5; // Friday
const WEEK_START_HOUR = 5; // 5:00am

/** The Friday (YYYY-MM-DD) that starts the mivtzoim week containing this moment. */
export function weekOf(moment: Date) {
  const d = new Date(moment);
  d.setHours(d.getHours() - WEEK_START_HOUR); // before 5am belongs to the day before
  d.setDate(d.getDate() - ((d.getDay() - WEEK_START_DAY + 7) % 7));
  return toISODate(d);
}

/**
 * When an entry happened. Entries logged for today use the time they were
 * saved; entries dated another day count as that day at noon.
 */
export function activityMoment(a: { activity_date: string; created_at?: string | null }) {
  if (a.created_at) {
    const saved = new Date(a.created_at);
    if (!Number.isNaN(saved.getTime()) && toISODate(saved) === a.activity_date) return saved;
  }
  const d = parseDate(a.activity_date);
  d.setHours(12);
  return d;
}

export function activityWeek(a: { activity_date: string; created_at?: string | null }) {
  return weekOf(activityMoment(a));
}

export function currentWeek() {
  return weekOf(new Date());
}

export function addDays(s: string, n: number) {
  const d = parseDate(s);
  d.setDate(d.getDate() + n);
  return toISODate(d);
}

/** The last `n` weeks, oldest first, ending with `last` (this week by default). */
export function recentWeeks(n: number, last = currentWeek()) {
  return Array.from({ length: n }, (_, i) => addDays(last, (i - n + 1) * 7));
}

const short = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" });
const long = new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric" });

export function formatShort(s: string) {
  return short.format(parseDate(s));
}

export function formatDay(s: string) {
  if (s === today()) return "Today";
  if (s === addDays(today(), -1)) return "Yesterday";
  return long.format(parseDate(s));
}

/** "Fri Sep 25 – Thu Oct 1" */
export function weekLabel(start: string) {
  return `Fri ${formatShort(start)} – Thu ${formatShort(addDays(start, 6))}`;
}

const HEBREW_MONTHS: Record<string, string> = {
  Tishri: "Tishrei",
  Heshvan: "Cheshvan",
  Tevet: "Teves",
  Nisan: "Nissan",
  Tamuz: "Tammuz",
  Av: "Menachem Av",
};

/** Today's Hebrew date, e.g. "13 Tishrei 5787". */
export function hebrewDate(d = new Date()) {
  try {
    const parts = new Intl.DateTimeFormat("en-u-ca-hebrew", { day: "numeric", month: "long", year: "numeric" }).formatToParts(d);
    const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
    const month = get("month");
    return `${get("day")} ${HEBREW_MONTHS[month] ?? month} ${get("year")}`;
  } catch {
    return "";
  }
}

export function longDate(d = new Date()) {
  return new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric" }).format(d);
}

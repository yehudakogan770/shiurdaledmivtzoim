/** Dates are stored as local YYYY-MM-DD strings. A mivtzoim week runs Sunday through Shabbos. */

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

/** Sunday that starts the week containing `s`. */
export function weekStart(s: string) {
  const d = parseDate(s);
  d.setDate(d.getDate() - d.getDay());
  return toISODate(d);
}

export function addDays(s: string, n: number) {
  const d = parseDate(s);
  d.setDate(d.getDate() + n);
  return toISODate(d);
}

/** The last `n` week starts, oldest first, ending with this week. */
export function recentWeeks(n: number) {
  const current = weekStart(today());
  return Array.from({ length: n }, (_, i) => addDays(current, (i - n + 1) * 7));
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

export function weekLabel(start: string) {
  return `${formatShort(start)} – ${formatShort(addDays(start, 6))}`;
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

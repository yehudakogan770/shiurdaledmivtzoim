import { HDate, Locale, Sedra } from "@hebcal/core";
import { activityWeek, addDays, formatDay, parseDate, weekLabel } from "./dates";

const sedras = new Map<number, Sedra>();
/** Remove vowels and cantillation; the maqaf that joins words becomes a space: "לך לך". */
const stripNikud = (s: string) =>
  s
    .replace(/־/g, " ")
    .replace(/[֑-ׇ]/g, "")
    .replace(/\s+/g, " ")
    .trim();

export interface Parsha {
  /** פרשת בראשית, or the Yom Tov name when Shabbos is a Yom Tov */
  hebrew: string;
  /** Parshas Bereishis, or Sukkos */
  english: string;
}

/** The parsha read on the Shabbos of the mivtzoim week starting on this Friday (diaspora). */
export function parshaOfWeek(fridayISO: string): Parsha {
  const shabbos = parseDate(addDays(fridayISO, 1));
  const hd = new HDate(shabbos);
  let sedra = sedras.get(hd.getFullYear());
  if (!sedra) {
    sedra = new Sedra(hd.getFullYear(), false);
    sedras.set(hd.getFullYear(), sedra);
  }
  const { parsha, chag } = sedra.lookup(hd);
  // Double parshiyos get a space between them too: "ויקהל פקודי".
  const he = parsha.map((p) => stripNikud(Locale.gettext(p, "he"))).join(" ");
  const en = parsha.map((p) => Locale.gettext(p, "ashkenazi")).join("-");
  return chag ? { hebrew: he, english: en } : { hebrew: `פרשת ${he}`, english: `Parshas ${en}` };
}

/** Just the name, without "Parshas": "Ki Savo", or the Yom Tov name. */
export function parshaName(fridayISO: string) {
  return parshaOfWeek(fridayISO).english.replace(/^Parshas /, "");
}

/** "Parshas Ki Savo · Fri Sep 18": the week's parsha with the Friday it starts. */
export function weekTitle(fridayISO: string) {
  return `${parshaOfWeek(fridayISO).english} · ${weekLabel(fridayISO)}`;
}

/** "Tue Sep 22 (Ha'azinu)": an entry's day with the parsha of its week. */
export function dayWithParsha(a: { activity_date: string; created_at?: string | null }) {
  return `${formatDay(a.activity_date)} (${parshaName(activityWeek(a))})`;
}

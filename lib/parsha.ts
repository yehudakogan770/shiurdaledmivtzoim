import { HDate, Locale, Sedra } from "@hebcal/core";
import { addDays, parseDate } from "./dates";

const sedras = new Map<number, Sedra>();
const stripNikud = (s: string) => s.replace(/[֑-ׇ]/g, "");

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
  const he = stripNikud(parsha.map((p) => Locale.gettext(p, "he")).join("-"));
  const en = parsha.map((p) => Locale.gettext(p, "ashkenazi")).join("-");
  return chag ? { hebrew: he, english: en } : { hebrew: `פרשת ${he}`, english: `Parshas ${en}` };
}

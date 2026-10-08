/**
 * A Chavrusa on a route: the English name, and the Hebrew name with the mother's name
 * ("מנחם מענדל בן חנה"). Each one is kept as one text in the account's partners list:
 * the English name alone, or a small JSON text when there's a Hebrew name too, so older
 * accounts (just names) keep working and nothing in the database had to change.
 */
export interface Chavrusa {
  name: string;
  hebrew: string;
  mother: string;
}

export const BLANK_CHAVRUSA: Chavrusa = { name: "", hebrew: "", mother: "" };

export function parseChavrusa(raw: string): Chavrusa {
  const text = (raw ?? "").trim();
  if (text.startsWith("{")) {
    try {
      const c = JSON.parse(text);
      return { name: String(c.n ?? "").trim(), hebrew: String(c.h ?? "").trim(), mother: String(c.m ?? "").trim() };
    } catch {
      // Not ours after all: treat it as a plain name.
    }
  }
  return { name: text, hebrew: "", mother: "" };
}

export function encodeChavrusa(c: Chavrusa): string {
  const name = c.name.trim();
  const hebrew = c.hebrew.trim();
  const mother = c.mother.trim();
  return hebrew || mother ? JSON.stringify({ n: name, h: hebrew, m: mother }) : name;
}

/** The account's Chavrusas, skipping empty ones. */
export function chavrusasOf(partners: string[] | null | undefined): Chavrusa[] {
  return (partners ?? []).map(parseChavrusa).filter((c) => c.name || c.hebrew);
}

/** "מנחם מענדל בן חנה" (just the name when there's no mother's name). */
export function hebrewName(c: Chavrusa) {
  return [c.hebrew, c.mother ? `בן ${c.mother}` : ""].filter(Boolean).join(" ");
}

/** For lists: "Mendel (מנחם מענדל בן חנה)". */
export function chavrusaLabel(c: Chavrusa) {
  const he = hebrewName(c);
  return c.name && he ? `${c.name} (${he})` : c.name || he;
}

/** All of an account's Chavrusas for a line of text. */
export function chavrusasText(partners: string[] | null | undefined, sep = ", ") {
  return chavrusasOf(partners).map(chavrusaLabel).join(sep);
}

/** All of an account's Chavrusas in Hebrew (the English name when there's no Hebrew one). */
export function chavrusasHebrew(partners: string[] | null | undefined, sep = " · ") {
  return chavrusasOf(partners)
    .map((c) => hebrewName(c) || c.name)
    .join(sep);
}

import type { RosterName } from "./types";
import { chavrusasOf } from "./chavrusa";

/** "Mendel Cohen": how a name from the list shows around the site. */
export const rosterDisplay = (r: RosterName) => `${r.first_name} ${r.last_name}`.trim();
/** "Cohen, Mendel": how it shows in the drop-down, so it's found by last name. */
export const rosterLabel = (r: RosterName) => [r.last_name, r.first_name].filter(Boolean).join(", ");

const byText = (a: string, b: string) => a.localeCompare(b, "en", { sensitivity: "base" });

/** The yeshivas on the list, A to Z. */
export function yeshivasOf(roster: RosterName[]) {
  return [...new Set(roster.map((r) => r.yeshiva))].sort(byText);
}

/** One yeshiva's names, by last name. */
export function namesIn(roster: RosterName[], yeshiva: string) {
  return roster.filter((r) => r.yeshiva === yeshiva).sort((a, b) => byText(rosterLabel(a), rosterLabel(b)));
}

/**
 * True when an account still has to pick its names from the list: it has nobody on it, or
 * someone whose name was typed in rather than picked (or was since taken off the list).
 */
export function needsListNames(partners: string[] | null | undefined, roster: RosterName[]) {
  if (roster.length === 0) return false;
  const list = chavrusasOf(partners);
  return list.length === 0 || list.some((c) => !c.roster || !roster.some((r) => r.id === c.roster));
}

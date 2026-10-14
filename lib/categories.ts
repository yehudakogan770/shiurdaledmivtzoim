import type { Activity, HiddenRange, PersonalCategory } from "./types";
import { currentWeek } from "./dates";

export const STANDARD = {
  tefillin: { label: "Tefillin", unit: "people put on Tefillin", short: "Tefillin" },
  shabbos_candles: { label: "Shabbos Candles", unit: "women and girls lit candles", short: "Candles" },
} as const;

/** The rest of the Rebbe's ten mivtzoim, offered as ready-made personal categories. */
export const SUGGESTED_PERSONAL = [
  { name: "Mezuzah", description: "Mezuzos checked or put up" },
  { name: "Tzedakah", description: "Pushkas given out or coins given" },
  { name: "Torah Learning", description: "People who learned with you" },
  { name: "Bayis Malei Seforim", description: "Seforim placed in homes" },
  { name: "Kashrus", description: "Kitchens kashered or people helped keep kosher" },
  { name: "Ahavas Yisroel", description: "Acts of kindness" },
  { name: "Chinuch", description: "Children signed up for Jewish education" },
  { name: "Taharas Hamishpacha", description: "Families helped" },
];

export type BuiltinType = keyof typeof STANDARD;
export const BUILTIN_TYPES: BuiltinType[] = ["tefillin", "shabbos_candles"];

/**
 * Tefillin and Shabbos Candles are built in, but an admin can rename, hide or
 * remove them like any other mivtza. Those choices are kept in a shared
 * category row marked with icon "builtin:<type>"; no row means the defaults.
 */
export const builtinIcon = (type: BuiltinType) => `builtin:${type}`;
export const isBuiltinRow = (c: Pick<PersonalCategory, "icon">) => !!c.icon?.startsWith("builtin:");
const REMOVED = "removed";

export interface Builtin {
  type: BuiltinType;
  name: string;
  short: string;
  /** Hidden now or from a coming week on (it can be brought back). */
  hidden: boolean;
  /** The stretches of weeks it's hidden in. */
  ranges: HiddenRange[];
  removed: boolean;
  position: number;
  row: PersonalCategory | null;
}

export function builtins(categories: PersonalCategory[]): Builtin[] {
  return BUILTIN_TYPES.map((type, i) => {
    const row =
      categories
        .filter((c) => c.shared && c.icon === builtinIcon(type))
        .sort((x, y) => x.created_at.localeCompare(y.created_at))[0] ?? null;
    const std = STANDARD[type];
    const name = row?.name.trim() || std.label;
    return {
      type,
      name,
      short: name === std.label ? std.short : name,
      hidden: row ? hiddenNowOrLater(hiddenRanges(row)) : false,
      ranges: row ? hiddenRanges(row) : [],
      removed: row?.description === REMOVED,
      // Until an admin reorders, Tefillin and Candles come first.
      position: row?.position ?? i - 100,
      row,
    };
  });
}

/**
 * The weeks a mivtza is hidden in. Weeks outside these keep it, so people can still go back and
 * add to or fix them. Rows from before weeks were tracked: archived means every week.
 */
export function hiddenRanges(c: Pick<PersonalCategory, "status" | "hidden_weeks">): HiddenRange[] {
  if (Array.isArray(c.hidden_weeks)) return c.hidden_weeks.filter((r) => r && (!r.from || !r.to || r.from < r.to));
  return c.status === "archived" ? [{ from: null, to: null }] : [];
}

export const hiddenInWeek = (ranges: HiddenRange[], week: string) => ranges.some((r) => (!r.from || week >= r.from) && (!r.to || week < r.to));

/** Hidden in the current week or from a coming week on: shows "Bring back" instead of "Hide". */
export const hiddenNowOrLater = (ranges: HiddenRange[], thisWeek = currentWeek()) => ranges.some((r) => !r.to || r.to > thisWeek);

/** Hide from a week on (none: every week). Earlier stretches stay as they were. */
export function hideFrom(ranges: HiddenRange[], from: string | null): HiddenRange[] {
  if (!from) return [{ from: null, to: null }];
  // Already hidden from before then on: nothing changes.
  if (ranges.some((r) => !r.to && (!r.from || r.from <= from))) return ranges;
  return [...ranges.filter((r) => r.to && r.to <= from), ...ranges.filter((r) => r.to && r.to > from && (!r.from || r.from < from)).map((r) => ({ ...r, to: from })), { from, to: null }];
}

/** Bring back from a week on (none: every week, as if never hidden). Weeks before stay as they were. */
export function bringBackFrom(ranges: HiddenRange[], from: string | null): HiddenRange[] {
  if (!from) return [];
  return ranges.flatMap((r) => {
    if (r.from && r.from >= from) return []; // would only have started later
    if (!r.to || r.to > from) return [{ ...r, to: from }];
    return [r];
  });
}

export const categoryHiddenIn = (c: Pick<PersonalCategory, "status" | "hidden_weeks">, week: string) => hiddenInWeek(hiddenRanges(c), week);
export const builtinHiddenIn = (b: Builtin, week: string) => b.removed || hiddenInWeek(b.ranges, week);

/** One mivtza on the front page: a built-in one or one an admin added. */
export type Mivtza = { key: string; builtin: Builtin; category?: undefined } | { key: string; builtin?: undefined; category: PersonalCategory };

/** Built-in and added mivtzoim together, in the order an admin set (new ones go last). */
export function orderedMivtzoim(builtinList: Builtin[], shared: PersonalCategory[]): Mivtza[] {
  const added = [...shared].sort((x, y) => x.created_at.localeCompare(y.created_at));
  const all = [
    ...builtinList.map((b) => ({ item: { key: b.type, builtin: b } as Mivtza, pos: b.position })),
    ...added.map((c, i) => ({ item: { key: c.id, category: c } as Mivtza, pos: c.position ?? 1000 + i })),
  ];
  return all.sort((x, y) => x.pos - y.pos).map((x) => x.item);
}

/**
 * Columns for reports (Excel, totals): every mivtza, including hidden ones, so their
 * history is never lost. Hidden ones only appear when they have entries in `rows`.
 */
export function reportColumns(builtinList: Builtin[], shared: PersonalCategory[], rows: Activity[]) {
  const cols = orderedMivtzoim(builtinList, shared).map((m) => {
    const matches = m.builtin
      ? (a: Pick<Activity, "category_type" | "personal_category_id">) => a.category_type === m.builtin!.type
      : (a: Pick<Activity, "category_type" | "personal_category_id">) => a.personal_category_id === m.category.id;
    const off = m.builtin ? m.builtin.hidden || m.builtin.removed : hiddenNowOrLater(hiddenRanges(m.category));
    return { key: m.key, label: m.builtin ? m.builtin.name : m.category.name, off, matches };
  });
  return cols.filter((c) => !c.off || rows.some(c.matches));
}

/** The row's description marks a built-in as removed (it stays restorable). */
export const builtinDescription = (removed: boolean) => (removed ? REMOVED : null);

export function categoryName(a: Pick<Activity, "category_type" | "personal_category_id">, personal: PersonalCategory[]) {
  if (a.category_type === "personal") {
    return personal.find((c) => c.id === a.personal_category_id)?.name ?? "Other";
  }
  return builtins(personal).find((b) => b.type === a.category_type)?.name ?? STANDARD[a.category_type].label;
}

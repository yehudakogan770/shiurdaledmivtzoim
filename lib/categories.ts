import type { Activity, PersonalCategory } from "./types";

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
  hidden: boolean;
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
      hidden: row?.status === "archived",
      removed: row?.description === REMOVED,
      // Until an admin reorders, Tefillin and Candles come first.
      position: row?.position ?? i - 100,
      row,
    };
  });
}

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

/** The row's description marks a built-in as removed (it stays restorable). */
export const builtinDescription = (removed: boolean) => (removed ? REMOVED : null);

export function categoryName(a: Pick<Activity, "category_type" | "personal_category_id">, personal: PersonalCategory[]) {
  if (a.category_type === "personal") {
    return personal.find((c) => c.id === a.personal_category_id)?.name ?? "Other";
  }
  return builtins(personal).find((b) => b.type === a.category_type)?.name ?? STANDARD[a.category_type].label;
}

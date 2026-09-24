import type { Activity, PersonalCategory } from "./types";

export const STANDARD = {
  tefillin: { label: "Tefillin", unit: "people put on tefillin", short: "Tefillin" },
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

export function categoryName(a: Pick<Activity, "category_type" | "personal_category_id">, personal: PersonalCategory[]) {
  if (a.category_type === "personal") {
    return personal.find((c) => c.id === a.personal_category_id)?.name ?? "Other";
  }
  return STANDARD[a.category_type].label;
}

/**
 * The dreidel: its four letters (in the order of its sides: front, right, back, left) and the
 * designs a player can choose. Every design is the same shape; only the material changes.
 */
export const LETTERS = [
  { he: "נ", name: "Nun", meaning: "Nothing happens" },
  { he: "ג", name: "Gimmel", meaning: "Take the whole pot" },
  { he: "ה", name: "Hey", meaning: "Take half the pot" },
  { he: "ש", name: "Shin", meaning: "Put two in the pot" },
] as const;

export type DreidelDesign =
  | "gold"
  | "wood"
  | "plastic"
  | "glass"
  | "frosted"
  | "food"
  | "candy"
  | "marble"
  | "stone"
  | "silver"
  | "gold-blue"
  | "gold-red"
  | "gold-green";

export const DESIGNS: { id: DreidelDesign; name: string }[] = [
  { id: "gold", name: "Gold" },
  { id: "wood", name: "Wood" },
  { id: "plastic", name: "Blue Plastic" },
  { id: "glass", name: "Glass" },
  { id: "frosted", name: "Frosted Glass" },
  { id: "food", name: "Chocolate Cake" },
  { id: "candy", name: "Fruity Candy" },
  { id: "marble", name: "Marble" },
  { id: "stone", name: "Stone" },
  { id: "silver", name: "Silver" },
  { id: "gold-blue", name: "Gold & Blue" },
  { id: "gold-red", name: "Gold & Red" },
  { id: "gold-green", name: "Gold & Green" },
];

export const isDesign = (v: unknown): v is DreidelDesign => DESIGNS.some((d) => d.id === v);

const DESIGN_KEY = "sdm-dreidel-design";
/** The design last chosen on this phone. */
export function savedDesign(): DreidelDesign {
  try {
    const v = localStorage.getItem(DESIGN_KEY);
    return isDesign(v) ? v : "gold";
  } catch {
    return "gold";
  }
}
export function saveDesign(d: DreidelDesign) {
  try {
    localStorage.setItem(DESIGN_KEY, d);
  } catch {
    // Not remembered on this phone.
  }
}

/** A fair random letter (0–3). */
export function randomLetter() {
  const a = new Uint32Array(1);
  crypto.getRandomValues(a);
  return a[0] % 4;
}

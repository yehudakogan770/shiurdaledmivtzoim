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

/** The materials. Those with colors come in five; a chosen dreidel is "base" or "base-color". */
export type DreidelBase = "gold" | "wood" | "plastic" | "glass" | "frosted" | "food" | "candy" | "marble" | "stone" | "silver" | "enamel";
export interface DreidelColor {
  id: string;
  name: string;
  hex: string;
}

export const BASES: { id: DreidelBase; name: string; colors?: DreidelColor[] }[] = [
  { id: "gold", name: "Gold" },
  {
    id: "enamel",
    name: "Gold & Enamel",
    colors: [
      { id: "blue", name: "Blue", hex: "#1d3fb0" },
      { id: "red", name: "Red", hex: "#b3161c" },
      { id: "green", name: "Green", hex: "#11804a" },
      { id: "purple", name: "Purple", hex: "#5b2a9e" },
      { id: "black", name: "Black", hex: "#17171c" },
    ],
  },
  { id: "silver", name: "Silver" },
  { id: "wood", name: "Wood" },
  {
    id: "plastic",
    name: "Plastic",
    colors: [
      { id: "blue", name: "Blue", hex: "#1a58e6" },
      { id: "red", name: "Red", hex: "#d81f2a" },
      { id: "green", name: "Green", hex: "#1f9a46" },
      { id: "purple", name: "Purple", hex: "#7a2fd0" },
      { id: "yellow", name: "Yellow", hex: "#f2c21a" },
    ],
  },
  { id: "glass", name: "Glass" },
  {
    id: "frosted",
    name: "Frosted Glass",
    colors: [
      { id: "clear", name: "Clear", hex: "#f4f6ff" },
      { id: "blue", name: "Blue", hex: "#b9d2ff" },
      { id: "pink", name: "Pink", hex: "#ffc4dc" },
      { id: "green", name: "Green", hex: "#c2efd2" },
      { id: "amber", name: "Amber", hex: "#ffd596" },
    ],
  },
  { id: "marble", name: "Marble" },
  { id: "stone", name: "Stone" },
  { id: "food", name: "Food" },
  { id: "candy", name: "Fruity Candy" },
];

/** A chosen dreidel: a material, and its color if it has colors ("plastic-red", "gold"). */
export type DreidelDesign = string;

export function parseDesign(id: DreidelDesign) {
  const [b, c] = id.split("-");
  const base = BASES.find((x) => x.id === b) ?? BASES[0];
  const color = base.colors ? base.colors.find((x) => x.id === c) ?? base.colors[0] : undefined;
  return { base, color, id: color ? `${base.id}-${color.id}` : base.id };
}

/** Every design, one per color. */
export const DESIGNS: DreidelDesign[] = BASES.flatMap((b) => (b.colors ? b.colors.map((c) => `${b.id}-${c.id}`) : [b.id]));

export const isDesign = (v: unknown): v is DreidelDesign => typeof v === "string" && DESIGNS.includes(v);

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

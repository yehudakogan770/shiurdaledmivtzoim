import type { ComponentType } from "react";
import { BookOpen, DoorOpen, Flame, Gift, GraduationCap, HandCoins, Heart, House, ScrollText, Sparkles, Users, UtensilsCrossed, Wine } from "lucide-react";
import { ChallahIcon, LulavIcon, TefillinIcon } from "@/components/icons";
import type { Activity, PersonalCategory } from "./types";

type Icon = ComponentType<{ size?: number; className?: string }>;

/** Pictures an admin can choose for a mivtza ("auto" picks one from the name). */
export const ICON_CHOICES: { id: string; label: string; Icon: Icon }[] = [
  { id: "tefillin", label: "Tefillin", Icon: TefillinIcon },
  { id: "candles", label: "Candles", Icon: Flame },
  { id: "challah", label: "Challah", Icon: ChallahIcon },
  { id: "scroll", label: "Scroll / pamphlet", Icon: ScrollText },
  { id: "lulav", label: "Lulav & Esrog", Icon: LulavIcon },
  { id: "mezuzah", label: "Mezuzah / door", Icon: DoorOpen },
  { id: "sefer", label: "Sefer / learning", Icon: BookOpen },
  { id: "tzedakah", label: "Tzedakah", Icon: HandCoins },
  { id: "kiddush", label: "Kiddush / L'chaim", Icon: Wine },
  { id: "kashrus", label: "Kashrus", Icon: UtensilsCrossed },
  { id: "home", label: "Home", Icon: House },
  { id: "people", label: "People", Icon: Users },
  { id: "chinuch", label: "Chinuch", Icon: GraduationCap },
  { id: "gift", label: "Gift", Icon: Gift },
  { id: "heart", label: "Kindness", Icon: Heart },
  { id: "sparkles", label: "Other", Icon: Sparkles },
];

/** The picture for a mivtza: the one an admin chose, otherwise one guessed from its name. */
export function iconForCategory(c: { name?: string | null; icon?: string | null } | null | undefined): Icon {
  const chosen = ICON_CHOICES.find((x) => x.id === c?.icon);
  return chosen ? chosen.Icon : iconForName(c?.name);
}

/** Icons for mivtzoim added by name: challah gets a challah roll; scrolls, l'chaims and pamphlets get a scroll. */
export function iconForName(name: string | null | undefined): Icon {
  const n = (name ?? "").toLowerCase().replace(/[^a-z]/g, "");
  if (n.includes("challa")) return ChallahIcon;
  if (["lulav", "esrog", "etrog", "arbaminim", "fourspecies"].some((w) => n.includes(w))) return LulavIcon;
  const scroll = ["scroll", "lchaim", "lechaim", "lchayim", "lechayim", "pamphlet", "brochure", "booklet"];
  if (scroll.some((w) => n.includes(w))) return ScrollText;
  return Sparkles;
}

/** The icon for any logged entry. */
export function iconForActivity(a: Pick<Activity, "category_type" | "personal_category_id">, categories: PersonalCategory[]): Icon {
  if (a.category_type === "tefillin") return TefillinIcon;
  if (a.category_type === "shabbos_candles") return Flame;
  return iconForCategory(categories.find((c) => c.id === a.personal_category_id));
}

import type { ComponentType } from "react";
import { Flame, ScrollText, Sparkles } from "lucide-react";
import { ChallahIcon, TefillinIcon } from "@/components/icons";
import type { Activity, PersonalCategory } from "./types";

type Icon = ComponentType<{ size?: number; className?: string }>;

/** Icons for mivtzoim added by name: challah gets a challah roll; scrolls, l'chaims and pamphlets get a scroll. */
export function iconForName(name: string | null | undefined): Icon {
  const n = (name ?? "").toLowerCase().replace(/[^a-z]/g, "");
  if (n.includes("challa")) return ChallahIcon;
  const scroll = ["scroll", "lchaim", "lechaim", "lchayim", "lechayim", "pamphlet", "brochure", "booklet"];
  if (scroll.some((w) => n.includes(w))) return ScrollText;
  return Sparkles;
}

/** The icon for any logged entry. */
export function iconForActivity(a: Pick<Activity, "category_type" | "personal_category_id">, categories: PersonalCategory[]): Icon {
  if (a.category_type === "tefillin") return TefillinIcon;
  if (a.category_type === "shabbos_candles") return Flame;
  return iconForName(categories.find((c) => c.id === a.personal_category_id)?.name);
}

"use client";

import { useSyncExternalStore } from "react";
import { Locale } from "@hebcal/core";
import frHebcal from "@hebcal/locales/fr.po";
import esHebcal from "@hebcal/locales/es.po";
import { STRINGS } from "./strings";

/**
 * The site in English, Hebrew (עברית), French and Spanish.
 *
 * Every piece of the site's own text goes through t("English text"), which gives it in the
 * chosen language (or the English when there's no translation yet). Hebrew stays Hebrew in every
 * language. English words are translated; transliterated Hebrew words (Tefillin, Shabbos,
 * Mivtzoim) are written the way the chosen language writes them (תפילין, Téfilines, Tefilín).
 * What people type themselves (route names, places) stays as they typed it.
 */
export type Lang = "en" | "he" | "fr" | "es";

export const LANGUAGES: { code: Lang; name: string; english: string }[] = [
  { code: "en", name: "English", english: "English" },
  { code: "he", name: "עברית", english: "Hebrew" },
  { code: "fr", name: "Français", english: "French" },
  { code: "es", name: "Español", english: "Spanish" },
];

const LOCALES: Record<Lang, string> = { en: "en-US", he: "he-IL", fr: "fr-FR", es: "es-ES" };
const KEY = "sdm-language";

// French and Spanish names for the parshiyos and Yamim Tovim.
Locale.addLocale("fr", frHebcal as never);
Locale.addLocale("es", esHebcal as never);

export const isLang = (v: unknown): v is Lang => v === "en" || v === "he" || v === "fr" || v === "es";

function stored(): Lang {
  try {
    const v = localStorage.getItem(KEY);
    return isLang(v) ? v : "en";
  } catch {
    return "en";
  }
}

let current: Lang = typeof window === "undefined" ? "en" : stored();
const listeners = new Set<() => void>();

function applyToPage() {
  if (typeof document === "undefined") return;
  document.documentElement.lang = current;
  document.documentElement.dir = current === "he" ? "rtl" : "ltr";
}
applyToPage();

/** The language the site is showing now. */
export const getLang = () => current;
/** For dates and numbers: "en-US", "he-IL", "fr-FR", "es-ES". */
export const locale = () => LOCALES[current];
export const isRtl = () => current === "he";

/** Switch the whole site to this language (and remember it on this device). */
export function setLanguage(lang: Lang) {
  if (!isLang(lang) || lang === current) return;
  current = lang;
  try {
    localStorage.setItem(KEY, lang);
  } catch {
    // Not remembered on this device; the account still has it.
  }
  applyToPage();
  listeners.forEach((l) => l());
}

/** Re-renders when the language changes. */
export function useLang(): Lang {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => current,
    () => "en",
  );
}

/**
 * The site's text in the chosen language: t("Add photos"), t("Added {name}.", { name }).
 * Text with no translation (or typed by people) comes back as it is.
 */
export function t(english: string, vars?: Record<string, string | number>): string {
  let out = current === "en" ? english : (STRINGS[current][english] ?? STRINGS[current][english.trim()] ?? english);
  if (vars) for (const [k, v] of Object.entries(vars)) out = out.split(`{${k}}`).join(String(v));
  return out;
}

/** "1 photo" / "3 photos": the singular for exactly one, else the plural (both go through t). */
export function tn(n: number, one: string, many: string, vars?: Record<string, string | number>) {
  return t(n === 1 ? one : many, { n, ...vars });
}

/** The Hebrew-calendar name in the chosen language (for hebcal's own names). */
export function hebcalName(name: string) {
  if (current === "he") return Locale.gettext(name, "he-x-nonikud");
  if (current === "fr" || current === "es") return Locale.gettext(name, current);
  return Locale.gettext(name, "ashkenazi");
}

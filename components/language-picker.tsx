"use client";

import { Languages } from "lucide-react";
import { LANGUAGES, setLanguage, t, useLang, type Lang } from "@/lib/i18n";
import { useData } from "@/lib/data";
import { Card, CardTitle, cx } from "./ui";

/** The four languages as buttons, each in its own language. Picking one switches the site right away. */
export function LanguageButtons({ onPick }: { onPick?(lang: Lang): void }) {
  const lang = useLang();
  return (
    <div role="radiogroup" aria-label={t("Language")} className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {LANGUAGES.map((l) => (
        <button
          key={l.code}
          type="button"
          role="radio"
          aria-checked={lang === l.code}
          lang={l.code}
          onClick={() => (onPick ? onPick(l.code) : setLanguage(l.code))}
          className={cx(
            "h-12 rounded-2xl px-3 text-sm font-medium transition",
            lang === l.code ? "bg-accent text-accent-ink shadow-card" : "bg-sunken text-ink hover:bg-ink/8",
          )}
        >
          {l.name}
        </button>
      ))}
    </div>
  );
}

/** At the bottom of Profile: the account's language, saved with the account. */
export function LanguageCard() {
  const { auth, notify } = useData();
  return (
    <Card>
      <CardTitle sub={t("The site shows in this language on every phone you sign in on.")}>
        <span className="inline-flex items-center gap-2">
          <Languages size={20} aria-hidden /> {t("Language")}
        </span>
      </CardTitle>
      <div className="px-6 pb-6">
        <LanguageButtons
          onPick={(lang) =>
            auth.setLanguage(lang).catch((err: Error) => notify(t("Your language didn't save: {message}", { message: err.message })))
          }
        />
      </div>
    </Card>
  );
}

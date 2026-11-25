"use client";

import { useState } from "react";
import { useData } from "@/lib/data";
import { namesIn, rosterLabel, yeshivasOf } from "@/lib/roster";
import type { RosterName } from "@/lib/types";
import { ADMIN_EMAILS } from "@/lib/admin";
import { Select } from "./ui";
import { t } from "@/lib/i18n";

/**
 * Picking a person from the Shiur Daled list: first the yeshiva, then the name from that
 * yeshiva's list. Nothing is typed, so every account spells a name the same way.
 */
export function RosterPick({
  value,
  yeshiva: startYeshiva,
  onPick,
  idPrefix,
  label,
  required,
}: {
  /** The picked name's id on the list, if any. */
  value?: string;
  yeshiva?: string;
  onPick(pick: RosterName | null): void;
  idPrefix: string;
  /** Who this is, for screen readers ("Chavrusa 2"). */
  label: string;
  required?: boolean;
}) {
  const { roster } = useData();
  const picked = roster.find((r) => r.id === value);
  const [yeshiva, setYeshiva] = useState(picked?.yeshiva ?? startYeshiva ?? "");
  const shown = picked?.yeshiva ?? yeshiva;
  return (
    <div className="grid min-w-0 flex-1 gap-2 sm:grid-cols-2">
      <Select
        id={`${idPrefix}-yeshiva`}
        aria-label={t("{who}, yeshiva", { who: label })}
        required={required}
        value={shown}
        onChange={(e) => {
          setYeshiva(e.target.value);
          if (picked) onPick(null);
        }}
      >
        <option value="">{t("Yeshiva")}</option>
        {yeshivasOf(roster).map((y) => (
          <option key={y} value={y}>
            {y}
          </option>
        ))}
      </Select>
      <Select
        id={`${idPrefix}-name`}
        aria-label={t("{who}, name", { who: label })}
        required={required}
        disabled={!shown}
        // Until a yeshiva is picked this is plainly switched off: darker, small words, no arrow. Then it turns into a normal box.
        className={shown ? undefined : "cursor-not-allowed !bg-ink/15 !text-xs !text-muted opacity-100"}
        style={shown ? undefined : { backgroundImage: "none" }}
        value={picked?.id ?? ""}
        onChange={(e) => onPick(roster.find((r) => r.id === e.target.value) ?? null)}
      >
        <option value="">{shown ? t("Name") : t("Pick the yeshiva first")}</option>
        {namesIn(roster, shown).map((r) => (
          <option key={r.id} value={r.id}>
            {rosterLabel(r)}
          </option>
        ))}
      </Select>
    </div>
  );
}

/** What to do when a name isn't on the list. */
export function NotOnList({ className }: { className?: string }) {
  return (
    <p className={className ?? "px-1 text-xs text-muted"}>
      {t("Name not on the list? Email us and we'll add it:")}{" "}
      <a href={`mailto:${ADMIN_EMAILS[0]}`} className="font-medium text-accent hover:underline">
        {ADMIN_EMAILS[0]}
      </a>
    </p>
  );
}

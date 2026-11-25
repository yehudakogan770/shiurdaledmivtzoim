"use client";

import { Plus, X } from "lucide-react";
import { BLANK_CHAVRUSA, chavrusasOf, hebrewName, type Chavrusa } from "@/lib/chavrusa";
import { Button, IconButton, Input, cx } from "./ui";
import { t } from "@/lib/i18n";
import { useData } from "@/lib/data";
import { rosterDisplay } from "@/lib/roster";
import { NotOnList, RosterPick } from "./roster-pick";

/**
 * The Chavrusas on a route: each one's English name, and under it the Hebrew name and the
 * mother's name with "בן" already in the middle, so only the two names are typed.
 */
export function ChavrusaFields({
  value,
  onChange,
  idPrefix,
  requireHebrew,
  forSomeoneElse,
  max = 5,
}: {
  value: Chavrusa[];
  onChange(next: Chavrusa[]): void;
  idPrefix: string;
  /** Ask for the Hebrew names whenever an English name is filled in. */
  requireHebrew?: boolean;
  /** An admin editing someone else's account: the first box isn't "Your name". */
  forSomeoneElse?: boolean;
  max?: number;
}) {
  const { roster } = useData();
  // With the Shiur Daled list set up, the English name is picked from it (yeshiva, then name), never typed.
  const fromList = roster.length > 0;
  const list = value.length ? value : [BLANK_CHAVRUSA];
  const set = (i: number, patch: Partial<Chavrusa>) => onChange(list.map((c, j) => (j === i ? { ...c, ...patch } : c)));
  return (
    <div className="grid gap-3">
      {list.map((c, i) => {
        const onList = !!c.roster && roster.some((r) => r.id === c.roster);
        const needHebrew = !!requireHebrew && !!(fromList ? onList : c.name.trim());
        // A name typed in before the list existed: shown as a reminder of who this row is.
        const typed = fromList && !onList && c.name.trim() ? c.name.trim() : "";
        return (
          <div key={i} className="grid gap-2 rounded-2xl bg-paper p-3">
            {typed && <p className="px-1 text-xs text-muted">{t("You wrote: {name}. Now pick it from the list.", { name: typed })}</p>}
            <div className="flex items-center gap-2">
              {fromList ? (
                <RosterPick
                  key={`${i}-${list.length}`}
                  idPrefix={`${idPrefix}-${i}`}
                  label={i === 0 && !forSomeoneElse ? t("Your name") : t("Chavrusa {n}", { n: i + 1 })}
                  value={onList ? c.roster : undefined}
                  yeshiva={c.yeshiva}
                  required={i === 0 || !!c.hebrew.trim() || !!c.mother.trim() || !!typed}
                  onPick={(r) => set(i, r ? { name: rosterDisplay(r), yeshiva: r.yeshiva, roster: r.id } : { roster: undefined, yeshiva: undefined })}
                />
              ) : (
              <Input
                id={`${idPrefix}-${i}`}
                aria-label={t("Chavrusa {n}, English name", { n: i + 1 })}
                value={c.name}
                onChange={(e) => set(i, { name: e.target.value })}
                // The first one is the person filling this in, so people don't think the route name is them.
                placeholder={i === 0 && !forSomeoneElse ? t("Your name") : t("Chavrusa's name")}
                autoComplete="off"
              />
              )}
              {list.length > 1 && (
                <IconButton aria-label={t("Remove Chavrusa {n}", { n: i + 1 })} onClick={() => onChange(list.filter((_, j) => j !== i))}>
                  <X size={18} />
                </IconButton>
              )}
            </div>
            {/* Hebrew, right to left: [name] בן [mother's name]. */}
            <div dir="rtl" lang="he" className="flex items-center gap-2">
              <Input
                id={`${idPrefix}-${i}-hebrew`}
                dir="rtl"
                lang="he"
                aria-label={t("Chavrusa {n}, Hebrew name", { n: i + 1 })}
                value={c.hebrew}
                required={needHebrew}
                onChange={(e) => set(i, { hebrew: e.target.value })}
                placeholder="שם"
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
                className="text-right"
              />
              <span className="shrink-0 text-lg font-medium text-muted" aria-hidden>
                בן
              </span>
              <Input
                id={`${idPrefix}-${i}-mother`}
                dir="rtl"
                lang="he"
                aria-label={t("Chavrusa {n}, mother's Hebrew name", { n: i + 1 })}
                value={c.mother}
                required={needHebrew}
                onChange={(e) => set(i, { mother: e.target.value })}
                placeholder="שם האם"
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
                className="text-right"
              />
            </div>
          </div>
        );
      })}
      <div className="flex items-center justify-between gap-2">
        <p className="px-1 text-xs text-muted">
          {fromList ? t("Yeshiva and name, then the Hebrew name and the mother's Hebrew name.") : t("English name, then the Hebrew name and the mother's Hebrew name.")}
        </p>
        {list.length < max && (
          <Button variant="ghost" className="h-9 shrink-0 px-3" onClick={() => onChange([...list, BLANK_CHAVRUSA])}>
            <Plus size={16} aria-hidden /> {t("Add another")}
          </Button>
        )}
      </div>
      {fromList && <NotOnList />}
    </div>
  );
}

/** The Chavrusas for display: each English name, with the Hebrew name small and gray under it. */
export function ChavrusaNames({ partners, className }: { partners: string[] | null | undefined; className?: string }) {
  const list = chavrusasOf(partners);
  if (list.length === 0) return null;
  return (
    <span className={cx("inline-flex flex-wrap gap-x-4 gap-y-1 align-top", className)}>
      {list.map((c, i) => (
        <span key={i} className="inline-flex flex-col leading-tight">
          <span>{c.name || hebrewName(c)}</span>
          {c.name && hebrewName(c) && (
            <span dir="rtl" lang="he" className="text-xs text-muted">
              {hebrewName(c)}
            </span>
          )}
        </span>
      ))}
    </span>
  );
}

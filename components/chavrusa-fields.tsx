"use client";

import { Plus, X } from "lucide-react";
import { BLANK_CHAVRUSA, type Chavrusa } from "@/lib/chavrusa";
import { Button, IconButton, Input } from "./ui";

/**
 * The Chavrusas on a route: each one's English name, and under it the Hebrew name and the
 * mother's name with "בן" already in the middle, so only the two names are typed.
 */
export function ChavrusaFields({
  value,
  onChange,
  idPrefix,
  requireHebrew,
  max = 5,
}: {
  value: Chavrusa[];
  onChange(next: Chavrusa[]): void;
  idPrefix: string;
  /** Ask for the Hebrew names whenever an English name is filled in. */
  requireHebrew?: boolean;
  max?: number;
}) {
  const list = value.length ? value : [BLANK_CHAVRUSA];
  const set = (i: number, patch: Partial<Chavrusa>) => onChange(list.map((c, j) => (j === i ? { ...c, ...patch } : c)));
  return (
    <div className="grid gap-3">
      {list.map((c, i) => {
        const needHebrew = !!requireHebrew && !!c.name.trim();
        return (
          <div key={i} className="grid gap-2 rounded-2xl bg-paper p-3">
            <div className="flex items-center gap-2">
              <Input
                id={`${idPrefix}-${i}`}
                aria-label={`Chavrusa ${i + 1}, English name`}
                value={c.name}
                onChange={(e) => set(i, { name: e.target.value })}
                placeholder="Chavrusa's name"
                autoComplete="off"
              />
              {list.length > 1 && (
                <IconButton aria-label={`Remove Chavrusa ${i + 1}`} onClick={() => onChange(list.filter((_, j) => j !== i))}>
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
                aria-label={`Chavrusa ${i + 1}, Hebrew name`}
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
                aria-label={`Chavrusa ${i + 1}, mother's Hebrew name`}
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
        <p className="px-1 text-xs text-muted">English name, then the Hebrew name and the mother&apos;s Hebrew name.</p>
        {list.length < max && (
          <Button variant="ghost" className="h-9 shrink-0 px-3" onClick={() => onChange([...list, BLANK_CHAVRUSA])}>
            <Plus size={16} aria-hidden /> Add another
          </Button>
        )}
      </div>
    </div>
  );
}

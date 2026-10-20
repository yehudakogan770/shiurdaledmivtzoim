"use client";

import { useState } from "react";
import { Check, Footprints, Plus } from "lucide-react";
import { useData } from "@/lib/data";
import { chavrusasOf } from "@/lib/chavrusa";
import { currentWeek } from "@/lib/dates";
import { t } from "@/lib/i18n";
import { Button, Card, Input, Modal, cx } from "./ui";

/**
 * The week's question, a slim bar right above the Mivtzoim buttons: did you go on Mivtzoim?
 * Yes opens a small pop-up with the route's Chavrusas to tap who went, and Other for anyone
 * else. Each tap saves at once.
 */
export function WeekQuestion({ week }: { week: string }) {
  const { me, data, actions, notify } = useData();
  const [open, setOpen] = useState(false);
  const answer = data.weeks.find((w) => w.user_id === me?.id && w.week === week);
  const people = answer?.people ?? [];
  const save = (went: boolean, next: string[]) => actions.answerWeek(week, { went, people: next }).catch((e: Error) => notify(e.message));

  const yes = () => {
    if (!answer?.went) save(true, people);
    setOpen(true);
  };

  return (
    <>
      <Card>
        <div className="flex items-center gap-3 px-4 py-3">
          <span aria-hidden className={cx("grid h-9 w-9 shrink-0 place-items-center rounded-full", answer?.went ? "bg-sage-soft text-sage-on-soft" : "bg-accent-soft text-accent-on-soft")}>
            {answer?.went ? <Check size={18} strokeWidth={2.6} /> : <Footprints size={18} />}
          </span>
          <button type="button" onClick={answer?.went ? () => setOpen(true) : undefined} className={cx("min-w-0 flex-1 text-start", !answer?.went && "cursor-default")} tabIndex={answer?.went ? 0 : -1}>
            <span className="block text-sm font-medium">{week === currentWeek() ? t("Went on Mivtzoim?") : t("Went on Mivtzoim that week?")}</span>
            {answer?.went && <span className="block truncate text-xs text-muted">{people.length ? people.join(", ") : t("Tap to add who went")}</span>}
          </button>
          <div className="flex shrink-0 gap-1.5" role="group" aria-label={t("Went on Mivtzoim?")}>
            <SmallChoice selected={answer?.went === true} tone="yes" onClick={yes}>
              {t("Yes")}
            </SmallChoice>
            <SmallChoice selected={answer?.went === false} tone="no" onClick={() => save(false, [])}>
              {t("No")}
            </SmallChoice>
          </div>
        </div>
      </Card>
      {/* Outside the card: its glass effect would keep the pop-up from covering the screen. */}
      {open && <WhoWent people={people} onChange={(next) => save(true, next)} onClose={() => setOpen(false)} />}
    </>
  );
}

function SmallChoice({ selected, tone, onClick, children }: { selected: boolean; tone: "yes" | "no"; onClick(): void; children: string }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={cx(
        "h-8 rounded-full border px-3.5 text-sm font-medium transition-colors",
        selected ? (tone === "yes" ? "border-transparent bg-sage-soft text-sage-on-soft" : "border-transparent bg-danger-soft text-danger") : "border-outline text-ink hover:bg-ink/8",
      )}
    >
      {children}
    </button>
  );
}

/** The small pop-up: just the names, a circle by each, and Other. */
function WhoWent({ people, onChange, onClose }: { people: string[]; onChange(next: string[]): void; onClose(): void }) {
  const { me } = useData();
  const [adding, setAdding] = useState(false);
  const [other, setOther] = useState("");
  const names = chavrusasOf(me?.partners).map((c) => c.name || c.hebrew);
  // Anyone typed in under Other, who isn't one of the route's Chavrusas.
  const others = people.filter((p) => !names.includes(p));
  const toggle = (name: string) => onChange(people.includes(name) ? people.filter((p) => p !== name) : [...people, name]);
  const addOther = () => {
    const name = other.trim();
    if (name && !people.some((p) => p.toLowerCase() === name.toLowerCase())) onChange([...people, name]);
    setOther("");
    setAdding(false);
  };

  return (
    <Modal onClose={onClose} blur>
      <div role="dialog" aria-modal="true" aria-labelledby="who-went" onClick={(e) => e.stopPropagation()} className="grid w-full max-w-xs gap-3 rounded-[28px] bg-card p-5 shadow-pop">
        <h2 id="who-went" className="text-lg font-medium">
          {t("Who went?")}
        </h2>
        <div className="grid gap-1">
          {[...names, ...others].map((name) => (
            <NameRow key={name} name={name} selected={people.includes(name)} onClick={() => toggle(name)} />
          ))}
          {adding ? (
            <form
              className="flex items-center gap-2 py-1"
              onSubmit={(e) => {
                e.preventDefault();
                addOther();
              }}
            >
              <Input autoFocus value={other} onChange={(e) => setOther(e.target.value)} placeholder={t("Their name")} aria-label={t("Their name")} maxLength={60} className="min-w-0 flex-1" />
              <Button type="submit" disabled={!other.trim()}>
                {t("Add")}
              </Button>
            </form>
          ) : (
            <button type="button" onClick={() => setAdding(true)} className="flex h-11 items-center gap-3 rounded-[14px] px-2 text-start text-accent hover:bg-accent/8">
              <span aria-hidden className="grid h-6 w-6 shrink-0 place-items-center rounded-full border-2 border-dashed border-accent">
                <Plus size={14} strokeWidth={2.6} />
              </span>
              <span className="text-sm font-medium">{t("Other")}</span>
            </button>
          )}
        </div>
        <Button type="button" onClick={onClose} className="justify-self-end">
          {t("Done")}
        </Button>
      </div>
    </Modal>
  );
}

function NameRow({ name, selected, onClick }: { name: string; selected: boolean; onClick(): void }) {
  return (
    <button type="button" role="checkbox" aria-checked={selected} onClick={onClick} className="flex h-11 items-center gap-3 rounded-[14px] px-2 text-start hover:bg-ink/5">
      <span aria-hidden className={cx("grid h-6 w-6 shrink-0 place-items-center rounded-full border-2 transition-colors", selected ? "border-accent bg-accent text-accent-ink" : "border-outline")}>
        {selected && <Check size={14} strokeWidth={3} />}
      </span>
      <span className="truncate text-sm font-medium">{name}</span>
    </button>
  );
}

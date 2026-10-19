"use client";

import { useState } from "react";
import { Check, Plus, UserRoundPlus } from "lucide-react";
import { useData } from "@/lib/data";
import { chavrusasOf, hebrewName } from "@/lib/chavrusa";
import { currentWeek } from "@/lib/dates";
import { weekTitle } from "@/lib/parsha";
import { t } from "@/lib/i18n";
import { Button, Card, Input, cx } from "./ui";

/**
 * The week's question, right above the Mivtzoim buttons: did you go on Mivtzoim? On Yes, a
 * circle by each of the route's Chavrusas to mark who went, and "Someone else" to add anyone else
 * by name. Each tap saves at once.
 */
export function WeekQuestion({ week }: { week: string }) {
  const { me, data, actions, notify } = useData();
  const [adding, setAdding] = useState(false);
  const [other, setOther] = useState("");
  const answer = data.weeks.find((w) => w.user_id === me?.id && w.week === week);
  const people = answer?.people ?? [];
  const chavrusas = chavrusasOf(me?.partners);
  const names = new Set(chavrusas.map((c) => c.name || c.hebrew));
  // Anyone typed in by name, who isn't one of the route's Chavrusas.
  const others = people.filter((p) => !names.has(p));

  const save = (went: boolean, next: string[]) => actions.answerWeek(week, { went, people: next }).catch((e: Error) => notify(e.message));
  const toggle = (name: string) => save(true, people.includes(name) ? people.filter((p) => p !== name) : [...people, name]);
  const addOther = () => {
    const name = other.trim();
    if (!name) return;
    if (!people.some((p) => p.toLowerCase() === name.toLowerCase())) save(true, [...people, name]);
    setOther("");
    setAdding(false);
  };

  return (
    <Card>
      <div className="px-6 pt-6 pb-6">
        <h2 className="text-2xl font-medium">{week === currentWeek() ? t("Did you go on Mivtzoim?") : t("Did you go on Mivtzoim the week of {week}?", { week: weekTitle(week) })}</h2>
        <div className="mt-4 grid grid-cols-2 gap-3" role="group" aria-label={t("Did you go on Mivtzoim?")}>
          <AnswerButton selected={answer?.went === true} tone="yes" onClick={() => save(true, people)}>
            {t("Yes")}
          </AnswerButton>
          <AnswerButton selected={answer?.went === false} tone="no" onClick={() => save(false, [])}>
            {t("No")}
          </AnswerButton>
        </div>

        {answer?.went && (
          <div className="mt-6">
            <p className="font-medium">{t("Who went?")}</p>
            <p className="text-sm text-muted">{t("Tap everyone who went.")}</p>
            <div className="mt-3 grid gap-2">
              {chavrusas.map((c) => {
                const name = c.name || c.hebrew;
                const he = c.name ? hebrewName(c) : "";
                return <PersonRow key={name} name={name} sub={he} selected={people.includes(name)} onClick={() => toggle(name)} />;
              })}
              {others.map((name) => (
                <PersonRow key={name} name={name} sub={t("Someone else")} selected onClick={() => toggle(name)} />
              ))}
              {adding ? (
                <form
                  className="flex items-center gap-2 rounded-[20px] bg-sunken p-2 ps-3"
                  onSubmit={(e) => {
                    e.preventDefault();
                    addOther();
                  }}
                >
                  <UserRoundPlus size={22} aria-hidden className="shrink-0 text-muted" />
                  <Input autoFocus value={other} onChange={(e) => setOther(e.target.value)} placeholder={t("Their name")} aria-label={t("Their name")} maxLength={60} className="min-w-0 flex-1" />
                  <Button type="submit" disabled={!other.trim()}>
                    {t("Add")}
                  </Button>
                </form>
              ) : (
                <button type="button" onClick={() => setAdding(true)} className="flex min-h-14 items-center gap-4 rounded-[20px] px-3 text-start text-accent hover:bg-accent/8">
                  <span aria-hidden className="grid h-7 w-7 shrink-0 place-items-center rounded-full border-2 border-dashed border-accent">
                    <Plus size={16} strokeWidth={2.6} />
                  </span>
                  <span className="font-medium">{t("Someone else")}</span>
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}

function AnswerButton({ selected, tone, onClick, children }: { selected: boolean; tone: "yes" | "no"; onClick(): void; children: string }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={cx(
        "flex h-14 items-center justify-center gap-2 rounded-full border text-lg font-medium transition-colors",
        selected
          ? tone === "yes"
            ? "border-transparent bg-sage-soft text-sage-on-soft"
            : "border-transparent bg-danger-soft text-danger"
          : "border-outline text-ink hover:bg-ink/8",
      )}
    >
      {selected && <Check size={20} strokeWidth={2.6} aria-hidden />}
      {children}
    </button>
  );
}

/** One person who might have gone, with a circle to tap. */
function PersonRow({ name, sub, selected, onClick }: { name: string; sub?: string; selected: boolean; onClick(): void }) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={selected}
      onClick={onClick}
      className={cx("flex min-h-14 items-center gap-4 rounded-[20px] px-3 py-2 text-start transition-colors", selected ? "bg-secondary-soft text-secondary-on-soft" : "hover:bg-ink/5")}
    >
      <span aria-hidden className={cx("grid h-7 w-7 shrink-0 place-items-center rounded-full border-2 transition-colors", selected ? "border-accent bg-accent text-accent-ink" : "border-outline")}>
        {selected && <Check size={16} strokeWidth={3} />}
      </span>
      <span className="min-w-0">
        <span className="block font-medium">{name}</span>
        {sub && <span className="block truncate text-sm text-muted">{sub}</span>}
      </span>
    </button>
  );
}

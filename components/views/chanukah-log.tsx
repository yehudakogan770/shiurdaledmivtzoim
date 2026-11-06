"use client";

import { useMemo, useState, type ReactNode } from "react";
import { Check, ChevronLeft, Minus, Moon, Plus, Sun, Trash2, X } from "lucide-react";
import { useData, type ChanukahInput } from "@/lib/data";
import type { ChanukahEntry } from "@/lib/types";
import { useNav } from "@/lib/nav";
import { chavrusasOf } from "@/lib/chavrusa";
import { isNightNow } from "@/lib/chanukah";
import { toISODate } from "@/lib/dates";
import { t, tn } from "@/lib/i18n";
import { useChanukahNow } from "../chanukah";
import { GeltShower } from "../gelt-shower";
import { MenorahIcon } from "../icons";
import { Empty, Input, Textarea, cx } from "../ui";

/** Places to tap in, so the bochurim see what kind of answer fits. */
const PLACE_IDEAS = ["Menorah lighting", "Street Mivtzoim", "Bikur Bayis", "Chabad House event", "Old age home"];
const STEPS = 4;

/**
 * Logging a Chanukah stop, one question at a time: who went, where, day or night, what they did
 * (each menorah lit with how many people lit it, and how many were given out), then a last look
 * before saving. One person logs it for the whole group. Opened with ?edit=<id> to fix an entry.
 */
export function ChanukahLogView() {
  const { me, guest, chanukah } = useData();
  const { query } = useNav();
  const editing = query.edit ? chanukah?.find((e) => e.id === query.edit) : undefined;
  if (!me || guest) {
    return <Empty title={t("Sign in to log Chanukah")} icon={MenorahIcon} />;
  }
  if (chanukah === null) {
    return <Empty title={t("Chanukah isn't set up yet")}>{t("Ask the Owner to run database update 019 in Supabase.")}</Empty>;
  }
  if (query.edit && !editing) {
    return <Empty title={t("That entry isn't here anymore")} />;
  }
  // A new form for each entry, so an entry opened from a link fills in once it has loaded.
  return <ChanukahForm key={editing?.id ?? "new"} editing={editing} />;
}

function ChanukahForm({ editing }: { editing?: ChanukahEntry }) {
  const { me, chanukah, data, actions, notify } = useData();
  const { go } = useNav();
  const state = useChanukahNow();

  const [step, setStep] = useState(1);
  const [people, setPeople] = useState<string[]>(editing?.people ?? []);
  const [typed, setTyped] = useState("");
  const [place, setPlace] = useState(editing?.place ?? "");
  const [night, setNight] = useState(editing ? editing.time_of_day === "night" : isNightNow(state.now));
  const [lit, setLit] = useState(editing ? editing.menorahs.length > 0 : true);
  const [gave, setGave] = useState(editing ? editing.given_out > 0 : false);
  const [menorahs, setMenorahs] = useState<number[]>(editing?.menorahs.length ? editing.menorahs : [1]);
  const [given, setGiven] = useState(editing?.given_out || 1);
  const [notes, setNotes] = useState(editing?.notes ?? "");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  // Counts each new stop logged, so each one gets its own gelt shower (and a re-render never replays it).
  const [celebration, setCelebration] = useState(0);

  // Names to tap: the route's Chavrusas, then anyone they've written down before.
  const names = useMemo(() => {
    const list = chavrusasOf(me?.partners).map((c) => c.name || c.hebrew);
    for (const w of data.weeks) if (w.user_id === me?.id) list.push(...w.people);
    for (const e of chanukah ?? []) if (e.user_id === me?.id) list.push(...e.people);
    return [...new Set(list.map((n) => n.trim()).filter(Boolean))];
  }, [me, data.weeks, chanukah]);

  const toggle = (name: string) => setPeople((p) => (p.includes(name) ? p.filter((x) => x !== name) : [...p, name]));
  const addTyped = () => {
    const name = typed.trim();
    if (name && !people.some((p) => p.toLowerCase() === name.toLowerCase())) setPeople((p) => [...p, name]);
    setTyped("");
  };

  const shownNames = [...names, ...people.filter((p) => !names.includes(p))];
  const finalMenorahs = lit ? menorahs : [];
  const finalGiven = gave ? given : 0;
  const peopleLit = finalMenorahs.reduce((a, n) => a + n, 0);

  const canNext = step === 1 ? people.length > 0 : step === 2 ? place.trim().length > 0 : step === 3 ? finalMenorahs.length > 0 || finalGiven > 0 : true;
  const hint = step === 1 ? t("Tap or type at least one name.") : step === 2 ? t("Write where you were.") : t("Tap what you did and fill in the numbers.");

  async function save() {
    setBusy(true);
    const entry: ChanukahInput = {
      year: editing?.year ?? state.year,
      entry_date: editing?.entry_date ?? toISODate(state.now),
      time_of_day: night ? "night" : "day",
      place,
      people,
      menorahs: finalMenorahs,
      given_out: finalGiven,
      notes: notes || null,
      is_test: editing?.is_test ?? state.testing,
    };
    try {
      await actions.saveChanukah(entry, editing?.id);
      setDone(true);
      if (!editing) setCelebration((n) => n + 1);
    } catch (e) {
      notify((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!editing || !confirm(t("Delete this Chanukah entry?"))) return;
    try {
      await actions.deleteChanukah(editing.id);
      notify(t("Entry deleted."));
      go("/history?chanukah=1");
    } catch (e) {
      notify((e as Error).message);
    }
  }

  if (done) {
    return (
      <div className="mx-auto max-w-md pt-[18vh] text-center">
        {/* Gold gelt falls around the message when a new stop is logged. */}
        {!editing && celebration > 0 && <GeltShower key={celebration} />}
        <h1 className="text-[2.4rem] leading-tight">
          <span className="chanukah-gold">{editing ? t("Saved") : t("Logged! Keep Lighting Up the City")}</span>
        </h1>
        <p className="mt-2 text-sm text-muted">
          {[finalMenorahs.length ? tn(finalMenorahs.length, "1 menorah lit", "{n} menorahs lit") : "", peopleLit ? tn(peopleLit, "1 person lit", "{n} people lit") : "", finalGiven ? tn(finalGiven, "1 menorah given out", "{n} menorahs given out") : ""]
            .filter(Boolean)
            .join(" · ")}
        </p>
        <div className="mt-6 grid gap-3">
          {!editing && (
            <GlossyButton
              onClick={() => {
                // Same group, a new place.
                setDone(false);
                setStep(2);
                setPlace("");
                setMenorahs([1]);
                setGiven(1);
                setNotes("");
              }}
            >
              {t("Log Another Stop")}
            </GlossyButton>
          )}
          <GlossyButton ghost onClick={() => go("/")}>
            {t("Back to Home")}
          </GlossyButton>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl">
      {/* Progress */}
      <div className="flex gap-1.5 pt-1" aria-hidden>
        {Array.from({ length: STEPS }, (_, i) => (
          <i key={i} className={cx("h-1 flex-1 rounded-full", i < step ? "bg-gradient-to-r from-[#ffd27a] to-[#ff8a3d]" : "bg-ink/15")} />
        ))}
      </div>
      {state.testing && !editing && <p className="mt-4 inline-block rounded-full bg-white/10 px-3 py-1 text-xs text-muted">{t("Test mode: this won't count")}</p>}
      <p className="mt-4 text-xs font-semibold uppercase tracking-[0.14em] text-accent">
        {editing ? t("Edit Chanukah entry") : t("Log Chanukah")} · {t("{n} of {total}", { n: step, total: STEPS })}
      </p>

      {step === 1 && (
        <Question title={t("Who Went?")} sub={t("Add everyone who was there. One of you logs it for the whole group.")}>
          <div className="flex flex-wrap gap-2">
            {shownNames.map((name) => (
              <Pill key={name} on={people.includes(name)} onClick={() => toggle(name)}>
                {people.includes(name) && <Check size={16} strokeWidth={2.6} aria-hidden />}
                {name}
              </Pill>
            ))}
          </div>
          <form
            className="mt-3 flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              addTyped();
            }}
          >
            <Input value={typed} onChange={(e) => setTyped(e.target.value)} placeholder={t("e.g. Dovid Klein")} aria-label={t("Add a name")} maxLength={60} className="min-w-0 flex-1" />
            <button type="submit" disabled={!typed.trim()} className="rounded-2xl bg-white/10 px-4 text-sm font-medium disabled:opacity-40">
              {t("Add")}
            </button>
          </form>
          <p className="mt-1.5 px-1 text-xs text-muted">{t("Type a name that isn't on the list")}</p>
        </Question>
      )}

      {step === 2 && (
        <Question title={t("Where Were You?")} sub={t("Write the place, or tap one below and add to it.")}>
          <Input value={place} onChange={(e) => setPlace(e.target.value)} placeholder={t("e.g. Menorah lighting on Kingston, Street Mivtzoim")} aria-label={t("Where were you?")} maxLength={120} />
          <p className="mt-3 px-1 text-sm text-muted">{t("Tap to fill in:")}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {PLACE_IDEAS.map((idea) => (
              <button key={idea} type="button" onClick={() => setPlace(t(idea))} className="rounded-full bg-white/10 px-3.5 py-1.5 text-sm text-muted hover:bg-white/15">
                {t(idea)}
              </button>
            ))}
          </div>
          <p className="mt-7 text-xs font-semibold uppercase tracking-[0.14em] text-accent">{t("Day or Night?")}</p>
          <div role="radiogroup" aria-label={t("Day or Night?")} className="mt-2 flex h-14 rounded-full border border-white/15 bg-white/5 p-1">
            <SwitchSide on={!night} onClick={() => setNight(false)}>
              <Sun size={17} aria-hidden /> {t("Day")}
            </SwitchSide>
            <SwitchSide on={night} onClick={() => setNight(true)}>
              <Moon size={17} aria-hidden /> {t("Night")}
            </SwitchSide>
          </div>
        </Question>
      )}

      {step === 3 && (
        <Question title={t("What Did You Do?")} sub={t("Tap everything you did there.")}>
          <div className="flex flex-wrap gap-2">
            <Pill on={lit} onClick={() => setLit(!lit)}>
              {lit && <Check size={16} strokeWidth={2.6} aria-hidden />}
              {t("Lit menorahs")}
            </Pill>
            <Pill on={gave} onClick={() => setGave(!gave)}>
              {gave && <Check size={16} strokeWidth={2.6} aria-hidden />}
              {t("Gave out menorahs")}
            </Pill>
          </div>

          {lit && (
            <>
              <p className="mt-7 text-xs font-semibold uppercase tracking-[0.14em] text-accent">{t("Menorahs You Lit")}</p>
              {menorahs.map((n, i) => (
                <div key={i} className="flex items-center gap-3 py-2.5">
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-[14px] bg-[#ffbe5a]/15 font-semibold text-accent">{i + 1}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block">{t("Menorah {n}", { n: i + 1 })}</span>
                    <span className="block text-xs text-muted">{t("How many people lit?")}</span>
                  </span>
                  <Stepper value={n} label={t("People who lit menorah {n}", { n: i + 1 })} onChange={(v) => setMenorahs((list) => list.map((x, j) => (j === i ? v : x)))} />
                  {menorahs.length > 1 && (
                    <button type="button" aria-label={t("Remove menorah {n}", { n: i + 1 })} onClick={() => setMenorahs((list) => list.filter((_, j) => j !== i))} className="grid h-9 w-9 place-items-center rounded-full text-muted hover:bg-white/10">
                      <X size={16} />
                    </button>
                  )}
                </div>
              ))}
              <button type="button" onClick={() => setMenorahs((list) => [...list, 1])} className="mt-1 flex h-12 w-full items-center justify-center gap-2 rounded-[18px] border border-white/15 bg-gradient-to-b from-white/15 to-white/5 font-medium shadow-[inset_0_1px_0_rgba(255,255,255,.25)]">
                <Plus size={18} aria-hidden /> {t("Add another menorah")}
              </button>
            </>
          )}

          {gave && (
            <>
              <p className="mt-7 text-xs font-semibold uppercase tracking-[0.14em] text-accent">{t("Menorahs You Gave Out")}</p>
              <div className="flex items-center gap-3 py-2.5">
                <span className="min-w-0 flex-1">
                  <span className="block">{t("How many?")}</span>
                  <span className="block text-xs text-muted">{t("e.g. 3")}</span>
                </span>
                <Stepper value={given} label={t("Menorahs given out")} onChange={setGiven} />
              </div>
            </>
          )}

          <p className="mt-7 text-xs font-semibold uppercase tracking-[0.14em] text-accent">{t("Anything Else? (Optional)")}</p>
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} maxLength={300} placeholder={t("e.g. Danced with them, gave out doughnuts")} aria-label={t("Anything else?")} className="mt-2" />
        </Question>
      )}

      {step === 4 && (
        <Question title={t("Check and Save")} sub={t("Make sure it's right, then save.")}>
          <dl className="grid gap-4">
            <Row label={t("Who went")} value={people.join(", ")} onEdit={() => setStep(1)} />
            <Row label={t("Where")} value={`${place} · ${night ? t("Night") : t("Day")}`} onEdit={() => setStep(2)} />
            <Row
              label={t("What you did")}
              value={[
                finalMenorahs.length ? `${tn(finalMenorahs.length, "1 menorah lit", "{n} menorahs lit")} (${tn(peopleLit, "1 person lit", "{n} people lit")})` : "",
                finalGiven ? tn(finalGiven, "1 menorah given out", "{n} menorahs given out") : "",
                notes.trim(),
              ]
                .filter(Boolean)
                .join(" · ")}
              onEdit={() => setStep(3)}
            />
          </dl>
        </Question>
      )}

      {!canNext && step < 4 && <p className="mt-6 text-center text-sm text-muted">{hint}</p>}
      <div className="mt-6 flex gap-3">
        {step > 1 && (
          <button type="button" onClick={() => setStep(step - 1)} aria-label={t("Back")} className="grid h-14 w-14 shrink-0 place-items-center rounded-[20px] border border-white/15 bg-white/5">
            <ChevronLeft size={22} className="rtl:rotate-180" />
          </button>
        )}
        {step < STEPS ? (
          <GlossyButton disabled={!canNext} onClick={() => setStep(step + 1)}>
            {t("Next")}
          </GlossyButton>
        ) : (
          <GlossyButton disabled={busy} onClick={save}>
            {busy ? t("Saving…") : editing ? t("Save changes") : t("Save")}
          </GlossyButton>
        )}
      </div>
      {editing && (
        <button type="button" onClick={remove} className="mx-auto mt-6 flex items-center gap-2 text-sm text-danger">
          <Trash2 size={16} aria-hidden /> {t("Delete this entry")}
        </button>
      )}
    </div>
  );
}

function Question({ title, sub, children }: { title: string; sub: string; children: ReactNode }) {
  return (
    <section className="mt-1">
      <h1 className="text-[1.75rem] font-semibold leading-tight">{title}</h1>
      <p className="mt-1 text-sm text-muted">{sub}</p>
      <div className="mt-5">{children}</div>
    </section>
  );
}

const glossyGold =
  "relative overflow-hidden bg-gradient-to-b from-[#ffe29a] via-[#ffbd52] to-[#f28a2e] text-[#2a1300] shadow-[inset_0_1px_0_rgba(255,255,255,.7)] before:absolute before:inset-x-0 before:top-0 before:h-1/2 before:bg-gradient-to-b before:from-white/40 before:to-transparent";

function Pill({ on, onClick, children }: { on: boolean; onClick(): void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={cx(
        "inline-flex h-11 items-center gap-1.5 rounded-full px-4 text-[0.95rem] transition",
        on ? cx(glossyGold, "border border-transparent font-medium") : "border border-white/15 bg-gradient-to-b from-white/15 to-white/5 shadow-[inset_0_1px_0_rgba(255,255,255,.25)]",
      )}
    >
      <span className="relative inline-flex items-center gap-1.5">{children}</span>
    </button>
  );
}

function SwitchSide({ on, onClick, children }: { on: boolean; onClick(): void; children: ReactNode }) {
  return (
    <button type="button" role="radio" aria-checked={on} onClick={onClick} className={cx("flex flex-1 items-center justify-center gap-2 rounded-full text-[0.95rem] transition", on ? cx(glossyGold, "font-semibold") : "text-muted")}>
      <span className="relative inline-flex items-center gap-2">{children}</span>
    </button>
  );
}

function Stepper({ value, label, onChange }: { value: number; label: string; onChange(v: number): void }) {
  return (
    <div className="flex h-12 shrink-0 items-center rounded-full border border-white/15 bg-white/5" role="group" aria-label={label}>
      <button type="button" aria-label={t("Less")} disabled={value <= 1} onClick={() => onChange(Math.max(1, value - 1))} className="grid h-12 w-11 place-items-center text-accent disabled:opacity-30">
        <Minus size={18} />
      </button>
      <input
        aria-label={label}
        inputMode="numeric"
        value={value}
        onChange={(e) => {
          const n = Number(e.target.value.replace(/\D/g, ""));
          onChange(Math.max(1, Math.min(9999, n || 1)));
        }}
        className="tabular w-10 bg-transparent text-center text-lg font-medium focus:outline-none"
      />
      <button type="button" aria-label={t("More")} onClick={() => onChange(value + 1)} className="grid h-12 w-11 place-items-center text-accent">
        <Plus size={18} />
      </button>
    </div>
  );
}

function Row({ label, value, onEdit }: { label: string; value: string; onEdit(): void }) {
  return (
    <div className="flex items-start gap-3">
      <div className="min-w-0 flex-1">
        <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-accent">{label}</dt>
        <dd className="mt-1 [overflow-wrap:anywhere]">{value}</dd>
      </div>
      <button type="button" onClick={onEdit} className="shrink-0 rounded-full px-3 py-1.5 text-sm text-accent hover:bg-white/10">
        {t("Change")}
      </button>
    </div>
  );
}

function GlossyButton({ children, onClick, disabled, ghost }: { children: ReactNode; onClick(): void; disabled?: boolean; ghost?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cx(
        "flex h-14 flex-1 items-center justify-center rounded-[20px] text-[1.05rem] font-semibold transition active:scale-[0.98] disabled:opacity-40",
        ghost ? "border border-white/15 bg-gradient-to-b from-white/15 to-white/5 shadow-[inset_0_1px_0_rgba(255,255,255,.25)]" : cx(glossyGold, "shadow-[0_10px_30px_rgba(255,140,50,.3),inset_0_1px_0_rgba(255,255,255,.75)]"),
      )}
    >
      <span className="relative">{children}</span>
    </button>
  );
}

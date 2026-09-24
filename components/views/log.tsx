"use client";

import { useMemo, useState, type FormEvent } from "react";
import { Check, Flame, Minus, Plus, ScrollText, Sparkles } from "lucide-react";
import { useData } from "@/lib/data";
import { useNav } from "@/lib/nav";
import { STANDARD } from "@/lib/categories";
import { today } from "@/lib/dates";
import type { CategoryType } from "@/lib/types";
import { Button, Card, CardTitle, Field, Input, PageHeader, Select, Textarea, cx } from "../ui";

type Choice = { key: string; type: CategoryType; personalId: string | null; label: string; hint: string };

const TONE: Record<CategoryType, { on: string; chip: string; icon: typeof ScrollText }> = {
  tefillin: { on: "bg-accent-soft text-accent-on-soft", chip: "bg-accent text-accent-ink", icon: ScrollText },
  shabbos_candles: { on: "bg-candle-soft text-candle-on-soft", chip: "bg-candle text-card", icon: Flame },
  personal: { on: "bg-sage-soft text-sage-on-soft", chip: "bg-sage text-card", icon: Sparkles },
};

export function LogView() {
  const { mine, data, actions, notify } = useData();
  const { query, Link, go } = useNav();

  const choices: Choice[] = useMemo(
    () => [
      { key: "tefillin", type: "tefillin", personalId: null, label: STANDARD.tefillin.label, hint: "People who put on tefillin" },
      { key: "shabbos_candles", type: "shabbos_candles", personalId: null, label: STANDARD.shabbos_candles.label, hint: "Women and girls who received candles" },
      ...mine.categories
        .filter((c) => c.status === "active")
        .map((c) => ({ key: c.id, type: "personal" as const, personalId: c.id, label: c.name, hint: c.description || "Your own category" })),
    ],
    [mine.categories],
  );

  const [choiceKey, setChoiceKey] = useState(query.category && choices.some((c) => c.key === query.category) ? query.category : "tefillin");
  const [quantity, setQuantity] = useState(1);
  const [date, setDate] = useState(today());
  const [groupId, setGroupId] = useState(query.group ?? (mine.groups.length === 1 ? mine.groups[0].id : ""));
  const [routeId, setRouteId] = useState(query.route ?? "");
  const [locationId, setLocationId] = useState(query.location ?? "");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  const choice = choices.find((c) => c.key === choiceKey) ?? choices[0];
  const routeStops = data.stops
    .filter((s) => s.route_id === routeId)
    .sort((a, b) => a.position - b.position)
    .map((s) => ({ stop: s, loc: data.locations.find((l) => l.id === s.location_id) }))
    .filter((x) => x.loc);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (quantity < 1) return notify("Enter at least 1.");
    setBusy(true);
    try {
      await actions.log({
        category_type: choice.type,
        personal_category_id: choice.personalId,
        quantity,
        activity_date: date,
        notes,
        group_id: groupId || null,
        route_id: routeId || null,
        location_id: locationId || null,
      });
      notify(`Logged ${quantity} × ${choice.label}`);
      setQuantity(1);
      setNotes("");
      if (query.route) go(`/routes/view?id=${query.route}`);
    } catch (err) {
      notify((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid grid-cols-1 gap-6">
      <PageHeader title="Log mivtzoim" subtitle="Record what you did. It counts toward your week and your group." />

      <form onSubmit={submit} className="grid grid-cols-1 gap-3 lg:grid-cols-[1fr_22rem]">
        <div className="grid content-start gap-3">
          <Card>
            <CardTitle sub="Pick what you're logging">Mivtza</CardTitle>
            <fieldset className="grid min-w-0 gap-2 px-4 pb-4 sm:grid-cols-2">
              <legend className="sr-only">Mivtza</legend>
              {choices.map((c) => {
                const active = c.key === choice.key;
                const tone = TONE[c.type];
                const Icon = tone.icon;
                return (
                  <label
                    key={c.key}
                    className={cx(
                      "flex min-w-0 cursor-pointer items-center gap-3 rounded-[20px] p-3 transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-accent",
                      active ? tone.on : "bg-paper hover:bg-sunken",
                    )}
                  >
                    <input type="radio" name="category" value={c.key} checked={active} onChange={() => setChoiceKey(c.key)} className="sr-only" />
                    <span className={cx("grid h-11 w-11 shrink-0 place-items-center rounded-full", active ? tone.chip : "bg-card text-muted")}>
                      {active ? <Check size={20} /> : <Icon size={20} />}
                    </span>
                    <span className="min-w-0">
                      <span className="block font-medium">{c.label}</span>
                      <span className={cx("block truncate text-sm", active ? "opacity-80" : "text-muted")}>{c.hint}</span>
                    </span>
                  </label>
                );
              })}
            </fieldset>
            <p className="px-6 pb-5 text-sm text-muted">
              Doing mezuzah, tzedakah or another mivtza?{" "}
              <Link href="/profile" className="font-medium text-accent hover:underline">
                Add your own category
              </Link>
            </p>
          </Card>

          <Card className="p-6">
            <label htmlFor="log-quantity" className="text-lg font-medium">
              How many
            </label>
            <div className="mt-4 flex items-center justify-center gap-6">
              <button
                type="button"
                aria-label="One less"
                onClick={() => setQuantity(Math.max(1, quantity - 1))}
                className="grid h-14 w-14 place-items-center rounded-2xl bg-secondary-soft text-secondary-on-soft transition hover:shadow-card"
              >
                <Minus size={24} />
              </button>
              <input
                id="log-quantity"
                type="number"
                inputMode="numeric"
                min={1}
                value={quantity}
                onChange={(e) => setQuantity(Number(e.target.value))}
                className="tabular w-32 bg-transparent text-center text-[4rem] leading-none font-normal focus:outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
              />
              <button
                type="button"
                aria-label="One more"
                onClick={() => setQuantity(quantity + 1)}
                className="grid h-14 w-14 place-items-center rounded-2xl bg-accent-soft text-accent-on-soft transition hover:shadow-card"
              >
                <Plus size={24} />
              </button>
            </div>
          </Card>

          <Card className="p-6">
            <Field label="Notes (optional)" htmlFor="log-notes">
              <Textarea id="log-notes" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Put on tefillin with the manager at the pizza shop" />
            </Field>
          </Card>
        </div>

        <div className="grid content-start gap-3">
          <Card className="grid gap-4 p-6">
            <h2 className="text-lg font-medium">Details</h2>
            <Field label="Date" htmlFor="log-date">
              <Input id="log-date" type="date" value={date} max={today()} onChange={(e) => setDate(e.target.value)} />
            </Field>
            <Field label="Count toward group" htmlFor="log-group">
              <Select id="log-group" value={groupId} onChange={(e) => setGroupId(e.target.value)}>
                <option value="">Just me</option>
                {mine.groups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Route" htmlFor="log-route">
              <Select
                id="log-route"
                value={routeId}
                onChange={(e) => {
                  setRouteId(e.target.value);
                  setLocationId("");
                }}
              >
                <option value="">No route</option>
                {mine.routes.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </Select>
            </Field>
            {routeId && (
              <Field label="Stop" htmlFor="log-location">
                <Select id="log-location" value={locationId} onChange={(e) => setLocationId(e.target.value)}>
                  <option value="">Any stop</option>
                  {routeStops.map(({ stop, loc }) => (
                    <option key={stop.id} value={loc!.id}>
                      {loc!.name}
                    </option>
                  ))}
                </Select>
              </Field>
            )}
          </Card>
          <Button type="submit" disabled={busy} className="h-14 w-full rounded-2xl text-base">
            {busy ? "Saving…" : `Log ${quantity} × ${choice.label}`}
          </Button>
        </div>
      </form>
    </div>
  );
}

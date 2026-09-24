"use client";

import { useMemo, useState, type FormEvent } from "react";
import { Minus, Plus } from "lucide-react";
import { useData } from "@/lib/data";
import { useNav } from "@/lib/nav";
import { STANDARD } from "@/lib/categories";
import { today } from "@/lib/dates";
import type { CategoryType } from "@/lib/types";
import { Button, Card, Field, Input, PageHeader, Select, Textarea, cx } from "../ui";

type Choice = { key: string; type: CategoryType; personalId: string | null; label: string; hint: string };

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

      <form onSubmit={submit} className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <Card className="grid gap-6 p-5 sm:p-6">
          <fieldset>
            <legend className="mb-2 text-sm font-semibold">Mivtza</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {choices.map((c) => {
                const active = c.key === choice.key;
                const tone =
                  c.type === "tefillin"
                    ? "border-accent bg-accent-soft"
                    : c.type === "shabbos_candles"
                      ? "border-candle bg-candle-soft"
                      : "border-sage bg-sage-soft";
                return (
                  <label
                    key={c.key}
                    className={cx("cursor-pointer rounded-md border px-4 py-3 transition-colors", active ? tone : "border-line hover:bg-sunken")}
                  >
                    <input type="radio" name="category" value={c.key} checked={active} onChange={() => setChoiceKey(c.key)} className="sr-only" />
                    <span className="block font-semibold">{c.label}</span>
                    <span className="block text-sm text-muted">{c.hint}</span>
                  </label>
                );
              })}
            </div>
            <p className="mt-2 text-sm text-muted">
              Doing mezuzah, tzedakah or another mivtza? <Link href="/profile" className="font-semibold text-accent">Add your own category</Link>.
            </p>
          </fieldset>

          <div className="grid gap-1.5">
            <label htmlFor="log-quantity" className="text-sm font-semibold">
              How many
            </label>
            <div className="flex items-center gap-2">
              <Button variant="secondary" aria-label="One less" onClick={() => setQuantity(Math.max(1, quantity - 1))} className="h-12 w-12 px-0">
                <Minus size={18} />
              </Button>
              <Input
                id="log-quantity"
                type="number"
                inputMode="numeric"
                min={1}
                value={quantity}
                onChange={(e) => setQuantity(Number(e.target.value))}
                className="tabular h-12 w-24 text-center font-display text-2xl font-bold"
              />
              <Button variant="secondary" aria-label="One more" onClick={() => setQuantity(quantity + 1)} className="h-12 w-12 px-0">
                <Plus size={18} />
              </Button>
            </div>
          </div>

          <Field label="Notes" htmlFor="log-notes" hint="Optional. A name, a place, anything to remember.">
            <Textarea id="log-notes" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Put on tefillin with the manager at the pizza shop" />
          </Field>
        </Card>

        <div className="grid content-start gap-6">
          <Card className="grid gap-4 p-5">
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
          <Button type="submit" disabled={busy} className="w-full py-3 text-base">
            {busy ? "Saving…" : `Log ${quantity} × ${choice.label}`}
          </Button>
        </div>
      </form>
    </div>
  );
}

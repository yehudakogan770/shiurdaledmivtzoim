"use client";

import type { ComponentType } from "react";
import { useMemo, useState, type FormEvent } from "react";
import { Check, Flame, Minus, Plus, Sparkles } from "lucide-react";
import { TefillinIcon } from "../icons";
import { useData } from "@/lib/data";
import { iconForName } from "@/lib/category-icons";
import { useNav } from "@/lib/nav";
import { activityWeek, today } from "@/lib/dates";
import { weekTitle } from "@/lib/parsha";
import { orderedMivtzoim } from "@/lib/categories";
import type { CategoryType } from "@/lib/types";
import { Button, Card, CardTitle, Field, Input, PageHeader, Select, cx } from "../ui";

type Choice = { key: string; type: CategoryType; personalId: string | null; label: string; hint: string; icon?: ComponentType<{ size?: number }> };

const TONE: Record<CategoryType, { on: string; chip: string; icon: ComponentType<{ size?: number }> }> = {
  tefillin: { on: "bg-accent-soft text-accent-on-soft", chip: "bg-accent text-accent-ink", icon: TefillinIcon },
  shabbos_candles: { on: "bg-candle-soft text-candle-on-soft", chip: "bg-candle text-card", icon: Flame },
  personal: { on: "bg-sage-soft text-sage-on-soft", chip: "bg-sage text-card", icon: Sparkles },
};

export function LogView() {
  const { mine, shared, builtins, data, actions, notify } = useData();
  const { query, Link, go } = useNav();

  const choices: Choice[] = useMemo(
    () => [
      // The front-page mivtzoim in the admin's order, then the person's own categories.
      ...orderedMivtzoim(builtins, shared).flatMap((m): Choice[] => {
        if (m.builtin) {
          const b = m.builtin;
          if (b.hidden || b.removed) return [];
          return [{ key: b.type, type: b.type, personalId: null, label: b.name, hint: b.type === "tefillin" ? "People who put on Tefillin" : "Women and girls who received candles" }];
        }
        const c = m.category;
        return c.status === "active" ? [{ key: c.id, type: "personal", personalId: c.id, label: c.name, hint: "For everyone", icon: iconForName(c.name) }] : [];
      }),
      ...mine.categories
        .filter((c) => c.status === "active")
        .map((c) => ({ key: c.id, type: "personal" as const, personalId: c.id, label: c.name, hint: c.description || "Your own category", icon: iconForName(c.name) })),
    ],
    [mine.categories, shared, builtins],
  );

  // Several mivtzoim can be filled in at once; each has its own amount and notes.
  const [items, setItems] = useState<Record<string, { quantity: number; notes: string }>>(() =>
    query.category && choices.some((c) => c.key === query.category) ? { [query.category]: { quantity: 1, notes: "" } } : {},
  );
  const [date, setDate] = useState(today());
  const [routeId, setRouteId] = useState(query.route ?? "");
  const [locationId, setLocationId] = useState(query.location ?? "");
  const [busy, setBusy] = useState(false);

  const selected = choices.filter((c) => items[c.key]);
  const totalCount = selected.reduce((n, c) => n + (items[c.key]?.quantity || 0), 0);
  const routeStops = data.stops
    .filter((s) => s.route_id === routeId)
    .sort((a, b) => a.position - b.position)
    .map((s) => ({ stop: s, loc: data.locations.find((l) => l.id === s.location_id) }))
    .filter((x) => x.loc);

  function toggle(key: string) {
    setItems((cur) => {
      const next = { ...cur };
      if (next[key]) delete next[key];
      else next[key] = { quantity: 1, notes: "" };
      return next;
    });
  }

  function change(key: string, patch: Partial<{ quantity: number; notes: string }>) {
    setItems((cur) => ({ ...cur, [key]: { ...cur[key], ...patch } }));
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    const toLog = selected.filter((c) => (items[c.key]?.quantity || 0) > 0);
    if (toLog.length === 0) return notify("Tap at least one Mivtza and enter how many.");
    setBusy(true);
    try {
      for (const c of toLog) {
        await actions.log({
          category_type: c.type,
          personal_category_id: c.personalId,
          quantity: items[c.key].quantity,
          activity_date: date,
          notes: items[c.key].notes,
          route_id: routeId || null,
          location_id: locationId || null,
        });
      }
      notify(`Logged ${toLog.map((c) => `${items[c.key].quantity} ${c.label}`).join(", ")}`);
      setItems({});
      if (query.route) go(`/routes/view?id=${query.route}`);
    } catch (err) {
      notify((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid grid-cols-1 gap-6">
      <PageHeader title="Log Mivtzoim" subtitle="Tap each Mivtza you did, fill in how many, then log them all at once." />

      <form onSubmit={submit} className="grid grid-cols-1 gap-3 lg:grid-cols-[1fr_22rem]">
        <div className="grid min-w-0 content-start gap-3">
          <Card>
            <CardTitle sub="Tap one or more">Mivtzoim</CardTitle>
            <div className="grid grid-cols-1 gap-2 px-4 pb-4">
              {choices.map((c) => {
                const item = items[c.key];
                const tone = TONE[c.type];
                const Icon = c.icon ?? tone.icon;
                return (
                  <div key={c.key} className={cx("rounded-[20px] transition-colors", item ? tone.on : "bg-paper")}>
                    <button
                      type="button"
                      aria-pressed={!!item}
                      onClick={() => toggle(c.key)}
                      className={cx("flex w-full min-w-0 items-center gap-3 rounded-[20px] p-3 text-left", !item && "hover:bg-sunken")}
                    >
                      <span className={cx("grid h-11 w-11 shrink-0 place-items-center rounded-full", item ? tone.chip : "bg-card text-muted")}>
                        {item ? <Check size={20} /> : <Icon size={20} />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block font-medium">{c.label}</span>
                        <span className={cx("block truncate text-sm", item ? "opacity-80" : "text-muted")}>{c.hint}</span>
                      </span>
                      {item && <span className="tabular shrink-0 text-2xl">{item.quantity}</span>}
                    </button>
                    {item && (
                      <div className="grid gap-3 px-3 pb-4 sm:grid-cols-[auto_1fr] sm:items-center">
                        <div className="flex items-center justify-center gap-3">
                          <button
                            type="button"
                            aria-label={`One less ${c.label}`}
                            onClick={() => change(c.key, { quantity: Math.max(0, item.quantity - 1) })}
                            className="grid h-12 w-12 place-items-center rounded-2xl bg-card text-ink transition hover:shadow-card"
                          >
                            <Minus size={22} />
                          </button>
                          <input
                            id={`qty-${c.key}`}
                            aria-label={`How many ${c.label}`}
                            type="number"
                            inputMode="numeric"
                            min={0}
                            value={item.quantity}
                            onChange={(e) => change(c.key, { quantity: Math.max(0, Number(e.target.value) || 0) })}
                            className="tabular w-20 bg-transparent text-center text-[2.5rem] leading-none focus:outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
                          />
                          <button
                            type="button"
                            aria-label={`One more ${c.label}`}
                            onClick={() => change(c.key, { quantity: item.quantity + 1 })}
                            className={cx("grid h-12 w-12 place-items-center rounded-2xl transition hover:shadow-card", tone.chip)}
                          >
                            <Plus size={22} />
                          </button>
                        </div>
                        <Input
                          id={`notes-${c.key}`}
                          aria-label={`Notes for ${c.label}`}
                          value={item.notes}
                          onChange={(e) => change(c.key, { notes: e.target.value })}
                          placeholder="Notes (optional)"
                          className="bg-card"
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            <p className="px-6 pb-5 text-sm text-muted">
              Doing another mivtza?{" "}
              <Link href="/profile" className="font-medium text-accent hover:underline">
                Add your own category
              </Link>
            </p>
          </Card>
        </div>

        <div className="grid content-start gap-3">
          <Card className="grid gap-4 p-6">
            <h2 className="text-lg font-medium">Details</h2>
            <Field label="Date" htmlFor="log-date" hint={date ? `Counts for ${weekTitle(activityWeek({ activity_date: date }))}` : undefined}>
              <Input id="log-date" type="date" value={date} max={today()} onChange={(e) => setDate(e.target.value)} />
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
          <Button type="submit" disabled={busy || totalCount === 0} className="h-14 w-full rounded-2xl text-base">
            {busy
              ? "Saving…"
              : selected.length === 0
                ? "Tap a Mivtza to start"
                : `Log ${selected.length === 1 ? `${totalCount} ${selected[0].label}` : `all ${selected.length} (${totalCount} total)`}`}
          </Button>
        </div>
      </form>
    </div>
  );
}

"use client";

import { useState, type FormEvent } from "react";
import { ArrowDownLeft, ArrowUpRight, Download, Package, Plus, ShieldCheck, Trash2, Wallet } from "lucide-react";
import { useData } from "@/lib/data";
import { activityWeek, addDays, currentWeek, today } from "@/lib/dates";
import { orderedMivtzoim } from "@/lib/categories";
import { weekTitle } from "@/lib/parsha";
import { buildFinanceWorkbook, monthLabel } from "@/lib/finance-export";
import type { FinanceEntry, Supply } from "@/lib/types";
import { Button, Card, CardTitle, Empty, Field, IconButton, Input, PageHeader, Segmented, Select, cx, listClass } from "../ui";
import { sum } from "./dashboard";

/** The Owner's money: donations in, expenses out, the balance, and the weekly supplies. English only (Owner screens). */

const METHODS = ["Cash App", "Zelle", "Cash", "Pushka", "Check", "Other"];
const CATEGORIES = ["Shabbos candles", "Tefillin supplies", "Lechaims", "Challah", "Water & snacks", "Bags", "Printing & pamphlets", "Transportation", "Food for the bochurim", "Other"];
const SUGGESTED: { name: string; per_week: number }[] = [
  { name: "Water bottles", per_week: 48 },
  { name: "Snacks", per_week: 40 },
  { name: "Lechaim cups", per_week: 50 },
  { name: "Challah", per_week: 20 },
  { name: "Bags", per_week: 60 },
  { name: "Shabbos candle kits", per_week: 150 },
];

const usd = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD" });

type Tab = "overview" | "in" | "out" | "supplies";

export function FinancesView() {
  const { isOwner, finances, settings, notify } = useData();
  const [tab, setTab] = useState<Tab>("overview");
  if (!isOwner) {
    return (
      <Card>
        <Empty title="Owner only" icon={ShieldCheck}>
          Only the site&apos;s Owner can see the finances.
        </Empty>
      </Card>
    );
  }
  if (!finances) {
    return (
      <div className="grid gap-3">
        <PageHeader title="Finances" subtitle="Money in, money out, and what to buy each week." />
        <Card>
          <div className="grid gap-3 px-6 py-6">
            <p className="font-medium">One database update is needed first.</p>
            <p className="text-sm text-muted">
              In Supabase, open SQL Editor → New query, paste the file <b>supabase/migrations/016_finances.sql</b> and click Run. Then reload this page. Only the Owner will be able to see these records.
            </p>
          </div>
        </Card>
      </div>
    );
  }

  async function download() {
    try {
      const blob = await buildFinanceWorkbook(finances!.entries, finances!.supplies, settings.site_name);
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `${settings.site_name} - Finances ${today()}.xlsx`;
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (e) {
      notify((e as Error).message);
    }
  }

  return (
    <div className="grid grid-cols-1 gap-3">
      <PageHeader
        title="Finances"
        subtitle="Only you can see this page."
        action={
          <Button variant="tonal" onClick={download}>
            <Download size={16} aria-hidden /> Excel
          </Button>
        }
      />
      <Totals entries={finances.entries} supplies={finances.supplies} />
      <div className="overflow-x-auto">
        <Segmented<Tab>
          label="Finances section"
          value={tab}
          onChange={setTab}
          options={[
            { value: "overview", label: "Overview" },
            { value: "in", label: "In" },
            { value: "out", label: "Out" },
            { value: "supplies", label: "Supplies" },
          ]}
        />
      </div>
      {tab === "overview" && <Overview entries={finances.entries} />}
      {tab === "in" && <Entries kind="in" entries={finances.entries} />}
      {tab === "out" && <Entries kind="out" entries={finances.entries} />}
      {tab === "supplies" && <Supplies supplies={finances.supplies} />}
    </div>
  );
}

const total = (list: FinanceEntry[]) => list.reduce((n, e) => n + e.amount, 0);

function Totals({ entries, supplies }: { entries: FinanceEntry[]; supplies: Supply[] }) {
  const month = today().slice(0, 7);
  const inn = entries.filter((e) => e.kind === "in");
  const out = entries.filter((e) => e.kind === "out");
  const toBuy = supplies.reduce((n, x) => n + Math.max(0, x.per_week - x.in_stock) * x.unit_cost, 0);
  const tiles: [string, string, string, string][] = [
    ["Balance", usd(total(inn) - total(out)), "everything in, minus everything out", total(inn) - total(out) < 0 ? "text-danger" : ""],
    ["In this month", usd(total(inn.filter((e) => e.entry_date.startsWith(month)))), monthLabel(month), "text-sage"],
    ["Out this month", usd(total(out.filter((e) => e.entry_date.startsWith(month)))), monthLabel(month), ""],
    ["Shopping this week", usd(toBuy), "what's still needed, at your prices", ""],
  ];
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {tiles.map(([label, value, note, tone]) => (
        <Card key={label}>
          <div className="px-5 py-4">
            <p className="text-sm font-medium text-muted">{label}</p>
            <p className={cx("tabular mt-1 text-2xl font-medium sm:text-3xl", tone)}>{value}</p>
            <p className="mt-1 text-xs text-muted">{note}</p>
          </div>
        </Card>
      ))}
    </div>
  );
}

function Overview({ entries }: { entries: FinanceEntry[] }) {
  const months = [...new Set(entries.map((e) => e.entry_date.slice(0, 7)))].sort().reverse();
  const out = entries.filter((e) => e.kind === "out");
  const byCategory = [...new Set(out.map((e) => e.category || "Other"))]
    .map((c) => [c, total(out.filter((e) => (e.category || "Other") === c))] as const)
    .sort((a, b) => b[1] - a[1]);
  const biggest = Math.max(1, ...byCategory.map(([, n]) => n));
  if (entries.length === 0) {
    return (
      <Card>
        <Empty title="Nothing recorded yet" icon={Wallet}>
          Add a donation under Money in, or an expense under Money out.
        </Empty>
      </Card>
    );
  }
  return (
    <div className="grid gap-3 lg:grid-cols-2">
      <Card>
        <CardTitle sub="Each month's money in and out">By month</CardTitle>
        <ul className={listClass}>
          {months.map((m) => {
            const list = entries.filter((e) => e.entry_date.startsWith(m));
            const i = total(list.filter((e) => e.kind === "in"));
            const o = total(list.filter((e) => e.kind === "out"));
            return (
              <li key={m} className="flex items-center gap-3 px-6 py-3">
                <span className="min-w-0 flex-1 font-medium">{monthLabel(m)}</span>
                <span className="tabular text-sm text-sage">+{usd(i)}</span>
                <span className="tabular text-sm text-muted">−{usd(o)}</span>
                <span className={cx("tabular w-24 text-end font-medium", i - o < 0 && "text-danger")}>{usd(i - o)}</span>
              </li>
            );
          })}
        </ul>
      </Card>
      <Card>
        <CardTitle sub="Everything spent, by what it was for">Where the money goes</CardTitle>
        {byCategory.length === 0 ? (
          <p className="px-6 pb-6 text-sm text-muted">No expenses yet.</p>
        ) : (
          <ul className="grid gap-3 px-6 pb-6">
            {byCategory.map(([c, n]) => (
              <li key={c}>
                <div className="flex justify-between text-sm">
                  <span>{c}</span>
                  <span className="tabular font-medium">{usd(n)}</span>
                </div>
                <div className="mt-1 h-2 overflow-hidden rounded-full bg-sunken">
                  <div className="h-full rounded-full bg-accent" style={{ width: `${(n / biggest) * 100}%` }} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

/** Money in or money out: add one, and the list of them, newest first. */
function Entries({ kind, entries }: { kind: "in" | "out"; entries: FinanceEntry[] }) {
  const { actions, notify } = useData();
  const blank = { date: today(), amount: "", who: "", pick: kind === "in" ? "Cash App" : CATEGORIES[0], notes: "" };
  const [form, setForm] = useState(blank);
  const [busy, setBusy] = useState(false);
  const list = entries.filter((e) => e.kind === kind).sort((a, b) => b.entry_date.localeCompare(a.entry_date) || b.created_at.localeCompare(a.created_at));

  async function add(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await actions.addFinance({
        kind,
        entry_date: form.date || today(),
        amount: Number(form.amount),
        who: form.who.trim() || null,
        method: kind === "in" ? form.pick : null,
        category: kind === "out" ? form.pick : null,
        notes: form.notes.trim() || null,
      });
      notify(kind === "in" ? `Added a donation of ${usd(Number(form.amount))}.` : `Added an expense of ${usd(Number(form.amount))}.`);
      setForm({ ...blank, date: form.date, pick: form.pick });
    } catch (err) {
      notify((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-3 lg:grid-cols-[22rem_1fr]">
      <Card>
        <CardTitle>{kind === "in" ? "Add a donation" : "Add an expense"}</CardTitle>
        <form onSubmit={add} className="grid gap-3 px-6 pb-6">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Amount ($)" htmlFor={`${kind}-amount`}>
              <Input id={`${kind}-amount`} required inputMode="decimal" type="number" min="0.01" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} placeholder="18.00" />
            </Field>
            <Field label="Date" htmlFor={`${kind}-date`}>
              <Input id={`${kind}-date`} type="date" required value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
            </Field>
          </div>
          <Field label={kind === "in" ? "How" : "What for"} htmlFor={`${kind}-pick`}>
            <Select id={`${kind}-pick`} value={form.pick} onChange={(e) => setForm({ ...form, pick: e.target.value })}>
              {(kind === "in" ? METHODS : CATEGORIES).map((m) => (
                <option key={m}>{m}</option>
              ))}
            </Select>
          </Field>
          <Field label={kind === "in" ? "From (who gave)" : "Paid by / where"} htmlFor={`${kind}-who`}>
            <Input id={`${kind}-who`} value={form.who} onChange={(e) => setForm({ ...form, who: e.target.value })} placeholder={kind === "in" ? "Name, or leave empty" : "e.g. Moshe, or Costco"} />
          </Field>
          <Field label="Notes" htmlFor={`${kind}-notes`}>
            <Input id={`${kind}-notes`} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Optional" />
          </Field>
          <Button type="submit" disabled={busy}>
            <Plus size={16} aria-hidden /> {busy ? "Saving…" : "Add"}
          </Button>
        </form>
      </Card>
      <Card>
        <CardTitle sub={`${list.length} ${list.length === 1 ? "entry" : "entries"} · ${usd(total(list))} in all`}>{kind === "in" ? "Money in" : "Money out"}</CardTitle>
        {list.length === 0 ? (
          <Empty title={kind === "in" ? "No donations yet" : "No expenses yet"} icon={kind === "in" ? ArrowDownLeft : ArrowUpRight} />
        ) : (
          <ul className={listClass}>
            {list.map((e) => (
              <li key={e.id} className="flex items-center gap-3 px-6 py-3">
                <span className={cx("grid h-10 w-10 shrink-0 place-items-center rounded-full", kind === "in" ? "bg-sage-soft text-sage-on-soft" : "bg-sunken text-muted")}>
                  {kind === "in" ? <ArrowDownLeft size={18} /> : <ArrowUpRight size={18} />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{kind === "in" ? e.who || "Anonymous" : e.category}</span>
                  <span className="block truncate text-sm text-muted">
                    {[e.entry_date, kind === "in" ? e.method : e.who, e.notes].filter(Boolean).join(" · ")}
                  </span>
                </span>
                <span className={cx("tabular text-lg font-medium", kind === "in" && "text-sage")}>{usd(e.amount)}</span>
                <IconButton
                  aria-label="Delete"
                  onClick={() => {
                    if (confirm(`Delete this ${usd(e.amount)} ${kind === "in" ? "donation" : "expense"}?`)) actions.deleteFinance(e.id);
                  }}
                >
                  <Trash2 size={18} />
                </IconButton>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

/** What to buy each week: how many are needed, how many are left, and what it costs. */
function Supplies({ supplies }: { supplies: Supply[] }) {
  const { actions, notify, data, builtins, shared } = useData();
  const [name, setName] = useState("");
  const mivtzoim = orderedMivtzoim(builtins, shared);
  const lastWeek = addDays(currentWeek(), -7);
  const list = [...supplies].sort((a, b) => (a.position ?? 999) - (b.position ?? 999) || a.created_at.localeCompare(b.created_at));
  // How many went out last week with a mivtza, from everyone's entries.
  const usedLastWeek = (key: string) =>
    sum(data.activity.filter((a) => activityWeek(a) === lastWeek && (a.category_type === key || a.personal_category_id === key)));
  const add = (n: string, per_week = 0) =>
    actions.addSupply({ name: n, per_week, in_stock: 0, unit_cost: 0, mivtza: null, position: supplies.length }).then(() => setName(""), (e: Error) => notify(e.message));
  const num = (v: string) => Math.max(0, Math.round(Number(v) || 0));
  const toBuy = list.reduce((n, x) => n + Math.max(0, x.per_week - x.in_stock) * x.unit_cost, 0);
  // Suggestions not on the list yet stay one tap away.
  const missing = SUGGESTED.filter((sg) => !list.some((x) => x.name.toLowerCase() === sg.name.toLowerCase()));

  return (
    <Card>
      <CardTitle sub={`To buy this week: ${usd(toBuy)} · Change any number and it saves.`}>Weekly supplies</CardTitle>
      {missing.length > 0 && <p className="px-6 pb-2 text-sm text-muted">{list.length ? "Add more:" : "Start with these, or add your own below:"}</p>}
      {missing.length > 0 && (
        <div className="flex flex-wrap gap-2 px-6 pb-4">
          {missing.map((s) => (
            <Button key={s.name} variant="tonal" className="h-9 px-4" onClick={() => add(s.name, s.per_week)}>
              <Plus size={14} aria-hidden /> {s.name}
            </Button>
          ))}
        </div>
      )}
      <ul className={listClass}>
        {list.map((x) => {
          const buy = Math.max(0, x.per_week - x.in_stock);
          return (
            <li key={x.id} className="grid gap-3 px-6 py-4">
              <div className="flex items-center gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-accent-soft text-accent-on-soft">
                  <Package size={18} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{x.name}</span>
                  <span className={cx("block text-sm", buy ? "text-candle" : "text-sage")}>{buy ? `Buy ${buy} · ${usd(buy * x.unit_cost)}` : "Enough for this week"}</span>
                </span>
                <IconButton aria-label={`Delete ${x.name}`} onClick={() => confirm(`Delete ${x.name}?`) && actions.deleteSupply(x.id)}>
                  <Trash2 size={18} />
                </IconButton>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <Field label="Per week" htmlFor={`${x.id}-pw`}>
                  <Input id={`${x.id}-pw`} type="number" inputMode="numeric" min="0" defaultValue={x.per_week} onBlur={(e) => num(e.target.value) !== x.per_week && actions.updateSupply(x.id, { per_week: num(e.target.value) })} />
                </Field>
                <Field label="In stock" htmlFor={`${x.id}-st`}>
                  <Input id={`${x.id}-st`} type="number" inputMode="numeric" min="0" defaultValue={x.in_stock} onBlur={(e) => num(e.target.value) !== x.in_stock && actions.updateSupply(x.id, { in_stock: num(e.target.value) })} />
                </Field>
                <Field label="Cost each" htmlFor={`${x.id}-c`}>
                  <Input
                    id={`${x.id}-c`}
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step="0.01"
                    defaultValue={x.unit_cost || ""}
                    placeholder="0.00"
                    onBlur={(e) => {
                      const v = Math.max(0, Math.round((Number(e.target.value) || 0) * 100) / 100);
                      if (v !== x.unit_cost) actions.updateSupply(x.id, { unit_cost: v });
                    }}
                  />
                </Field>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="shrink-0 text-muted">Handed out with</span>
                <Select aria-label={`Mivtza for ${x.name}`} value={x.mivtza ?? ""} onChange={(e) => actions.updateSupply(x.id, { mivtza: e.target.value || null })} className="min-w-0 flex-1">
                  <option value="">—</option>
                  {mivtzoim.map((m) => (
                    <option key={m.key} value={m.key}>
                      {m.builtin ? m.builtin.name : m.category.name}
                    </option>
                  ))}
                </Select>
                {x.mivtza && <span className="w-full text-muted">{usedLastWeek(x.mivtza)} given out the week of {weekTitle(lastWeek)}</span>}
              </div>
            </li>
          );
        })}
      </ul>
      <form
        className="flex gap-2 px-6 py-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (name.trim()) add(name.trim());
        }}
      >
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Add an item (e.g. Tefillin straps)" aria-label="New supply item" />
        <Button type="submit" disabled={!name.trim()}>
          <Plus size={16} aria-hidden /> Add
        </Button>
      </form>
    </Card>
  );
}

"use client";

import { useRef, useState, type FormEvent, type ReactNode } from "react";
import { Download, Pencil, ShieldCheck, Trash2 } from "lucide-react";
import { useData } from "@/lib/data";
import { formatShort, today } from "@/lib/dates";
import { buildFinanceWorkbook, monthLabel } from "@/lib/finance-export";
import type { FinanceEntry } from "@/lib/types";
import { givenOut } from "@/lib/given-out";
import { Button, Card, Empty, Field, IconButton, Input, PageHeader, Segmented, Select, cx } from "../ui";

/**
 * The Owner's books: donations in, expenses out, the balance, and how many of each Mivtza to buy or
 * print. Laid out as plain tables, like a ledger. English only (Owner screens).
 */

const METHODS = ["Cash App", "Zelle", "Cash", "Pushka", "Check", "Other"];
const CATEGORIES = ["Shabbos candles", "Tefillin supplies", "Lechaims", "Challah", "Water & snacks", "Bags", "Printing & pamphlets", "Transportation", "Food for the bochurim", "Other"];

const usd = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD" });
const total = (list: FinanceEntry[]) => list.reduce((n, e) => n + e.amount, 0);
/** "Oct 27, 2026" */
const day = (iso: string) => new Date(iso + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

type Tab = "summary" | "in" | "out" | "buy";

export function FinancesView() {
  const { isOwner, finances, settings, notify, data, builtins, shared } = useData();
  const [tab, setTab] = useState<Tab>("summary");
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
        <PageHeader title="Finances" />
        <Card>
          <div className="grid gap-2 px-6 py-5 text-sm">
            <p className="font-medium">One database update is needed first.</p>
            <p className="text-muted">In Supabase, open SQL Editor → New query, paste the file supabase/migrations/016_finances.sql and click Run. Then reload this page.</p>
          </div>
        </Card>
      </div>
    );
  }

  async function download() {
    try {
      const blob = await buildFinanceWorkbook(finances!.entries, givenOut(data.activity, builtins, shared, 8), settings.site_name);
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
        subtitle="Visible to the Owner only."
        action={
          <Button variant="secondary" onClick={download}>
            <Download size={16} aria-hidden /> Export
          </Button>
        }
      />
      <Summary entries={finances.entries} />
      {/* Slightly tighter tabs so all four fit across a phone. */}
      <div className="overflow-x-auto [&_button]:px-3 sm:[&_button]:px-4">
        <Segmented<Tab>
          label="Section"
          value={tab}
          onChange={setTab}
          options={[
            { value: "summary", label: "Summary" },
            { value: "in", label: "Income" },
            { value: "out", label: "Expenses" },
            { value: "buy", label: "Buy/print" },
          ]}
        />
      </div>
      {tab === "summary" && <Monthly entries={finances.entries} />}
      {tab === "in" && <Ledger kind="in" entries={finances.entries} />}
      {tab === "out" && <Ledger kind="out" entries={finances.entries} />}
      {tab === "buy" && <BuyPrint />}
    </div>
  );
}

/** A plain table: a header row, then rows; numbers line up on the right. */
function Table({ head, children, foot, wide }: { head: ReactNode; children: ReactNode; foot?: ReactNode; wide?: boolean }) {
  return (
    <div className="overflow-x-auto">
      <table className={cx("w-full border-collapse text-sm", wide && "min-w-[32rem]")}>
        <thead className="border-b border-line text-start text-xs uppercase tracking-wide text-muted">{head}</thead>
        <tbody className="divide-y divide-line/60">{children}</tbody>
        {foot && <tfoot className="border-t-2 border-line font-medium">{foot}</tfoot>}
      </table>
    </div>
  );
}
const th = "px-2 py-2.5 text-start font-medium first:ps-6 last:pe-6 sm:px-4";
const td = "px-2 py-2.5 first:ps-6 last:pe-6 sm:px-4";
/** Columns left out on phones, so the table fits without scrolling sideways. */
const wideOnly = "hidden sm:table-cell";
const num = "tabular text-end whitespace-nowrap";

/** The four numbers that matter, in one row. */
function Summary({ entries }: { entries: FinanceEntry[] }) {
  const month = today().slice(0, 7);
  const year = today().slice(0, 4);
  const inn = entries.filter((e) => e.kind === "in");
  const out = entries.filter((e) => e.kind === "out");
  const balance = total(inn) - total(out);
  const name = monthLabel(month).split(" ")[0];
  const cells: [string, string, boolean?][] = [
    ["Balance", usd(balance), balance < 0],
    [`Income, ${name}`, usd(total(inn.filter((e) => e.entry_date.startsWith(month))))],
    [`Expenses, ${name}`, usd(total(out.filter((e) => e.entry_date.startsWith(month))))],
    [`Income, ${year}`, usd(total(inn.filter((e) => e.entry_date.startsWith(year))))],
  ];
  return (
    <Card>
      <dl className="grid grid-cols-2 divide-line/60 sm:grid-cols-4 sm:divide-x">
        {cells.map(([label, value, negative]) => (
          <div key={label} className="px-6 py-4">
            <dt className="text-xs uppercase tracking-wide text-muted">{label}</dt>
            <dd className={cx("tabular mt-1 text-xl font-medium", negative && "text-danger")}>{value}</dd>
          </div>
        ))}
      </dl>
    </Card>
  );
}

function SectionTitle({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="px-6 pt-5 pb-3">
      <h2 className="font-medium">{title}</h2>
      {sub && <p className="text-sm text-muted">{sub}</p>}
    </div>
  );
}

/** Month by month, with a running balance, then expenses by category. */
function Monthly({ entries }: { entries: FinanceEntry[] }) {
  if (entries.length === 0) {
    return (
      <Card>
        <p className="px-6 py-5 text-sm text-muted">No records yet. Add income or an expense to start.</p>
      </Card>
    );
  }
  const months = [...new Set(entries.map((e) => e.entry_date.slice(0, 7)))].sort();
  let running = 0;
  const rows = months.map((m) => {
    const list = entries.filter((e) => e.entry_date.startsWith(m));
    const i = total(list.filter((e) => e.kind === "in"));
    const o = total(list.filter((e) => e.kind === "out"));
    running += i - o;
    return { m, i, o, balance: running };
  });
  const out = entries.filter((e) => e.kind === "out");
  const spent = total(out);
  const byCategory = [...new Set(out.map((e) => e.category || "Other"))]
    .map((c) => [c, total(out.filter((e) => (e.category || "Other") === c))] as const)
    .sort((a, b) => b[1] - a[1]);
  const inAll = total(entries.filter((e) => e.kind === "in"));
  return (
    <div className="grid gap-3 xl:grid-cols-2 [&>*]:min-w-0">
      <Card>
        <SectionTitle title="By month" />
        <Table
          head={
            <tr>
              <th className={th}>Month</th>
              <th className={cx(th, "text-end")}>Income</th>
              <th className={cx(th, "text-end")}>Expenses</th>
              <th className={cx(th, "text-end", wideOnly)}>Net</th>
              <th className={cx(th, "text-end")}>Balance</th>
            </tr>
          }
          foot={
            <tr>
              <td className={td}>Total</td>
              <td className={cx(td, num)}>{usd(inAll)}</td>
              <td className={cx(td, num)}>{usd(spent)}</td>
              <td className={cx(td, num, wideOnly)}>{usd(inAll - spent)}</td>
              <td className={cx(td, num)}>{usd(inAll - spent)}</td>
            </tr>
          }
        >
          {[...rows].reverse().map((r) => (
            <tr key={r.m}>
              <td className={td}>{monthLabel(r.m)}</td>
              <td className={cx(td, num)}>{usd(r.i)}</td>
              <td className={cx(td, num)}>{usd(r.o)}</td>
              <td className={cx(td, num, wideOnly, r.i - r.o < 0 && "text-danger")}>{usd(r.i - r.o)}</td>
              <td className={cx(td, num)}>{usd(r.balance)}</td>
            </tr>
          ))}
        </Table>
      </Card>
      <Card>
        <SectionTitle title="Expenses by category" />
        {byCategory.length === 0 ? (
          <p className="px-6 pb-5 text-sm text-muted">No expenses yet.</p>
        ) : (
          <Table
            head={
              <tr>
                <th className={th}>Category</th>
                <th className={cx(th, "text-end")}>Amount</th>
                <th className={cx(th, "text-end")}>Share</th>
              </tr>
            }
            foot={
              <tr>
                <td className={td}>Total</td>
                <td className={cx(td, num)}>{usd(spent)}</td>
                <td className={cx(td, num)}>100%</td>
              </tr>
            }
          >
            {byCategory.map(([c, n]) => (
              <tr key={c}>
                <td className={td}>{c}</td>
                <td className={cx(td, num)}>{usd(n)}</td>
                <td className={cx(td, num, "text-muted")}>{Math.round((n / spent) * 100)}%</td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
    </div>
  );
}

/** Income or expenses: a form to add or change one, and the full list as a table, newest first. */
function Ledger({ kind, entries }: { kind: "in" | "out"; entries: FinanceEntry[] }) {
  const { actions, notify } = useData();
  const blank = { date: today(), amount: "", who: "", pick: kind === "in" ? "Cash App" : CATEGORIES[0], notes: "" };
  const [form, setForm] = useState(blank);
  const [busy, setBusy] = useState(false);
  // The entry being changed, if any: the same form fills in with it.
  const [editing, setEditing] = useState<FinanceEntry | null>(null);
  const formTop = useRef<HTMLDivElement>(null);
  const list = entries.filter((e) => e.kind === kind).sort((a, b) => b.entry_date.localeCompare(a.entry_date) || b.created_at.localeCompare(a.created_at));
  const word = kind === "in" ? "income" : "expense";

  function edit(e: FinanceEntry) {
    setEditing(e);
    setForm({ date: e.entry_date, amount: String(e.amount), who: e.who ?? "", pick: (kind === "in" ? e.method : e.category) || blank.pick, notes: e.notes ?? "" });
    formTop.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }
  function cancel() {
    setEditing(null);
    setForm(blank);
  }

  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const fields = {
        entry_date: form.date || today(),
        amount: Number(form.amount),
        who: form.who.trim() || null,
        method: kind === "in" ? form.pick : null,
        category: kind === "out" ? form.pick : null,
        notes: form.notes.trim() || null,
      };
      if (editing) {
        await actions.updateFinance(editing.id, fields);
        notify("Saved the changes.");
        cancel();
      } else {
        await actions.addFinance({ kind, ...fields });
        notify(`Recorded ${usd(Number(form.amount))} ${word}.`);
        setForm({ ...blank, date: form.date, pick: form.pick });
      }
    } catch (err) {
      notify((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-3">
      <div ref={formTop} className="scroll-mt-24">
        <Card className={cx(editing && "ring-2 ring-accent")}>
          <SectionTitle title={editing ? `Edit ${word}` : kind === "in" ? "Record income" : "Record an expense"} />
          <form onSubmit={save} className="grid gap-3 px-6 pb-5 sm:grid-cols-2 lg:grid-cols-[8rem_10rem_1fr_1fr_1fr_auto] lg:items-end [&>*]:min-w-0">
            <Field label="Amount ($)" htmlFor={`${kind}-amount`}>
              <Input id={`${kind}-amount`} required inputMode="decimal" type="number" min="0.01" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} placeholder="0.00" />
            </Field>
            <Field label="Date" htmlFor={`${kind}-date`}>
              <Input id={`${kind}-date`} type="date" required value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
            </Field>
            <Field label={kind === "in" ? "Method" : "Category"} htmlFor={`${kind}-pick`}>
              <Select id={`${kind}-pick`} value={form.pick} onChange={(e) => setForm({ ...form, pick: e.target.value })}>
                {(kind === "in" ? METHODS : CATEGORIES).map((m) => (
                  <option key={m}>{m}</option>
                ))}
              </Select>
            </Field>
            <Field label={kind === "in" ? "From" : "Paid by / vendor"} htmlFor={`${kind}-who`}>
              <Input id={`${kind}-who`} value={form.who} onChange={(e) => setForm({ ...form, who: e.target.value })} placeholder={kind === "in" ? "Name (optional)" : "e.g. Costco"} />
            </Field>
            <Field label="Notes" htmlFor={`${kind}-notes`}>
              <Input id={`${kind}-notes`} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Optional" />
            </Field>
            <div className="flex gap-2 sm:col-span-2 lg:col-span-1">
              <Button type="submit" disabled={busy} className="flex-1 lg:flex-none">
                {busy ? "Saving…" : editing ? "Save" : "Add"}
              </Button>
              {editing && (
                <Button variant="ghost" onClick={cancel}>
                  Cancel
                </Button>
              )}
            </div>
          </form>
        </Card>
      </div>
      <Card>
        <SectionTitle title={kind === "in" ? "Income" : "Expenses"} sub={`${list.length} ${list.length === 1 ? "record" : "records"}`} />
        {list.length === 0 ? (
          <p className="px-6 pb-5 text-sm text-muted">Nothing recorded yet.</p>
        ) : (
          <>
          {/* Phones: one simple row per record, so Edit and Delete are always in reach. */}
          <ul className="divide-y divide-line/60 border-t border-line sm:hidden">
            {list.map((e) => (
              <li key={e.id} className={cx("flex items-center gap-2 py-2.5 ps-6 pe-3", editing?.id === e.id && "bg-accent/8")}>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="truncate font-medium">{kind === "in" ? e.who || "Anonymous" : e.category}</span>
                    <span className="tabular shrink-0 font-medium">{usd(e.amount)}</span>
                  </div>
                  <p className="truncate text-xs text-muted">{[day(e.entry_date), kind === "in" ? e.method : e.who, e.notes].filter(Boolean).join(" · ")}</p>
                </div>
                <IconButton aria-label="Edit" onClick={() => edit(e)} className="h-9 w-9">
                  <Pencil size={15} />
                </IconButton>
                <IconButton
                  aria-label="Delete"
                  className="h-9 w-9"
                  onClick={() => {
                    if (!confirm(`Delete this ${usd(e.amount)} ${word}?`)) return;
                    if (editing?.id === e.id) cancel();
                    actions.deleteFinance(e.id);
                  }}
                >
                  <Trash2 size={15} />
                </IconButton>
              </li>
            ))}
            <li className="flex justify-between py-2.5 ps-6 pe-6 font-medium">
              <span>Total</span>
              <span className="tabular">{usd(total(list))}</span>
            </li>
          </ul>
          <div className="hidden sm:block">
          <Table
            wide
            head={
              <tr>
                <th className={th}>Date</th>
                <th className={th}>{kind === "in" ? "From" : "Category"}</th>
                <th className={th}>{kind === "in" ? "Method" : "Paid by / vendor"}</th>
                <th className={th}>Notes</th>
                <th className={cx(th, "text-end")}>Amount</th>
                <th className={th}>
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            }
            foot={
              <tr>
                <td className={td} colSpan={4}>
                  Total
                </td>
                <td className={cx(td, num)}>{usd(total(list))}</td>
                <td className={td} />
              </tr>
            }
          >
            {list.map((e) => (
              <tr key={e.id} className={cx(editing?.id === e.id && "bg-accent/8")}>
                <td className={cx(td, "whitespace-nowrap text-muted")}>{day(e.entry_date)}</td>
                <td className={td}>{kind === "in" ? e.who || "Anonymous" : e.category}</td>
                <td className={cx(td, "text-muted")}>{(kind === "in" ? e.method : e.who) || "—"}</td>
                <td className={cx(td, "max-w-[14rem] truncate text-muted")} title={e.notes ?? undefined}>
                  {e.notes || ""}
                </td>
                <td className={cx(td, num, "font-medium")}>{usd(e.amount)}</td>
                <td className={cx(td, "whitespace-nowrap text-end")}>
                  <IconButton aria-label="Edit" onClick={() => edit(e)} className="h-8 w-8">
                    <Pencil size={15} />
                  </IconButton>
                  <IconButton
                    aria-label="Delete"
                    className="h-8 w-8"
                    onClick={() => {
                      if (!confirm(`Delete this ${usd(e.amount)} ${word}?`)) return;
                      if (editing?.id === e.id) cancel();
                      actions.deleteFinance(e.id);
                    }}
                  >
                    <Trash2 size={15} />
                  </IconButton>
                </td>
              </tr>
            ))}
          </Table>
          </div>
          </>
        )}
      </Card>
    </div>
  );
}

/** How many of each Mivtza everyone gave out each week, and how many to get for next week. */
function BuyPrint() {
  const { data, builtins, shared } = useData();
  const { weeks, items } = givenOut(data.activity, builtins, shared, 6);
  return (
    <Card>
      <SectionTitle title="Given out per week" sub="From everyone's logged Mivtzoim. Next week = the higher of last week and the 4-week average, rounded up to the next 5." />
      {weeks.length === 0 ? (
        <p className="px-6 pb-5 text-sm text-muted">No finished weeks yet.</p>
      ) : (
        <Table
          head={
            <tr>
              <th className={th}>Mivtza</th>
              {weeks.map((w, i) => (
                <th key={w} className={cx(th, "text-end whitespace-nowrap", i < weeks.length - 2 && wideOnly)}>
                  {formatShort(w)}
                </th>
              ))}
              <th className={cx(th, "text-end")}>Avg.</th>
              <th className={cx(th, "text-end whitespace-nowrap", wideOnly)}>This week</th>
              <th className={cx(th, "text-end whitespace-nowrap text-ink")}>Next week</th>
            </tr>
          }
        >
          {items.map((x) => (
            <tr key={x.key}>
              <td className={td}>{x.label}</td>
              {x.counts.map((n, i) => (
                <td key={weeks[i]} className={cx(td, num, i < weeks.length - 2 && wideOnly, n === 0 && "text-muted")}>
                  {n}
                </td>
              ))}
              <td className={cx(td, num, "text-muted")}>{Math.round(x.average)}</td>
              <td className={cx(td, num, wideOnly, "text-muted")}>{x.thisWeek}</td>
              <td className={cx(td, num, "font-semibold")}>{x.suggested}</td>
            </tr>
          ))}
        </Table>
      )}
      <p className="px-6 py-3 text-xs text-muted">Weeks are shown by their Friday. On a phone, only the last 2 weeks show; turn it sideways or open it on a computer for all 6. Water, snacks and bags aren&apos;t logged as Mivtzoim, so they can&apos;t be counted here.</p>
    </Card>
  );
}

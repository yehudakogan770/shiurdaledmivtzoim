"use client";

import { useState, type FormEvent } from "react";
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Download, Pencil, Plus, ShieldCheck, Trash2 } from "lucide-react";
import { useData } from "@/lib/data";
import { addDays, allWeeks, currentWeek, FIRST_WEEK, formatShort } from "@/lib/dates";
import { parshaName } from "@/lib/parsha";
import { buildReportWorkbook } from "@/lib/report-export";
import type { ReportCount, ReportItem } from "@/lib/types";
import { Button, Card, Empty, IconButton, Input, PageHeader, Select, cx } from "../ui";

/**
 * The weekly report: the Owner sets up the items (Scrolls, Candles…), and each week the Owner,
 * admins and accounts the Owner allowed fill in how many were sold and how many are needed for
 * next week. Plain tables, like a ledger. English only.
 */
export function ReportView() {
  const { canSeeReport, isOwner, report, settings, notify } = useData();
  const [week, setWeek] = useState(currentWeek());
  if (!canSeeReport) {
    return (
      <Card>
        <Empty title="Not available" icon={ShieldCheck}>
          The weekly report is for the Owner, admins, and accounts the Owner allows.
        </Empty>
      </Card>
    );
  }
  if (!report) {
    return (
      <div className="grid gap-3">
        <PageHeader title="Weekly report" />
        <Card>
          <div className="grid gap-2 px-6 py-5 text-sm">
            <p className="font-medium">One database update is needed first.</p>
            <p className="text-muted">
              {isOwner
                ? "In Supabase, open SQL Editor → New query, paste the file supabase/migrations/016_report_viewers.sql and click Run. Then reload this page."
                : "Ask the Owner to run database update 016 in Supabase."}
            </p>
          </div>
        </Card>
      </div>
    );
  }
  const items = [...report.items].sort((x, y) => (x.position ?? 0) - (y.position ?? 0) || x.created_at.localeCompare(y.created_at));

  async function download() {
    try {
      const blob = await buildReportWorkbook(week, items, report!.counts, settings.site_name);
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `${settings.site_name} - Weekly report ${week}.xlsx`;
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
        title="Weekly report"
        subtitle="How many of each item were sold, and how many are needed for next week."
        action={
          <Button variant="secondary" onClick={download}>
            <Download size={16} aria-hidden /> Export
          </Button>
        }
      />
      <WeekBar week={week} onChange={setWeek} />
      <WeekTable week={week} items={items} counts={report.counts} />
      {isOwner && <ManageItems items={items} />}
    </div>
  );
}

/** The week: arrows for the week before or after, or pick any week. */
function WeekBar({ week, onChange }: { week: string; onChange(week: string): void }) {
  const weeks = allWeeks(); // newest first
  return (
    <Card>
      <div className="flex items-center gap-2 px-3 py-3">
        <IconButton aria-label="Week before" disabled={addDays(week, -7) < FIRST_WEEK} onClick={() => onChange(addDays(week, -7))}>
          <ChevronLeft size={20} className="rtl:rotate-180" />
        </IconButton>
        <Select aria-label="Week" value={week} onChange={(e) => onChange(e.target.value)} className="min-w-0 flex-1 py-2.5 text-sm">
          {weeks.map((w) => (
            <option key={w} value={w}>
              {/* Short, so it fits across a phone: "Lech-Lecha · Oct 23". */}
              {`${w === currentWeek() ? "This week · " : ""}${parshaName(w)} · ${formatShort(w)}`}
            </option>
          ))}
        </Select>
        <IconButton aria-label="Week after" disabled={week === currentWeek()} onClick={() => onChange(addDays(week, 7))}>
          <ChevronRight size={20} className="rtl:rotate-180" />
        </IconButton>
      </div>
    </Card>
  );
}

/** "Need next week" until someone fills it in: the higher of this week's and the 4-week average sales, rounded up to the next 5. */
function suggestion(itemId: string, week: string, counts: ReportCount[]) {
  const sold = (w: string) => counts.find((c) => c.item_id === itemId && c.week === w)?.sold;
  const recent = [1, 2, 3, 4].map((i) => sold(addDays(week, -7 * i))).filter((n): n is number => n != null);
  const base = Math.max(sold(week) ?? 0, recent.length ? recent.reduce((a, b) => a + b, 0) / recent.length : 0);
  return base > 0 ? Math.ceil(base / 5) * 5 : null;
}

/** The week's sheet: one row per item, with boxes to fill in. Each box saves when you leave it. */
function WeekTable({ week, items, counts }: { week: string; items: ReportItem[]; counts: ReportCount[] }) {
  const { isOwner } = useData();
  const get = (itemId: string, w: string) => counts.find((c) => c.item_id === itemId && c.week === w);
  if (items.length === 0) {
    return (
      <Card>
        <p className="px-6 py-5 text-sm text-muted">{isOwner ? "No items yet. Add the first one below (for example Scrolls)." : "The Owner hasn't set up any items yet."}</p>
      </Card>
    );
  }
  return (
    <Card>
      <div className="px-6 pt-5 pb-3">
        <h2 className="font-medium">Week of {formatShort(week)}</h2>
        <p className="text-sm text-muted">Type a number and it saves. “Need next week” shows a suggestion in gray until someone fills it in.</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead className="border-b border-line text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className={th}>Item</th>
              <th className={cx(th, "text-end")}>Sold</th>
              <th className={cx(th, "text-end", wideOnly)}>Last week</th>
              <th className={cx(th, "text-end")}>Need next week</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line/60">
            {items.map((x) => {
              const row = get(x.id, week);
              const last = get(x.id, addDays(week, -7))?.sold;
              return (
                <tr key={x.id}>
                  <td className={td}>
                    <span className="block font-medium">{x.name}</span>
                    <span className="block text-xs text-muted sm:hidden">Last week: {last ?? "—"}</span>
                  </td>
                  <td className={cx(td, "text-end")}>
                    <NumberBox key={`${x.id}-${week}-sold`} label={`${x.name} sold`} value={row?.sold ?? null} itemId={x.id} week={week} field="sold" />
                  </td>
                  <td className={cx(td, num, wideOnly, "text-muted")}>{last ?? "—"}</td>
                  <td className={cx(td, "text-end")}>
                    <NumberBox key={`${x.id}-${week}-needed`} label={`${x.name} needed next week`} value={row?.needed ?? null} placeholder={suggestion(x.id, week, counts)} itemId={x.id} week={week} field="needed" />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

/** One number to fill in. Saves when you leave the box (or press Enter); empty clears it. */
function NumberBox({ label, value, placeholder, itemId, week, field }: { label: string; value: number | null; placeholder?: number | null; itemId: string; week: string; field: "sold" | "needed" }) {
  const { actions, notify } = useData();
  const [text, setText] = useState(value == null ? "" : String(value));
  const save = () => {
    const clean = text.trim();
    const next = clean === "" ? null : Math.max(0, Math.round(Number(clean)));
    if (next !== null && Number.isNaN(next)) return setText(value == null ? "" : String(value));
    if (next === value) return;
    actions.setReportCount(itemId, week, { [field]: next }).catch((e: Error) => notify(e.message));
  };
  return (
    <Input
      aria-label={label}
      type="number"
      inputMode="numeric"
      min="0"
      value={text}
      placeholder={placeholder != null ? String(placeholder) : "—"}
      onChange={(e) => setText(e.target.value)}
      onBlur={save}
      onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
      className="tabular ms-auto w-24 py-2 text-end"
    />
  );
}

/** The Owner: add, rename, reorder or remove the items. */
function ManageItems({ items }: { items: ReportItem[] }) {
  const { actions, notify } = useData();
  const [name, setName] = useState("");
  const [editing, setEditing] = useState<{ id: string; name: string } | null>(null);
  const add = (e: FormEvent) => {
    e.preventDefault();
    actions.addReportItem(name).then(() => setName(""), (err: Error) => notify(err.message));
  };
  return (
    <Card>
      <div className="px-6 pt-5 pb-3">
        <h2 className="font-medium">Items</h2>
        <p className="text-sm text-muted">Only you can change this list. Everyone who can use the report fills in the numbers.</p>
      </div>
      {items.length > 0 && (
        <ul className="divide-y divide-line/60 border-y border-line/60">
          {items.map((x, i) => (
            <li key={x.id} className="flex items-center gap-1 py-1.5 ps-6 pe-3">
              {editing?.id === x.id ? (
                <form
                  className="flex min-w-0 flex-1 gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    actions.renameReportItem(x.id, editing.name).then(() => setEditing(null), (err: Error) => notify(err.message));
                  }}
                >
                  <Input autoFocus aria-label="Item name" value={editing.name} onChange={(e) => setEditing({ id: x.id, name: e.target.value })} className="py-2" />
                  <Button type="submit" className="h-10 px-4">
                    Save
                  </Button>
                </form>
              ) : (
                <>
                  <span className="min-w-0 flex-1 truncate">{x.name}</span>
                  <IconButton aria-label={`Move ${x.name} up`} disabled={i === 0} onClick={() => actions.moveReportItem(x.id, -1)} className="h-9 w-9">
                    <ChevronUp size={18} />
                  </IconButton>
                  <IconButton aria-label={`Move ${x.name} down`} disabled={i === items.length - 1} onClick={() => actions.moveReportItem(x.id, 1)} className="h-9 w-9">
                    <ChevronDown size={18} />
                  </IconButton>
                  <IconButton aria-label={`Rename ${x.name}`} onClick={() => setEditing({ id: x.id, name: x.name })} className="h-9 w-9">
                    <Pencil size={16} />
                  </IconButton>
                  <IconButton
                    aria-label={`Remove ${x.name}`}
                    className="h-9 w-9"
                    onClick={() => confirm(`Remove ${x.name}? All of its numbers, in every week, are deleted too.`) && actions.removeReportItem(x.id)}
                  >
                    <Trash2 size={16} />
                  </IconButton>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
      <form onSubmit={add} className="flex gap-2 px-6 py-4">
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Add an item (e.g. Scrolls)" aria-label="New item" />
        <Button type="submit" disabled={!name.trim()}>
          <Plus size={16} aria-hidden /> Add
        </Button>
      </form>
    </Card>
  );
}

const th = "px-2 py-2.5 text-start font-medium first:ps-6 last:pe-6 sm:px-4";
const td = "px-2 py-2 first:ps-6 last:pe-6 sm:px-4";
const num = "tabular text-end whitespace-nowrap";
/** Columns left out on phones, so the table fits without scrolling sideways. */
const wideOnly = "hidden sm:table-cell";

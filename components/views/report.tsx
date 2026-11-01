"use client";

import { useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight, Download, ShieldCheck } from "lucide-react";
import { useData } from "@/lib/data";
import { addDays, allWeeks, currentWeek, FIRST_WEEK } from "@/lib/dates";
import { weekTitle } from "@/lib/parsha";
import { givenOut, weekReport } from "@/lib/given-out";
import { buildReportWorkbook } from "@/lib/report-export";
import { Button, Card, Empty, IconButton, PageHeader, Select, cx } from "../ui";

/**
 * The Owner's weekly report: how many of each Mivtza went out in a week, compared with the week
 * before and the 4 before that, a suggestion for how many to get next week, and each route's total.
 * Plain tables, like a ledger. English only (Owner screens).
 */
export function ReportView() {
  const { isOwner, data, people, builtins, shared, settings, notify } = useData();
  const [week, setWeek] = useState(currentWeek());
  if (!isOwner) {
    return (
      <Card>
        <Empty title="Owner only" icon={ShieldCheck}>
          Only the site&apos;s Owner can see the weekly report.
        </Empty>
      </Card>
    );
  }
  const nameOf = (id: string) => people.find((p) => p.id === id)?.name || data.names[id] || "Someone";
  const report = weekReport(data.activity, builtins, shared, week, nameOf);
  const weeks = allWeeks(); // newest first
  const isThisWeek = week === currentWeek();
  const change = report.total - report.lastTotal;

  async function download() {
    try {
      const blob = await buildReportWorkbook(week, report, givenOut(data.activity, builtins, shared, 8), settings.site_name);
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
        subtitle="How many of each Mivtza went out. Visible to the Owner only."
        action={
          <Button variant="secondary" onClick={download}>
            <Download size={16} aria-hidden /> Export
          </Button>
        }
      />

      {/* The week: arrows for the week before or after, or pick any week. */}
      <Card>
        <div className="flex items-center gap-2 px-3 py-3">
          <IconButton aria-label="Week before" disabled={addDays(week, -7) < FIRST_WEEK} onClick={() => setWeek(addDays(week, -7))}>
            <ChevronLeft size={20} className="rtl:rotate-180" />
          </IconButton>
          <Select aria-label="Week" value={week} onChange={(e) => setWeek(e.target.value)} className="min-w-0 flex-1 py-2.5 text-sm">
            {weeks.map((w) => (
              <option key={w} value={w}>
                {w === currentWeek() ? `This week · ${weekTitle(w)}` : weekTitle(w)}
              </option>
            ))}
          </Select>
          <IconButton aria-label="Week after" disabled={isThisWeek} onClick={() => setWeek(addDays(week, 7))}>
            <ChevronRight size={20} className="rtl:rotate-180" />
          </IconButton>
        </div>
      </Card>

      <Card>
        <dl className="grid grid-cols-3 divide-x divide-line/60">
          <Figure label="Total given out" value={report.total} />
          <Figure label="Vs. last week" value={`${change > 0 ? "+" : ""}${change}`} tone={change > 0 ? "text-sage" : change < 0 ? "text-danger" : ""} />
          <Figure label="Routes that logged" value={report.routes.length} />
        </dl>
        {isThisWeek && <p className="border-t border-line/60 px-6 py-2.5 text-xs text-muted">This week isn&apos;t over yet (it ends Friday), so these numbers will still grow.</p>}
      </Card>

      <div className="grid gap-3 xl:grid-cols-[3fr_2fr] [&>*]:min-w-0">
        <Card>
          <SectionTitle title="By Mivtza" sub="“Next week” is the higher of this week and the 4-week average, rounded up to the next 5." />
          <Table
            head={
              <tr>
                <th className={th}>Mivtza</th>
                <th className={cx(th, "text-end")}>This week</th>
                <th className={cx(th, "text-end")}>Last week</th>
                <th className={cx(th, "text-end", wideOnly)}>Avg.</th>
                <th className={cx(th, "text-end")}>Next week</th>
              </tr>
            }
            foot={
              <tr>
                <td className={td}>Total</td>
                <td className={cx(td, num)}>{report.total}</td>
                <td className={cx(td, num)}>{report.lastTotal}</td>
                <td className={cx(td, wideOnly)} />
                <td className={td} />
              </tr>
            }
          >
            {report.lines.map((l) => (
              <tr key={l.key}>
                <td className={td}>{l.label}</td>
                <td className={cx(td, num, "font-medium", l.count === 0 && "text-muted")}>{l.count}</td>
                <td className={cx(td, num, "text-muted")}>{l.lastWeek}</td>
                <td className={cx(td, num, wideOnly, "text-muted")}>{Math.round(l.average)}</td>
                <td className={cx(td, num, "font-semibold")}>{l.suggested}</td>
              </tr>
            ))}
          </Table>
        </Card>

        <Card>
          <SectionTitle title="By route" sub="Everything each route logged this week." />
          {report.routes.length === 0 ? (
            <p className="px-6 pb-5 text-sm text-muted">Nothing logged this week.</p>
          ) : (
            <Table
              head={
                <tr>
                  <th className={th}>Route</th>
                  <th className={cx(th, "text-end")}>Total</th>
                </tr>
              }
            >
              {report.routes.map((r) => (
                <tr key={r.id}>
                  <td className={td}>{r.name}</td>
                  <td className={cx(td, num)}>{r.total}</td>
                </tr>
              ))}
            </Table>
          )}
        </Card>
      </div>
      <p className="px-1 text-xs text-muted">Counted from what everyone logged. Weeks run Friday to Friday. Water, snacks and bags aren&apos;t logged, so they aren&apos;t counted.</p>
    </div>
  );
}

function Figure({ label, value, tone }: { label: string; value: ReactNode; tone?: string }) {
  return (
    <div className="px-4 py-4 sm:px-6">
      <dt className="text-xs uppercase tracking-wide text-muted">{label}</dt>
      <dd className={cx("tabular mt-1 text-2xl font-medium", tone)}>{value}</dd>
    </div>
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

/** A plain table: a header row, then rows; numbers line up on the right. */
function Table({ head, children, foot }: { head: ReactNode; children: ReactNode; foot?: ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead className="border-b border-line text-start text-xs uppercase tracking-wide text-muted">{head}</thead>
        <tbody className="divide-y divide-line/60">{children}</tbody>
        {foot && <tfoot className="border-t-2 border-line font-medium">{foot}</tfoot>}
      </table>
    </div>
  );
}
const th = "px-2 py-2.5 text-start font-medium first:ps-6 last:pe-6 sm:px-4";
const td = "px-2 py-2.5 first:ps-6 last:pe-6 sm:px-4";
const num = "tabular text-end whitespace-nowrap";
/** Columns left out on phones, so the table fits without scrolling sideways. */
const wideOnly = "hidden sm:table-cell";

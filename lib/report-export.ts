import type { GivenOut, WeekLine } from "./given-out";
import { formatShort } from "./dates";
import { weekTitle } from "./parsha";

const TEAL = "FF106A7A";

/** The weekly report as an Excel file: the chosen week (each Mivtza and each route), then the last 8 weeks side by side. */
export async function buildReportWorkbook(
  week: string,
  report: { lines: WeekLine[]; routes: { name: string; total: number }[]; total: number; lastTotal: number },
  history: { weeks: string[]; items: GivenOut[] },
  siteName: string,
): Promise<Blob> {
  const { default: ExcelJS } = await import("exceljs");
  const wb = new ExcelJS.Workbook();
  wb.creator = siteName;
  wb.created = new Date();
  type Sheet = ReturnType<typeof wb.addWorksheet>;
  const header = (ws: Sheet, values: string[]) => {
    ws.addRow(values).eachCell((c) => {
      c.font = { bold: true, color: { argb: "FFFFFFFF" } };
      c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: TEAL } };
    });
  };

  const ws = wb.addWorksheet("Weekly report");
  ws.addRow([`${siteName} · Weekly report`]).font = { bold: true, size: 14 };
  ws.addRow([weekTitle(week)]).font = { italic: true };
  ws.addRow([]);
  header(ws, ["Mivtza", "This week", "Last week", "Change", "4-week average", "Get for next week"]);
  for (const l of report.lines) ws.addRow([l.label, l.count, l.lastWeek, l.count - l.lastWeek, Math.round(l.average), l.suggested]);
  ws.addRow(["Total", report.total, report.lastTotal, report.total - report.lastTotal, "", ""]).font = { bold: true };
  ws.addRow([]);
  header(ws, ["Route", "Total this week"]);
  for (const r of report.routes) ws.addRow([r.name, r.total]);
  if (!report.routes.length) ws.addRow(["Nothing logged this week"]);
  [26, 12, 12, 10, 16, 18].forEach((w, i) => (ws.getColumn(i + 1).width = w));

  const h = wb.addWorksheet("Last 8 weeks");
  header(h, ["Mivtza", ...history.weeks.map((w) => `Week of ${formatShort(w)}`), "4-week average", "Get for next week"]);
  for (const x of history.items) h.addRow([x.label, ...x.counts, Math.round(x.average), x.suggested]);
  [24, ...history.weeks.map(() => 13), 15, 17].forEach((w, i) => (h.getColumn(i + 1).width = w));

  wb.eachSheet((s) => (s.pageSetup = { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0 }));
  const buffer = await wb.xlsx.writeBuffer();
  return new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}

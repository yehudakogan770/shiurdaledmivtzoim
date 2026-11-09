import type { ReportCount, ReportItem } from "./types";
import { addDays, formatShort } from "./dates";
import { weekTitle } from "./parsha";

const TEAL = "FF106A7A";

/** The weekly report as an Excel file: the chosen week, then each item's sales over the last 8 weeks. */
export async function buildReportWorkbook(week: string, items: ReportItem[], counts: ReportCount[], siteName: string): Promise<Blob> {
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
  const get = (itemId: string, w: string) => counts.find((c) => c.item_id === itemId && c.week === w);

  const ws = wb.addWorksheet("Weekly report");
  ws.addRow([`${siteName} · Weekly report`]).font = { bold: true, size: 14 };
  ws.addRow([weekTitle(week)]).font = { italic: true };
  ws.addRow([]);
  header(ws, ["Item", "Sold this week", "Sold last week", "Need next week"]);
  for (const x of items) ws.addRow([x.name, get(x.id, week)?.sold ?? "", get(x.id, addDays(week, -7))?.sold ?? "", get(x.id, week)?.needed ?? ""]);
  [26, 16, 16, 16].forEach((w, i) => (ws.getColumn(i + 1).width = w));

  const weeks = Array.from({ length: 8 }, (_, i) => addDays(week, -7 * (7 - i)));
  const h = wb.addWorksheet("Last 8 weeks");
  header(h, ["Item (sold)", ...weeks.map((w) => `Week of ${formatShort(w)}`)]);
  for (const x of items) h.addRow([x.name, ...weeks.map((w) => get(x.id, w)?.sold ?? "")]);
  [24, ...weeks.map(() => 13)].forEach((w, i) => (h.getColumn(i + 1).width = w));

  wb.eachSheet((s) => (s.pageSetup = { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0 }));
  const buffer = await wb.xlsx.writeBuffer();
  return new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}

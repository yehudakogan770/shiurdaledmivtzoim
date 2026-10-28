import type { FinanceEntry, Supply } from "./types";
import { weekTitle } from "./parsha";
import { activityWeek } from "./dates";

const TEAL = "FF106A7A";
const MONEY = '"$"#,##0.00';

/** "2026-10" → "October 2026" */
export function monthLabel(key: string) {
  const [y, m] = key.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

/** The Owner's finances as an Excel file: a month-by-month summary, money in, money out, and the supplies list. */
export async function buildFinanceWorkbook(entries: FinanceEntry[], supplies: Supply[], siteName: string): Promise<Blob> {
  const { default: ExcelJS } = await import("exceljs");
  const wb = new ExcelJS.Workbook();
  wb.creator = siteName;
  wb.created = new Date();
  const sorted = [...entries].sort((a, b) => a.entry_date.localeCompare(b.entry_date) || a.created_at.localeCompare(b.created_at));
  type Sheet = ReturnType<typeof wb.addWorksheet>;
  const header = (ws: Sheet, values: string[]) => {
    const row = ws.addRow(values);
    row.eachCell((c) => {
      c.font = { bold: true, color: { argb: "FFFFFFFF" } };
      c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: TEAL } };
    });
  };
  const money = (ws: Sheet, cols: number[]) => cols.forEach((c) => (ws.getColumn(c).numFmt = MONEY));
  const sum = (list: FinanceEntry[]) => list.reduce((n, e) => n + e.amount, 0);

  // 1) Summary by month, with the running balance.
  const s = wb.addWorksheet("Summary");
  s.addRow([`${siteName} · Finances`]).font = { bold: true, size: 14 };
  s.addRow([]);
  header(s, ["Month", "Money in", "Money out", "Net", "Balance"]);
  const months = [...new Set(sorted.map((e) => e.entry_date.slice(0, 7)))].sort();
  let balance = 0;
  for (const m of months) {
    const list = sorted.filter((e) => e.entry_date.startsWith(m));
    const inn = sum(list.filter((e) => e.kind === "in"));
    const out = sum(list.filter((e) => e.kind === "out"));
    balance += inn - out;
    s.addRow([monthLabel(m), inn, out, inn - out, balance]);
  }
  const totalIn = sum(sorted.filter((e) => e.kind === "in"));
  const totalOut = sum(sorted.filter((e) => e.kind === "out"));
  s.addRow(["Total", totalIn, totalOut, totalIn - totalOut, totalIn - totalOut]).font = { bold: true };
  money(s, [2, 3, 4, 5]);
  [24, 14, 14, 14, 14].forEach((w, i) => (s.getColumn(i + 1).width = w));

  // 2) and 3) Every donation and every expense, easy to sort and filter.
  const list = (name: string, kind: "in" | "out") => {
    const ws = wb.addWorksheet(name, { views: [{ state: "frozen", ySplit: 1 }] });
    header(ws, kind === "in" ? ["Date", "Week", "From", "How", "Amount", "Notes"] : ["Date", "Week", "For", "Paid by / where", "Amount", "Notes"]);
    for (const e of sorted.filter((x) => x.kind === kind)) {
      ws.addRow([e.entry_date, weekTitle(activityWeek({ activity_date: e.entry_date })), (kind === "in" ? e.who : e.category) ?? "", (kind === "in" ? e.method : e.who) ?? "", e.amount, e.notes ?? ""]);
    }
    ws.addRow(["Total", "", "", "", sum(sorted.filter((x) => x.kind === kind)), ""]).font = { bold: true };
    money(ws, [5]);
    ws.autoFilter = { from: "A1", to: "F1" };
    [12, 30, 24, 20, 12, 40].forEach((w, i) => (ws.getColumn(i + 1).width = w));
  };
  list("Money in", "in");
  list("Money out", "out");

  // 4) The weekly supplies: what to buy and what it costs.
  const sp = wb.addWorksheet("Supplies");
  header(sp, ["Item", "Needed each week", "In stock", "To buy", "Cost each", "Cost to buy", "Cost of a full week"]);
  for (const x of [...supplies].sort((a, b) => (a.position ?? 999) - (b.position ?? 999) || a.name.localeCompare(b.name))) {
    const buy = Math.max(0, x.per_week - x.in_stock);
    sp.addRow([x.name, x.per_week, x.in_stock, buy, x.unit_cost, buy * x.unit_cost, x.per_week * x.unit_cost]);
  }
  money(sp, [5, 6, 7]);
  [24, 16, 10, 10, 12, 14, 18].forEach((w, i) => (sp.getColumn(i + 1).width = w));

  // Each sheet prints one page wide.
  wb.eachSheet((ws) => (ws.pageSetup = { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0 }));
  const buffer = await wb.xlsx.writeBuffer();
  return new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}

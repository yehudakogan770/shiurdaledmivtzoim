import type { Activity, PersonalCategory, Profile, Route, Location } from "./types";
import { activityMoment, activityWeek, formatShort } from "./dates";
import { categoryName, reportColumns, type Builtin } from "./categories";
import { parshaName, weekTitle } from "./parsha";
import { chavrusasHebrew, chavrusasOf } from "./chavrusa";
import { t, tn } from "./i18n";

/** Everything the admin can see, for building the Excel file. */
export interface ExportInput {
  weeks: string[]; // Fridays (YYYY-MM-DD) to include
  activity: Activity[];
  categories: PersonalCategory[];
  builtins: Builtin[];
  shared: PersonalCategory[];
  people: Profile[];
  names: Record<string, string>;
  routes: Route[];
  locations: Location[];
  siteName: string;
}

type Column = { key: string; label: string; matches: (a: Activity) => boolean };

const TEAL = "FF106A7A";
const TEAL_SOFT = "FFDDF3F7";
/** Excel sheet names: at most 31 characters, none of \\ / ? * [ ] : ' */
const sheetName = (s: string) => s.replace(/[\\/?*[\]:']/g, "").slice(0, 31);
const RTL = { horizontal: "right", readingOrder: "rtl", vertical: "middle", wrapText: true } as const;

/**
 * Builds an .xlsx workbook, organized by week, and returns it as a downloadable file.
 * Only mivtzoim with numbers are included. Each week has a sheet with a block per route
 * (account): its name, its Chavrusas in Hebrew (name בן mother's name), and what they did,
 * split by where (a route and stop, or General).
 */
export async function buildWorkbook(input: ExportInput): Promise<Blob> {
  const { default: ExcelJS } = await import("exceljs");
  const weeks = [...input.weeks].sort(); // oldest first
  const inWeeks = new Set(weeks);
  const rows = input.activity
    .filter((a) => inWeeks.has(activityWeek(a)) && a.quantity > 0)
    .sort((a, b) => activityMoment(a).getTime() - activityMoment(b).getTime());

  const sum = (list: Activity[]) => list.reduce((n, a) => n + a.quantity, 0);
  // Only mivtzoim that have numbers in the chosen weeks, in the admin's order.
  const sharedIds = new Set(input.shared.map((c) => c.id));
  const columns: Column[] = reportColumns(input.builtins, input.shared, rows)
    .filter((c) => sum(rows.filter(c.matches)) > 0)
    .map((c) => ({ ...c, label: t(c.label) }));
  const isOwn = (a: Activity) => a.category_type === "personal" && !sharedIds.has(a.personal_category_id ?? "");
  if (rows.some(isOwn)) columns.push({ key: "own", label: t("Own categories"), matches: isOwn });
  const counts = (list: Activity[]) => columns.map((c) => sum(list.filter(c.matches)));

  const person = (id: string) => input.people.find((p) => p.id === id);
  const nameOf = (id: string) => person(id)?.name || input.names[id] || t("Someone");
  const hebrewOf = (id: string) => chavrusasHebrew(person(id)?.partners);
  const englishOf = (id: string) => chavrusasOf(person(id)?.partners).map((c) => c.name).filter(Boolean).join(", ");
  const usernameOf = (id: string) => (person(id)?.username ? `@${person(id)!.username}` : "");
  const routeOf = (a: Activity) => input.routes.find((r) => r.id === a.route_id)?.name ?? "";
  const stopOf = (a: Activity) => input.locations.find((l) => l.id === a.location_id)?.name ?? "";
  const whereOf = (a: Activity) => [routeOf(a), stopOf(a)].filter(Boolean).join(" · ") || t("General");
  const byName = (ids: Iterable<string>) => [...new Set(ids)].sort((a, b) => nameOf(a).localeCompare(nameOf(b)));

  const wb = new ExcelJS.Workbook();
  wb.creator = input.siteName;
  wb.created = new Date();

  type Sheet = ReturnType<typeof wb.addWorksheet>;
  const header = (ws: Sheet, values: (string | number)[]) => {
    const row = ws.addRow(values);
    row.eachCell((cell) => {
      cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: TEAL } };
      cell.alignment = { vertical: "middle", wrapText: true };
    });
    return row;
  };
  const bold = (row: { eachCell: (fn: (c: { font: unknown }) => void) => void }) => row.eachCell((c) => (c.font = { bold: true }));
  const title = (ws: Sheet, text: string, sub?: string) => {
    ws.addRow([text]).font = { bold: true, size: 14 };
    if (sub) ws.addRow([sub]).font = { italic: true, color: { argb: "FF5C6166" } };
    ws.addRow([]);
  };
  const widths = (ws: Sheet, list: number[]) => list.forEach((w, i) => (ws.getColumn(i + 1).width = w));
  const rangeText = weeks.length === 1 ? weekTitle(weeks[0]) : t("{n} weeks: {from} to {to}", { n: weeks.length, from: weekTitle(weeks[0]), to: weekTitle(weeks[weeks.length - 1]) });

  // 1) Summary: one line per week, a column per mivtza that has numbers.
  const summary = wb.addWorksheet(sheetName(t("Summary")), { views: [{ state: "frozen", ySplit: 4 }] });
  title(summary, `${input.siteName} · ${rangeText}`, t("Totals for everyone, per week. Only Mivtzoim with numbers are shown."));
  header(summary, [t("Week"), ...columns.map((c) => c.label), t("Total")]);
  for (const w of weeks) {
    const list = rows.filter((a) => activityWeek(a) === w);
    summary.addRow([weekTitle(w), ...counts(list), sum(list)]);
  }
  bold(summary.addRow([t("Total"), ...counts(rows), sum(rows)]));
  widths(summary, [34, ...columns.map(() => 14), 10]);

  // 2) One sheet per week: a block per route, with its Chavrusas and what was done where.
  const used = new Set<string>();
  for (const w of weeks) {
    let name = `${formatShort(w)} ${parshaName(w)}`.replace(/[\\/?*[\]:']/g, "").slice(0, 31);
    while (used.has(name)) name = `${name.slice(0, 29)} ${used.size}`;
    used.add(name);
    const ws = wb.addWorksheet(name);
    const list = rows.filter((a) => activityWeek(a) === w);
    const routeCount = new Set(list.map((a) => a.user_id)).size;
    title(ws, weekTitle(w), tn(routeCount, "{total} Mivtzoim from {n} route", "{total} Mivtzoim from {n} routes", { total: sum(list) }));
    widths(ws, [26, 38, 12]);
    if (list.length === 0) {
      ws.addRow([t("Nothing logged this week")]);
      continue;
    }
    for (const id of byName(list.map((a) => a.user_id))) {
      const mine = list.filter((a) => a.user_id === id);
      // The route's name, then its Chavrusas in Hebrew.
      const top = ws.addRow([nameOf(id), hebrewOf(id) || "—"]);
      top.height = 22;
      top.eachCell((cell) => {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: TEAL_SOFT } };
      });
      top.getCell(1).font = { bold: true, size: 12 };
      top.getCell(2).font = { bold: true, size: 12 };
      top.getCell(2).alignment = RTL;
      ws.mergeCells(top.number, 2, top.number, 3);
      header(ws, [t("Mivtza"), t("Where"), t("Amount")]);
      // One line per mivtza and place.
      const lines = new Map<string, { label: string; where: string; total: number }>();
      for (const c of columns) {
        for (const a of mine.filter(c.matches)) {
          const key = `${c.key}|${whereOf(a)}`;
          const line = lines.get(key) ?? { label: c.key === "own" ? t(categoryName(a, input.categories)) : c.label, where: whereOf(a), total: 0 };
          line.total += a.quantity;
          lines.set(key, line);
        }
      }
      for (const line of lines.values()) ws.addRow([line.label, line.where, line.total]);
      bold(ws.addRow([t("Total"), "", sum(mine)]));
      ws.addRow([]);
    }
  }

  // 3) By route, for all the chosen weeks together.
  const byRoute = wb.addWorksheet(sheetName(t("By route")), { views: [{ state: "frozen", ySplit: 4 }] });
  title(byRoute, `${t("Totals per route")} · ${rangeText}`, t("Only Mivtzoim with numbers are shown."));
  header(byRoute, [t("Route name"), t("Chavrusas (Hebrew)"), t("Chavrusas (English)"), t("Username"), ...columns.map((c) => c.label), t("Total")]);
  for (const id of byName(rows.map((a) => a.user_id))) {
    const list = rows.filter((a) => a.user_id === id);
    const row = byRoute.addRow([nameOf(id), hebrewOf(id), englishOf(id), usernameOf(id), ...counts(list), sum(list)]);
    row.getCell(2).alignment = RTL;
  }
  bold(byRoute.addRow([t("Total"), "", "", "", ...counts(rows), sum(rows)]));
  widths(byRoute, [24, 34, 30, 16, ...columns.map(() => 13), 10]);

  // 4) Every entry in one list, easy to sort and filter in Excel.
  const all = wb.addWorksheet(sheetName(t("All entries")), { views: [{ state: "frozen", ySplit: 1 }] });
  header(all, [t("Week"), t("Date"), t("Route name"), t("Chavrusas (Hebrew)"), t("Mivtza"), t("Amount"), t("Route"), t("Stop"), t("Notes"), t("Username")]);
  for (const a of rows) {
    const row = all.addRow([
      weekTitle(activityWeek(a)),
      a.activity_date,
      nameOf(a.user_id),
      hebrewOf(a.user_id),
      t(categoryName(a, input.categories)),
      a.quantity,
      routeOf(a) || t("General"),
      stopOf(a),
      a.notes ?? "",
      usernameOf(a.user_id),
    ]);
    row.getCell(4).alignment = RTL;
  }
  all.autoFilter = { from: "A1", to: "J1" };
  widths(all, [30, 12, 22, 34, 18, 9, 20, 22, 30, 16]);

  const buffer = await wb.xlsx.writeBuffer();
  return new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}

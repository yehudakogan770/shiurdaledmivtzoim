import type { Activity, PersonalCategory, Profile, Route, Location } from "./types";
import { activityMoment, activityWeek, formatShort } from "./dates";
import { categoryName, orderedMivtzoim, type Builtin } from "./categories";
import { parshaName, weekTitle } from "./parsha";

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

/** Builds an .xlsx workbook, organized by week, and returns it as a downloadable file. */
export async function buildWorkbook(input: ExportInput): Promise<Blob> {
  const { default: ExcelJS } = await import("exceljs");
  const weeks = [...input.weeks].sort(); // oldest first
  const inWeeks = new Set(weeks);
  const rows = input.activity
    .filter((a) => inWeeks.has(activityWeek(a)))
    .sort((a, b) => activityMoment(a).getTime() - activityMoment(b).getTime());

  // One column per mivtza, in the admin's order, plus people's own categories if any were used.
  const sharedIds = new Set(input.shared.map((c) => c.id));
  const columns: Column[] = orderedMivtzoim(input.builtins, input.shared).flatMap((m): Column[] => {
    if (m.builtin) return m.builtin.removed ? [] : [{ key: m.key, label: m.builtin.name, matches: (a) => a.category_type === m.builtin!.type }];
    return [{ key: m.key, label: m.category.name, matches: (a) => a.personal_category_id === m.category.id }];
  });
  const isOwn = (a: Activity) => a.category_type === "personal" && !sharedIds.has(a.personal_category_id ?? "");
  if (rows.some(isOwn)) columns.push({ key: "own", label: "Own categories", matches: isOwn });

  const person = (id: string) => input.people.find((p) => p.id === id);
  const nameOf = (id: string) => person(id)?.name || input.names[id] || "Someone";
  const usernameOf = (id: string) => (person(id)?.username ? `@${person(id)!.username}` : "");
  const sum = (list: Activity[]) => list.reduce((n, a) => n + a.quantity, 0);
  const counts = (list: Activity[]) => columns.map((c) => sum(list.filter(c.matches)));

  const wb = new ExcelJS.Workbook();
  wb.creator = input.siteName;
  wb.created = new Date();

  type Sheet = ReturnType<typeof wb.addWorksheet>;
  const header = (ws: Sheet, values: (string | number)[]) => {
    const row = ws.addRow(values);
    row.eachCell((cell) => {
      cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: TEAL } };
      cell.alignment = { vertical: "middle" };
    });
    return row;
  };
  const bold = (row: { font: unknown; eachCell: (fn: (c: { font: unknown }) => void) => void }) => row.eachCell((c) => (c.font = { bold: true }));
  const title = (ws: Sheet, text: string) => {
    const row = ws.addRow([text]);
    row.font = { bold: true, size: 14 };
    ws.addRow([]);
  };
  const widths = (ws: Sheet, first: number[]) => {
    ws.columns.forEach((col, i) => (col.width = first[i] ?? 14));
  };
  const rangeText = weeks.length === 1 ? weekTitle(weeks[0]) : `${weeks.length} weeks: ${weekTitle(weeks[0])} to ${weekTitle(weeks[weeks.length - 1])}`;

  // 1) Summary: one line per week, a column per mivtza.
  const summary = wb.addWorksheet("Summary", { views: [{ state: "frozen", ySplit: 3 }] });
  title(summary, `${input.siteName} · ${rangeText}`);
  header(summary, ["Week", ...columns.map((c) => c.label), "Total"]);
  for (const w of weeks) {
    const list = rows.filter((a) => activityWeek(a) === w);
    summary.addRow([weekTitle(w), ...counts(list), sum(list)]);
  }
  bold(summary.addRow(["Total", ...counts(rows), sum(rows)]));
  widths(summary, [34]);

  // 2) By person, for all the chosen weeks together.
  const byPerson = wb.addWorksheet("By person", { views: [{ state: "frozen", ySplit: 3 }] });
  title(byPerson, `Totals per person · ${rangeText}`);
  header(byPerson, ["Person", "Username", ...columns.map((c) => c.label), "Total"]);
  const ids = [...new Set(rows.map((a) => a.user_id))].sort((a, b) => nameOf(a).localeCompare(nameOf(b)));
  for (const id of ids) {
    const list = rows.filter((a) => a.user_id === id);
    byPerson.addRow([nameOf(id), usernameOf(id), ...counts(list), sum(list)]);
  }
  bold(byPerson.addRow(["Total", "", ...counts(rows), sum(rows)]));
  widths(byPerson, [24, 18]);

  // 3) One sheet per week: people's totals, then that week's entries.
  const used = new Set<string>();
  for (const w of weeks) {
    let name = `${formatShort(w)} ${parshaName(w)}`.replace(/[\\/?*[\]:']/g, "").slice(0, 31);
    while (used.has(name)) name = `${name.slice(0, 29)} ${used.size}`;
    used.add(name);
    const ws = wb.addWorksheet(name);
    const list = rows.filter((a) => activityWeek(a) === w);
    title(ws, weekTitle(w));
    header(ws, ["Person", "Username", ...columns.map((c) => c.label), "Total"]);
    const weekIds = [...new Set(list.map((a) => a.user_id))].sort((a, b) => nameOf(a).localeCompare(nameOf(b)));
    for (const id of weekIds) {
      const mine = list.filter((a) => a.user_id === id);
      ws.addRow([nameOf(id), usernameOf(id), ...counts(mine), sum(mine)]);
    }
    bold(ws.addRow(["Total", "", ...counts(list), sum(list)]));
    ws.addRow([]);
    ws.addRow(["Entries"]).font = { bold: true, size: 12 };
    header(ws, ["Date", "Person", "Mivtza", "Amount", "Route", "Place", "Notes"]);
    for (const a of list) ws.addRow(entry(a).slice(1));
    if (list.length === 0) ws.addRow(["Nothing logged this week"]);
    widths(ws, [24, 18]);
  }

  // 4) Every entry in one list, easy to sort and filter in Excel.
  const all = wb.addWorksheet("All entries", { views: [{ state: "frozen", ySplit: 1 }] });
  header(all, ["Week", "Date", "Person", "Mivtza", "Amount", "Route", "Place", "Notes", "Username"]);
  for (const a of rows) all.addRow([...entry(a), usernameOf(a.user_id)]);
  all.autoFilter = { from: "A1", to: "I1" };
  widths(all, [30, 14, 22, 20, 9, 20, 22, 36, 16]);

  function entry(a: Activity): (string | number)[] {
    return [
      weekTitle(activityWeek(a)),
      a.activity_date,
      nameOf(a.user_id),
      categoryName(a, input.categories),
      a.quantity,
      input.routes.find((r) => r.id === a.route_id)?.name ?? "",
      input.locations.find((l) => l.id === a.location_id)?.name ?? "",
      a.notes ?? "",
    ];
  }

  const buffer = await wb.xlsx.writeBuffer();
  return new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}

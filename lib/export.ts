import type { Activity, PersonalCategory, Profile, Route, Location, WeekAnswer } from "./types";
import { activityMoment, activityWeek } from "./dates";
import { categoryName, reportColumns, type Builtin } from "./categories";
import { weekTitle } from "./parsha";
import { chavrusasOf, hebrewName } from "./chavrusa";
import { t } from "./i18n";

/** Everything the admin can see, for building the Excel file. */
export interface ExportInput {
  weeks: string[]; // Fridays (YYYY-MM-DD) to include
  activity: Activity[];
  /** Each route's answer to the week's question: did they go on Mivtzoim, and who went. */
  answers: WeekAnswer[];
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
const GRAY = "FF5C6166";
const RTL = { horizontal: "right", readingOrder: "rtl", vertical: "middle", wrapText: true } as const;

/**
 * The Duch: one sheet, ready to print. For each week, the totals of each Mivtza, then each route
 * that went: who went (English name, and Hebrew name with the mother's name), how many of each
 * Mivtza, and any notes.
 */
export async function buildWorkbook(input: ExportInput): Promise<Blob> {
  const { default: ExcelJS } = await import("exceljs");
  const weeks = [...input.weeks].sort(); // oldest first
  const inWeeks = new Set(weeks);
  const rows = input.activity
    .filter((a) => inWeeks.has(activityWeek(a)) && a.quantity > 0)
    .sort((a, b) => activityMoment(a).getTime() - activityMoment(b).getTime());
  const answers = input.answers.filter((x) => inWeeks.has(x.week));

  const sum = (list: Activity[]) => list.reduce((n, a) => n + a.quantity, 0);
  // Every Mivtza on the front page (in the admin's order), plus people's own ones if any were logged.
  const sharedIds = new Set(input.shared.map((c) => c.id));
  const columns: Column[] = reportColumns(input.builtins, input.shared, rows).map((c) => ({ ...c, label: t(c.label) }));
  const isOwn = (a: Activity) => a.category_type === "personal" && !sharedIds.has(a.personal_category_id ?? "");
  if (rows.some(isOwn)) columns.push({ key: "own", label: t("Own categories"), matches: isOwn });

  const person = (id: string) => input.people.find((p) => p.id === id);
  const nameOf = (id: string) => person(id)?.name || input.names[id] || t("Someone");
  const byName = (ids: Iterable<string>) => [...new Set(ids)].sort((a, b) => nameOf(a).localeCompare(nameOf(b)));
  const placeOf = (a: Activity) =>
    [input.routes.find((r) => r.id === a.route_id)?.name, input.locations.find((l) => l.id === a.location_id)?.name].filter(Boolean).join(" · ");

  /**
   * Who went, with their Hebrew names: the people ticked in the week's question (Chavrusas get
   * their Hebrew name from the route; anyone added under Other has only the English name). With
   * no answer, the route's Chavrusas.
   */
  const whoWent = (id: string, w: string) => {
    const chavrusas = chavrusasOf(person(id)?.partners);
    const answer = answers.find((x) => x.user_id === id && x.week === w);
    if (!answer?.went) return chavrusas.map((c) => ({ english: c.name, hebrew: hebrewName(c) }));
    return answer.people.map((name) => {
      const c = chavrusas.find((x) => (x.name || x.hebrew) === name);
      return { english: c?.name || name, hebrew: c ? hebrewName(c) : "" };
    });
  };

  const wb = new ExcelJS.Workbook();
  wb.creator = input.siteName;
  wb.created = new Date();
  const ws = wb.addWorksheet("Duch");
  ws.pageSetup = { orientation: "portrait", fitToPage: true, fitToWidth: 1, fitToHeight: 0 };
  [30, 38, 12].forEach((w, i) => (ws.getColumn(i + 1).width = w));

  const header = (values: string[]) => {
    const row = ws.addRow(values);
    row.eachCell((cell) => {
      cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: TEAL } };
    });
    return row;
  };

  ws.addRow([input.siteName]).font = { bold: true, size: 16 };
  for (const w of weeks) {
    const list = rows.filter((a) => activityWeek(a) === w);
    ws.addRow([]);
    ws.addRow([weekTitle(w)]).font = { bold: true, size: 14 };

    // The week's totals of each Mivtza.
    header([t("Totals"), "", t("Amount")]);
    for (const c of columns) ws.addRow([c.label, "", sum(list.filter(c.matches))]);
    const total = ws.addRow([t("Total"), "", sum(list)]);
    total.font = { bold: true };

    // Each route that went: answered Yes, or logged something.
    const went = answers.filter((x) => x.week === w && x.went).map((x) => x.user_id);
    const ids = byName([...list.map((a) => a.user_id), ...went]);
    if (ids.length === 0) {
      ws.addRow([]);
      ws.addRow([t("Nothing logged this week")]).font = { italic: true, color: { argb: GRAY } };
      continue;
    }
    for (const id of ids) {
      const mine = list.filter((a) => a.user_id === id);
      ws.addRow([]);
      const top = ws.addRow([nameOf(id), "", ""]);
      top.font = { bold: true, size: 13 };
      top.eachCell({ includeEmpty: true }, (cell) => (cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: TEAL_SOFT } }));

      header([t("English name"), t("Hebrew name and mother's name"), ""]);
      for (const p of whoWent(id, w)) ws.addRow([p.english, p.hebrew]).getCell(2).alignment = RTL;

      header([t("Mivtza"), "", t("Amount")]);
      for (const c of columns) ws.addRow([c.label, "", sum(mine.filter(c.matches))]);
      ws.addRow([t("Total"), "", sum(mine)]).font = { bold: true };

      // Any notes they added, with which Mivtza (and where, if it was on a route).
      const notes = mine.filter((a) => a.notes?.trim());
      if (notes.length) {
        header([t("Notes"), "", ""]);
        for (const a of notes) {
          const what = [t(categoryName(a, input.categories)), placeOf(a)].filter(Boolean).join(" · ");
          const row = ws.addRow([what, a.notes!.trim()]);
          row.getCell(1).alignment = { vertical: "top" };
          row.getCell(2).alignment = { wrapText: true, vertical: "top" };
          ws.mergeCells(row.number, 2, row.number, 3);
        }
      }
    }
  }

  const buffer = await wb.xlsx.writeBuffer();
  return new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}

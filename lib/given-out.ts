import type { Activity, PersonalCategory } from "./types";
import { activityWeek, addDays, currentWeek, FIRST_WEEK } from "./dates";
import { reportColumns, type Builtin } from "./categories";

/**
 * How many of each Mivtza everyone gave out, week by week, from what was logged, and how many to
 * get for next week: the bigger of last week and the average of the last 4 weeks, rounded up to
 * the next 5. Weeks before the site started counting are left out.
 */
export interface GivenOut {
  key: string;
  label: string;
  /** Oldest first, one per week in `weeks`. */
  counts: number[];
  thisWeek: number;
  average: number;
  highest: number;
  suggested: number;
}

export function givenOut(activity: Activity[], builtins: Builtin[], shared: PersonalCategory[], howMany = 6) {
  const last = addDays(currentWeek(), -7);
  const weeks: string[] = [];
  for (let i = howMany - 1; i >= 0; i--) {
    const w = addDays(last, -7 * i);
    if (w >= FIRST_WEEK) weeks.push(w);
  }
  const rows = activity.filter((a) => a.quantity > 0);
  const byWeek = new Map<string, Activity[]>();
  for (const a of rows) {
    const w = activityWeek(a);
    byWeek.set(w, [...(byWeek.get(w) ?? []), a]);
  }
  const sum = (list: Activity[] | undefined, match: (a: Activity) => boolean) => (list ?? []).filter(match).reduce((n, a) => n + a.quantity, 0);
  const items: GivenOut[] = reportColumns(builtins, shared, rows).map((c) => {
    const counts = weeks.map((w) => sum(byWeek.get(w), c.matches));
    const recent = counts.slice(-4);
    const average = recent.length ? recent.reduce((n, x) => n + x, 0) / recent.length : 0;
    const base = Math.max(counts[counts.length - 1] ?? 0, average);
    return {
      key: c.key,
      label: c.label,
      counts,
      thisWeek: sum(byWeek.get(currentWeek()), c.matches),
      average,
      highest: Math.max(0, ...counts),
      suggested: base > 0 ? Math.ceil(base / 5) * 5 : 0,
    };
  });
  return { weeks, items };
}

/** One line of the weekly report: how many of one Mivtza went out in the chosen week, and around it. */
export interface WeekLine {
  key: string;
  label: string;
  count: number;
  lastWeek: number;
  /** Average of the 4 weeks before the chosen one. */
  average: number;
  /** For the coming week: the higher of this week and the average, rounded up to the next 5. */
  suggested: number;
}

/** The weekly report for one week: each Mivtza's count, and each route's total. */
export function weekReport(activity: Activity[], builtins: Builtin[], shared: PersonalCategory[], week: string, names: (userId: string) => string) {
  const rows = activity.filter((a) => a.quantity > 0);
  const inWeek = (w: string) => rows.filter((a) => activityWeek(a) === w);
  const sum = (list: Activity[], match: (a: Activity) => boolean = () => true) => list.filter(match).reduce((n, a) => n + a.quantity, 0);
  const now = inWeek(week);
  const before = inWeek(addDays(week, -7));
  const earlier = [1, 2, 3, 4].map((i) => addDays(week, -7 * i)).filter((w) => w >= FIRST_WEEK).map(inWeek);
  const lines: WeekLine[] = reportColumns(builtins, shared, rows).map((c) => {
    const count = sum(now, c.matches);
    const average = earlier.length ? earlier.reduce((n, list) => n + sum(list, c.matches), 0) / earlier.length : 0;
    const base = Math.max(count, average);
    return { key: c.key, label: c.label, count, lastWeek: sum(before, c.matches), average, suggested: base > 0 ? Math.ceil(base / 5) * 5 : 0 };
  });
  const routes = [...new Set(now.map((a) => a.user_id))]
    .map((id) => ({ id, name: names(id), total: sum(now.filter((a) => a.user_id === id)) }))
    .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));
  return { lines, routes, total: sum(now), lastTotal: sum(before) };
}

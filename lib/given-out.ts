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

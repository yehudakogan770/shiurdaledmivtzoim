import type { Activity, WeekAnswer } from "./types";

/**
 * The week's question ("Did you go on Mivtzoim?") is saved as a hidden entry among the account's
 * Mivtzoim entries: on the week's Friday, counting 0, with the answer in its notes after this
 * marker. That way it needs no database update, and it's deleted along with the account. The site
 * takes these entries out as soon as it loads, so they never show up in totals or history.
 */
const MARK = "sdm-week-answer:";

export function isWeekAnswer(a: Pick<Activity, "notes">) {
  return !!a.notes?.startsWith(MARK);
}

export function readWeekAnswer(a: Activity): WeekAnswer | null {
  try {
    const v = JSON.parse(a.notes!.slice(MARK.length));
    const people = Array.isArray(v.people) ? v.people.filter((p: unknown): p is string => typeof p === "string") : [];
    return { id: a.id, user_id: a.user_id, week: a.activity_date, went: !!v.went, people, created_at: a.created_at };
  } catch {
    return null;
  }
}

/** The entry's fields for this answer. */
export function weekAnswerEntry(user_id: string, week: string, answer: { went: boolean; people: string[] }) {
  return {
    user_id,
    group_id: null,
    route_id: null,
    location_id: null,
    category_type: "personal" as const,
    personal_category_id: null,
    quantity: 0,
    notes: MARK + JSON.stringify({ went: answer.went, people: answer.went ? answer.people : [] }),
    activity_date: week,
  };
}

/** Splits loaded entries into the real Mivtzoim entries and the week answers. */
export function splitWeekAnswers(rows: Activity[]) {
  const activity: Activity[] = [];
  const weeks: WeekAnswer[] = [];
  for (const a of rows) {
    if (!isWeekAnswer(a)) activity.push(a);
    else {
      const w = readWeekAnswer(a);
      if (w) weeks.push(w);
    }
  }
  return { activity, weeks };
}

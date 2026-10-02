"use client";

import type { ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import type { Activity } from "@/lib/types";

/** Same person, same mivtza, same day, same route and stop: these are one group. */
function groupKey(a: Activity) {
  return [a.user_id, a.category_type, a.personal_category_id ?? "", a.activity_date, a.route_id ?? "", a.location_id ?? ""].join("|");
}

/** Entries grouped by person, mivtza, day, route and stop, in the order they were given. */
export function groupEntries(rows: Activity[]): Activity[][] {
  const groups = new Map<string, Activity[]>();
  for (const a of rows) {
    const key = groupKey(a);
    groups.set(key, [...(groups.get(key) ?? []), a]);
  }
  return [...groups.values()];
}

/**
 * A list of entries where matching ones (see groupEntries) show as one line, like
 * "Mendel · Lulav · 20", that opens to the separate entries. Each entry keeps its own
 * buttons inside. A single entry shows as it always did.
 */
export function EntryGroups({
  rows,
  row,
  summary,
}: {
  rows: Activity[];
  /** One entry, as an <li>. */
  row(a: Activity): ReactNode;
  /** The left part of a group's line (icon, name, day…), from its first entry. */
  summary(first: Activity, group: Activity[]): ReactNode;
}) {
  return (
    <>
      {groupEntries(rows).map((group) =>
        group.length === 1 ? (
          row(group[0])
        ) : (
          <li key={group[0].id}>
            <details className="group/entries">
              <summary className="flex cursor-pointer list-none items-center gap-3 px-6 py-3.5 hover:bg-ink/5 [&::-webkit-details-marker]:hidden">
                {summary(group[0], group)}
                <span className="text-right">
                  <span className="tabular block text-2xl">{group.reduce((n, a) => n + a.quantity, 0)}</span>
                  <span className="block text-xs text-muted">{group.length} entries</span>
                </span>
                <ChevronDown size={20} aria-hidden className="shrink-0 text-muted transition-transform group-open/entries:rotate-180" />
              </summary>
              <ul className="divide-y divide-line/60 border-t border-line/60 bg-paper/60 pl-4">{group.map((a) => row(a))}</ul>
            </details>
          </li>
        ),
      )}
    </>
  );
}

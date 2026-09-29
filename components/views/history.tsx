"use client";

import { useState } from "react";
import { ChevronDown, ClipboardList, Flame, Sparkles, Trash2 } from "lucide-react";
import { TefillinIcon } from "../icons";
import { useData } from "@/lib/data";
import { iconForActivity } from "@/lib/category-icons";
import { categoryName } from "@/lib/categories";
import { activityMoment, activityWeek, currentWeek, formatDay, weekLabel } from "@/lib/dates";
import { parshaOfWeek } from "@/lib/parsha";
import { Button, ButtonLink, Card, CategoryIcon, Empty, IconButton, PageHeader, Select } from "../ui";
import { sum } from "./dashboard";

export function HistoryView() {
  const { mine, data, builtins, actions, notify } = useData();
  const [filter, setFilter] = useState("all");

  const rows = mine.activity
    .filter((a) => filter === "all" || (filter === a.category_type && a.category_type !== "personal") || a.personal_category_id === filter)
    .sort((a, b) => activityMoment(b).getTime() - activityMoment(a).getTime());

  const weeks = new Map<string, typeof rows>();
  for (const a of rows) {
    const w = activityWeek(a);
    weeks.set(w, [...(weeks.get(w) ?? []), a]);
  }

  async function remove(id: string) {
    try {
      await actions.deleteActivity(id);
      notify("Entry deleted.");
    } catch (err) {
      notify((err as Error).message);
    }
  }

  return (
    <div className="grid grid-cols-1 gap-6">
      <PageHeader
        title="History"
        subtitle={`${sum(rows)} Mivtzoim across ${rows.length} entries`}
        action={
          <div className="w-52">
            <label htmlFor="history-filter" className="sr-only">
              Show
            </label>
            <Select id="history-filter" value={filter} onChange={(e) => setFilter(e.target.value)}>
              <option value="all">All Mivtzoim</option>
              {builtins.map((b) => (
                <option key={b.type} value={b.type}>
                  {b.name}
                </option>
              ))}
              {mine.categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </div>
        }
      />

      {rows.length === 0 ? (
        <Card>
          <Empty title="No entries yet" icon={ClipboardList} action={<ButtonLink href="/log">Add an entry</ButtonLink>}>
            Everything you log shows up here in weekly folders. Weeks run from Friday 5am to the next Friday 5am.
          </Empty>
        </Card>
      ) : (
        [...weeks.entries()].map(([week, list]) => (
          <details key={week} open={week === currentWeek()} className="group overflow-hidden rounded-[28px] bg-card">
            <summary className="flex cursor-pointer list-none items-center gap-3 px-6 py-4 hover:bg-ink/5 [&::-webkit-details-marker]:hidden">
              <span className="min-w-0 flex-1">
                <span className="block text-lg font-medium">
                  {parshaOfWeek(week).english}
                  {week === currentWeek() && <span className="ml-2 text-sm font-normal text-accent">This week</span>}
                </span>
                <span className="block text-sm text-muted">
                  {weekLabel(week)} · {list.length} {list.length === 1 ? "entry" : "entries"}
                </span>
              </span>
              <span className="text-right">
                <span className="tabular block text-2xl">{sum(list)}</span>
                <span className="block text-xs text-muted">Mivtzoim</span>
              </span>
              <ChevronDown size={20} aria-hidden className="shrink-0 text-muted transition-transform group-open:rotate-180" />
            </summary>
            <ul className="divide-y divide-line/60 border-t border-line/60">
              {list.map((a) => {
                const route = data.routes.find((r) => r.id === a.route_id);
                const place = data.locations.find((l) => l.id === a.location_id);
                const meta = [formatDay(a.activity_date), route?.name, place?.name].filter(Boolean).join(" · ");
                return (
                  <li key={a.id} className="flex items-center gap-3 px-6 py-3.5">
                    <CategoryIcon type={a.category_type} icon={iconForActivity(a, data.categories)} />
                    <span className="min-w-0 flex-1">
                      <span className="block font-medium">{categoryName(a, data.categories)}</span>
                      <span className="block text-sm text-muted">{meta}</span>
                      {a.notes && <span className="block text-sm">{a.notes}</span>}
                    </span>
                    <span className="tabular w-10 text-right text-2xl">{a.quantity}</span>
                    <IconButton aria-label="Delete entry" onClick={() => remove(a.id)}>
                      <Trash2 size={18} />
                    </IconButton>
                  </li>
                );
              })}
            </ul>
          </details>
        ))
      )}
    </div>
  );
}

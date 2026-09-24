"use client";

import { useState } from "react";
import { ClipboardList, Flame, ScrollText, Sparkles, Trash2 } from "lucide-react";
import { useData } from "@/lib/data";
import { categoryName } from "@/lib/categories";
import { formatDay, weekLabel, weekStart } from "@/lib/dates";
import { Button, ButtonLink, Card, CategoryIcon, Empty, IconButton, PageHeader, Select } from "../ui";
import { sum } from "./dashboard";

export function HistoryView() {
  const { mine, data, actions, notify } = useData();
  const [filter, setFilter] = useState("all");
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const rows = mine.activity
    .filter((a) => filter === "all" || (filter === a.category_type && a.category_type !== "personal") || a.personal_category_id === filter)
    .sort((a, b) => (b.activity_date + b.created_at).localeCompare(a.activity_date + a.created_at));

  const weeks = new Map<string, typeof rows>();
  for (const a of rows) {
    const w = weekStart(a.activity_date);
    weeks.set(w, [...(weeks.get(w) ?? []), a]);
  }

  async function remove(id: string) {
    try {
      await actions.deleteActivity(id);
      notify("Entry deleted.");
    } catch (err) {
      notify((err as Error).message);
    }
    setConfirmId(null);
  }

  return (
    <div className="grid grid-cols-1 gap-6">
      <PageHeader
        title="History"
        subtitle={`${sum(rows)} mivtzoim across ${rows.length} entries`}
        action={
          <div className="w-52">
            <label htmlFor="history-filter" className="sr-only">
              Show
            </label>
            <Select id="history-filter" value={filter} onChange={(e) => setFilter(e.target.value)}>
              <option value="all">All mivtzoim</option>
              <option value="tefillin">Tefillin</option>
              <option value="shabbos_candles">Shabbos Candles</option>
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
            Everything you log shows up here, grouped by week.
          </Empty>
        </Card>
      ) : (
        [...weeks.entries()].map(([week, list]) => (
          <Card key={week}>
            <div className="flex items-baseline justify-between gap-3 px-6 pt-5 pb-2">
              <h2 className="text-lg font-medium">{weekLabel(week)}</h2>
              <span className="tabular text-sm text-muted">{sum(list)} total</span>
            </div>
            <ul className="divide-y divide-line/60">
              {list.map((a) => {
                const group = data.groups.find((g) => g.id === a.group_id);
                const route = data.routes.find((r) => r.id === a.route_id);
                const place = data.locations.find((l) => l.id === a.location_id);
                const meta = [formatDay(a.activity_date), group?.name, route?.name, place?.name].filter(Boolean).join(" · ");
                return (
                  <li key={a.id} className="flex items-center gap-3 px-6 py-3.5">
                    <CategoryIcon type={a.category_type} icon={a.category_type === "tefillin" ? ScrollText : a.category_type === "shabbos_candles" ? Flame : Sparkles} />
                    <span className="min-w-0 flex-1">
                      <span className="block font-medium">{categoryName(a, data.categories)}</span>
                      <span className="block text-sm text-muted">{meta}</span>
                      {a.notes && <span className="block text-sm">{a.notes}</span>}
                    </span>
                    <span className="tabular w-10 text-right text-2xl">{a.quantity}</span>
                    {confirmId === a.id ? (
                      <span className="flex gap-1">
                        <Button variant="danger" className="h-9 px-4" onClick={() => remove(a.id)}>
                          Delete
                        </Button>
                        <Button variant="ghost" className="h-9 px-3" onClick={() => setConfirmId(null)}>
                          Keep
                        </Button>
                      </span>
                    ) : (
                      <IconButton aria-label="Delete entry" onClick={() => setConfirmId(a.id)}>
                        <Trash2 size={18} />
                      </IconButton>
                    )}
                  </li>
                );
              })}
            </ul>
          </Card>
        ))
      )}
    </div>
  );
}

"use client";

import { useState, type FormEvent } from "react";
import { ChevronDown, ClipboardList, Flame, Pencil, Sparkles, Trash2 } from "lucide-react";
import { useEditMode } from "@/lib/edit-mode";
import type { Activity } from "@/lib/types";
import { TefillinIcon } from "../icons";
import { useData } from "@/lib/data";
import { iconForActivity } from "@/lib/category-icons";
import { categoryName, orderedMivtzoim } from "@/lib/categories";
import { activityMoment, activityWeek, currentWeek, formatDay, weekLabel } from "@/lib/dates";
import { parshaOfWeek } from "@/lib/parsha";
import { Button, ButtonLink, Card, CategoryIcon, Empty, Field, IconButton, Input, PageHeader, Select } from "../ui";
import { EditSwitch, sum } from "./dashboard";
import { EntryGroups } from "../entry-groups";

export function HistoryView() {
  const { isOwner } = useData();
  return isOwner ? <EveryonesHistory /> : <MyHistory />;
}

/**
 * The Owner's History: everyone's entries in weekly folders, with whose each one is. With Edit
 * on, each entry has a pencil (amount, day, notes) and a trash button.
 */
function EveryonesHistory() {
  const { data, builtins, shared, actions, notify } = useData();
  const { editing } = useEditMode();
  const [item, setItem] = useState("all");
  const [person, setPerson] = useState("all");
  const [draft, setDraft] = useState<{ id: string; quantity: string; activity_date: string; notes: string } | null>(null);
  const nameOf = (id: string) => data.names[id] || "Someone";
  const metaOf = (a: Activity) =>
    [formatDay(a.activity_date), data.routes.find((r) => r.id === a.route_id)?.name, data.locations.find((l) => l.id === a.location_id)?.name].filter(Boolean).join(" · ");
  const people = [...new Set(data.activity.map((a) => a.user_id))].sort((a, b) => nameOf(a).localeCompare(nameOf(b)));

  const rows = data.activity
    .filter((a) => item === "all" || (item === a.category_type && a.category_type !== "personal") || a.personal_category_id === item)
    .filter((a) => person === "all" || a.user_id === person)
    .sort((a, b) => activityMoment(b).getTime() - activityMoment(a).getTime());
  const weeks = new Map<string, Activity[]>();
  for (const a of rows) weeks.set(activityWeek(a), [...(weeks.get(activityWeek(a)) ?? []), a]);

  async function attempt(work: () => Promise<void>, message: string) {
    try {
      await work();
      notify(message);
    } catch (err) {
      notify((err as Error).message);
    }
  }

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!draft) return;
    const quantity = Number(draft.quantity);
    if (!Number.isFinite(quantity) || quantity < 0) return notify("Enter how many.");
    await attempt(() => actions.updateActivity(draft.id, { quantity, activity_date: draft.activity_date, notes: draft.notes }), quantity === 0 ? "Entry deleted." : "Entry saved.");
    setDraft(null);
  }

  return (
    <div className="grid grid-cols-1 gap-6">
      <PageHeader title="History" subtitle={`Everyone's Mivtzoim: ${sum(rows)} across ${rows.length} entries`} action={<EditSwitch />} />
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Person" htmlFor="history-person">
          <Select id="history-person" value={person} onChange={(e) => setPerson(e.target.value)}>
            <option value="all">Everyone</option>
            {people.map((id) => (
              <option key={id} value={id}>
                {nameOf(id)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Mivtza" htmlFor="history-filter">
          <Select id="history-filter" value={item} onChange={(e) => setItem(e.target.value)}>
            <option value="all">All Mivtzoim</option>
            {orderedMivtzoim(builtins, shared).map((m) => (
              <option key={m.key} value={m.key}>
                {m.builtin ? m.builtin.name : m.category.name}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      {rows.length === 0 ? (
        <Card>
          <Empty title="No entries" icon={ClipboardList}>
            Entries people log show up here in weekly folders.
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
              <EntryGroups
                rows={list}
                summary={(a) => (
                  <>
                    <CategoryIcon type={a.category_type} icon={iconForActivity(a, data.categories)} />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium text-accent">{nameOf(a.user_id)}</span>
                      <span className="block font-medium">{categoryName(a, data.categories)}</span>
                      <span className="block text-sm text-muted">{metaOf(a)}</span>
                    </span>
                  </>
                )}
                row={(a) => {
                const meta = metaOf(a);
                if (draft?.id === a.id) {
                  return (
                    <li key={a.id} className="px-6 py-4">
                      <form onSubmit={save} className="grid gap-3">
                        <p className="font-medium">
                          {nameOf(a.user_id)} · {categoryName(a, data.categories)}
                        </p>
                        <div className="grid grid-cols-2 gap-3">
                          <Field label="How many" htmlFor="entry-quantity" hint="0 deletes it.">
                            <Input id="entry-quantity" type="number" inputMode="numeric" min={0} required value={draft.quantity} onChange={(e) => setDraft({ ...draft, quantity: e.target.value })} />
                          </Field>
                          <Field label="Day" htmlFor="entry-date">
                            <Input id="entry-date" type="date" required value={draft.activity_date} onChange={(e) => setDraft({ ...draft, activity_date: e.target.value })} />
                          </Field>
                        </div>
                        <Field label="Notes" htmlFor="entry-notes">
                          <Input id="entry-notes" value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} />
                        </Field>
                        <div className="flex gap-2">
                          <Button type="submit" className="h-9 px-4">
                            Save
                          </Button>
                          <Button type="button" variant="ghost" className="h-9 px-3" onClick={() => setDraft(null)}>
                            Cancel
                          </Button>
                        </div>
                      </form>
                    </li>
                  );
                }
                return (
                  <li key={a.id} className="flex items-center gap-3 px-6 py-3.5">
                    <CategoryIcon type={a.category_type} icon={iconForActivity(a, data.categories)} />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium text-accent">{nameOf(a.user_id)}</span>
                      <span className="block font-medium">{categoryName(a, data.categories)}</span>
                      <span className="block text-sm text-muted">{meta}</span>
                      {a.notes && <span className="block text-sm">{a.notes}</span>}
                    </span>
                    <span className="tabular w-10 text-right text-2xl">{a.quantity}</span>
                    {editing && (
                      <span className="flex shrink-0 items-center">
                        <IconButton
                          aria-label={`Edit ${nameOf(a.user_id)}'s ${categoryName(a, data.categories)} entry`}
                          onClick={() => setDraft({ id: a.id, quantity: String(a.quantity), activity_date: a.activity_date, notes: a.notes ?? "" })}
                        >
                          <Pencil size={18} />
                        </IconButton>
                        <IconButton aria-label="Delete entry" onClick={() => attempt(() => actions.deleteActivity(a.id), "Entry deleted.")}>
                          <Trash2 size={18} />
                        </IconButton>
                      </span>
                    )}
                  </li>
                );
                }}
              />
            </ul>
          </details>
        ))
      )}
    </div>
  );
}

function MyHistory() {
  const { mine, data, builtins, shared, actions, notify } = useData();
  const metaOf = (a: Activity) =>
    [formatDay(a.activity_date), data.routes.find((r) => r.id === a.route_id)?.name, data.locations.find((l) => l.id === a.location_id)?.name].filter(Boolean).join(" · ");
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
              {orderedMivtzoim(builtins, shared).map((m) => (
                <option key={m.key} value={m.key}>
                  {m.builtin ? m.builtin.name : m.category.name}
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
              <EntryGroups
                rows={list}
                summary={(a) => (
                  <>
                    <CategoryIcon type={a.category_type} icon={iconForActivity(a, data.categories)} />
                    <span className="min-w-0 flex-1">
                      <span className="block font-medium">{categoryName(a, data.categories)}</span>
                      <span className="block text-sm text-muted">{metaOf(a)}</span>
                    </span>
                  </>
                )}
                row={(a) => {
                const meta = metaOf(a);
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
                }}
              />
            </ul>
          </details>
        ))
      )}
    </div>
  );
}

"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { ChevronDown, ChevronUp, Download, ClipboardList, Eye, EyeOff, KeyRound, Flame, Pencil, ShieldCheck, Sparkles, Trash2, Users } from "lucide-react";
import { TefillinIcon } from "../icons";
import { categoryName, orderedMivtzoim, reportColumns, type BuiltinType } from "@/lib/categories";
import { dayWithParsha, weekTitle } from "@/lib/parsha";
import { allWeeks, currentWeek } from "@/lib/dates";
import type { Activity, PersonalCategory, Profile } from "@/lib/types";
import { ICON_CHOICES, iconForActivity, iconForCategory, iconForName } from "@/lib/category-icons";
import { useData } from "@/lib/data";
import { handle, isAdminIdentifier } from "@/lib/admin";
import type { SiteSettings } from "@/lib/types";
import { Avatar, Badge, Button, Card, CardTitle, CategoryIcon, Empty, Field, IconButton, Input, PageHeader, Select, Textarea, cx, listClass } from "../ui";
import { sum } from "./dashboard";

export function AdminView() {
  const { isAdmin } = useData();
  if (!isAdmin) {
    return (
      <Card>
        <Empty title="Admins only" icon={ShieldCheck}>
          This page is for the site&apos;s administrators.
        </Empty>
      </Card>
    );
  }
  return (
    <div className="grid grid-cols-1 gap-6">
      <PageHeader title="Admin" subtitle="Edit the website and manage everyone who uses it." />
      <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
        <SiteSettingsCard />
        <SharedCategoriesCard />
      </div>
      <PeopleCard />
      <ExportCard />
      <ActivityCard />
    </div>
  );
}

function SiteSettingsCard() {
  const { settings, actions, notify } = useData();
  const [draft, setDraft] = useState<SiteSettings>(settings);
  const [busy, setBusy] = useState(false);
  useEffect(() => setDraft(settings), [settings]);
  const set = (k: keyof SiteSettings) => (e: { target: { value: string } }) => setDraft({ ...draft, [k]: e.target.value });

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!draft.site_name.trim()) return notify("The site needs a name.");
    setBusy(true);
    try {
      await actions.saveSettings({
        site_name: draft.site_name.trim(),
        tagline: "",
        welcome: draft.welcome.trim(),
        announcement: draft.announcement.trim(),
      });
      notify("Website updated.");
    } catch (err) {
      notify((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardTitle sub="Shown to everyone who opens the site">Website</CardTitle>
      <form onSubmit={save} className="grid gap-4 px-6 pb-6">
        <Field label="Site name" htmlFor="admin-name">
          <Input id="admin-name" value={draft.site_name} onChange={set("site_name")} maxLength={40} />
        </Field>
        <Field label="Welcome text" htmlFor="admin-welcome" hint="Shown on the sign-up screen.">
          <Textarea id="admin-welcome" rows={2} value={draft.welcome} onChange={set("welcome")} maxLength={200} />
        </Field>
        <Field label="Announcement" htmlFor="admin-announcement" hint="Shown at the top of everyone's dashboard. Leave empty to hide it.">
          <Textarea
            id="admin-announcement"
            rows={3}
            value={draft.announcement}
            onChange={set("announcement")}
            maxLength={500}
            placeholder="Mivtzoim this Friday at 2:00. Meet outside the shul."
          />
        </Field>
        <Button type="submit" disabled={busy} className="justify-self-start">
          {busy ? "Saving…" : "Save changes"}
        </Button>
      </form>
    </Card>
  );
}

/** The picture shown for a mivtza in the admin list. */
function ItemIcon({ item }: { item: { name: string; icon?: string; builtin?: BuiltinType } }) {
  const Icon = item.builtin === "tefillin" ? TefillinIcon : item.builtin === "shabbos_candles" ? Flame : iconForCategory(item);
  return <Icon size={18} />;
}

/** Choose the picture for a mivtza. "Auto" guesses from the name (for example Challah, Lulav, Pamphlet). */
function IconPicker({ name, value, onChange }: { name: string; value: string; onChange(value: string): void }) {
  const chosen = ICON_CHOICES.some((c) => c.id === value) ? value : "auto";
  const Guess = iconForName(name);
  const options = [{ id: "auto", label: "Auto (from the name)", Icon: Guess }, ...ICON_CHOICES];
  return (
    <fieldset className="grid gap-2">
      <legend className="px-1 pb-2 text-sm font-medium text-muted">Icon</legend>
      <div className="flex flex-wrap gap-2">
        {options.map(({ id, label, Icon }) => (
          <button
            key={id}
            type="button"
            title={label}
            aria-label={label}
            aria-pressed={chosen === id}
            onClick={() => onChange(id)}
            className={cx(
              "grid h-11 w-11 place-items-center rounded-xl border transition",
              chosen === id ? "border-accent bg-accent text-accent-ink" : "border-line bg-card text-ink hover:bg-ink/5",
              id === "auto" && "border-dashed",
            )}
          >
            <Icon size={20} />
          </button>
        ))}
      </div>
      <p className="px-1 text-xs text-muted">{options.find((o) => o.id === chosen)?.label}</p>
    </fieldset>
  );
}

/** The warning before deleting a mivtza: it takes all of its history with it. */
function DeleteMivtzaDialog({ name, entries, hidden, onHide, onDelete, onCancel }: { name: string; entries: number; hidden: boolean; onHide(): void; onDelete(): void; onCancel(): void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onCancel();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);
  return (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-black/50 p-4" onClick={onCancel}>
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="delete-title"
        aria-describedby="delete-text"
        className="grid w-full max-w-md gap-4 rounded-[28px] bg-card p-6 shadow-pop"
        onClick={(e) => e.stopPropagation()}
      >
        <span className="grid h-12 w-12 place-items-center rounded-2xl bg-danger-soft text-danger">
          <Trash2 size={24} aria-hidden />
        </span>
        <h2 id="delete-title" className="text-xl font-medium">
          Delete {name} and all its history?
        </h2>
        <div id="delete-text" className="grid gap-2 text-sm">
          <p>
            This deletes <b className="font-medium">{name}</b> for everyone <b className="font-medium">and every {name} entry in everyone&apos;s history</b>
            {entries > 0 ? ` (${entries} ${entries === 1 ? "entry" : "entries"})` : ""}. It will be gone from History, the totals and the Excel export.
          </p>
          <p className="font-medium text-danger">This can&apos;t be undone.</p>
          {!hidden && <p className="text-muted">Only want people to stop adding it? Hide it instead: nothing is lost, and you can show it again anytime.</p>}
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="ghost" onClick={onCancel} autoFocus>
            Cancel
          </Button>
          {!hidden && (
            <Button variant="tonal" onClick={onHide}>
              <EyeOff size={16} aria-hidden /> Hide instead
            </Button>
          )}
          <Button variant="danger" onClick={onDelete}>
            Delete everything
          </Button>
        </div>
      </div>
    </div>
  );
}

function SharedCategoriesCard() {
  const { shared, builtins, actions, notify, data } = useData();
  const [name, setName] = useState("");
  const [icon, setIcon] = useState("auto");
  const [busy, setBusy] = useState(false);

  async function add(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await actions.addCategory(name, "", true, icon);
      notify(`${name.trim()} is now on everyone's front page.`);
      setName("");
      setIcon("auto");
    } catch (err) {
      notify((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const [removing, setRemoving] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ key: string; name: string; icon: string } | null>(null);

  // Tefillin and Candles first, then the ones added here; all work the same way.
  type Item = { key: string; name: string; hidden: boolean; builtin?: BuiltinType; icon?: string };
  const items: Item[] = orderedMivtzoim(builtins, shared).flatMap((m): Item[] =>
    m.builtin
      ? m.builtin.removed
        ? []
        : [{ key: m.key, name: m.builtin.name, hidden: m.builtin.hidden, builtin: m.builtin.type }]
      : [{ key: m.key, name: m.category.name, hidden: m.category.status === "archived", icon: m.category.icon }],
  );

  /** Move one up or down; the front page follows this order. */
  function move(index: number, by: -1 | 1) {
    const keys = items.map((x) => x.key);
    const to = index + by;
    if (to < 0 || to >= keys.length) return;
    [keys[index], keys[to]] = [keys[to], keys[index]];
    attempt(() => actions.reorderMivtzoim(keys));
  }
  const removedBuiltins = builtins.filter((b) => b.removed);

  async function attempt(work: () => Promise<void>, message?: string) {
    try {
      await work();
      if (message) notify(message);
    } catch (err) {
      notify((err as Error).message);
    }
  }

  async function saveEdit(e: FormEvent, item: Item) {
    e.preventDefault();
    if (!editing) return;
    const { name, icon } = editing;
    await attempt(
      () => (item.builtin ? actions.updateBuiltin(item.builtin, { name }) : actions.updateCategory(item.key, name, "", icon)),
      `${name.trim()} was updated for everyone.`,
    );
    setEditing(null);
  }

  async function remove(item: Item) {
    setRemoving(null);
    await attempt(() => actions.deleteMivtzaEverywhere(item.key), `${item.name} and its history were deleted.`);
  }
  const removingItem = items.find((x) => x.key === removing);
  const historyCount = (item: Item) =>
    data.activity.filter((a) => (item.builtin ? a.category_type === item.builtin : a.personal_category_id === item.key)).length;

  const toggle = (item: Item, hide: boolean) =>
    attempt(() => (item.builtin ? actions.updateBuiltin(item.builtin, { hidden: hide }) : actions.archiveCategory(item.key, hide)));

  return (
    <Card>
      <CardTitle sub="Each one gets its own counter and quick-add button on everyone's front page, in this order. Use the arrows to move them.">Mivtzoim for everyone</CardTitle>
      {items.length > 0 && (
        <ul className={listClass}>
          {items.map((item, index) => (
            <li key={item.key} className="flex flex-wrap items-center gap-2 px-6 py-3">
              {editing?.key === item.key ? (
                <form onSubmit={(e) => saveEdit(e, item)} className="grid w-full gap-3 py-1">
                  <Field label="Name" htmlFor={`edit-name-${item.key}`}>
                    <Input id={`edit-name-${item.key}`} required autoFocus value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
                  </Field>
                  {!item.builtin && <IconPicker name={editing.name} value={editing.icon} onChange={(v) => setEditing({ ...editing, icon: v })} />}
                  <span className="flex gap-2">
                    <Button type="submit" variant="tonal" className="h-9 px-4">
                      Save
                    </Button>
                    <Button type="button" variant="ghost" className="h-9 px-3" onClick={() => setEditing(null)}>
                      Cancel
                    </Button>
                  </span>
                </form>
              ) : (
                <>
                  <span className="-ml-3 flex flex-col">
                    <IconButton aria-label={`Move ${item.name} up`} disabled={index === 0} onClick={() => move(index, -1)} className="h-7 w-9 disabled:opacity-25">
                      <ChevronUp size={18} />
                    </IconButton>
                    <IconButton aria-label={`Move ${item.name} down`} disabled={index === items.length - 1} onClick={() => move(index, 1)} className="h-7 w-9 disabled:opacity-25">
                      <ChevronDown size={18} />
                    </IconButton>
                  </span>
                  <span className="min-w-0 flex flex-1 items-center gap-3">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent-on-soft">
                      <ItemIcon item={item} />
                    </span>
                    <span className={item.hidden ? "block font-medium text-muted line-through" : "block font-medium"}>{item.name}</span>
                  </span>
                  <>
                      {item.hidden ? (
                        <Button variant="ghost" className="h-9 px-3" onClick={() => toggle(item, false)}>
                          <Eye size={16} aria-hidden /> Show
                        </Button>
                      ) : (
                        <Button variant="ghost" className="h-9 px-3" onClick={() => toggle(item, true)}>
                          <EyeOff size={16} aria-hidden /> Hide
                        </Button>
                      )}
                      <IconButton aria-label={`Edit ${item.name}`} onClick={() => setEditing({ key: item.key, name: item.name, icon: item.icon ?? "auto" })}>
                        <Pencil size={18} />
                      </IconButton>
                      <IconButton aria-label={`Delete ${item.name}`} onClick={() => setRemoving(item.key)}>
                        <Trash2 size={18} />
                      </IconButton>
                  </>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
      {removingItem && (
        <DeleteMivtzaDialog
          name={removingItem.name}
          entries={historyCount(removingItem)}
          hidden={removingItem.hidden}
          onHide={() => {
            setRemoving(null);
            toggle(removingItem, true);
            notify(`${removingItem.name} is hidden. Its history is kept.`);
          }}
          onDelete={() => remove(removingItem)}
          onCancel={() => setRemoving(null)}
        />
      )}
      {removedBuiltins.length > 0 && (
        <p className="flex flex-wrap items-center gap-2 px-6 pt-3 text-sm text-muted">
          Removed:
          {removedBuiltins.map((b) => (
            <button
              key={b.type}
              type="button"
              onClick={() => attempt(() => actions.updateBuiltin(b.type, { removed: false, hidden: false }), `${b.name} is back on everyone's front page.`)}
              className="h-8 rounded-lg border border-dashed border-outline px-3 text-sm hover:bg-ink/8"
            >
              Bring back {b.name}
            </button>
          ))}
        </p>
      )}
      <form onSubmit={add} className="grid gap-3 px-6 pt-3 pb-6">
        <Field label="Name" htmlFor="shared-name">
          <Input id="shared-name" required value={name} onChange={(e) => setName(e.target.value)} placeholder="Mezuzah" />
        </Field>
        <IconPicker name={name} value={icon} onChange={setIcon} />
        <Button type="submit" variant="tonal" disabled={busy} className="justify-self-start">
          Add for everyone
        </Button>
      </form>
    </Card>
  );
}

function PeopleCard() {
  const { me, people, data, actions, notify } = useData();
  const [pending, setPending] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const rows = [...people].sort((a, b) => (a.role === b.role ? a.name.localeCompare(b.name) : a.role === "admin" ? -1 : 1));

  async function change(userId: string, role: "user" | "admin") {
    setPending(userId);
    try {
      await actions.setRole(userId, role);
      notify(role === "admin" ? "They're now an admin." : "Admin access removed.");
    } catch (err) {
      notify((err as Error).message);
    } finally {
      setPending(null);
    }
  }

  return (
    <Card>
      <CardTitle sub={`${people.length} ${people.length === 1 ? "account" : "accounts"}`}>People</CardTitle>
      <ul className={listClass}>
        {rows.map((p) => {
          const total = sum(data.activity.filter((a) => a.user_id === p.id));
          const locked = p.id === me?.id || isAdminIdentifier(p.username);
          const expanded = open === p.id;
          return (
            <li key={p.id}>
            <div className="flex flex-wrap items-center gap-3 px-6 py-3">
              <button
                type="button"
                aria-expanded={expanded}
                aria-label={expanded ? `Hide ${p.name}'s details` : `Show ${p.name}'s details`}
                onClick={() => setOpen(expanded ? null : p.id)}
                className="flex min-w-0 flex-1 items-center gap-3 rounded-2xl text-left"
              >
              <Avatar name={p.name} id={p.id} size={40} />
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="truncate font-medium">{p.name}</span>
                  {p.role === "admin" && <Badge tone="accent">Admin</Badge>}
                  {p.id === me?.id && <span className="text-xs text-muted">(you)</span>}
                </span>
                {p.username && <span className="block truncate text-sm text-muted">{handle(p.username)}</span>}
              </span>
              <span className="tabular text-right">
                <span className="block text-xl">{total}</span>
                <span className="block text-xs text-muted">Mivtzoim</span>
              </span>
              <ChevronDown size={18} aria-hidden className={cx("shrink-0 text-muted transition-transform", expanded && "rotate-180")} />
              </button>
              {!locked &&
                (p.role === "admin" ? (
                  <Button variant="secondary" className="h-9 px-4" disabled={pending !== null} onClick={() => change(p.id, "user")}>
                    Remove admin
                  </Button>
                ) : (
                  <Button variant="tonal" className="h-9 px-4" disabled={pending !== null} onClick={() => change(p.id, "admin")}>
                    Make admin
                  </Button>
                ))}
            </div>
            {expanded && <PersonDetails person={p} />}
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

const iconFor = (a: Activity, categories: PersonalCategory[]) => iconForActivity(a, categories);

function ActivityRow({ a, showPerson }: { a: Activity; showPerson?: boolean }) {
  const { data, actions, notify } = useData();
  const route = data.routes.find((r) => r.id === a.route_id);
  const place = data.locations.find((l) => l.id === a.location_id);
  const who = data.names[a.user_id] || "Someone";
  const meta = [dayWithParsha(a), route?.name, place?.name].filter(Boolean).join(" · ");
  return (
    <li className="flex items-center gap-3 px-6 py-3">
      {showPerson ? <Avatar name={who} id={a.user_id} size={36} /> : <CategoryIcon type={a.category_type} icon={iconFor(a, data.categories)} />}
      <span className="min-w-0 flex-1">
        <span className="block font-medium">
          {showPerson && <>{who} · </>}
          {categoryName(a, data.categories)}
        </span>
        <span className="block text-sm text-muted">{meta}</span>
        {a.notes && <span className="block text-sm">{a.notes}</span>}
      </span>
      <span className="tabular text-2xl">{a.quantity}</span>
      <IconButton
        aria-label="Delete entry"
        onClick={() => actions.deleteActivity(a.id).then(() => notify("Entry deleted."), (err: Error) => notify(err.message))}
      >
        <Trash2 size={18} />
      </IconButton>
    </li>
  );
}

function PersonDetails({ person }: { person: Profile }) {
  const { data, builtins, shared } = useData();
  const userId = person.id;
  const rows = data.activity
    .filter((a) => a.user_id === userId)
    .sort((a, b) => (b.activity_date + b.created_at).localeCompare(a.activity_date + a.created_at));
  const routes = data.routes.filter((r) => r.created_by === userId).length;
  const categories = data.categories.filter((c) => c.user_id === userId && !c.shared).map((c) => c.name);
  const facts: [string, string][] = [
    ["Username", person.username ? handle(person.username) : "—"],
    ["Email", person.email || "—"],
    ["Chavrusas", person.partners?.length ? person.partners.join(", ") : "None"],
    ["Routes made", String(routes)],
    ["Own categories", categories.length ? categories.join(", ") : "None"],
    ["Last active", rows[0] ? dayWithParsha(rows[0]) : "Never"],
  ];
  // One box per mivtza (hidden ones too if this person has history with them).
  const totals: [string, number][] = reportColumns(builtins, shared, rows).map((c) => [c.label, sum(rows.filter(c.matches))]);
  return (
    <div className="mx-4 mb-4 grid gap-4 rounded-[20px] bg-paper p-4">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {totals.map(([label, value]) => (
          <div key={label} className="rounded-2xl bg-card px-4 py-3">
            <p className="text-xs text-muted">{label}</p>
            <p className="tabular text-2xl">{value}</p>
          </div>
        ))}
      </div>
      <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
        {facts.map(([k, v]) => (
          <div key={k} className="min-w-0">
            <dt className="text-muted">{k}</dt>
            <dd className="break-words">{v}</dd>
          </div>
        ))}
      </dl>
      <div className="flex flex-wrap gap-2">
        <EditPerson person={person} />
        <SetPassword person={person} />
        <DeletePerson person={person} />
      </div>
      <div className="overflow-hidden rounded-2xl bg-card">
        <p className="px-6 pt-4 pb-1 text-sm font-medium">Entries ({rows.length})</p>
        {rows.length === 0 ? (
          <p className="px-6 pb-4 text-sm text-muted">Nothing logged yet.</p>
        ) : (
          <ul className={listClass}>
            {rows.slice(0, 25).map((a) => (
              <ActivityRow key={a.id} a={a} />
            ))}
          </ul>
        )}
        {rows.length > 25 && <p className="px-6 py-3 text-xs text-muted">Showing the latest 25. See all of them in All activity below.</p>}
      </div>
    </div>
  );
}

/** For the Mivtza filter: "all", a built-in type, a mivtza's id, or "own" (people's own categories). */
function matchesMivtza(a: Activity, kind: string, shared: PersonalCategory[]) {
  if (kind === "all") return true;
  if (kind === "own") return a.category_type === "personal" && !shared.some((c) => c.id === a.personal_category_id);
  return a.category_type === kind || a.personal_category_id === kind;
}

/** Download everyone's Mivtzoim as an Excel file, organized by week. */
function ExportCard() {
  const { data, people, builtins, shared, settings, notify } = useData();
  const weeks = allWeeks(); // newest first
  const [mode, setMode] = useState<"this" | "all" | "choose">("this");
  const [picked, setPicked] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const selected = mode === "this" ? [currentWeek()] : mode === "all" ? weeks : weeks.filter((w) => picked.includes(w));

  async function download() {
    if (selected.length === 0) return notify("Pick at least one week.");
    setBusy(true);
    try {
      const { buildWorkbook } = await import("@/lib/export");
      const blob = await buildWorkbook({
        weeks: selected,
        activity: data.activity,
        categories: data.categories,
        builtins,
        shared,
        people,
        names: data.names,
        routes: data.routes,
        locations: data.locations,
        siteName: settings.site_name,
      });
      const range = mode === "this" ? `Week of ${currentWeek()}` : mode === "all" ? "All weeks" : selected.length === 1 ? weekTitle(selected[0]).replace(/[^\w '-]/g, "").trim() : `${selected.length} weeks`;
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `${settings.site_name} - ${range}.xlsx`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(link.href), 10_000);
      notify("Excel file downloaded.");
    } catch (err) {
      notify(`Couldn't make the file: ${(err as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  const choice = (value: typeof mode, label: string) => (
    <label className={cx("flex cursor-pointer items-center gap-2 rounded-full border px-4 py-2 text-sm", mode === value ? "border-accent bg-accent-soft text-accent-on-soft" : "border-line")}>
      <input type="radio" name="export-mode" className="sr-only" checked={mode === value} onChange={() => setMode(value)} />
      {label}
    </label>
  );

  return (
    <Card>
      <CardTitle sub="A spreadsheet of everyone's Mivtzoim, organized by week. Opens in Excel, Google Sheets or Numbers.">Export to Excel</CardTitle>
      <div className="grid gap-4 px-6 pb-6">
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Which weeks">
          {choice("this", "This week")}
          {choice("all", "All weeks")}
          {choice("choose", "Choose weeks")}
        </div>
        {mode === "choose" && (
          <div className="grid gap-2">
            <div className="flex gap-3 text-sm">
              <button type="button" className="font-medium text-accent hover:underline" onClick={() => setPicked(weeks)}>
                Select all
              </button>
              <button type="button" className="font-medium text-accent hover:underline" onClick={() => setPicked([])}>
                Clear
              </button>
            </div>
            <ul className="grid max-h-64 gap-1 overflow-y-auto rounded-2xl border border-line p-2">
              {weeks.map((w) => (
                <li key={w}>
                  <label className="flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2 hover:bg-ink/5">
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-[var(--accent)]"
                      checked={picked.includes(w)}
                      onChange={(e) => setPicked(e.target.checked ? [...picked, w] : picked.filter((x) => x !== w))}
                    />
                    <span className="text-sm">
                      {weekTitle(w)}
                      {w === currentWeek() && <span className="ml-2 text-accent">This week</span>}
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          </div>
        )}
        <Button onClick={download} disabled={busy || selected.length === 0} className="justify-self-start">
          <Download size={16} aria-hidden /> {busy ? "Making the file…" : `Download Excel${selected.length > 1 ? ` (${selected.length} weeks)` : ""}`}
        </Button>
        <p className="text-xs text-muted">
          Inside: a Summary tab (each week&apos;s totals), a By route tab, one tab per week (each route's totals, plus every entry), and an All entries tab.
        </p>
      </div>
    </Card>
  );
}

function ActivityCard() {
  const { data, people, builtins, shared } = useData();
  const [person, setPerson] = useState("all");
  const [kind, setKind] = useState("all");
  const [limit, setLimit] = useState(30);
  const rows = useMemo(
    () =>
      data.activity
        .filter((a) => (person === "all" || a.user_id === person) && matchesMivtza(a, kind, shared))
        .sort((a, b) => (b.activity_date + b.created_at).localeCompare(a.activity_date + a.created_at)),
    [data.activity, person, kind, shared],
  );
  const everyone = people.length ? people : [...new Set(data.activity.map((a) => a.user_id))].map((id) => ({ id, name: data.names[id] || "Someone" }));

  return (
    <Card>
      <CardTitle sub={`${rows.length} ${rows.length === 1 ? "entry" : "entries"} · ${sum(rows)} Mivtzoim`}>All activity</CardTitle>
      <div className="grid gap-3 px-6 pb-3 sm:grid-cols-2">
        <Field label="Route" htmlFor="admin-person">
          <Select id="admin-person" value={person} onChange={(e) => { setPerson(e.target.value); setLimit(30); }}>
            <option value="all">Everyone</option>
            {everyone.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Mivtza" htmlFor="admin-kind">
          <Select id="admin-kind" value={kind} onChange={(e) => { setKind(e.target.value); setLimit(30); }}>
            <option value="all">All Mivtzoim</option>
{orderedMivtzoim(builtins, shared).map((m) => (
              <option key={m.key} value={m.key}>
                {m.builtin ? m.builtin.name : m.category.name}
              </option>
            ))}
            <option value="own">People&apos;s own categories</option>
          </Select>
        </Field>
      </div>
      {rows.length === 0 ? (
        <Empty title="No entries" icon={ClipboardList} />
      ) : (
        <ul className={listClass}>
          {rows.slice(0, limit).map((a) => (
            <ActivityRow key={a.id} a={a} showPerson />
          ))}
        </ul>
      )}
      {rows.length > limit && (
        <div className="px-6 pt-2 pb-6">
          <Button variant="tonal" onClick={() => setLimit(limit + 50)}>
            Show more
          </Button>
        </div>
      )}
      {rows.length <= limit && <div className="pb-3" />}
    </Card>
  );
}

function EditPerson({ person }: { person: Profile }) {
  const { actions, notify } = useData();
  const [draft, setDraft] = useState<{ name: string; username: string; email: string; partners: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!draft) return;
    setBusy(true);
    try {
      await actions.adminUpdatePerson(person.id, {
        name: draft.name,
        username: draft.username,
        email: draft.email,
        partners: draft.partners.split(",").map((x) => x.trim()).filter(Boolean),
      });
      notify(`${draft.name.trim()}'s account was updated.`);
      setDraft(null);
    } catch (err) {
      notify((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (!draft) {
    return (
      <Button
        variant="tonal"
        className="h-9 px-4"
        onClick={() =>
          setDraft({ name: person.name, username: person.username ?? "", email: person.email ?? "", partners: (person.partners ?? []).join(", ") })
        }
      >
        <Pencil size={16} aria-hidden /> Edit account
      </Button>
    );
  }
  const id = (k: string) => `person-${k}-${person.id}`;
  return (
    <form onSubmit={save} className="grid w-full gap-3 rounded-2xl bg-card p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Route name" htmlFor={id("name")}>
          <Input id={id("name")} required value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
        </Field>
        <Field label="Username" htmlFor={id("username")} hint="What they sign in with.">
          <Input id={id("username")} required autoCapitalize="none" value={draft.username} onChange={(e) => setDraft({ ...draft, username: e.target.value })} />
        </Field>
        <Field label="Email" htmlFor={id("email")}>
          <Input id={id("email")} type="email" required value={draft.email} onChange={(e) => setDraft({ ...draft, email: e.target.value })} />
        </Field>
        <Field label="Chavrusas" htmlFor={id("partners")} hint="Separate names with commas.">
          <Input id={id("partners")} value={draft.partners} onChange={(e) => setDraft({ ...draft, partners: e.target.value })} />
        </Field>
      </div>
      <div className="flex gap-2">
        <Button type="submit" disabled={busy} className="h-9 px-4">
          Save
        </Button>
        <Button type="button" variant="ghost" className="h-9 px-3" onClick={() => setDraft(null)}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

function DeletePerson({ person }: { person: Profile }) {
  const { me, actions, notify } = useData();
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);
  if (person.id === me?.id) return null;

  async function remove() {
    setBusy(true);
    try {
      await actions.adminDeletePerson(person.id);
      notify(`${person.name}'s account was deleted.`);
    } catch (err) {
      notify((err as Error).message);
      setBusy(false);
      setAsking(false);
    }
  }

  if (!asking) {
    return (
      <Button variant="ghost" className="h-9 px-3 text-danger" onClick={() => setAsking(true)}>
        <Trash2 size={16} aria-hidden /> Delete account
      </Button>
    );
  }
  return (
    <div role="alert" className="grid w-full gap-3 rounded-2xl bg-card p-4">
      <p className="text-sm">
        Delete {person.name}&apos;s account? Their entries, routes and own Mivtzoim are deleted too, and they can&apos;t sign in anymore. This can&apos;t be undone.
      </p>
      <div className="flex gap-2">
        <Button variant="danger" disabled={busy} className="h-9 px-4" onClick={remove}>
          Delete account
        </Button>
        <Button variant="ghost" className="h-9 px-3" onClick={() => setAsking(false)}>
          Keep
        </Button>
      </div>
    </div>
  );
}

function SetPassword({ person }: { person: Profile }) {
  const { actions, notify } = useData();
  const [open, setOpen] = useState(false);
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [busy, setBusy] = useState(false);

  async function save(e: FormEvent) {
    e.preventDefault();
    if (pw !== pw2) return notify("The two passwords don't match.");
    setBusy(true);
    try {
      await actions.adminSetPassword(person.id, pw);
      notify(`New password set for ${person.name}. Tell them it, and they can sign in now.`);
      setOpen(false);
      setPw("");
      setPw2("");
    } catch (err) {
      notify((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <Button variant="tonal" className="h-9 justify-self-start px-4" onClick={() => setOpen(true)}>
        <KeyRound size={16} aria-hidden /> Set a new password
      </Button>
    );
  }
  return (
    <form onSubmit={save} className="grid w-full gap-3 rounded-2xl bg-card p-4">
      <p className="text-sm">
        For when {person.name} forgot their password. Choose a new one, then tell them it along with their username
        {person.username ? ` (${handle(person.username)})` : ""}.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="New password" htmlFor={`pw-${person.id}`}>
          <Input id={`pw-${person.id}`} type="text" autoComplete="off" required minLength={6} value={pw} onChange={(e) => setPw(e.target.value)} />
        </Field>
        <Field label="Type it again" htmlFor={`pw2-${person.id}`}>
          <Input id={`pw2-${person.id}`} type="text" autoComplete="off" required minLength={6} value={pw2} onChange={(e) => setPw2(e.target.value)} />
        </Field>
      </div>
      <div className="flex gap-2">
        <Button type="submit" disabled={busy} className="h-9 px-4">
          {busy ? "Saving…" : "Save new password"}
        </Button>
        <Button variant="ghost" className="h-9 px-3" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

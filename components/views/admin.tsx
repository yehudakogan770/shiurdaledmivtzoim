"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { ChevronDown, ClipboardList, Eye, EyeOff, KeyRound, Flame, Pencil, ShieldCheck, Sparkles, Trash2, Users } from "lucide-react";
import { TefillinIcon } from "../icons";
import { categoryName } from "@/lib/categories";
import { activityWeek, currentWeek } from "@/lib/dates";
import { dayWithParsha } from "@/lib/parsha";
import type { Activity, PersonalCategory, Profile } from "@/lib/types";
import { iconForActivity } from "@/lib/category-icons";
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

function SharedCategoriesCard() {
  const { shared, actions, notify } = useData();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  async function add(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await actions.addCategory(name, "", true);
      notify(`${name.trim()} is now on everyone's front page.`);
      setName("");
    } catch (err) {
      notify((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const [removing, setRemoving] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ id: string; name: string } | null>(null);

  async function saveEdit(e: FormEvent) {
    e.preventDefault();
    if (!editing) return;
    try {
      await actions.updateCategory(editing.id, editing.name, "");
      notify(`${editing.name.trim()} was updated for everyone.`);
      setEditing(null);
    } catch (err) {
      notify((err as Error).message);
    }
  }

  async function remove(id: string, label: string) {
    try {
      await actions.deleteCategory(id);
      notify(`${label} was removed from everyone's front page.`);
    } catch (err) {
      notify((err as Error).message);
    }
    setRemoving(null);
  }

  async function toggle(id: string, archive: boolean) {
    try {
      await actions.archiveCategory(id, archive);
    } catch (err) {
      notify((err as Error).message);
    }
  }

  return (
    <Card>
      <CardTitle sub="Each one gets its own counter and quick-add button on everyone's front page, next to Tefillin and Shabbos Candles">Mivtzoim for everyone</CardTitle>
      {shared.length > 0 && (
        <ul className={listClass}>
          {shared.map((c) => (
            <li key={c.id} className="flex flex-wrap items-center gap-2 px-6 py-3">
              {editing?.id === c.id ? (
                <form onSubmit={saveEdit} className="grid w-full gap-3 py-1">
                  <Field label="Name" htmlFor={`edit-name-${c.id}`}>
                    <Input id={`edit-name-${c.id}`} required autoFocus value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
                  </Field>
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
                  <span className="min-w-0 flex-1">
                    <span className={c.status === "archived" ? "block font-medium text-muted line-through" : "block font-medium"}>{c.name}</span>
                  </span>
                  {removing === c.id ? (
                    <span className="flex w-full flex-wrap items-center justify-end gap-2 sm:w-auto">
                      <span className="text-sm">Remove {c.name} for everyone?</span>
                      <Button variant="danger" className="h-9 px-4" onClick={() => remove(c.id, c.name)}>
                        Remove
                      </Button>
                      <Button variant="ghost" className="h-9 px-3" onClick={() => setRemoving(null)}>
                        Keep
                      </Button>
                    </span>
                  ) : (
                    <>
                      {c.status === "archived" ? (
                        <Button variant="ghost" className="h-9 px-3" onClick={() => toggle(c.id, false)}>
                          <Eye size={16} aria-hidden /> Show
                        </Button>
                      ) : (
                        <Button variant="ghost" className="h-9 px-3" onClick={() => toggle(c.id, true)}>
                          <EyeOff size={16} aria-hidden /> Hide
                        </Button>
                      )}
                      <IconButton aria-label={`Edit ${c.name}`} onClick={() => setEditing({ id: c.id, name: c.name })}>
                        <Pencil size={18} />
                      </IconButton>
                      <IconButton aria-label={`Remove ${c.name}`} onClick={() => setRemoving(c.id)}>
                        <Trash2 size={18} />
                      </IconButton>
                    </>
                  )}
                </>
              )}
            </li>
          ))}
        </ul>
      )}
      <form onSubmit={add} className="grid gap-3 px-6 pt-3 pb-6">
        <Field label="Name" htmlFor="shared-name">
          <Input id="shared-name" required value={name} onChange={(e) => setName(e.target.value)} placeholder="Mezuzah" />
        </Field>
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
                <span className="block text-xs text-muted">mivtzoim</span>
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
  const { data } = useData();
  const userId = person.id;
  const rows = data.activity
    .filter((a) => a.user_id === userId)
    .sort((a, b) => (b.activity_date + b.created_at).localeCompare(a.activity_date + a.created_at));
  const thisWeek = currentWeek();
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
  const totals: [string, number][] = [
    ["Tefillin", sum(rows.filter((a) => a.category_type === "tefillin"))],
    ["Candles", sum(rows.filter((a) => a.category_type === "shabbos_candles"))],
    ["Other", sum(rows.filter((a) => a.category_type === "personal"))],
    ["This week", sum(rows.filter((a) => activityWeek(a) === thisWeek))],
  ];
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

function ActivityCard() {
  const { data, people } = useData();
  const [person, setPerson] = useState("all");
  const [kind, setKind] = useState("all");
  const [limit, setLimit] = useState(30);
  const rows = useMemo(
    () =>
      data.activity
        .filter((a) => (person === "all" || a.user_id === person) && (kind === "all" || a.category_type === kind))
        .sort((a, b) => (b.activity_date + b.created_at).localeCompare(a.activity_date + a.created_at)),
    [data.activity, person, kind],
  );
  const everyone = people.length ? people : [...new Set(data.activity.map((a) => a.user_id))].map((id) => ({ id, name: data.names[id] || "Someone" }));

  return (
    <Card>
      <CardTitle sub={`${rows.length} ${rows.length === 1 ? "entry" : "entries"} · ${sum(rows)} mivtzoim`}>All activity</CardTitle>
      <div className="grid gap-3 px-6 pb-3 sm:grid-cols-2">
        <Field label="Person" htmlFor="admin-person">
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
            <option value="all">All mivtzoim</option>
            <option value="tefillin">Tefillin</option>
            <option value="shabbos_candles">Shabbos Candles</option>
            <option value="personal">Other</option>
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
        <Field label="Name" htmlFor={id("name")}>
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
        Delete {person.name}&apos;s account? Their entries, routes and own mivtzoim are deleted too, and they can&apos;t sign in anymore. This can&apos;t be undone.
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

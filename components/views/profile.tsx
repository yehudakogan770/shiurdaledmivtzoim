"use client";

import { useState, type FormEvent } from "react";
import { Plus } from "lucide-react";
import { useData } from "@/lib/data";
import { SUGGESTED_PERSONAL } from "@/lib/categories";
import { Button, Card, CardTitle, Field, Input, PageHeader } from "../ui";
import { sum } from "./dashboard";

export function ProfileView() {
  const { me, backend, mine, auth, actions, notify } = useData();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(me?.name ?? "");
  const [catName, setCatName] = useState("");
  const [catDesc, setCatDesc] = useState("");
  const [busy, setBusy] = useState(false);
  const canRename = backend?.kind !== "claude";

  const active = mine.categories.filter((c) => c.status === "active");
  const archived = mine.categories.filter((c) => c.status === "archived");
  const suggestions = SUGGESTED_PERSONAL.filter((s) => !mine.categories.some((c) => c.name.toLowerCase() === s.name.toLowerCase()));

  async function saveName(e: FormEvent) {
    e.preventDefault();
    try {
      await auth.updateName(name.trim());
      setEditing(false);
      notify("Name saved.");
    } catch (err) {
      notify((err as Error).message);
    }
  }

  async function addCategory(n: string, d?: string) {
    setBusy(true);
    try {
      await actions.addCategory(n, d);
      notify(`Added ${n}.`);
      setCatName("");
      setCatDesc("");
    } catch (err) {
      notify((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function toggle(id: string, archive: boolean) {
    try {
      await actions.archiveCategory(id, archive);
    } catch (err) {
      notify((err as Error).message);
    }
  }

  return (
    <div className="grid grid-cols-1 gap-6">
      <PageHeader title="Profile" subtitle="Your account and the mivtzoim you track." />

      <div className="grid gap-3 lg:grid-cols-2">
        <Card>
          <CardTitle action={canRename && !editing ? <Button variant="ghost" className="h-9 px-3" onClick={() => { setName(me?.name ?? ""); setEditing(true); }}>Edit</Button> : undefined}>
            Account
          </CardTitle>
          <div className="grid gap-4 px-6 pb-6">
            {editing ? (
              <form onSubmit={saveName} className="grid gap-3">
                <Field label="Name" htmlFor="profile-name">
                  <Input id="profile-name" required value={name} onChange={(e) => setName(e.target.value)} />
                </Field>
                <div className="flex gap-2">
                  <Button type="submit">Save</Button>
                  <Button variant="ghost" onClick={() => setEditing(false)}>
                    Cancel
                  </Button>
                </div>
              </form>
            ) : (
              <div>
                <p className="text-sm font-medium text-muted">Name</p>
                <p className="text-2xl font-medium">{me?.name}</p>
                {me?.email && <p className="text-muted">{me.email}</p>}
              </div>
            )}
            <div className="grid grid-cols-3 gap-3 rounded-2xl bg-paper p-4 text-center">
              <div>
                <p className="tabular text-2xl font-medium">{sum(mine.activity)}</p>
                <p className="text-xs text-muted">mivtzoim</p>
              </div>
              <div>
                <p className="tabular text-2xl font-medium">{mine.groups.length}</p>
                <p className="text-xs text-muted">groups</p>
              </div>
              <div>
                <p className="tabular text-2xl font-medium">{mine.routes.length}</p>
                <p className="text-xs text-muted">routes</p>
              </div>
            </div>
            <p className="text-sm text-muted">{backend?.storageLabel}</p>
            {backend?.hasAuth && (
              <Button variant="secondary" className="justify-self-start" onClick={() => auth.signOut()}>
                Sign out
              </Button>
            )}
          </div>
        </Card>

        <Card>
          <CardTitle>My categories</CardTitle>
          <div className="grid gap-5 px-6 pb-6">
            <p className="text-sm text-muted">
              Tefillin and Shabbos Candles are always there. Add any other mivtza you do and it appears on the Log page.
            </p>
            {active.length > 0 && (
              <ul className="divide-y divide-line/60 overflow-hidden rounded-2xl bg-paper">
                {active.map((c) => (
                  <li key={c.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                    <span className="min-w-0">
                      <span className="block font-medium">{c.name}</span>
                      {c.description && <span className="block truncate text-sm text-muted">{c.description}</span>}
                    </span>
                    <Button variant="ghost" className="h-9 px-3" onClick={() => toggle(c.id, true)}>
                      Hide
                    </Button>
                  </li>
                ))}
              </ul>
            )}
            {suggestions.length > 0 && (
              <div>
                <p className="mb-2 text-sm font-medium text-muted">From the ten mivtzoim</p>
                <div className="flex flex-wrap gap-2">
                  {suggestions.map((s) => (
                    <button
                      key={s.name}
                      type="button"
                      disabled={busy}
                      onClick={() => addCategory(s.name, s.description)}
                      className="inline-flex items-center gap-1 h-8 rounded-lg border border-outline px-3 text-sm font-medium text-muted hover:bg-ink/8 disabled:opacity-50"
                    >
                      <Plus size={13} aria-hidden /> {s.name}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                addCategory(catName, catDesc);
              }}
              className="grid gap-3 border-t border-line/60 pt-4"
            >
              <Field label="Your own category" htmlFor="cat-name">
                <Input id="cat-name" required value={catName} onChange={(e) => setCatName(e.target.value)} placeholder="Lulav and Esrog" />
              </Field>
              <Field label="What you count" htmlFor="cat-desc">
                <Input id="cat-desc" value={catDesc} onChange={(e) => setCatDesc(e.target.value)} placeholder="People who shook lulav" />
              </Field>
              <Button type="submit" variant="tonal" disabled={busy} className="justify-self-start">
                Add category
              </Button>
            </form>
            {archived.length > 0 && (
              <div>
                <p className="mb-2 text-sm font-medium text-muted">Hidden</p>
                <div className="flex flex-wrap gap-2">
                  {archived.map((c) => (
                    <button key={c.id} type="button" onClick={() => toggle(c.id, false)} className="h-8 rounded-lg border border-dashed border-outline px-3 text-sm text-muted hover:bg-ink/8">
                      Show {c.name}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}

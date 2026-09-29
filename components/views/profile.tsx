"use client";

import { useState, type FormEvent } from "react";
import { Pencil, Plus, X } from "lucide-react";
import { handle } from "@/lib/admin";
import { useData } from "@/lib/data";
import { SUGGESTED_PERSONAL } from "@/lib/categories";
import { Button, Card, CardTitle, Field, IconButton, Input, PageHeader } from "../ui";
import { sum } from "./dashboard";
import { InstallCard } from "../install-app";

export function ProfileView() {
  const { me, backend, mine, auth, actions, notify } = useData();
  const [catName, setCatName] = useState("");
  const [catDesc, setCatDesc] = useState("");
  const [busy, setBusy] = useState(false);

  const active = mine.categories.filter((c) => c.status === "active");
  const archived = mine.categories.filter((c) => c.status === "archived");
  const suggestions = SUGGESTED_PERSONAL.filter((s) => !mine.categories.some((c) => c.name.toLowerCase() === s.name.toLowerCase()));

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
      <PageHeader title="Profile" subtitle="Your account and the Mivtzoim you track." />

      <div className="grid gap-3 lg:grid-cols-2">
        <AccountCard />

        <Card>
          <CardTitle>My categories</CardTitle>
          <div className="grid gap-5 px-6 pb-6">
            <p className="text-sm text-muted">
              The Mivtzoim on the front page are always there. Add any other Mivtza you do and it appears on the Log page.
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
                <p className="mb-2 text-sm font-medium text-muted">From the ten Mivtzoim</p>
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

      <InstallCard />
    </div>
  );
}

/** The person's account: route name and Chavrusas, plus how they sign in (username, email, password). */
function AccountCard() {
  const { me, backend, mine, auth, notify } = useData();
  const [open, setOpen] = useState<null | "details" | "username" | "email" | "password">(null);
  const [name, setName] = useState("");
  const [partners, setPartners] = useState<string[]>([""]);
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [current, setCurrent] = useState("");
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [busy, setBusy] = useState(false);
  const editable = backend?.kind !== "claude";

  function start(which: NonNullable<typeof open>) {
    setName(me?.name ?? "");
    setPartners(me?.partners?.length ? [...me.partners] : [""]);
    setUsername(me?.username ?? "");
    setEmail(me?.email ?? "");
    setCurrent("");
    setPw("");
    setPw2("");
    setOpen(which);
  }

  async function run(work: () => Promise<string>) {
    setBusy(true);
    try {
      notify(await work());
      setOpen(null);
    } catch (err) {
      notify((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (open === "details") {
      return run(async () => {
        if (!name.trim()) throw new Error("Enter the route name.");
        await auth.updateProfile(name.trim(), partners.map((p) => p.trim()).filter(Boolean));
        return "Saved.";
      });
    }
    if (open === "username") return run(async () => (await auth.changeUsername(username), "Username changed. Use it next time you sign in."));
    if (open === "email")
      return run(async () => {
        const { needsConfirmation } = await auth.changeEmail(email);
        return needsConfirmation ? `We sent a link to ${email.trim()}. Open it to finish changing your email. (Check Spam too.)` : "Email changed.";
      });
    if (open === "password")
      return run(async () => {
        if (pw !== pw2) throw new Error("The two new passwords don't match.");
        await auth.changePassword(current, pw);
        return "Password changed.";
      });
  };

  const buttons = (
    <div className="flex gap-2">
      <Button type="submit" disabled={busy}>
        {busy ? "Saving…" : "Save"}
      </Button>
      <Button variant="ghost" onClick={() => setOpen(null)}>
        Cancel
      </Button>
    </div>
  );

  const row = (label: string, value: React.ReactNode, which: NonNullable<typeof open>) => (
    <div className="flex items-center gap-3 py-3">
      <div className="min-w-0 flex-1">
        <p className="text-sm text-muted">{label}</p>
        <div className="break-words font-medium">{value}</div>
      </div>
      {editable && (
        <Button variant="ghost" className="h-9 shrink-0 px-3" onClick={() => start(which)} aria-label={`Change ${label.toLowerCase()}`}>
          <Pencil size={16} aria-hidden /> Change
        </Button>
      )}
    </div>
  );

  return (
    <Card>
      <CardTitle sub="Change your route name, Chavrusas and how you sign in">Account settings</CardTitle>
      <div className="grid gap-4 px-6 pb-6">
        {open === "details" ? (
          <form onSubmit={submit} className="grid gap-3">
            <Field label="Route name" htmlFor="profile-name">
              <Input id="profile-name" required autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="(general location)" />
            </Field>
            <div className="grid gap-1.5">
              <p className="px-1 text-sm font-medium text-muted">Chavrusas on this route</p>
              {partners.map((p, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Input
                    id={`profile-partner-${i}`}
                    aria-label={`Chavrusa ${i + 1}`}
                    value={p}
                    onChange={(e) => setPartners(partners.map((x, j) => (j === i ? e.target.value : x)))}
                    placeholder="Chavrusa's name"
                  />
                  <IconButton aria-label={`Remove Chavrusa ${i + 1}`} onClick={() => setPartners(partners.length > 1 ? partners.filter((_, j) => j !== i) : [""])}>
                    <X size={18} />
                  </IconButton>
                </div>
              ))}
              <Button variant="ghost" className="h-9 justify-self-start px-3" onClick={() => setPartners([...partners, ""])}>
                <Plus size={16} aria-hidden /> Add a Chavrusa
              </Button>
            </div>
            {buttons}
          </form>
        ) : (
          <div className="divide-y divide-line/60">
            <div className="flex items-start gap-3 pb-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm text-muted">Route name</p>
                <p className="break-words text-2xl font-medium">{me?.name}</p>
                <p className="mt-1 text-sm">
                  <span className="text-muted">Chavrusas: </span>
                  {me?.partners?.length ? me.partners.join(", ") : <span className="text-muted">none yet</span>}
                </p>
              </div>
              {editable && (
                <Button variant="tonal" className="h-9 shrink-0 px-4" onClick={() => start("details")}>
                  <Pencil size={16} aria-hidden /> Edit
                </Button>
              )}
            </div>
            {backend?.hasAuth && (
              <>
                {open === "username" ? (
                  <form onSubmit={submit} className="grid gap-3 py-3">
                    <Field label="New username" htmlFor="profile-username" hint="3 to 20 letters, numbers, dots or dashes. You'll sign in with it.">
                      <Input id="profile-username" required autoFocus autoCapitalize="none" value={username} onChange={(e) => setUsername(e.target.value)} />
                    </Field>
                    {buttons}
                  </form>
                ) : (
                  row("Username", me?.username ? handle(me.username) : "—", "username")
                )}
                {open === "email" ? (
                  <form onSubmit={submit} className="grid gap-3 py-3">
                    <Field label="New email" htmlFor="profile-email" hint="We'll send a link to the new address to confirm it.">
                      <Input id="profile-email" type="email" required autoFocus value={email} onChange={(e) => setEmail(e.target.value)} />
                    </Field>
                    {buttons}
                  </form>
                ) : (
                  row("Email", me?.email || "—", "email")
                )}
                {open === "password" ? (
                  <form onSubmit={submit} className="grid gap-3 py-3">
                    <Field label="Current password" htmlFor="profile-current">
                      <Input id="profile-current" type="password" required autoFocus autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} />
                    </Field>
                    <Field label="New password" htmlFor="profile-pw" hint="At least 6 characters.">
                      <Input id="profile-pw" type="password" required minLength={6} autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} />
                    </Field>
                    <Field label="Type the new password again" htmlFor="profile-pw2">
                      <Input id="profile-pw2" type="password" required minLength={6} autoComplete="new-password" value={pw2} onChange={(e) => setPw2(e.target.value)} />
                    </Field>
                    {buttons}
                  </form>
                ) : (
                  row("Password", "••••••••", "password")
                )}
              </>
            )}
          </div>
        )}
        <div className="grid grid-cols-2 gap-3 rounded-2xl bg-paper p-4 text-center">
          <div>
            <p className="tabular text-2xl font-medium">{sum(mine.activity)}</p>
            <p className="text-xs text-muted">Mivtzoim</p>
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
  );
}

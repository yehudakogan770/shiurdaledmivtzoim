"use client";

import { useState, type FormEvent } from "react";
import { AtSign, KeyRound, Mail, Pencil, Plus, X } from "lucide-react";
import { handle } from "@/lib/admin";
import { useData } from "@/lib/data";
import { SUGGESTED_PERSONAL } from "@/lib/categories";
import { BLANK_CHAVRUSA, chavrusasOf, encodeChavrusa, type Chavrusa } from "@/lib/chavrusa";
import { ChavrusaFields, ChavrusaNames } from "../chavrusa-fields";
import { Button, Card, CardTitle, Field, IconButton, Input, Modal, PageHeader } from "../ui";
import { sum } from "./dashboard";
import { InstallCard } from "../install-app";
import { MyPhotos } from "./photos";
import { LanguageCard } from "../language-picker";
import { t } from "@/lib/i18n";

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
      notify(t("Added {name}.", { name: t(n) }));
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
    <div className="grid grid-cols-1 gap-3">
      <PageHeader title={t("Profile")} subtitle={t("Your account and the Mivtzoim you track.")} />

      <div className="grid gap-3 lg:grid-cols-2">
        <AccountCard />

        <Card>
          <CardTitle>{t("My categories")}</CardTitle>
          <div className="grid gap-4 px-6 pb-5">
            <p className="text-sm text-muted">
              {t("The Mivtzoim on the front page are always there. Add any other Mivtza you do and it appears on the Log page.")}
            </p>
            {active.length > 0 && (
              <ul className="divide-y divide-line/60 overflow-hidden rounded-2xl bg-paper">
                {active.map((c) => (
                  <li key={c.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                    <span className="min-w-0">
                      <span className="block font-medium">{t(c.name)}</span>
                      {c.description && <span className="block truncate text-sm text-muted">{c.description}</span>}
                    </span>
                    <Button variant="ghost" className="h-9 px-3" onClick={() => toggle(c.id, true)}>
                      {t("Hide")}
                    </Button>
                  </li>
                ))}
              </ul>
            )}
            {suggestions.length > 0 && (
              <div>
                <p className="mb-2 text-sm font-medium text-muted">{t("From the ten Mivtzoim")}</p>
                <div className="flex flex-wrap gap-2">
                  {suggestions.map((s) => (
                    <button
                      key={s.name}
                      type="button"
                      disabled={busy}
                      onClick={() => addCategory(s.name, s.description)}
                      className="inline-flex items-center gap-1 h-8 rounded-lg border border-outline px-3 text-sm font-medium text-muted hover:bg-ink/8 disabled:opacity-50"
                    >
                      <Plus size={13} aria-hidden /> {t(s.name)}
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
              <Field label={t("Your own category")} htmlFor="cat-name">
                <Input id="cat-name" required value={catName} onChange={(e) => setCatName(e.target.value)} placeholder={t("Lulav and Esrog")} />
              </Field>
              <Field label={t("What you count")} htmlFor="cat-desc">
                <Input id="cat-desc" value={catDesc} onChange={(e) => setCatDesc(e.target.value)} placeholder={t("People who shook lulav")} />
              </Field>
              <Button type="submit" variant="tonal" disabled={busy} className="justify-self-start">
                {t("Add category")}
              </Button>
            </form>
            {archived.length > 0 && (
              <div>
                <p className="mb-2 text-sm font-medium text-muted">{t("Hidden")}</p>
                <div className="flex flex-wrap gap-2">
                  {archived.map((c) => (
                    <button key={c.id} type="button" onClick={() => toggle(c.id, false)} className="h-8 rounded-lg border border-dashed border-outline px-3 text-sm text-muted hover:bg-ink/8">
                      {t("Show {name}", { name: t(c.name) })}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </Card>
      </div>

      <MyPhotos />

      <InstallCard />

      <LanguageCard />
    </div>
  );
}

/** The person's account: route name and Chavrusas, plus how they sign in (username, email, password). */
function AccountCard() {
  const { me, backend, mine, auth, notify } = useData();
  const [open, setOpen] = useState<null | "details">(null);
  const [dialog, setDialog] = useState<null | "username" | "email" | "password">(null);
  const [name, setName] = useState("");
  const [partners, setPartners] = useState<Chavrusa[]>([BLANK_CHAVRUSA]);
  const [busy, setBusy] = useState(false);
  const editable = backend?.kind !== "claude";

  function start(which: NonNullable<typeof open>) {
    setName(me?.name ?? "");
    setPartners(me?.partners?.length ? chavrusasOf(me.partners) : [BLANK_CHAVRUSA]);
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
        if (!name.trim()) throw new Error(t("Enter the route name."));
        await auth.updateProfile(name.trim(), partners.filter((c) => c.name.trim() || c.hebrew.trim()).map(encodeChavrusa));
        return t("Saved.");
      });
    }
  };

  const buttons = (
    <div className="flex gap-2">
      <Button type="submit" disabled={busy}>
        {busy ? t("Saving…") : t("Save")}
      </Button>
      <Button variant="ghost" onClick={() => setOpen(null)}>
        {t("Cancel")}
      </Button>
    </div>
  );

  const row = (label: string, value: React.ReactNode, onChange: () => void) => (
    <div className="flex items-center gap-3 py-3">
      <div className="min-w-0 flex-1">
        {value === null ? (
          <p className="font-medium">{t(label)}</p>
        ) : (
          <>
            <p className="text-sm text-muted">{t(label)}</p>
            <div className="break-words font-medium">{value}</div>
          </>
        )}
      </div>
      {editable && (
        <Button variant="ghost" className="h-9 shrink-0 px-3" onClick={onChange} aria-label={t(`Change ${label.toLowerCase()}`)}>
          <Pencil size={16} aria-hidden /> {t("Change")}
        </Button>
      )}
    </div>
  );

  return (
    <Card>
      <CardTitle sub={t("Change your route name, Chavrusas and how you sign in")}>{t("Account settings")}</CardTitle>
      <div className="grid gap-4 px-6 pb-6">
        {open === "details" ? (
          <form onSubmit={submit} className="grid gap-3">
            <Field label={t("Route name")} htmlFor="profile-name">
              <Input id="profile-name" required autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder={t("(general location)")} />
            </Field>
            <div className="grid gap-1.5">
              <p className="px-1 text-sm font-medium text-muted">{t("Chavrusas on this route")}</p>
              <ChavrusaFields value={partners} onChange={setPartners} idPrefix="profile-partner" requireHebrew />
            </div>
            {buttons}
          </form>
        ) : (
          <div className="divide-y divide-line/60">
            <div className="flex items-start gap-3 pb-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm text-muted">{t("Route name")}</p>
                <p className="break-words text-2xl font-medium">{me?.name}</p>
                <div className="mt-2 text-sm">
                  <p className="text-muted">{t("Chavrusas")}</p>
                  {chavrusasOf(me?.partners).length ? <ChavrusaNames partners={me?.partners} /> : <span className="text-muted">{t("none yet")}</span>}
                </div>
              </div>
              {editable && (
                <Button variant="tonal" className="h-9 shrink-0 px-4" onClick={() => start("details")}>
                  <Pencil size={16} aria-hidden /> {t("Edit")}
                </Button>
              )}
            </div>
            {backend?.hasAuth && (
              <>
                {row("Username", me?.username ? handle(me.username) : "—", () => setDialog("username"))}
                {row("Email", me?.email || "—", () => setDialog("email"))}
                {row("Password", null, () => setDialog("password"))}
              </>
            )}
          </div>
        )}
        <div className="grid grid-cols-2 gap-3 rounded-2xl bg-paper p-4 text-center">
          <div>
            <p className="tabular text-2xl font-medium">{sum(mine.activity)}</p>
            <p className="text-xs text-muted">{t("Mivtzoim")}</p>
          </div>
          <div>
            <p className="tabular text-2xl font-medium">{mine.routes.length}</p>
            <p className="text-xs text-muted">{t("routes")}</p>
          </div>
        </div>
        <p className="text-sm text-muted">{backend?.storageLabel}</p>
        {dialog && <SecureChangeDialog kind={dialog} onClose={() => setDialog(null)} />}
        {backend?.hasAuth && (
          <Button variant="secondary" className="justify-self-start" onClick={() => auth.signOut()}>
            {t("Sign out")}
          </Button>
        )}
      </div>
    </Card>
  );
}

/**
 * Changing the username, email or password happens in a pop-up, in two steps:
 * first the current password (checked before going on), then the new value.
 */
function SecureChangeDialog({ kind, onClose }: { kind: "username" | "email" | "password"; onClose(): void }) {
  const { me, auth, notify } = useData();
  const [step, setStep] = useState<"current" | "new">("current");
  const [current, setCurrent] = useState("");
  const [value, setValue] = useState("");
  const [again, setAgain] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const what = kind === "email" ? "email" : kind;
  const Icon = kind === "username" ? AtSign : kind === "email" ? Mail : KeyRound;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      if (step === "current") {
        await auth.verifyPassword(current);
        setStep("new");
      } else if (kind === "password") {
        if (value.length < 6) throw new Error(t("Use at least 6 characters."));
        if (value !== again) throw new Error(t("The two new passwords don't match."));
        await auth.changePassword(current, value);
        notify(t("Password changed."));
        onClose();
      } else if (kind === "username") {
        await auth.changeUsername(value);
        notify(t("Username changed. Use it next time you sign in."));
        onClose();
      } else {
        if (value.trim().toLowerCase() !== again.trim().toLowerCase()) throw new Error(t("The two email addresses don't match."));
        const { needsConfirmation } = await auth.changeEmail(value);
        notify(needsConfirmation ? t("We sent a link to {email}. Open it to finish changing your email. (Check Spam too.)", { email: value.trim() }) : t("Email changed."));
        onClose();
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal onClose={onClose} blur>
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby="change-title"
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
        className="grid w-full max-w-sm gap-4 rounded-[28px] bg-card p-6 shadow-pop"
      >
        <span className="grid h-12 w-12 place-items-center rounded-2xl bg-accent-soft text-accent-on-soft">
          <Icon size={22} aria-hidden />
        </span>
        <div>
          <h2 id="change-title" className="text-xl font-medium">
            {t(`Change ${what}`)}
          </h2>
          <p className="text-sm text-muted">{step === "current" ? t("Step 1 of 2: enter your current password.") : t(`Step 2 of 2: enter your new ${what}.`)}</p>
        </div>
        {step === "current" ? (
          <Field label={t("Current password")} htmlFor="change-current">
            <Input id="change-current" type="password" required autoFocus autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} />
          </Field>
        ) : kind === "password" ? (
          <>
            <Field label={t("New password")} htmlFor="change-new" hint={t("At least 6 characters.")}>
              <Input id="change-new" type="password" required autoFocus minLength={6} autoComplete="new-password" value={value} onChange={(e) => setValue(e.target.value)} />
            </Field>
            <Field label={t("Type the new password again")} htmlFor="change-again">
              <Input id="change-again" type="password" required minLength={6} autoComplete="new-password" value={again} onChange={(e) => setAgain(e.target.value)} />
            </Field>
          </>
        ) : kind === "username" ? (
          <Field label={t("New username")} htmlFor="change-new" hint={t("Now: {current}. 3 to 20 letters, numbers, dots or dashes.", { current: me?.username ? handle(me.username) : t("none") })}>
            <Input id="change-new" required autoFocus autoCapitalize="none" autoComplete="username" value={value} onChange={(e) => setValue(e.target.value)} />
          </Field>
        ) : (
          <>
            <Field label={t("New email")} htmlFor="change-new" hint={t("Now: {current}. We'll send a link to the new address to confirm it.", { current: me?.email ?? t("none") })}>
              <Input id="change-new" type="email" required autoFocus autoComplete="email" value={value} onChange={(e) => setValue(e.target.value)} />
            </Field>
            <Field label={t("Type the new email again")} htmlFor="change-again">
              <Input id="change-again" type="email" required autoComplete="email" value={again} onChange={(e) => setAgain(e.target.value)} />
            </Field>
          </>
        )}
        {error && (
          <p role="alert" className="rounded-2xl bg-danger-soft px-4 py-3 text-sm text-danger">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            {t("Cancel")}
          </Button>
          <Button type="submit" disabled={busy}>
            {busy ? t("Checking…") : step === "current" ? t("Continue") : t(`Save new ${what}`)}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

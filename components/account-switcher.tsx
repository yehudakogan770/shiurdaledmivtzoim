"use client";

import { useEffect, useState, type FormEvent } from "react";
import { ArrowLeftRight, Plus, X } from "lucide-react";
import { useData } from "@/lib/data";
import { useNav } from "@/lib/nav";
import { handle } from "@/lib/admin";
import type { SavedAccount } from "@/lib/backend";
import { t } from "@/lib/i18n";
import { Avatar, Button, Field, IconButton, Input, Modal } from "./ui";

/**
 * In the menu: the other accounts signed in on this device, to switch to with one tap, and "Add
 * another account". For the Owner and admins (so they can also have a regular account), and for
 * anyone who already has more than one account here.
 */
export function AccountSwitcher({ onDone }: { onDone?: () => void }) {
  const { me, isAdmin, backend, auth, notify } = useData();
  const { go } = useNav();
  const [accounts, setAccounts] = useState<SavedAccount[]>([]);
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (me) auth.savedAccounts().then(setAccounts, () => setAccounts([]));
    // Reload the list when the account in use changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me?.id]);

  if (!me || !backend?.switchAccount) return null;
  const others = accounts.filter((a) => a.id !== me.id);
  if (!isAdmin && others.length === 0) return null;

  async function switchTo(id: string) {
    setBusy(true);
    try {
      await auth.switchAccount(id);
      onDone?.();
      go("/");
    } catch (err) {
      notify((err as Error).message);
      auth.savedAccounts().then(setAccounts, () => {});
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-0.5">
      {others.map((a) => (
        <div key={a.id} className="flex items-center gap-1">
          <button
            type="button"
            disabled={busy}
            onClick={() => switchTo(a.id)}
            className="flex min-w-0 flex-1 items-center gap-3 rounded-full px-3 py-1.5 text-start text-sm hover:bg-ink/5 disabled:opacity-50"
          >
            <Avatar name={a.name} id={a.id} size={32} />
            <span className="min-w-0">
              <span className="block truncate font-medium">{a.name}</span>
              <span className="block truncate text-xs text-muted">{a.username ? handle(a.username) : ""}</span>
            </span>
            <ArrowLeftRight size={16} aria-hidden className="ms-auto shrink-0 text-muted" />
          </button>
          <IconButton
            aria-label={t("Remove {name} from this device", { name: a.name })}
            className="h-8 w-8"
            onClick={async () => {
              await auth.forgetAccount(a.id);
              setAccounts((list) => list.filter((x) => x.id !== a.id));
            }}
          >
            <X size={14} />
          </IconButton>
        </div>
      ))}
      <button type="button" onClick={() => setAdding(true)} className="flex items-center gap-3 rounded-full px-3 py-2 text-start text-sm font-medium text-accent hover:bg-accent/8">
        <span className="grid h-8 w-8 place-items-center rounded-full border-2 border-dashed border-accent">
          <Plus size={14} />
        </span>
        {t("Add another account")}
      </button>
      {adding && (
        <AddAccount
          onClose={() => setAdding(false)}
          onAdded={() => {
            setAdding(false);
            onDone?.();
            go("/");
          }}
        />
      )}
    </div>
  );
}

/** Sign in to another account on this device; the one in use stays signed in to switch back to. */
function AddAccount({ onClose, onAdded }: { onClose(): void; onAdded(): void }) {
  const { auth } = useData();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await auth.addAccount(username, password);
      onAdded();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal onClose={onClose} blur>
      <form role="dialog" aria-modal="true" aria-labelledby="add-account" onSubmit={submit} onClick={(e) => e.stopPropagation()} className="grid w-full max-w-sm gap-4 rounded-[28px] bg-card p-6 shadow-pop">
        <div>
          <h2 id="add-account" className="text-xl font-medium">
            {t("Add another account")}
          </h2>
          <p className="mt-1 text-sm text-muted">{t("Sign in to it here. You stay signed in to this one too, and can switch back from the menu.")}</p>
        </div>
        <Field label={t("Username")} htmlFor="add-username">
          <Input id="add-username" required autoFocus autoComplete="off" autoCapitalize="none" value={username} onChange={(e) => setUsername(e.target.value)} />
        </Field>
        <Field label={t("Password")} htmlFor="add-password">
          <Input id="add-password" required type="password" autoComplete="off" value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>
        {error && <p className="text-sm text-danger">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            {t("Cancel")}
          </Button>
          <Button type="submit" disabled={busy}>
            {busy ? t("Please wait…") : t("Sign in")}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

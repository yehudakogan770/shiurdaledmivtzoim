"use client";

import { useState, type FormEvent } from "react";
import { CircleCheck, Lock, Search, UserRoundPlus } from "lucide-react";
import type { Profile } from "@/lib/types";
import { currentWeek } from "@/lib/dates";
import { QuickLog } from "./dashboard";
import { getLang, setLanguage, t, type Lang } from "@/lib/i18n";
import { useData } from "@/lib/data";
import { useNav } from "@/lib/nav";
import { setAccountDesk } from "@/lib/account-desk";
import { handle } from "@/lib/admin";
import { BLANK_CHAVRUSA, encodeChavrusa, type Chavrusa } from "@/lib/chavrusa";
import { ChavrusaFields } from "../chavrusa-fields";
import { LanguageButtons } from "../language-picker";
import { LogoMark } from "../brand";
import { Avatar, Button, Field, Input, Modal, cx } from "../ui";

const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/**
 * The account desk (Owner only): the whole screen is the sign-up form, for people without a phone
 * or computer of their own. Accounts made here are ready at once, with no confirmation email.
 * Getting back to the Owner screens takes the Owner's password.
 */
export function AccountDeskView({ ownerLang }: { ownerLang: Lang }) {
  const [tab, setTab] = useState<"create" | "find">("create");
  const [leaving, setLeaving] = useState(false);
  return (
    <div className="flex min-h-screen flex-col items-center px-4 py-8 sm:py-12">
      <div role="tablist" className="mb-6 grid w-full max-w-[40rem] grid-cols-2 gap-1 rounded-full bg-sunken p-1">
        {(["create", "find"] as const).map((k) => (
          <button
            key={k}
            type="button"
            role="tab"
            aria-selected={tab === k}
            onClick={() => setTab(k)}
            className={cx("flex h-12 items-center justify-center gap-2 rounded-full text-sm font-medium transition", tab === k ? "bg-accent text-accent-ink shadow-card" : "text-ink hover:bg-ink/5")}
          >
            {k === "create" ? <UserRoundPlus size={18} aria-hidden /> : <Search size={18} aria-hidden />}
            {k === "create" ? t("Create an account") : t("Find my account")}
          </button>
        ))}
      </div>

      {tab === "create" ? <CreateAccount /> : <FindAccount />}

      <button
        type="button"
        onClick={() => setLeaving(true)}
        className="mt-8 inline-flex h-10 items-center gap-2 rounded-full px-4 text-sm text-muted hover:bg-ink/5"
      >
        <Lock size={16} aria-hidden /> {t("Owner")}
      </button>

      {leaving && <LeaveDesk ownerLang={ownerLang} onClose={() => setLeaving(false)} />}
    </div>
  );
}

/** Making a new account: the same details as signing up, each sign-in detail typed twice. */
function CreateAccount() {
  const { actions, settings } = useData();
  const [name, setName] = useState("");
  const [partners, setPartners] = useState<Chavrusa[]>([BLANK_CHAVRUSA]);
  const [username, setUsername] = useState("");
  const [username2, setUsername2] = useState("");
  const [email, setEmail] = useState("");
  const [email2, setEmail2] = useState("");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [made, setMade] = useState<{ name: string; username: string } | null>(null);

  function clear() {
    setName("");
    setPartners([BLANK_CHAVRUSA]);
    setUsername("");
    setUsername2("");
    setEmail("");
    setEmail2("");
    setPassword("");
    setPassword2("");
    setError(null);
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!same(username, username2)) return setError(t("The two usernames don't match. Type them again."));
    if (!same(email, email2)) return setError(t("The two emails don't match. Type them again."));
    if (password !== password2) return setError(t("The two passwords don't match. Type them again."));
    setBusy(true);
    try {
      await actions.ownerCreateAccount({
        name: name.trim(),
        partners: partners.filter((c) => c.name.trim() || c.hebrew.trim()).map(encodeChavrusa),
        username,
        email,
        password,
        language: getLang(),
      });
      setMade({ name: name.trim(), username: username.trim().toLowerCase().replace(/^@/, "") });
      clear();
      window.scrollTo(0, 0);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {made ? (
        <div className="grid w-full max-w-[40rem] justify-items-center gap-4 rounded-[28px] bg-card px-6 py-12 text-center sm:px-10">
          <span className="grid h-16 w-16 place-items-center rounded-full bg-sage-soft text-sage-on-soft">
            <CircleCheck size={34} aria-hidden />
          </span>
          <h1 className="text-[2rem] leading-tight">{t("Your account is ready")}</h1>
          <p className="text-base text-muted">{t("{name} can sign in on any phone or computer with this username and the password you chose.", { name: made.name })}</p>
          <p className="rounded-2xl bg-sunken px-5 py-3 text-2xl font-medium">{handle(made.username)}</p>
          <Button className="mt-2" onClick={() => setMade(null)}>
            {t("Next person")}
          </Button>
        </div>
      ) : (
        <form onSubmit={submit} className="grid w-full max-w-[64rem] gap-10 rounded-[28px] bg-card px-6 py-10 sm:px-10 md:grid-cols-2 md:gap-12 md:px-12 md:py-12">
          <div>
            <LogoMark className="h-12 w-12" />
            <p className="mt-6 text-sm font-medium text-accent">{t(settings.site_name)}</p>
            <h1 className="mt-1 text-[2.25rem] leading-tight font-normal sm:text-[2.75rem]">{t("Create your account")}</h1>
            <p className="mt-3 text-base text-muted">{t("Fill in your details. Your account is ready right away: sign in on any phone or computer with your username and password.")}</p>
          </div>

          <div className="grid content-start gap-5">
            <div className="grid gap-1.5">
              <p className="px-1 text-sm font-medium text-muted">{t("Language")}</p>
              <LanguageButtons />
            </div>
            <Field label={t("Route name")} htmlFor="desk-name">
              <Input id="desk-name" required value={name} onChange={(e) => setName(e.target.value)} placeholder={t("(general location)")} autoComplete="off" />
            </Field>
            <div className="grid gap-1.5">
              <p className="px-1 text-sm font-medium text-muted">{t("Chavrusas on this route")}</p>
              <ChavrusaFields value={partners} onChange={setPartners} idPrefix="desk-partner" requireHebrew />
            </div>

            <Field label={t("Username")} htmlFor="desk-username" hint={t("3 to 20 letters, numbers, dots or dashes. You'll use it to sign in.")}>
              <Input id="desk-username" required value={username} onChange={(e) => setUsername(e.target.value.replace(/\s/g, ""))} placeholder="mendel" autoComplete="off" autoCapitalize="none" autoCorrect="off" spellCheck={false} />
            </Field>
            <Field label={t("Type the username again")} htmlFor="desk-username2">
              <Input id="desk-username2" required value={username2} onChange={(e) => setUsername2(e.target.value.replace(/\s/g, ""))} autoComplete="off" autoCapitalize="none" autoCorrect="off" spellCheck={false} />
            </Field>

            <Field label={t("Email")} htmlFor="desk-email" hint={t("So the admin can reach you, and help if you forget your password.")}>
              <Input id="desk-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" autoComplete="off" autoCapitalize="none" />
            </Field>
            <Field label={t("Type the email again")} htmlFor="desk-email2">
              <Input id="desk-email2" type="email" required value={email2} onChange={(e) => setEmail2(e.target.value)} autoComplete="off" autoCapitalize="none" />
            </Field>

            <Field label={t("Password")} htmlFor="desk-password" hint={t("Use at least 6 characters.")}>
              <Input id="desk-password" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" />
            </Field>
            <Field label={t("Type the password again")} htmlFor="desk-password2">
              <Input id="desk-password2" type="password" required minLength={6} value={password2} onChange={(e) => setPassword2(e.target.value)} autoComplete="new-password" />
            </Field>

            {error && <p className="rounded-2xl bg-danger-soft px-4 py-3 text-sm whitespace-pre-line text-danger">{error}</p>}

            <div className="mt-4 flex justify-end">
              <Button type="submit" disabled={busy}>
                {busy ? t("Please wait…") : t("Create account")}
              </Button>
            </div>
          </div>
        </form>
      )}
    </>
  );
}

/**
 * For someone with an account but no phone: they find it by username and log their Mivtzoim here.
 * Names only show once a few letters are typed, so nobody can scroll through everyone's accounts.
 */
function FindAccount() {
  const { people, me } = useData();
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<Profile | null>(null);
  const q = query.trim().toLowerCase().replace(/^@/, "");
  const found =
    q.length < 2
      ? []
      : people
          .filter((p) => p.id !== me?.id && ((p.username ?? "").toLowerCase().includes(q) || p.name.toLowerCase().includes(q)))
          .sort((a, b) => Number((b.username ?? "").toLowerCase() === q) - Number((a.username ?? "").toLowerCase() === q))
          .slice(0, 8);

  if (picked) {
    return (
      <div className="grid w-full max-w-[40rem] gap-5 rounded-[28px] bg-card px-5 py-8 sm:px-8">
        <div className="flex items-center gap-4">
          <Avatar name={picked.name} id={picked.id} size={52} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-2xl">{picked.name}</p>
            {picked.username && <p className="text-sm text-muted">{handle(picked.username)}</p>}
          </div>
        </div>
        <p className="text-sm text-muted">{t("Tap a mivtza to add it to this week. Tap − to take one off.")}</p>
        <QuickLog week={currentWeek()} userId={picked.id} />
        <Button
          className="mt-2 justify-self-center"
          onClick={() => {
            setPicked(null);
            setQuery("");
          }}
        >
          {t("Done")}
        </Button>
      </div>
    );
  }

  return (
    <div className="grid w-full max-w-[40rem] gap-5 rounded-[28px] bg-card px-5 py-8 sm:px-8">
      <div>
        <h1 className="text-[2rem] leading-tight">{t("Find my account")}</h1>
        <p className="mt-2 text-base text-muted">{t("Type your username, then tap your name to log your Mivtzoim.")}</p>
      </div>
      <Field label={t("Username")} htmlFor="desk-find">
        <Input
          id="desk-find"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="mendel"
          autoComplete="off"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
        />
      </Field>
      {q.length >= 2 && (
        <div className="grid gap-2">
          {found.length ? (
            found.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setPicked(p)}
                className="flex items-center gap-4 rounded-2xl bg-sunken p-3 text-start transition hover:bg-ink/8"
              >
                <Avatar name={p.name} id={p.id} size={40} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-lg font-medium">{p.name}</span>
                  {p.username && <span className="block text-sm text-muted">{handle(p.username)}</span>}
                </span>
              </button>
            ))
          ) : (
            <p className="px-1 text-sm text-muted">{t("No account with that username. Check the spelling, or create an account.")}</p>
          )}
        </div>
      )}
    </div>
  );
}

/** Back to the Owner screens: only with the Owner's password. */
function LeaveDesk({ ownerLang, onClose }: { ownerLang: Lang; onClose(): void }) {
  const { auth } = useData();
  const { go } = useNav();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [wrong, setWrong] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setWrong(false);
    try {
      await auth.verifyPassword(code);
      setLanguage(ownerLang);
      go("/admin");
      setAccountDesk(false);
    } catch {
      setWrong(true);
      setCode("");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal onClose={onClose} blur>
      <form
        role="dialog"
        aria-modal="true"
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
        className="grid w-full max-w-sm gap-4 rounded-[28px] bg-card p-6 shadow-pop"
      >
        <h2 className="text-xl">{t("Back to the Owner screens")}</h2>
        <p className="text-sm text-muted">{t("Enter the Owner account's password.")}</p>
        <Input type="password" autoFocus required value={code} onChange={(e) => setCode(e.target.value)} autoComplete="off" aria-label={t("Password")} id="desk-unlock" />
        {wrong && <p className={cx("rounded-2xl bg-danger-soft px-4 py-3 text-sm text-danger")}>{t("That isn't the Owner's password.")}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            {t("Cancel")}
          </Button>
          <Button type="submit" disabled={busy || !code}>
            {busy ? t("Please wait…") : t("Unlock")}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

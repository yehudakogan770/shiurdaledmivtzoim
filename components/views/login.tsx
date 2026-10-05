"use client";

import { getLang, t } from "@/lib/i18n";
import { LanguageButtons } from "../language-picker";
import { useState, type FormEvent } from "react";
import { ArrowLeft, Plus, X } from "lucide-react";
import { useData } from "@/lib/data";
import { currentWeek, hebrewDate } from "@/lib/dates";
import { parshaOfWeek } from "@/lib/parsha";
import { ADMIN_EMAILS } from "@/lib/admin";
import { BLANK_CHAVRUSA, encodeChavrusa, type Chavrusa } from "@/lib/chavrusa";
import { ChavrusaFields } from "../chavrusa-fields";
import { LogoMark } from "../brand";
import { Button, Field, IconButton, Input, cx } from "../ui";
import { SiteFooter } from "../site-footer";

type Mode = "signin" | "signup" | "forgot" | "reset";

const TITLES: Record<Mode, string> = {
  signin: "Sign in",
  signup: "Create your account",
  forgot: "Forgot your username or password?",
  reset: "Choose a new password",
};

export function LoginView({ initialMode = "signin", onBack }: { initialMode?: Mode; onBack?: () => void }) {
  const { auth, backend, settings } = useData();
  const [mode, setMode] = useState<Mode>(initialMode);
  const [name, setName] = useState("");
  const [partners, setPartners] = useState<Chavrusa[]>([BLANK_CHAVRUSA]);
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: "error" | "info"; text: string } | null>(null);

  function go(next: Mode) {
    setMode(next);
    setMessage(null);
    setPassword("");
    setPassword2("");
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setMessage(null);
    if ((mode === "signup" || mode === "reset") && password !== password2) {
      setMessage({ kind: "error", text: t("The two passwords don't match. Type them again.") });
      return;
    }
    setBusy(true);
    try {
      if (mode === "signup") {
        const { needsConfirmation } = await auth.signUp({
          name: name.trim(),
          partners: partners.filter((c) => c.name.trim() || c.hebrew.trim()).map(encodeChavrusa),
          username,
          email,
          password,
          language: getLang(),
        });
        if (needsConfirmation) {
          go("signin");
          setMessage({ kind: "info", text: t("Almost done. We sent a confirmation link to {email}. Open it, then sign in with your username and password.\n\nDon't see the email? Check your Spam or Promotions folder.", { email: email.trim() }) });
        }
      } else if (mode === "signin") {
        await auth.signIn(username, password);
      } else if (mode === "forgot") {
        await auth.requestPasswordReset(email);
        setMessage({ kind: "info", text: t("If {email} has an account, we sent it a link to reset your password. The email also shows your username.", { email: email.trim() }) });
      } else {
        await auth.updatePassword(password);
        auth.finishRecovery();
      }
    } catch (err) {
      setMessage({ kind: "error", text: (err as Error).message });
    } finally {
      setBusy(false);
    }
  }

  const subtitle =
    mode === "signup"
      ? t(settings.welcome)
      : mode === "forgot"
        ? t("No problem. The admin can look up your username and give you a new password.")
        : mode === "reset"
          ? t("Type your new password twice.")
          : t("to continue to {site}", { site: t(settings.site_name) });

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-paper px-4 py-10">
      {onBack && (
        <div className="mb-3 w-full max-w-[64rem]">
          <button type="button" onClick={onBack} className="inline-flex h-10 items-center gap-2 rounded-full px-3 text-sm font-medium text-accent hover:bg-accent/8">
            <ArrowLeft size={18} aria-hidden /> {t("Back to the preview")}
          </button>
        </div>
      )}
      <form
        onSubmit={submit}
        className="grid w-full max-w-[64rem] gap-10 rounded-[28px] bg-card px-6 py-10 sm:px-10 md:grid-cols-2 md:gap-12 md:px-12 md:py-12"
      >
        <div>
          <LogoMark className="h-12 w-12" />
          <p className="mt-6 text-sm font-medium text-accent">{t(settings.site_name)}</p>
          <h1 className="mt-1 text-[2.25rem] leading-tight font-normal sm:text-[2.75rem]">{t(TITLES[mode])}</h1>
          <p className="mt-3 text-base text-muted">{subtitle}</p>
        </div>

        <div className="grid content-start gap-5">
          {mode === "signup" && (
            <>
              {/* First, so the rest of the form shows in the language they pick. */}
              <div className="grid gap-1.5">
                <p className="px-1 text-sm font-medium text-muted">{t("Language")}</p>
                <LanguageButtons />
              </div>
              <Field label={t("Route name")} htmlFor="login-name">
                <Input id="login-name" required value={name} onChange={(e) => setName(e.target.value)} placeholder={t("(general location)")} autoComplete="off" />
              </Field>
              <div className="grid gap-1.5">
                <p className="px-1 text-sm font-medium text-muted">{t("Chavrusas on this route")}</p>
                <ChavrusaFields value={partners} onChange={setPartners} idPrefix="login-partner" requireHebrew />
              </div>
            </>
          )}

          {(mode === "signup" || mode === "signin") && (
            <Field label={t("Username")} htmlFor="login-username" hint={mode === "signup" ? t("3 to 20 letters, numbers, dots or dashes. You'll use it to sign in.") : undefined}>
              <Input
                id="login-username"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value.replace(/\s/g, ""))}
                placeholder="mendel"
                autoComplete="username"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
              />
            </Field>
          )}

          {mode === "forgot" && (
            <div className="grid gap-3 rounded-2xl bg-paper p-5">
              <p className="font-medium">{t("Contact the admin")}</p>
              <p className="text-sm text-muted">{t("Send a message with your full name and the email you signed up with. You'll get your username and a new password back.")}</p>
              <p className="text-base font-medium break-all text-accent select-all">{ADMIN_EMAILS[0]}</p>
            </div>
          )}

          {mode === "signup" && (
            <Field label={t("Email")} htmlFor="login-email" hint={t("So the admin can reach you, and help if you forget your password.")}>
              <Input
                id="login-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
                autoCapitalize="none"
              />
            </Field>
          )}

          {mode !== "forgot" && (
            <Field label={mode === "reset" ? t("New password") : t("Password")} htmlFor="login-password" hint={mode === "signup" || mode === "reset" ? t("Use at least 6 characters.") : undefined}>
              <Input
                id="login-password"
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={mode === "signin" ? "current-password" : "new-password"}
              />
            </Field>
          )}

          {(mode === "signup" || mode === "reset") && (
            <Field label={t("Type the password again")} htmlFor="login-password2">
              <Input
                id="login-password2"
                type="password"
                required
                minLength={6}
                value={password2}
                onChange={(e) => setPassword2(e.target.value)}
                autoComplete="new-password"
              />
            </Field>
          )}

          {mode === "signin" && (
            <button type="button" onClick={() => go("forgot")} className="justify-self-start px-1 text-sm font-medium text-accent hover:underline">
              {t("Forgot username or password?")}
            </button>
          )}

          {message && (
            <p className={cx("whitespace-pre-line", message.kind === "error" ? "rounded-2xl bg-danger-soft px-4 py-3 text-sm text-danger" : "rounded-2xl bg-sage-soft px-4 py-3 text-sm text-sage-on-soft")}>
              {message.text}
            </p>
          )}
          {backend?.kind === "local" && <p className="px-1 text-sm text-muted">{backend.storageLabel}</p>}

          <div className="mt-6 flex flex-wrap items-center justify-end gap-2">
            {mode === "signin" && (
              <Button variant="ghost" onClick={() => go("signup")}>
                {t("Create account")}
              </Button>
            )}
            {(mode === "signup" || mode === "forgot") && (
              <Button variant="ghost" onClick={() => go("signin")}>
                {t("Back to sign in")}
              </Button>
            )}
            {mode !== "forgot" && (
              <Button type="submit" disabled={busy}>
                {busy ? t("Please wait…") : mode === "reset" ? t("Save password") : mode === "signup" ? t("Create account") : t("Sign in")}
              </Button>
            )}
          </div>
        </div>
      </form>
      <div className="mt-6 flex w-full max-w-[64rem] flex-wrap justify-between gap-2 px-4 text-xs text-muted">
        <span>{t(settings.site_name)}</span>
        <span>
          {hebrewDate()} · {parshaOfWeek(currentWeek()).local}
        </span>
      </div>
      <SiteFooter className="w-full max-w-[64rem] px-0" />
    </div>
  );
}

"use client";

import { useState, type FormEvent } from "react";
import { Plus, X } from "lucide-react";
import { useData } from "@/lib/data";
import { hebrewDate } from "@/lib/dates";
import { LogoMark } from "../brand";
import { Button, Field, IconButton, Input } from "../ui";

type Mode = "signin" | "signup" | "forgot" | "reset";

const TITLES: Record<Mode, string> = {
  signin: "Sign in",
  signup: "Create your account",
  forgot: "Forgot your username or password?",
  reset: "Choose a new password",
};

export function LoginView({ initialMode = "signin" }: { initialMode?: Mode }) {
  const { auth, backend, settings } = useData();
  const [mode, setMode] = useState<Mode>(initialMode);
  const [name, setName] = useState("");
  const [partners, setPartners] = useState<string[]>([""]);
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
      setMessage({ kind: "error", text: "The two passwords don't match. Type them again." });
      return;
    }
    setBusy(true);
    try {
      if (mode === "signup") {
        const { needsConfirmation } = await auth.signUp({
          name: name.trim(),
          partners: partners.map((p) => p.trim()).filter(Boolean),
          username,
          email,
          password,
        });
        if (needsConfirmation) {
          go("signin");
          setMessage({ kind: "info", text: `Almost done. We sent a confirmation link to ${email.trim()}. Open it, then sign in with your username and password.` });
        }
      } else if (mode === "signin") {
        await auth.signIn(username, password);
      } else if (mode === "forgot") {
        await auth.requestPasswordReset(email);
        setMessage({ kind: "info", text: `If ${email.trim()} has an account, we sent it a link to reset your password. The email also shows your username.` });
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
      ? settings.welcome
      : mode === "forgot"
        ? "Enter the email you signed up with. We'll send you a link to set a new password, along with your username."
        : mode === "reset"
          ? "Type your new password twice."
          : `to continue to ${settings.site_name}`;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-paper px-4 py-10">
      <form
        onSubmit={submit}
        className="grid w-full max-w-[64rem] gap-10 rounded-[28px] bg-card px-6 py-10 sm:px-10 md:grid-cols-2 md:gap-12 md:px-12 md:py-12"
      >
        <div>
          <LogoMark className="h-12 w-12" />
          <p className="mt-6 text-sm font-medium text-accent">{settings.site_name}</p>
          <h1 className="mt-1 text-[2.25rem] leading-tight font-normal sm:text-[2.75rem]">{TITLES[mode]}</h1>
          <p className="mt-3 text-base text-muted">{subtitle}</p>
        </div>

        <div className="grid content-start gap-5">
          {mode === "signup" && (
            <>
              <Field label="Your name" htmlFor="login-name">
                <Input id="login-name" required value={name} onChange={(e) => setName(e.target.value)} placeholder="Mendel Cohen" autoComplete="name" />
              </Field>
              <div className="grid gap-1.5">
                <p className="px-1 text-sm font-medium text-muted">Mivtzoim chavrusas (partners)</p>
                {partners.map((p, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <Input
                      id={`login-partner-${i}`}
                      aria-label={`Chavrusa ${i + 1}`}
                      value={p}
                      onChange={(e) => setPartners(partners.map((x, j) => (j === i ? e.target.value : x)))}
                      placeholder={i === 0 ? "Yossi Levi" : "Another chavrusa"}
                    />
                    {partners.length > 1 && (
                      <IconButton aria-label={`Remove chavrusa ${i + 1}`} onClick={() => setPartners(partners.filter((_, j) => j !== i))}>
                        <X size={18} />
                      </IconButton>
                    )}
                  </div>
                ))}
                <div className="flex items-center justify-between gap-2">
                  <p className="px-1 text-xs text-muted">Optional. Your account will show all your names together.</p>
                  {partners.length < 5 && (
                    <Button variant="ghost" className="h-9 shrink-0 px-3" onClick={() => setPartners([...partners, ""])}>
                      <Plus size={16} aria-hidden /> Add another
                    </Button>
                  )}
                </div>
              </div>
            </>
          )}

          {(mode === "signup" || mode === "signin") && (
            <Field label="Username" htmlFor="login-username" hint={mode === "signup" ? "3 to 20 letters, numbers, dots or dashes. You'll use it to sign in." : undefined}>
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

          {(mode === "signup" || mode === "forgot") && (
            <Field label="Email" htmlFor="login-email" hint={mode === "signup" ? "We'll send a link to confirm your account. It's also how you reset a forgotten password." : undefined}>
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
            <Field label={mode === "reset" ? "New password" : "Password"} htmlFor="login-password" hint={mode === "signup" || mode === "reset" ? "Use at least 6 characters." : undefined}>
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
            <Field label="Type the password again" htmlFor="login-password2">
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
              Forgot username or password?
            </button>
          )}

          {message && (
            <p className={message.kind === "error" ? "rounded-2xl bg-danger-soft px-4 py-3 text-sm text-danger" : "rounded-2xl bg-sage-soft px-4 py-3 text-sm text-sage-on-soft"}>
              {message.text}
            </p>
          )}
          {backend?.kind === "local" && <p className="px-1 text-sm text-muted">{backend.storageLabel}</p>}

          <div className="mt-6 flex flex-wrap items-center justify-end gap-2">
            {mode === "signin" && (
              <Button variant="ghost" onClick={() => go("signup")}>
                Create account
              </Button>
            )}
            {(mode === "signup" || mode === "forgot") && (
              <Button variant="ghost" onClick={() => go("signin")}>
                Back to sign in
              </Button>
            )}
            <Button type="submit" disabled={busy}>
              {busy ? "Please wait…" : mode === "forgot" ? "Send reset link" : mode === "reset" ? "Save password" : mode === "signup" ? "Create account" : "Sign in"}
            </Button>
          </div>
        </div>
      </form>
      <div className="mt-6 flex w-full max-w-[64rem] flex-wrap justify-between gap-2 px-4 text-xs text-muted">
        <span>{settings.site_name}</span>
        <span>{hebrewDate()}</span>
      </div>
    </div>
  );
}

"use client";

import { useState, type FormEvent } from "react";
import { useData } from "@/lib/data";
import { hebrewDate } from "@/lib/dates";
import { LogoMark } from "../brand";
import { Button, Field, Input } from "../ui";

export function LoginView() {
  const { auth, backend, settings } = useData();
  const [isSignUp, setIsSignUp] = useState(false);
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: "error" | "info"; text: string } | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      if (isSignUp) {
        const { needsConfirmation } = await auth.signUp(name, username, password);
        if (needsConfirmation) setMessage({ kind: "info", text: "Your account was created. Sign in with your username and password." });
      } else {
        await auth.signIn(username, password);
      }
    } catch (err) {
      setMessage({ kind: "error", text: (err as Error).message });
    } finally {
      setBusy(false);
    }
  }

  function toggle() {
    setIsSignUp(!isSignUp);
    setMessage(null);
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-paper px-4 py-10">
      <form
        onSubmit={submit}
        className="grid w-full max-w-[64rem] gap-10 rounded-[28px] bg-card px-6 py-10 sm:px-10 md:grid-cols-2 md:gap-12 md:px-12 md:py-12"
      >
        <div>
          <LogoMark className="h-12 w-12" />
          <h1 className="mt-6 text-[2.25rem] leading-tight font-normal sm:text-[2.75rem]">{isSignUp ? "Create your account" : "Sign in"}</h1>
          <p className="mt-3 text-base text-muted">
            {isSignUp ? settings.welcome : `to continue to ${settings.site_name} ${settings.tagline}`}
          </p>
        </div>

        <div className="grid content-start gap-5">
          {isSignUp && (
            <Field label="Full name" htmlFor="login-name">
              <Input id="login-name" required value={name} onChange={(e) => setName(e.target.value)} placeholder="Mendel Cohen" autoComplete="name" />
            </Field>
          )}
          <Field label={isSignUp ? "Username" : "Username or email"} htmlFor="login-username" hint={isSignUp ? "3 to 20 letters, numbers, dots or dashes. You'll use it to sign in." : undefined}>
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
          <Field label="Password" htmlFor="login-password" hint={isSignUp ? "Use at least 6 characters." : undefined}>
            <Input
              id="login-password"
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={isSignUp ? "new-password" : "current-password"}
            />
          </Field>
          {message && (
            <p className={message.kind === "error" ? "rounded-2xl bg-danger-soft px-4 py-3 text-sm text-danger" : "rounded-2xl bg-sage-soft px-4 py-3 text-sm text-sage-on-soft"}>
              {message.text}
            </p>
          )}
          {backend?.kind === "local" && <p className="px-1 text-sm text-muted">{backend.storageLabel}</p>}

          <div className="mt-6 flex items-center justify-end gap-2">
            <Button variant="ghost" onClick={toggle}>
              {isSignUp ? "Sign in instead" : "Create account"}
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? "Please wait…" : "Next"}
            </Button>
          </div>
        </div>
      </form>
      <div className="mt-6 flex w-full max-w-[64rem] flex-wrap justify-between gap-2 px-4 text-xs text-muted">
        <span>
          {settings.site_name} {settings.tagline}
        </span>
        <span>{hebrewDate()}</span>
      </div>
    </div>
  );
}

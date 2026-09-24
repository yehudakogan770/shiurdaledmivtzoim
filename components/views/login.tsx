"use client";

import { useState, type FormEvent } from "react";
import { useData } from "@/lib/data";
import { Button, Field, Input } from "../ui";

export function LoginView() {
  const { auth, backend } = useData();
  const [isSignUp, setIsSignUp] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: "error" | "info"; text: string } | null>(null);
  const needsPassword = backend?.usesPassword ?? true;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      if (isSignUp) {
        const { needsConfirmation } = await auth.signUp(name, email, password);
        if (needsConfirmation) setMessage({ kind: "info", text: "Check your email for a link to confirm your account, then sign in." });
      } else {
        await auth.signIn(email, password);
      }
    } catch (err) {
      setMessage({ kind: "error", text: (err as Error).message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="grid min-h-screen place-items-center bg-paper px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="font-display text-4xl font-bold">Shiur Daled</h1>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-muted">Mivtzoim</p>
          <p className="mt-4 text-muted">
            Track tefillin, Shabbos candles and every other mivtza, on your own and with your group.
          </p>
        </div>

        <form onSubmit={submit} className="grid gap-4 rounded-lg border border-line bg-surface p-6">
          <h2 className="font-display text-2xl font-bold">{isSignUp ? "Create your account" : "Sign in"}</h2>
          {isSignUp && (
            <Field label="Name" htmlFor="login-name">
              <Input id="login-name" required value={name} onChange={(e) => setName(e.target.value)} placeholder="Mendel Cohen" autoComplete="name" />
            </Field>
          )}
          <Field label="Email" htmlFor="login-email">
            <Input id="login-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" autoComplete="email" />
          </Field>
          {needsPassword && (
            <Field label="Password" htmlFor="login-password" hint={isSignUp ? "At least 6 characters." : undefined}>
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
          )}
          {message && <p className={message.kind === "error" ? "text-sm text-danger" : "text-sm text-sage"}>{message.text}</p>}
          <Button type="submit" disabled={busy} className="w-full py-2.5">
            {busy ? "One moment…" : isSignUp ? "Create account" : "Sign in"}
          </Button>
          {!needsPassword && <p className="text-center text-xs text-muted">{backend?.storageLabel}</p>}
        </form>

        <p className="mt-5 text-center text-sm text-muted">
          {isSignUp ? "Already have an account?" : "New here?"}{" "}
          <button type="button" onClick={() => { setIsSignUp(!isSignUp); setMessage(null); }} className="font-semibold text-accent underline-offset-2 hover:underline">
            {isSignUp ? "Sign in" : "Create an account"}
          </button>
        </p>
      </div>
    </main>
  );
}

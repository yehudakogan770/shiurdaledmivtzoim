"use client";

import { useState, type FormEvent } from "react";
import { Check, Copy, HandHeart, Mail, Pencil } from "lucide-react";
import { useData } from "@/lib/data";
import { useNav } from "@/lib/nav";
import { useEditMode } from "@/lib/edit-mode";
import { donationInfo, donationTagline, type DonationInfo } from "@/lib/donation";
import { Button, Field, Input, Textarea, cx } from "./ui";

const EMAIL = "sdmivtzoim87@gmail.com";

/** Bottom of every page: ways to partner in the mivtzoim (Cash App, Zelle) and how to reach us. */
export function SiteFooter({ className }: { className?: string }) {
  const { settings, isOwner } = useData();
  const { path } = useNav();
  const { editing } = useEditMode();
  const home = path === "/" || path.startsWith("/dashboard");
  // The Admin page is for running the site, so it skips the Cash App / Zelle box.
  // The Owner sees it only on Home, where it can be edited.
  const showPartner = !path.startsWith("/admin") && (!isOwner || home);
  const { title, text, cashtag: CASHTAG, zelle: ZELLE } = donationInfo(settings);
  const [copied, setCopied] = useState(false);

  async function copyZelle() {
    try {
      await navigator.clipboard.writeText(ZELLE);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Clipboard blocked: the address is written out right next to the button.
    }
  }

  const pill =
    "inline-flex w-full min-w-0 items-center gap-3 rounded-full py-1.5 pl-1.5 pr-4 text-left text-sm transition hover:brightness-[0.97] hover:shadow-card sm:w-auto";

  return (
    <footer className={cx("mt-10 grid gap-6", className)}>
      {showPartner && isOwner && editing && <DonationEditor />}
      {showPartner && !(isOwner && editing) && (
        <section className="grid min-w-0 grid-cols-1 gap-4 rounded-[28px] bg-card p-6 lg:grid-cols-[1fr_auto] lg:items-center">
          <div className="flex items-start gap-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-accent-soft text-accent-on-soft">
              <HandHeart size={22} aria-hidden />
            </span>
            <div>
              <h2 className="text-lg font-medium">{title}</h2>
              <p className="text-sm text-muted">{text}</p>
            </div>
          </div>
          <div className="flex min-w-0 flex-wrap gap-2">
            <a
              href={`https://cash.app/${CASHTAG.startsWith("$") ? CASHTAG : `$${CASHTAG}`}`}
              target="_blank"
              rel="noopener noreferrer"
              className={cx(pill, "bg-[#00d64f]/15 text-ink")}
            >
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#00d64f] text-base font-bold text-white">
                $
              </span>
              <span className="min-w-0 leading-tight">
                <span className="block font-medium">Cash App</span>
                <span className="block text-[13px] text-muted sm:text-sm">{CASHTAG}</span>
              </span>
            </a>
            <button
              type="button"
              onClick={copyZelle}
              className={cx(pill, "bg-[#6d1ed4]/12 text-ink")}
              aria-label={`Zelle ${ZELLE}, copy address`}
            >
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#6d1ed4] text-base font-bold text-white">
                Z
              </span>
              <span className="min-w-0 flex-1 leading-tight">
                <span className="block font-medium">Zelle</span>
                <span className="block text-[13px] text-muted sm:text-sm">
                  {ZELLE.includes("@") ? (
                    <>
                      {ZELLE.split("@")[0]}
                      <wbr />@{ZELLE.split("@")[1]}
                    </>
                  ) : (
                    ZELLE
                  )}
                </span>
              </span>
              {copied ? (
                <Check size={16} aria-hidden className="text-sage" />
              ) : (
                <Copy size={16} aria-hidden className="text-muted" />
              )}
            </button>
          </div>
          {copied && (
            <p role="status" className="text-sm text-muted lg:col-span-2">
              Zelle address copied. Send it from your bank&apos;s app with
              Zelle.
            </p>
          )}
        </section>
      )}

      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 px-2 text-sm text-muted">
        <span>
          © {new Date().getFullYear()} {settings.site_name}
        </span>
        <span className="flex flex-wrap items-center gap-x-5 gap-y-1">
          <a
            href={`mailto:${EMAIL}`}
            className="inline-flex items-center gap-1.5 font-medium text-accent hover:underline"
          >
            <Mail size={16} aria-hidden /> Contact us
          </a>
          <a href={`mailto:${EMAIL}`} className="hover:underline">
            {EMAIL}
          </a>
        </span>
      </div>
    </footer>
  );
}

/** The Owner's form for the donation box, shown on Home while Edit is on. */
function DonationEditor() {
  const { settings, actions, notify } = useData();
  // Like the other settings: shown as it is, and typed in only after tapping the pencil.
  const [draft, setDraft] = useState<DonationInfo | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof DonationInfo) => (e: { target: { value: string } }) => draft && setDraft({ ...draft, [k]: e.target.value });
  const now = donationInfo(settings);

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!draft) return;
    setBusy(true);
    try {
      await actions.saveSettings({ ...settings, tagline: donationTagline(draft) });
      notify("Donation box saved.");
      setDraft(null);
    } catch (err) {
      notify((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (!draft) {
    return (
      <section className="grid gap-4 rounded-[28px] bg-card p-6">
        <div>
          <h2 className="text-lg font-medium">Donation box</h2>
          <p className="text-sm text-muted">Shown at the bottom of every page for everyone.</p>
        </div>
        <dl className="grid gap-x-6 gap-y-3 rounded-2xl bg-paper px-4 py-3 text-sm sm:grid-cols-2">
          {(
            [
              ["Heading", now.title],
              ["Text", now.text],
              ["Cash App", now.cashtag],
              ["Zelle", now.zelle],
            ] as const
          ).map(([k, v]) => (
            <div key={k} className="min-w-0">
              <dt className="text-muted">{k}</dt>
              <dd className="break-words font-medium">{v}</dd>
            </div>
          ))}
        </dl>
        <Button variant="tonal" className="h-9 justify-self-start px-4" aria-label="Edit donation box" onClick={() => setDraft(now)}>
          <Pencil size={16} aria-hidden /> Edit
        </Button>
      </section>
    );
  }

  return (
    <form onSubmit={save} className="grid gap-4 rounded-[28px] bg-card p-6">
      <div className="flex items-center gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-accent-soft text-accent-on-soft">
          <Pencil size={20} aria-hidden />
        </span>
        <div>
          <h2 className="text-lg font-medium">Donation box</h2>
          <p className="text-sm text-muted">Shown at the bottom of every page for everyone.</p>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Heading" htmlFor="donation-title">
          <Input id="donation-title" required maxLength={60} value={draft.title} onChange={set("title")} />
        </Field>
        <Field label="Text" htmlFor="donation-text">
          <Textarea id="donation-text" required rows={2} maxLength={160} value={draft.text} onChange={set("text")} />
        </Field>
        <Field label="Cash App name" htmlFor="donation-cashtag" hint="Starts with $">
          <Input id="donation-cashtag" required maxLength={40} autoCapitalize="none" value={draft.cashtag} onChange={set("cashtag")} />
        </Field>
        <Field label="Zelle email or phone" htmlFor="donation-zelle">
          <Input id="donation-zelle" required maxLength={80} autoCapitalize="none" value={draft.zelle} onChange={set("zelle")} />
        </Field>
      </div>
      <div className="flex gap-2">
        <Button type="submit" disabled={busy} className="h-9 px-4">
          {busy ? "Saving…" : "Save"}
        </Button>
        <Button type="button" variant="ghost" className="h-9 px-3" onClick={() => setDraft(null)}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

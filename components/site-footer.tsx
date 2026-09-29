"use client";

import { useState } from "react";
import { Check, Copy, HandHeart, Mail } from "lucide-react";
import { useData } from "@/lib/data";
import { useNav } from "@/lib/nav";
import { cx } from "./ui";

const EMAIL = "sdmivtzoim87@gmail.com";
const CASHTAG = "$sdmivtzoim87";
const ZELLE = EMAIL;

/** Bottom of every page: ways to partner in the mivtzoim (Cash App, Zelle) and how to reach us. */
export function SiteFooter({ className }: { className?: string }) {
  const { settings } = useData();
  const { path } = useNav();
  // The Admin page is for running the site, so it skips the Cash App / Zelle box.
  const showPartner = !path.startsWith("/admin");
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
    "inline-flex h-11 items-center gap-2.5 rounded-full pl-1.5 pr-5 text-sm font-medium transition hover:brightness-[0.97] hover:shadow-card";

  return (
    <footer className={cx("mt-10 grid gap-6", className)}>
      {showPartner && (
        <section className="grid gap-4 rounded-[28px] bg-card p-6 sm:grid-cols-[1fr_auto] sm:items-center">
          <div className="flex items-start gap-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-accent-soft text-accent-on-soft">
              <HandHeart size={22} aria-hidden />
            </span>
            <div>
              <h2 className="text-lg font-medium">Partner in the Mivtzoim</h2>
              <p className="text-sm text-muted">
                Your participation helps make the Mivtzoim possible.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <a
              href={`https://cash.app/${CASHTAG}`}
              target="_blank"
              rel="noopener noreferrer"
              className={cx(pill, "bg-[#00d64f]/15 text-ink")}
            >
              <span className="grid h-8 w-8 place-items-center rounded-full bg-[#00d64f] text-base font-bold text-white">
                $
              </span>
              Cash App <span className="text-muted">{CASHTAG}</span>
            </a>
            <button
              type="button"
              onClick={copyZelle}
              className={cx(pill, "bg-[#6d1ed4]/12 text-ink")}
              aria-label={`Zelle ${ZELLE}, copy address`}
            >
              <span className="grid h-8 w-8 place-items-center rounded-full bg-[#6d1ed4] text-base font-bold text-white">
                Z
              </span>
              Zelle <span className="text-muted">{ZELLE}</span>
              {copied ? (
                <Check size={16} aria-hidden className="text-sage" />
              ) : (
                <Copy size={16} aria-hidden className="text-muted" />
              )}
            </button>
          </div>
          {copied && (
            <p role="status" className="text-sm text-muted sm:col-span-2">
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

"use client";

import { useEffect, useState } from "react";

/** Chrome's "install this app" prompt, which it offers once per page load. */
type InstallPrompt = Event & { prompt(): Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };

let deferred: InstallPrompt | null = null;
const listeners = new Set<() => void>();
const changed = () => listeners.forEach((fn) => fn());

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault(); // show our own button instead of Chrome's mini bar
    deferred = e as InstallPrompt;
    changed();
  });
  window.addEventListener("appinstalled", () => {
    deferred = null;
    changed();
  });
}

/** Register the service worker that makes the site installable (only on the real website). */
export function registerServiceWorker() {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
  if (location.protocol !== "https:" && location.hostname !== "localhost" && location.hostname !== "127.0.0.1") return;
  const base = process.env.NEXT_PUBLIC_BASE_PATH || "";
  navigator.serviceWorker.register(`${base}/sw.js`, { scope: `${base}/` }).catch(() => {});
}

export type Platform = "ios" | "android" | "other";

function detectPlatform(): Platform {
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) return "ios";
  if (/Android/.test(ua)) return "android";
  return "other";
}

function isInstalled() {
  return window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

/** Whether the site is already running as an installed app, and how to install it here. */
export function useInstall() {
  const [state, setState] = useState<{ ready: boolean; installed: boolean; platform: Platform; canPrompt: boolean }>({
    ready: false,
    installed: false,
    platform: "other",
    canPrompt: false,
  });

  useEffect(() => {
    const update = () => setState({ ready: true, installed: isInstalled(), platform: detectPlatform(), canPrompt: !!deferred });
    update();
    listeners.add(update);
    return () => {
      listeners.delete(update);
    };
  }, []);

  async function prompt() {
    if (!deferred) return false;
    const p = deferred;
    await p.prompt();
    const { outcome } = await p.userChoice;
    deferred = null;
    changed();
    return outcome === "accepted";
  }

  return { ...state, prompt };
}

const BUILD_ID = process.env.NEXT_PUBLIC_BUILD_ID || "";

/** True when the website has a newer version than the one running on this screen. */
export async function newVersionOnline() {
  if (!BUILD_ID || typeof location === "undefined") return false;
  const base = process.env.NEXT_PUBLIC_BASE_PATH || "";
  try {
    const res = await fetch(`${base}/version.json?t=${Date.now()}`, { cache: "no-store" });
    if (!res.ok) return false;
    const { build } = (await res.json()) as { build?: string };
    return !!build && build !== BUILD_ID;
  } catch {
    return false;
  }
}

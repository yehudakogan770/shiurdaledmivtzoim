"use client";

import { useEffect, type RefObject } from "react";

/**
 * Sections further down the page fade and slide up gently as they scroll into view. Only sections
 * that start below the visible screen are hidden first, so nothing already in view ever blinks.
 * Once shown, the classes come off again, so no motion styles linger (they'd trap pop-ups).
 * Off for phones set to reduce motion. New sections (a page loading its data, a tab switching)
 * are picked up too.
 */
export function useScrollReveal(root: RefObject<HTMLElement | null>, key: string) {
  useEffect(() => {
    const main = root.current;
    if (!main || typeof IntersectionObserver === "undefined") return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const seen = new WeakSet<Element>();
    const show = (el: HTMLElement) => {
      el.classList.add("reveal-in");
      el.classList.remove("reveal-wait");
      const done = () => el.classList.remove("reveal-in");
      el.addEventListener("transitionend", done, { once: true });
      setTimeout(done, 700);
    };
    const watcher = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          watcher.unobserve(e.target);
          show(e.target as HTMLElement);
        }
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.08 },
    );
    const scan = () => {
      // Top-level sections only (cards inside cards move with their card).
      for (const el of main.querySelectorAll<HTMLElement>("section")) {
        if (seen.has(el) || el.parentElement?.closest("main section")) continue;
        seen.add(el);
        if (el.getBoundingClientRect().top < window.innerHeight * 0.92) continue;
        el.classList.add("reveal-wait");
        watcher.observe(el);
      }
    };
    scan();
    const changes = new MutationObserver(() => scan());
    changes.observe(main, { childList: true, subtree: true });
    return () => {
      changes.disconnect();
      watcher.disconnect();
      main.querySelectorAll(".reveal-wait, .reveal-in").forEach((el) => el.classList.remove("reveal-wait", "reveal-in"));
    };
  }, [root, key]);
}

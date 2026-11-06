"use client";

import { createContext, useContext, type ComponentType, type ReactNode } from "react";

export interface LinkProps {
  href: string;
  className?: string;
  children: ReactNode;
  "aria-current"?: "page" | undefined;
}

/**
 * Screens navigate through this context instead of next/link, so they run in
 * the Next.js site and in the single-file build published as a Claude artifact.
 */
export interface Nav {
  path: string;
  query: Record<string, string>;
  go(href: string): void;
  back(fallback: string): void;
  Link: ComponentType<LinkProps>;
}

const NavContext = createContext<Nav | null>(null);

export function NavProvider({ value, children }: { value: Nav; children: ReactNode }) {
  return <NavContext.Provider value={value}>{children}</NavContext.Provider>;
}

export function useNav() {
  const nav = useContext(NavContext);
  if (!nav) throw new Error("useNav must be used inside NavProvider");
  return nav;
}

export function parseHref(href: string) {
  const [path, qs = ""] = href.split("?");
  const query: Record<string, string> = {};
  new URLSearchParams(qs).forEach((v, k) => (query[k] = v));
  return { path: path || "/", query };
}

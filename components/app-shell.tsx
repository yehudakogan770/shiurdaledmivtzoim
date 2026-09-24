"use client";

import type { ReactNode } from "react";
import { ClipboardPen, History, LayoutDashboard, Map, UserRound, Users } from "lucide-react";
import { useData } from "@/lib/data";
import { useNav } from "@/lib/nav";
import { cx } from "./ui";
import { LoginView } from "./views/login";

const links = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard, match: ["/", "/dashboard"] },
  { href: "/log", label: "Log Mivtzoim", icon: ClipboardPen, match: ["/log", "/mivtzoim"] },
  { href: "/groups", label: "Groups", icon: Users, match: ["/groups"] },
  { href: "/routes", label: "Routes", icon: Map, match: ["/routes"] },
  { href: "/history", label: "History", icon: History, match: ["/history"] },
  { href: "/profile", label: "Profile", icon: UserRound, match: ["/profile"] },
];

function isActive(path: string, match: string[]) {
  return match.some((m) => (m === "/" ? path === "/" : path === m || path.startsWith(m + "/")));
}

function Brand() {
  return (
    <div className="leading-tight">
      <div className="font-display text-xl font-bold">Shiur Daled</div>
      <div className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">Mivtzoim</div>
    </div>
  );
}

function Sidebar() {
  const { path, Link } = useNav();
  const { me } = useData();
  return (
    <aside className="border-b border-line bg-surface lg:sticky lg:top-0 lg:flex lg:h-screen lg:w-60 lg:shrink-0 lg:flex-col lg:border-b-0 lg:border-r">
      <div className="flex items-center justify-between px-4 pt-4 pb-2 lg:px-5 lg:pt-6 lg:pb-4">
        <Brand />
        {me && <span className="truncate text-sm text-muted lg:hidden">{me.name}</span>}
      </div>
      <nav aria-label="Main" className="flex gap-1 overflow-x-auto px-3 pb-3 lg:flex-col lg:overflow-visible lg:pb-0">
        {links.map(({ href, label, icon: Icon, match }) => {
          const active = isActive(path, match);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={cx(
                "flex shrink-0 items-center gap-2.5 rounded-md px-3 py-2 text-sm font-semibold transition-colors",
                active ? "bg-accent-soft text-accent" : "text-muted hover:bg-sunken hover:text-ink",
              )}
            >
              <Icon size={17} strokeWidth={2} aria-hidden /> {label}
            </Link>
          );
        })}
      </nav>
      {me && (
        <div className="mt-auto hidden border-t border-line px-5 py-4 text-sm lg:block">
          <div className="text-xs text-muted">Signed in as</div>
          <div className="truncate font-semibold">{me.name}</div>
        </div>
      )}
    </aside>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const { status, error, me, backend, toast } = useData();

  let body: ReactNode;
  if (status === "loading") {
    body = <div className="grid min-h-[60vh] place-items-center text-muted">Loading…</div>;
  } else if (status === "error") {
    body = (
      <div className="mx-auto max-w-md py-20 text-center">
        <p className="font-display text-2xl font-bold">Couldn&apos;t load your data</p>
        <p className="mt-2 text-muted">{error}</p>
      </div>
    );
  } else if (!me && backend?.hasAuth) {
    return (
      <>
        <LoginView />
        <Toast message={toast} />
      </>
    );
  } else if (!me) {
    body = (
      <div className="mx-auto max-w-md py-20 text-center">
        <p className="font-display text-2xl font-bold">Sign in to Claude to continue</p>
        <p className="mt-2 text-muted">This page needs to know who you are so it can save your mivtzoim.</p>
      </div>
    );
  } else {
    body = children;
  }

  return (
    <div className="min-h-screen lg:flex">
      <Sidebar />
      <main className="min-w-0 flex-1 px-4 py-6 sm:px-8 sm:py-8">
        <div className="mx-auto max-w-5xl">{body}</div>
      </main>
      <Toast message={toast} />
    </div>
  );
}

function Toast({ message }: { message: string | null }) {
  return (
    <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex justify-center px-4 pb-[calc(1rem+env(safe-area-inset-bottom,0px))]">
      {message && <div className="rounded-md bg-ink px-4 py-2.5 text-sm font-semibold text-paper shadow-lg">{message}</div>}
    </div>
  );
}

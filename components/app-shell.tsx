"use client";

import type { ReactNode } from "react";
import { ClipboardPen, History, LayoutDashboard, LogOut, Map, Plus, UserRound, Users } from "lucide-react";
import { useData } from "@/lib/data";
import { useNav } from "@/lib/nav";
import { hebrewDate } from "@/lib/dates";
import { Avatar, IconButton, cx } from "./ui";
import { LogoMark, Wordmark } from "./brand";
import { LoginView } from "./views/login";

const links = [
  { href: "/", label: "Dashboard", short: "Home", icon: LayoutDashboard, match: ["/", "/dashboard"] },
  { href: "/log", label: "Log mivtzoim", short: "Log", icon: ClipboardPen, match: ["/log", "/mivtzoim"] },
  { href: "/groups", label: "Groups", short: "Groups", icon: Users, match: ["/groups"] },
  { href: "/routes", label: "Routes", short: "Routes", icon: Map, match: ["/routes"] },
  { href: "/history", label: "History", short: "History", icon: History, match: ["/history"] },
  { href: "/profile", label: "Profile", short: "Profile", icon: UserRound, match: ["/profile"] },
];

function isActive(path: string, match: string[]) {
  return match.some((m) => (m === "/" ? path === "/" : path === m || path.startsWith(m + "/")));
}

/** Material 3 navigation drawer (desktop). */
function Drawer() {
  const { path, Link } = useNav();
  const { me, backend, auth } = useData();
  return (
    <aside className="sticky top-0 hidden h-screen w-72 shrink-0 flex-col px-3 py-4 lg:flex">
      <div className="px-4 pt-2 pb-6">
        <Link href="/">
          <Wordmark />
        </Link>
      </div>
      <div className="px-1 pb-4">
        <Link
          href="/log"
          className="inline-flex h-14 items-center gap-3 rounded-2xl bg-accent-soft pr-6 pl-4 text-[15px] font-medium text-accent-on-soft shadow-pop transition hover:brightness-[0.97]"
        >
          <Plus size={22} aria-hidden /> Log mivtzoim
        </Link>
      </div>
      <nav aria-label="Main" className="grid gap-0.5">
        {links.map(({ href, label, icon: Icon, match }) => {
          const active = isActive(path, match);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={cx(
                "flex h-14 items-center gap-3 rounded-full px-4 text-sm font-medium transition-colors",
                active ? "bg-secondary-soft text-secondary-on-soft" : "text-muted hover:bg-ink/8 hover:text-ink",
              )}
            >
              <Icon size={22} strokeWidth={active ? 2.2 : 1.8} aria-hidden /> {label}
            </Link>
          );
        })}
      </nav>
      <div className="mt-auto grid gap-3">
        <p className="px-4 text-sm text-muted">{hebrewDate()}</p>
        {me && (
          <div className="flex items-center gap-2 rounded-[28px] bg-card p-2">
            <Link href="/profile" className="flex min-w-0 flex-1 items-center gap-3 rounded-full p-1 pr-3 hover:bg-ink/5">
              <Avatar name={me.name} id={me.id} size={40} />
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium">{me.name}</span>
                <span className="block truncate text-xs text-muted">{me.username ? `@${me.username}` : "View profile"}</span>
              </span>
            </Link>
            {backend?.hasAuth && (
              <IconButton onClick={() => auth.signOut()} aria-label="Sign out">
                <LogOut size={18} />
              </IconButton>
            )}
          </div>
        )}
      </div>
    </aside>
  );
}

/** Top app bar (phones). */
function TopAppBar() {
  const { Link } = useNav();
  const { me } = useData();
  return (
    <header className="sticky top-[env(safe-area-inset-top,0px)] z-30 flex h-16 items-center justify-between bg-paper/90 px-4 backdrop-blur lg:hidden">
      <Link href="/" className="flex items-center gap-2.5">
        <LogoMark className="h-9 w-9" />
        <span className="text-lg font-medium">Shiur Daled</span>
      </Link>
      {me && (
        <Link href="/profile" aria-label="Profile" className="rounded-full">
          <Avatar name={me.name} id={me.id} size={36} />
        </Link>
      )}
    </header>
  );
}

/** Material 3 navigation bar (phones), with a pill indicator behind the active icon. */
function NavigationBar() {
  const { path, Link } = useNav();
  const tabs = [links[0], links[2], links[3], links[4], links[5]];
  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 bg-card pt-3 pb-[calc(1rem+env(safe-area-inset-bottom,0px))] shadow-[0_-1px_0_var(--line)] lg:hidden"
    >
      {tabs.map(({ href, short, icon: Icon, match }) => {
        const active = isActive(path, match);
        return (
          <Link key={href} href={href} aria-current={active ? "page" : undefined} className="flex flex-col items-center gap-1 text-xs font-medium">
            <span
              className={cx(
                "grid h-8 w-16 place-items-center rounded-full transition-colors",
                active ? "bg-secondary-soft text-secondary-on-soft" : "text-muted",
              )}
            >
              <Icon size={22} strokeWidth={active ? 2.2 : 1.8} aria-hidden />
            </span>
            <span className={active ? "text-ink" : "text-muted"}>{short}</span>
          </Link>
        );
      })}
    </nav>
  );
}

/** Floating action button for logging (phones). */
function Fab() {
  const { path, Link } = useNav();
  if (isActive(path, links[1].match)) return null;
  return (
    <Link
      href="/log"
      aria-label="Log mivtzoim"
      className="fixed right-4 bottom-[calc(6.5rem+env(safe-area-inset-bottom,0px))] z-30 grid h-14 w-14 place-items-center rounded-2xl bg-accent-soft text-accent-on-soft shadow-pop lg:hidden"
    >
      <Plus size={26} aria-hidden />
    </Link>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const { status, error, me, backend, toast } = useData();

  let body: ReactNode;
  if (status === "loading") {
    return (
      <div className="grid min-h-screen place-items-center bg-paper">
        <div className="flex flex-col items-center gap-4 text-muted">
          <LogoMark className="h-14 w-14 animate-pulse" />
        </div>
      </div>
    );
  } else if (status === "error") {
    body = (
      <div className="mx-auto max-w-md py-20 text-center">
        <p className="text-2xl">We couldn&apos;t load your data</p>
        <p className="mt-2 text-muted">{error}</p>
      </div>
    );
  } else if (!me && backend?.hasAuth) {
    return (
      <>
        <LoginView />
        <Snackbar message={toast} />
      </>
    );
  } else if (!me) {
    body = (
      <div className="mx-auto max-w-md py-20 text-center">
        <p className="text-2xl">Sign in to Claude to continue</p>
        <p className="mt-2 text-muted">This page needs to know who you are so it can save your mivtzoim.</p>
      </div>
    );
  } else {
    body = children;
  }

  return (
    <div className="min-h-screen bg-paper lg:flex">
      <Drawer />
      <div className="min-w-0 flex-1">
        <TopAppBar />
        <main className="px-4 pt-2 pb-36 sm:px-6 lg:px-8 lg:pt-8 lg:pb-12">
          <div className="mx-auto max-w-6xl">{body}</div>
        </main>
      </div>
      <Fab />
      <NavigationBar />
      <Snackbar message={toast} />
    </div>
  );
}

/** Material 3 snackbar. */
function Snackbar({ message }: { message: string | null }) {
  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-[calc(6.5rem+env(safe-area-inset-bottom,0px))] z-50 flex justify-center pr-20 pl-4 lg:bottom-6 lg:px-4"
    >
      {message && <div className="min-h-12 rounded-xl bg-ink px-4 py-3.5 text-sm text-paper shadow-pop">{message}</div>}
    </div>
  );
}

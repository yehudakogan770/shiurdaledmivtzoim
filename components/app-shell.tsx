"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { History, LayoutDashboard, LogOut, Map, Menu, Plus, ShieldCheck, UserRound, Users } from "lucide-react";
import { handle } from "@/lib/admin";
import { useData } from "@/lib/data";
import { useNav } from "@/lib/nav";
import { hebrewDate } from "@/lib/dates";
import { Avatar, IconButton, cx } from "./ui";
import { LogoMark } from "./brand";
import { LoginView } from "./views/login";

const links = [
  { href: "/", label: "Dashboard", short: "Home", icon: LayoutDashboard, match: ["/", "/dashboard"] },
  { href: "/groups", label: "Groups", short: "Groups", icon: Users, match: ["/groups"] },
  { href: "/routes", label: "Routes", short: "Routes", icon: Map, match: ["/routes"] },
  { href: "/history", label: "History", short: "History", icon: History, match: ["/history"] },
  { href: "/profile", label: "Profile", short: "Profile", icon: UserRound, match: ["/profile"] },
];

const LOG_MATCH = ["/log", "/mivtzoim"];
const ADMIN_LINK = { href: "/admin", label: "Admin", short: "Admin", icon: ShieldCheck, match: ["/admin"] };

function isActive(path: string, match: string[]) {
  return match.some((m) => (m === "/" ? path === "/" : path === m || path.startsWith(m + "/")));
}

/** The side panel's contents. `expanded` shows labels; collapsed shows icons only. */
function PanelContent({ expanded, onNavigate }: { expanded: boolean; onNavigate?: () => void }) {
  const { path, Link } = useNav();
  const { me, backend, auth, settings, isAdmin } = useData();
  const items = isAdmin ? [...links, ADMIN_LINK] : links;
  const label = cx("whitespace-nowrap transition-opacity duration-200", expanded ? "opacity-100" : "opacity-0");
  return (
    <div className="flex h-full flex-col px-3 py-4" onClick={(e) => (e.target as HTMLElement).closest("a") && onNavigate?.()}>
      <div className="px-2 pt-2 pb-6">
        <Link href="/">
          <span className="flex items-center gap-3">
            <LogoMark className="h-10 w-10" />
            <span className={cx("leading-tight", label)}>
              <span className="block text-lg font-medium text-ink">{settings.site_name}</span>
              <span className="block text-sm text-muted">{settings.tagline}</span>
            </span>
          </span>
        </Link>
      </div>
      <nav aria-label="Main" className="grid gap-0.5">
        {items.map(({ href, label: text, icon: Icon, match }) => {
          const active = isActive(path, match);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={cx(
                "flex h-14 items-center gap-4 overflow-hidden rounded-full px-4 text-sm font-medium transition-colors",
                active ? "bg-secondary-soft text-secondary-on-soft" : "text-muted hover:bg-ink/8 hover:text-ink",
              )}
            >
              <Icon size={22} strokeWidth={active ? 2.2 : 1.8} aria-hidden className="shrink-0" />
              <span className={label}>{text}</span>
            </Link>
          );
        })}
      </nav>
      <div className="mt-auto grid gap-3">
        <p className={cx("px-4 text-sm text-muted", label)}>{hebrewDate()}</p>
        {me && (
          <div className={cx("flex items-center gap-2 overflow-hidden rounded-[28px] p-2 transition-colors", expanded ? "bg-card" : "bg-transparent")}>
            <Link href="/profile" className="flex min-w-0 flex-1 items-center gap-3 rounded-full p-1 pr-3 hover:bg-ink/5">
              <Avatar name={me.name} id={me.id} size={40} />
              <span className={cx("min-w-0", label)}>
                <span className="block truncate text-sm font-medium">{me.name}</span>
                <span className="block truncate text-xs text-muted">{me.username ? handle(me.username) : "View profile"}</span>
              </span>
            </Link>
            {backend?.hasAuth && expanded && (
              <IconButton onClick={() => auth.signOut()} aria-label="Sign out">
                <LogOut size={18} />
              </IconButton>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/** Computers: a slim icon rail that opens while the mouse (or keyboard focus) is on it. */
function HoverRail() {
  const [open, setOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const show = () => {
    if (timer.current) clearTimeout(timer.current);
    setOpen(true);
  };
  const hide = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setOpen(false), 150);
  };
  return (
    <div className="hidden w-20 shrink-0 lg:block">
      <aside
        aria-label="Side panel"
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocus={show}
        onBlur={(e) => !e.currentTarget.contains(e.relatedTarget as Node) && hide()}
        className={cx(
          "fixed inset-y-0 left-0 z-40 overflow-hidden bg-paper transition-[width,box-shadow] duration-200 ease-out",
          open ? "w-72 rounded-r-[28px] shadow-pop" : "w-20",
        )}
      >
        <PanelContent expanded={open} />
      </aside>
    </div>
  );
}

/** Phones and tablets: a modal side panel opened from the three-bar button. */
function ModalDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { path } = useNav();
  useEffect(() => {
    onClose();
    // Close whenever the page changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  }, [open, onClose]);
  return (
    <div className="lg:hidden" aria-hidden={!open}>
      <div
        onClick={onClose}
        className={cx("fixed inset-0 z-40 bg-black/40 transition-opacity duration-200", open ? "opacity-100" : "pointer-events-none opacity-0")}
      />
      <aside
        aria-label="Side panel"
        inert={!open}
        className={cx(
          "fixed inset-y-0 left-0 z-50 w-[85%] max-w-80 rounded-r-[28px] bg-paper pt-[env(safe-area-inset-top,0px)] pb-[env(safe-area-inset-bottom,0px)] shadow-pop transition-transform duration-250 ease-out",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <PanelContent expanded onNavigate={onClose} />
      </aside>
    </div>
  );
}

/** Top app bar (phones and tablets). */
function TopAppBar({ onMenu }: { onMenu: () => void }) {
  const { Link } = useNav();
  const { me, settings } = useData();
  return (
    <header className="sticky top-[env(safe-area-inset-top,0px)] z-30 flex h-16 items-center gap-1 bg-paper/90 px-2 backdrop-blur lg:hidden">
      <IconButton onClick={onMenu} aria-label="Open menu" className="h-12 w-12 text-ink">
        <Menu size={24} />
      </IconButton>
      <Link href="/" className="flex items-center gap-2.5">
        <LogoMark className="h-8 w-8" />
        <span className="truncate text-lg font-medium">{settings.site_name}</span>
      </Link>
      {me && (
        <Link href="/profile" aria-label="Profile" className="ml-auto mr-2 rounded-full">
          <Avatar name={me.name} id={me.id} size={36} />
        </Link>
      )}
    </header>
  );
}

/** Material 3 navigation bar (phones), with a pill indicator behind the active icon. */
function NavigationBar() {
  const { path, Link } = useNav();
  const tabs = links;
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
  if (isActive(path, LOG_MATCH)) return null;
  return (
    <Link
      href="/log"
      aria-label="Log mivtzoim"
      className="fixed right-4 bottom-[calc(6.5rem+env(safe-area-inset-bottom,0px))] z-30 grid h-14 w-14 place-items-center rounded-2xl bg-accent-soft text-accent-on-soft shadow-pop transition hover:brightness-[0.97] lg:right-8 lg:bottom-8"
    >
      <Plus size={26} aria-hidden />
    </Link>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const { status, error, me, backend, toast } = useData();
  const [menuOpen, setMenuOpen] = useState(false);
  const closeMenu = useCallback(() => setMenuOpen(false), []);

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
      <HoverRail />
      <ModalDrawer open={menuOpen} onClose={closeMenu} />
      <div className="min-w-0 flex-1">
        <TopAppBar onMenu={() => setMenuOpen(true)} />
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

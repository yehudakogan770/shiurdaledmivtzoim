"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { History, LayoutDashboard, LogOut, Map, Menu, ShieldCheck, Sunset, UserRound } from "lucide-react";
import { handle } from "@/lib/admin";
import { useData } from "@/lib/data";
import { displayName } from "@/lib/types";
import { useNav } from "@/lib/nav";
import { currentWeek, hebrewDate } from "@/lib/dates";
import { parshaOfWeek } from "@/lib/parsha";
import { useShkiah } from "@/lib/shkiah";
import { Avatar, IconButton, cx } from "./ui";
import { LogoMark } from "./brand";
import { LoginView } from "./views/login";
import { SiteFooter } from "./site-footer";

const links = [
  { href: "/", label: "Dashboard", short: "Home", icon: LayoutDashboard, match: ["/", "/dashboard"] },
  { href: "/routes", label: "Routes", short: "Routes", icon: Map, match: ["/routes"] },
  { href: "/history", label: "History", short: "History", icon: History, match: ["/history"] },
  { href: "/profile", label: "Profile", short: "Profile", icon: UserRound, match: ["/profile"] },
];

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
        <p className={cx("px-4 text-sm text-muted", label)}>{hebrewDate()} · {parshaOfWeek(currentWeek()).english}</p>
        {me && (
          <div className={cx("flex items-center gap-2 overflow-hidden rounded-[28px] p-2 transition-colors", expanded ? "bg-card" : "bg-transparent")}>
            <Link href="/profile" className="flex min-w-0 flex-1 items-center gap-3 rounded-full p-1 pr-3 hover:bg-ink/5">
              <Avatar name={me.name} id={me.id} size={40} />
              <span className={cx("min-w-0", label)}>
                <span className="block truncate text-sm font-medium">{displayName(me)}</span>
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
          "fixed inset-y-0 left-0 z-50 w-[85%] max-w-80 rounded-r-[28px] bg-paper pt-[env(safe-area-inset-top,0px)] pb-[env(safe-area-inset-bottom,0px)] transition-transform duration-250 ease-out",
          open ? "translate-x-0 shadow-pop" : "-translate-x-full",
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
    <header className="sticky top-[env(safe-area-inset-top,0px)] z-30 flex h-16 items-center gap-1 px-2 lg:hidden">
      {/* The bar's background runs a little past its bottom edge and fades out there, so content scrolls under it softly. */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[calc(100%+1.75rem)] bg-paper/90 backdrop-blur"
        style={{
          maskImage: "linear-gradient(to bottom, #000 calc(100% - 2.5rem), transparent)",
          WebkitMaskImage: "linear-gradient(to bottom, #000 calc(100% - 2.5rem), transparent)",
        }}
      />
      <IconButton onClick={onMenu} aria-label="Open menu" className="h-12 w-12 text-ink">
        <Menu size={24} />
      </IconButton>
      <Link href="/" className="flex min-w-0 items-center gap-2.5">
        <LogoMark className="h-8 w-8 shrink-0" />
        <span className="min-w-0 leading-tight">
          <span className="block truncate text-lg font-medium">{settings.site_name}</span>
          <ShkiahLine short className="block truncate text-xs text-muted" />
        </span>
      </Link>
      {me && (
        <Link href="/profile" aria-label="Profile" className="ml-auto mr-2 rounded-full">
          <Avatar name={me.name} id={me.id} size={36} />
        </Link>
      )}
    </header>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const { status, error, me, backend, toast, auth } = useData();
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
  } else if (auth.recovering) {
    return (
      <>
        <LoginView initialMode="reset" />
        <Snackbar message={toast} />
      </>
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
        <div className="hidden justify-end px-8 pt-6 lg:flex">
          <span className="inline-flex items-center gap-2 rounded-full bg-card px-4 py-2 text-sm text-muted">
            <Sunset size={16} aria-hidden className="text-candle" />
            <ShkiahLine />
          </span>
        </div>
        <main className="px-4 pt-2 pb-16 sm:px-6 lg:px-8 lg:pt-4 lg:pb-12">
          <div className="w-full">{body}</div>
          <SiteFooter />
        </main>
      </div>
      <Snackbar message={toast} />
    </div>
  );
}

/** "Shkiah Fri Oct 2 · 6:36 PM": this Friday's sundown where the person is. */
function ShkiahLine({ className, short }: { className?: string; short?: boolean }) {
  const shkiah = useShkiah();
  if (!shkiah) return null;
  return (
    <span className={className} title={shkiah.located ? "Sundown at your location" : "Sundown in Crown Heights. Allow location to see yours."}>
      Shkiah Fri{short ? " " : ` ${shkiah.date} · `}<span className="font-medium text-ink">{shkiah.time}</span>
      {!shkiah.located && (short ? " · Crown Hts" : " (Crown Heights)")}
    </span>
  );
}

/** Material 3 snackbar. */
function Snackbar({ message }: { message: string | null }) {
  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-[calc(1.5rem+env(safe-area-inset-bottom,0px))] z-50 flex justify-center px-4"
    >
      {message && <div className="min-h-12 rounded-xl bg-ink px-4 py-3.5 text-sm text-paper shadow-pop">{message}</div>}
    </div>
  );
}

"use client";

import { useEffect, useRef, useState, type ComponentType } from "react";
import { ClipboardList, Flame, Megaphone, Minus, Pencil, Plus, Sparkles, Trash2 } from "lucide-react";
import { useEditMode } from "@/lib/edit-mode";
import { SettingField, SharedCategoriesCard } from "./admin";
import { EntryGroups } from "../entry-groups";
import { TefillinIcon } from "../icons";
import { useData, type LogInput } from "@/lib/data";
import { iconForActivity, iconForCategory } from "@/lib/category-icons";
import { useNav } from "@/lib/nav";
import { categoryName } from "@/lib/categories";
import { activityMoment, activityWeek, addDays, allWeeks, currentWeek, formatDay, formatShort, hebrewDate, longDate, recentWeeks, today, weekLabel } from "@/lib/dates";
import { InstallBanner } from "../install-app";
import type { CommunityRow } from "@/lib/backend";
import { builtinHiddenIn, categoryHiddenIn, orderedMivtzoim, type BuiltinType } from "@/lib/categories";
import { parshaName, parshaOfWeek, weekTitle } from "@/lib/parsha";
import type { Activity } from "@/lib/types";
import { Card, CardTitle, CategoryIcon, Empty, IconButton, PageHeader, Select, Stat, cx, listClass } from "../ui";

export function sum(rows: Activity[]) {
  return rows.reduce((n, a) => n + a.quantity, 0);
}

function niceMax(n: number) {
  if (n <= 4) return 4;
  const pow = 10 ** Math.floor(Math.log10(n));
  for (const m of [1, 2, 2.5, 5, 10]) if (m * pow >= n) return m * pow;
  return 10 * pow;
}

/** The front-page counters: Tefillin, Shabbos Candles, and every mivtza an admin adds for everyone. */
type Counter = {
  key: string;
  title: string;
  short: string;
  text: string;
  icon: ComponentType<{ size?: number }>;
  tone: "accent" | "candle" | "sage" | "ink";
  soft: string;
  chip: string;
  /** Color of this mivtza in the Activity chart (and, for admin-added ones, its icon and button). */
  color: string;
  /** Set for admin-added mivtzoim: styles the button and icon with `color`. */
  custom?: boolean;
  matches: (a: Activity) => boolean;
  log: LogInput;
};

/** Distinct colors for admin-added mivtzoim, in the order they were added. */
const EXTRA_COLORS = ["#2e8b57", "#6a5acd", "#c0563a", "#1f7fa3", "#a07a12", "#b03a78", "#4b7f2a", "#8a4fb8"];

/**
 * The mivtzoim shown in a week (default: this week). One hidden from a later week still shows in
 * earlier ones. With `keep`, a hidden one still shows when it has entries there, so a week's totals
 * never change because something was hidden (it just can't be added to anymore).
 */
export function useCounters(week: string = currentWeek(), keep?: Activity[]): Counter[] {
  const { shared, builtins } = useData();
  const standard: Record<BuiltinType, Omit<Counter, "title" | "short">> = {
    tefillin: {
      key: "tefillin",
      text: "Someone just put on Tefillin",
      icon: TefillinIcon,
      tone: "accent",
      soft: "bg-accent-soft text-accent-on-soft",
      chip: "bg-accent text-accent-ink",
      color: "var(--accent)",
      matches: (a) => a.category_type === "tefillin",
      log: { category_type: "tefillin", quantity: 1 },
    },
    shabbos_candles: {
      key: "shabbos_candles",
      text: "Gave out candles or a kit",
      icon: Flame,
      tone: "candle",
      soft: "bg-candle-soft text-candle-on-soft",
      chip: "bg-candle text-card",
      color: "var(--candle)",
      matches: (a) => a.category_type === "shabbos_candles",
      log: { category_type: "shabbos_candles", quantity: 1 },
    },
  };
  const colorOf = new Map([...shared].sort((x, y) => x.created_at.localeCompare(y.created_at)).map((c, i) => [c.id, EXTRA_COLORS[i % EXTRA_COLORS.length]]));
  const show = (hidden: boolean, c: Counter) => !hidden || !!keep?.some(c.matches);
  // Same order as the admin set; hidden or removed ones are left off.
  return orderedMivtzoim(builtins, shared).flatMap((m): Counter[] => {
    if (m.builtin) {
      const c: Counter = { ...standard[m.builtin.type], title: m.builtin.name, short: m.builtin.short };
      return show(builtinHiddenIn(m.builtin, week), c) ? [c] : [];
    }
    const c = m.category;
    return [
      {
        key: c.id,
        title: c.name,
        short: c.name,
        text: c.description || `Add one ${c.name}`,
        icon: iconForCategory(c),
        tone: "sage" as const,
        soft: "text-ink",
        chip: "text-white",
        color: colorOf.get(c.id)!,
        custom: true,
        matches: (a: Activity) => a.category_type === "personal" && a.personal_category_id === c.id,
        log: { category_type: "personal" as const, personal_category_id: c.id, quantity: 1 },
      },
    ].filter((x) => show(categoryHiddenIn(c, week), x));
  });
}

export function DashboardView() {
  const { isOwner } = useData();
  return isOwner ? <OwnerHome /> : <PersonalHome />;
}

/** The Owner's switch for editing what everyone sees, right on the page. */
export function EditSwitch() {
  const { editing, setEditing } = useEditMode();
  return (
    <button
      type="button"
      role="switch"
      aria-checked={editing}
      onClick={() => setEditing(!editing)}
      className={cx(
        "inline-flex h-11 items-center gap-2.5 rounded-full pr-4 pl-1.5 text-sm font-medium transition",
        editing ? "bg-accent text-accent-ink" : "bg-card text-ink shadow-card hover:bg-ink/5",
      )}
    >
      <span className={cx("relative h-7 w-12 rounded-full transition", editing ? "bg-accent-ink/30" : "bg-ink/15")}>
        <span className={cx("absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all", editing ? "left-6" : "left-1")} />
      </span>
      <Pencil size={16} aria-hidden />
      {editing ? "Editing" : "Edit"}
    </button>
  );
}

/**
 * The Owner runs the site and doesn't log Mivtzoim: Home shows what everyone sees, and with
 * Edit on, the site name, announcement and mivtzoim can be changed right here.
 */
function OwnerHome() {
  const { settings } = useData();
  const { editing } = useEditMode();
  const [week, setWeek] = useState(currentWeek());
  const hd = hebrewDate();
  return (
    <div className="grid grid-cols-1 gap-6">
      <PageHeader eyebrow={`${longDate()}${hd ? ` · ${hd}` : ""} · ${parshaOfWeek(currentWeek()).english}`} title="Dashboard" action={<EditSwitch />} />

      {editing && (
        <Card>
          <CardTitle sub="Turn off Edit when you're done.">Editing the site</CardTitle>
          <div className="px-6 pb-6">
            <SettingField field="site_name" label="Site name" hint="Shown at the top of every page." maxLength={40} required />
          </div>
        </Card>
      )}

      <WeekPicker week={week} onChange={setWeek} />

      <EveryoneStrip week={week} />

      <InstallBanner />

      {editing ? (
        <Card>
          <div className="px-6 py-6">
            <SettingField
              field="announcement"
              label="Announcement"
              hint="Shown at the top of everyone's Home page. Leave empty to hide it."
              rows={3}
              maxLength={500}
              placeholder="Mivtzoim this Friday at 2:00. Meet outside the shul."
              empty="No announcement right now."
            />
          </div>
        </Card>
      ) : (
        settings.announcement.trim() && (
          <div role="status" className="flex items-start gap-3 rounded-[28px] bg-secondary-soft px-5 py-4 text-secondary-on-soft">
            <Megaphone size={20} aria-hidden className="mt-0.5 shrink-0" />
            <p className="whitespace-pre-line">{settings.announcement}</p>
          </div>
        )
      )}

      <SharedCategoriesCard
        controls={editing}
        title="Mivtzoim"
        sub={editing ? "Everyone's buttons, in this order. Use the arrows to move them." : "The buttons everyone has, in this order. Turn on Edit to change them."}
      />
    </div>
  );
}

function PersonalHome() {
  const { me, mine, data, settings } = useData();
  const { Link } = useNav();
  const thisWeek = currentWeek();
  const [week, setWeek] = useState(thisWeek);
  const lastWeek = addDays(week, -7);
  const weekRows = mine.activity.filter((a) => activityWeek(a) === week);
  const lastRows = mine.activity.filter((a) => activityWeek(a) === lastWeek);
  // The week's totals keep anything with entries, even if it was hidden since.
  const counters = useCounters(week, weekRows);
  const weekEntries = [...weekRows].sort((x, y) => activityMoment(y).getTime() - activityMoment(x).getTime());
  const hd = hebrewDate();

  return (
    <div className="grid grid-cols-1 gap-6">
      <PageHeader eyebrow={`${longDate()}${hd ? ` · ${hd}` : ""} · ${parshaOfWeek(currentWeek()).english}`} title={me?.name || "Dashboard"} />

      <WeekPicker week={week} onChange={setWeek} />

      <EveryoneStrip week={week} />

      <InstallBanner />

      {settings.announcement.trim() && (
        <div role="status" className="flex items-start gap-3 rounded-[28px] bg-secondary-soft px-5 py-4 text-secondary-on-soft">
          <Megaphone size={20} aria-hidden className="mt-0.5 shrink-0" />
          <p className="whitespace-pre-line">{settings.announcement}</p>
        </div>
      )}

      <div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-[repeat(auto-fit,minmax(12rem,1fr))]">
          {counters.map((c) => {
            const now = sum(weekRows.filter(c.matches));
            return (
              <Stat
                key={c.key}
                label={c.short}
                icon={c.icon}
                value={now}
                delta={now - sum(lastRows.filter(c.matches))}
                note="vs last week"
                tone={c.tone}
                color={c.custom ? c.color : undefined}
              />
            );
          })}
        </div>
      </div>

      {week !== thisWeek && (
        <p role="status" className="rounded-[20px] bg-candle-soft px-5 py-3 text-sm text-candle-on-soft">
          You&apos;re looking at the week of {weekTitle(week)}. Anything you add, remove or change here counts for that week.
        </p>
      )}

      <QuickLog week={week} />

      <div className="grid grid-cols-1 gap-6">
        <Card>
          <CardTitle sub="Everything you logged, by week">Activity</CardTitle>
          <WeeklyChart rows={mine.activity} last={week} />
        </Card>
      </div>

      <WeekEntries week={week} rows={weekEntries} counters={counters} />
    </div>
  );
}

/** The entry's icon, in the same color as its front-page counter. */
function RowIcon({ a, counters }: { a: Activity; counters: Counter[] }) {
  const { data } = useData();
  const categories = data.categories;
  const c = counters.find((x) => x.matches(a));
  if (c?.custom) {
    return (
      <span aria-hidden className="grid h-10 w-10 shrink-0 place-items-center rounded-full" style={{ background: `color-mix(in srgb, ${c.color} 22%, var(--card))`, color: c.color }}>
        <c.icon size={18} />
      </span>
    );
  }
  return <CategoryIcon type={a.category_type} icon={iconForActivity(a, categories)} />;
}

/** The date an entry is saved with: today, or (when looking at an earlier week) that week's Friday. */
export function dateForWeek(week: string) {
  return week === currentWeek() ? today() : week;
}

function newestInWeek(rows: Activity[], week: string, c: Counter) {
  return rows
    .filter((a) => activityWeek(a) === week && c.matches(a))
    .sort((x, y) => activityMoment(y).getTime() - activityMoment(x).getTime() || (y.created_at ?? "").localeCompare(x.created_at ?? ""))[0];
}

/** true on phones and tablets (a finger, no mouse), so buttons can say "Tap" instead of "Click". */
function useTouch() {
  const [touch, setTouch] = useState(true);
  useEffect(() => {
    const query = window.matchMedia("(hover: none) and (pointer: coarse)");
    const update = () => setTouch(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  return touch;
}

function QuickLog({ week }: { week: string }) {
  const touch = useTouch();
  const { actions, notify, mine, guest } = useData();
  const counters = useCounters(week);
  const past = week !== currentWeek();

  async function add(c: Counter) {
    try {
      await actions.log({ ...c.log, activity_date: dateForWeek(week) });
      notify(past ? `Added ${c.title} to the week of ${weekTitle(week)}` : `Added ${c.title}`);
    } catch (e) {
      notify((e as Error).message);
    }
  }

  async function subtract(c: Counter) {
    const last = newestInWeek(mine.activity, week, c);
    if (!last) return;
    try {
      await actions.setActivityQuantity(last.id, last.quantity - 1);
      notify(`Removed ${c.title}${past ? ` from the week of ${weekTitle(week)}` : ""}`);
    } catch (e) {
      notify((e as Error).message);
    }
  }

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {counters.map((c) => (
        <QuickButton
          key={c.key}
          c={c}
          count={sum(mine.activity.filter((a) => activityWeek(a) === week && c.matches(a)))}
          hint={touch ? "Tap here to add" : "Click here to add"}
          sample={guest}
          onAdd={() => add(c)}
          onSubtract={() => subtract(c)}
        />
      ))}
    </div>
  );
}

/**
 * One quick-add button. While you tap, a small "+1, +2, +3…" shows how many you're
 * adding right now, and "−1, −2…" on the minus shows how many you're taking off.
 * Each fades away 2 seconds after the last tap, or when the button is scrolled away.
 */
/**
 * A tap counter that fades out 2 seconds after the last tap (each tap restarts the
 * 2 seconds) and starts over from 1 next time.
 */
function useTally() {
  const [n, setN] = useState(0);
  const [fading, setFading] = useState(false);
  const timers = useRef<number[]>([]);
  const clear = () => {
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
  };
  useEffect(() => clear, []);
  return {
    n,
    fading,
    tap() {
      clear();
      setFading(false);
      setN((x) => x + 1);
      timers.current.push(
        window.setTimeout(() => setFading(true), 2000),
        window.setTimeout(() => {
          setN(0);
          setFading(false);
        }, 2400),
      );
    },
    reset() {
      clear();
      setN(0);
      setFading(false);
    },
  };
}

function QuickButton({ c, count, hint, sample, onAdd, onSubtract }: { c: Counter; count: number; hint: string; sample?: boolean; onAdd(): void; onSubtract(): void }) {
  const plus = useTally();
  const minus = useTally();
  const box = useRef<HTMLDivElement>(null);
  const counting = plus.n > 0 || minus.n > 0;

  useEffect(() => {
    const el = box.current;
    if (!el || !counting || typeof IntersectionObserver === "undefined") return;
    const seen = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) return;
      plus.reset();
      minus.reset();
    });
    seen.observe(el);
    return () => seen.disconnect();
  }, [counting]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div
      ref={box}
      className={cx("flex items-center gap-2 rounded-[28px] p-3 pr-4", c.soft)}
      style={c.custom ? { background: `color-mix(in srgb, ${c.color} 18%, var(--card))` } : undefined}
    >
      <button
        type="button"
        onClick={() => {
          // In the sample nothing is added, so there's nothing to count.
          if (!sample) plus.tap();
          onAdd();
        }}
        aria-label={`Add 1 ${c.title}`}
        className="flex min-w-0 flex-1 items-center gap-4 rounded-[22px] p-2 text-left transition hover:bg-ink/5 active:scale-[0.99] disabled:opacity-60"
      >
        <span className={cx("relative grid h-14 w-14 shrink-0 place-items-center rounded-2xl", c.chip)} style={c.custom ? { background: c.color } : undefined}>
          <c.icon size={26} />
          {plus.n > 0 && (
            <span aria-live="polite" aria-label={`Adding ${plus.n}`} className={cx("absolute -top-4 -right-6 transition-opacity duration-300", plus.fading && "opacity-0")}>
              <span key={plus.n} className="tally-pop block text-sage tabular pointer-events-none text-lg font-bold leading-none [text-shadow:0_0_4px_var(--card),0_0_2px_var(--card)]">
                +{plus.n}
              </span>
            </span>
          )}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-xl font-medium">{c.title}</span>
          <span className="block truncate text-sm opacity-80">{hint}</span>
        </span>
      </button>
      <span className="relative shrink-0">
        <button
          type="button"
          disabled={count === 0}
          onClick={() => {
            minus.tap();
            onSubtract();
          }}
          aria-label={`Remove 1 ${c.title}`}
          title={`Remove 1 ${c.title}`}
          className="grid h-11 w-11 place-items-center rounded-full bg-minus text-minus-ink transition hover:brightness-95 disabled:opacity-30"
        >
          <Minus size={20} strokeWidth={2.5} />
        </button>
        {minus.n > 0 && (
          <span aria-live="polite" aria-label={`Removing ${minus.n}`} className={cx("absolute -top-4 -right-2 transition-opacity duration-300", minus.fading && "opacity-0")}>
            <span key={minus.n} className="tally-pop block text-danger tabular pointer-events-none text-lg font-bold leading-none [text-shadow:0_0_4px_var(--card),0_0_2px_var(--card)]">
              −{minus.n}
            </span>
          </span>
        )}
      </span>
    </div>
  );
}

/** The chosen week's entries, where amounts can be changed or entries deleted. */
function WeekEntries({ week, rows, counters }: { week: string; rows: Activity[]; counters: Counter[] }) {
  const { data, actions, notify } = useData();
  const { Link } = useNav();

  async function setQty(a: Activity, quantity: number) {
    try {
      await actions.setActivityQuantity(a.id, quantity);
      if (quantity <= 0) notify("Entry deleted.");
    } catch (e) {
      notify((e as Error).message);
    }
  }

  return (
    <Card>
      <CardTitle
        sub={week === currentWeek() ? "Change an amount or delete an entry" : `Week of ${weekTitle(week)} · change an amount or delete an entry`}
        action={<Link href="/history" className="inline-flex h-9 items-center rounded-full px-3 text-sm font-medium text-accent hover:bg-accent/8">Full history</Link>}
      >
        {week === currentWeek() ? "This week's entries" : `Entries · ${parshaOfWeek(week).english}`}
      </CardTitle>
      {rows.length === 0 ? (
        <Empty title="Nothing logged this week" icon={ClipboardList}>
          Tap a Mivtza above to add one.
        </Empty>
      ) : (
        <ul className={listClass}>
          <EntryGroups
            rows={rows}
            summary={(a) => (
              <>
                <RowIcon a={a} counters={counters} />
                <span className="min-w-0 flex-1">
                  <span className="block font-medium">{categoryName(a, data.categories)}</span>
                  <span className="block truncate text-sm text-muted">{formatDay(a.activity_date)}</span>
                </span>
              </>
            )}
            row={(a) => (
            <li key={a.id} className="flex flex-wrap items-center gap-3 px-6 py-3">
              <RowIcon a={a} counters={counters} />
              <span className="min-w-0 flex-1">
                <span className="block font-medium">{categoryName(a, data.categories)}</span>
                <span className="block truncate text-sm text-muted">
                  {formatDay(a.activity_date)}
                  {a.notes ? ` · ${a.notes}` : ""}
                </span>
              </span>
              <span className="flex items-center gap-1">
                <IconButton aria-label="One less" disabled={a.quantity <= 1} onClick={() => setQty(a, a.quantity - 1)}>
                  <Minus size={18} />
                </IconButton>
                <span className="tabular w-8 text-center text-xl">{a.quantity}</span>
                <IconButton aria-label="One more" onClick={() => setQty(a, a.quantity + 1)}>
                  <Plus size={18} />
                </IconButton>
                <IconButton aria-label="Delete entry" onClick={() => setQty(a, 0)}>
                  <Trash2 size={18} />
                </IconButton>
              </span>
            </li>
            )}
          />
        </ul>
      )}
    </Card>
  );
}

/**
 * Everyone's entries for a week, from every account. Admins (and the test
 * modes) already have them all; everyone else asks the database for the
 * anonymous totals and adds their own entries from this screen, so their own
 * taps show up instantly.
 */
function useEveryoneRows(week: string): Activity[] {
  const { backend, data, mine, isAdmin, me } = useData();
  const [server, setServer] = useState<CommunityRow[] | null>(null);
  const ask = backend?.kind === "supabase" && !isAdmin && !!me && !!backend.communityActivity;

  useEffect(() => {
    if (!ask || !backend?.communityActivity) return;
    let stale = false;
    const get = () =>
      backend.communityActivity!(addDays(week, -1), addDays(week, 7)).then((rows) => {
        if (!stale) setServer(rows);
      });
    get();
    const onVisible = () => document.visibilityState === "visible" && get();
    document.addEventListener("visibilitychange", onVisible);
    const timer = setInterval(get, 60_000);
    return () => {
      stale = true;
      document.removeEventListener("visibilitychange", onVisible);
      clearInterval(timer);
    };
  }, [ask, backend, week]);

  const rows = ask && server ? [...(server.filter((r) => !r.mine) as unknown as Activity[]), ...mine.activity] : data.activity;
  return rows.filter((a) => activityWeek(a) === week);
}

/**
 * Everyone's total for each mivtza this week. Two or more slide past from right
 * to left; a single one just sits there; with nothing logged the section is hidden.
 */
function EveryoneStrip({ week }: { week: string }) {
  const rows = useEveryoneRows(week);
  const counters = useCounters(week, rows);
  // Only mivtzoim someone actually did this week.
  const items = counters.map((c) => ({ c, total: sum(rows.filter(c.matches)) })).filter((x) => x.total > 0);
  if (items.length === 0) return null;
  const title = week === currentWeek() ? "Everyone this week" : `Everyone · ${parshaOfWeek(week).english}`;

  const chip = ({ c, total }: (typeof items)[number], key: string) => (
    <div
      key={key}
      className={cx("flex items-center gap-3 rounded-2xl py-2 pr-5 pl-2", c.soft)}
      style={c.custom ? { background: `color-mix(in srgb, ${c.color} 18%, var(--card))` } : undefined}
    >
      <span className={cx("grid h-10 w-10 shrink-0 place-items-center rounded-xl", c.chip)} style={c.custom ? { background: c.color } : undefined}>
        <c.icon size={20} />
      </span>
      <span className="whitespace-nowrap font-medium">{c.title}</span>
      <span className="tabular text-2xl">{total}</span>
    </div>
  );

  if (items.length === 1) {
    return (
      <section aria-label={title} className="rounded-[28px] bg-card py-4">
        <p className="px-6 pb-3 text-sm font-medium text-muted">{title}</p>
        <div className="flex px-6">{chip(items[0], items[0].c.key)}</div>
      </section>
    );
  }

  // Repeat the list so one copy is wider than the screen, then show it twice for a seamless loop.
  const copy = Array.from({ length: Math.max(2, Math.ceil(16 / items.length)) }, () => items).flat();
  return (
    <section aria-label={title} className="overflow-hidden rounded-[28px] bg-card py-4">
      <p className="px-6 pb-3 text-sm font-medium text-muted">{title}</p>
      <ul className="sr-only">
        {items.map(({ c, total }) => (
          <li key={c.key}>
            {c.title}: {total}
          </li>
        ))}
      </ul>
      <div
        aria-hidden
        className="marquee pointer-events-none select-none overflow-hidden"
        style={{
          maskImage: "linear-gradient(to right, transparent, #000 6%, #000 94%, transparent)",
          WebkitMaskImage: "linear-gradient(to right, transparent, #000 6%, #000 94%, transparent)",
        }}
      >
        <div className="marquee-track flex w-max" style={{ animationDuration: `${copy.length * 3}s` }}>
          {[0, 1].map((n) => (
            <div key={n} className="flex shrink-0 gap-3 pr-3">
              {copy.map((item, i) => chip(item, `${item.c.key}-${i}`))}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/** The parsha of the week on top, with a small menu to look at another week. */
function WeekPicker({ week, onChange }: { week: string; onChange(week: string): void }) {
  const thisWeek = currentWeek();
  const weeks = allWeeks();
  const parsha = parshaOfWeek(week);
  return (
    <section className="flex flex-wrap items-center justify-between gap-4 rounded-[28px] bg-card px-6 py-5">
      <div className="min-w-0">
        <p lang="he" dir="rtl" className="text-right text-3xl font-medium leading-tight sm:text-left" style={{ fontFamily: '"Frank Ruhl Libre", "David", "Times New Roman", serif' }}>
          {parsha.hebrew}
        </p>
        <p className="mt-1 text-sm text-muted">
          {parsha.english} · {weekLabel(week)}
          {week !== thisWeek && (
            <button type="button" onClick={() => onChange(thisWeek)} className="ml-2 font-medium text-accent hover:underline">
              Back to this week
            </button>
          )}
        </p>
      </div>
      <div className="w-full sm:w-auto">
        <label htmlFor="week-picker" className="sr-only">
          Week
        </label>
        <Select id="week-picker" value={week} onChange={(e) => onChange(e.target.value)} className="h-11 py-2 text-sm sm:w-auto sm:min-w-72">
          {weeks.map((w) => (
            <option key={w} value={w}>
              {w === thisWeek ? "This week · " : ""}
              {parshaOfWeek(w).english} · {weekLabel(w)}
            </option>
          ))}
        </Select>
      </div>
    </section>
  );
}

function WeeklyChart({ rows, last }: { rows: Activity[]; last: string }) {
  const weeks = recentWeeks(8, last);
  const counters = useCounters();
  // One colored part per front-page mivtza, plus "Other" for people's own categories.
  const series: { key: string; label: string; color: string; matches: (a: Activity) => boolean }[] = [
    ...counters.map((c) => ({ key: c.key, label: c.short, color: c.color, matches: c.matches })),
    { key: "other", label: "Other", color: "var(--outline)", matches: (a: Activity) => !counters.some((c) => c.matches(a)) },
  ];
  const totals = weeks.map((w) => {
    const inWeek = rows.filter((a) => activityWeek(a) === w);
    return { week: w, parts: series.map((s) => sum(inWeek.filter(s.matches))) };
  });
  const shown = series.filter((s, j) => s.key !== "other" || totals.some((t) => t.parts[j] > 0));
  const top = niceMax(Math.max(0, ...totals.map((t) => t.parts.reduce((a, b) => a + b, 0))));
  const ticks = [top, (top * 3) / 4, top / 2, top / 4, 0];

  return (
    <div className="px-6 pt-4 pb-6">
      <div className="flex gap-3">
        <div className="tabular relative h-52 w-7 shrink-0 text-right text-[11px] text-muted" aria-hidden>
          {ticks.map((t, i) => (
            <span key={t} className="absolute right-0 -translate-y-1/2 leading-none" style={{ top: `${(i / (ticks.length - 1)) * 100}%` }}>
              {Number.isInteger(t) ? t : t.toFixed(1)}
            </span>
          ))}
        </div>
        <div className="relative h-52 flex-1">
          <div aria-hidden className="absolute inset-0">
            {ticks.map((t, i) => (
              <div
                key={t}
                className={cx("absolute inset-x-0 border-t", t === 0 ? "border-line" : "border-dashed border-line/70")}
                style={{ top: `${(i / (ticks.length - 1)) * 100}%` }}
              />
            ))}
          </div>
          <div className="relative flex h-full items-end gap-2 sm:gap-3">
            {totals.map((t, i) => {
              const total = t.parts.reduce((a, b) => a + b, 0);
              const current = i === totals.length - 1;
              return (
                <div key={t.week} className="relative flex h-full flex-1 items-end" title={`${weekTitle(t.week)}: ${total}`}>
                  <div
                    className={cx("relative mx-auto flex w-full max-w-10 flex-col-reverse rounded-t-lg", !current && "opacity-70")}
                    style={{ height: `${(total / top) * 100}%` }}
                  >
                    {total > 0 && (
                      <span className={cx("tabular absolute inset-x-0 -top-5 text-center text-[11px] font-bold", current ? "text-ink" : "text-muted")}>{total}</span>
                    )}
                    {t.parts.map((v, j) =>
                      v ? <div key={j} className="last:rounded-t-lg" style={{ height: `${(v / total) * 100}%`, background: series[j].color }} /> : null,
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
      <div className="mt-2 flex gap-2 pl-10 sm:gap-3">
        {totals.map((t, i) => (
          <span key={t.week} className={cx("flex-1 text-center text-[11px]", i === totals.length - 1 ? "font-bold text-ink" : "text-muted")}>
            {t.week === currentWeek() ? (
              "Now"
            ) : (
              <>
                <span className="hidden sm:block">{formatShort(t.week)}</span>
                <span className="hidden truncate text-[10px] sm:block">{parshaName(t.week)}</span>
                <span className="sm:hidden">{Number(t.week.slice(5, 7))}/{Number(t.week.slice(8))}</span>
              </>
            )}
          </span>
        ))}
      </div>
      <div className="mt-5 flex flex-wrap gap-4 text-xs font-medium text-muted">
        {shown.map((s) => (
          <span key={s.key} className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ background: s.color }} aria-hidden /> {s.label}
          </span>
        ))}
      </div>
    </div>
  );
}

"use client";

import { useState, type ComponentType } from "react";
import { ClipboardList, Flame, Megaphone, Minus, Plus, Sparkles, Trash2 } from "lucide-react";
import { TefillinIcon } from "../icons";
import { useData, type LogInput } from "@/lib/data";
import { iconForActivity, iconForName } from "@/lib/category-icons";
import { useNav } from "@/lib/nav";
import { categoryName } from "@/lib/categories";
import { activityMoment, activityWeek, addDays, allWeeks, currentWeek, formatDay, formatShort, hebrewDate, longDate, recentWeeks, today, weekLabel } from "@/lib/dates";
import { parshaName, parshaOfWeek, weekTitle } from "@/lib/parsha";
import type { Activity } from "@/lib/types";
import { Button, Card, CardTitle, CategoryIcon, Empty, IconButton, PageHeader, Select, Stat, cx, listClass } from "../ui";

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

export function useCounters(): Counter[] {
  const { shared } = useData();
  return [
    {
      key: "tefillin",
      title: "Tefillin",
      short: "Tefillin",
      text: "Someone just put on tefillin",
      icon: TefillinIcon,
      tone: "accent",
      soft: "bg-accent-soft text-accent-on-soft",
      chip: "bg-accent text-accent-ink",
      color: "var(--accent)",
      matches: (a) => a.category_type === "tefillin",
      log: { category_type: "tefillin", quantity: 1 },
    },
    {
      key: "shabbos_candles",
      title: "Shabbos Candles",
      short: "Candles",
      text: "Gave out candles or a kit",
      icon: Flame,
      tone: "candle",
      soft: "bg-candle-soft text-candle-on-soft",
      chip: "bg-candle text-card",
      color: "var(--candle)",
      matches: (a) => a.category_type === "shabbos_candles",
      log: { category_type: "shabbos_candles", quantity: 1 },
    },
    ...shared
      .filter((c) => c.status === "active")
      .map((c, i) => ({
        key: c.id,
        title: c.name,
        short: c.name,
        text: c.description || `Add one ${c.name}`,
        icon: iconForName(c.name),
        tone: "sage" as const,
        soft: "text-ink",
        chip: "text-white",
        color: EXTRA_COLORS[i % EXTRA_COLORS.length],
        custom: true,
        matches: (a: Activity) => a.category_type === "personal" && a.personal_category_id === c.id,
        log: { category_type: "personal" as const, personal_category_id: c.id, quantity: 1 },
      })),
  ];
}

export function DashboardView() {
  const { me, mine, data, settings } = useData();
  const { Link } = useNav();
  const thisWeek = currentWeek();
  const [week, setWeek] = useState(thisWeek);
  const lastWeek = addDays(week, -7);
  const weekRows = mine.activity.filter((a) => activityWeek(a) === week);
  const lastRows = mine.activity.filter((a) => activityWeek(a) === lastWeek);
  const counters = useCounters();
  const weekEntries = [...weekRows].sort((x, y) => activityMoment(y).getTime() - activityMoment(x).getTime());
  const hd = hebrewDate();

  return (
    <div className="grid grid-cols-1 gap-6">
      <PageHeader eyebrow={`${longDate()}${hd ? ` · ${hd}` : ""} · ${parshaOfWeek(currentWeek()).english}`} title={me?.name || "Dashboard"} />

      <WeekPicker week={week} onChange={setWeek} />

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

function QuickLog({ week }: { week: string }) {
  const { actions, notify, mine } = useData();
  const counters = useCounters();
  const [busy, setBusy] = useState<string | null>(null);
  const past = week !== currentWeek();

  async function add(c: Counter) {
    setBusy(c.key);
    try {
      await actions.log({ ...c.log, activity_date: dateForWeek(week) });
      notify(past ? `Added 1 ${c.title} to the week of ${weekTitle(week)}` : `Added 1 ${c.title}`);
    } catch (e) {
      notify((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function subtract(c: Counter) {
    const last = newestInWeek(mine.activity, week, c);
    if (!last) return;
    setBusy(c.key);
    try {
      await actions.setActivityQuantity(last.id, last.quantity - 1);
      notify(`Removed 1 ${c.title}${past ? ` from the week of ${weekTitle(week)}` : ""}`);
    } catch (e) {
      notify((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {counters.map((c) => {
        const count = sum(mine.activity.filter((a) => activityWeek(a) === week && c.matches(a)));
        return (
          <div
            key={c.key}
            className={cx("flex items-center gap-2 rounded-[28px] p-3 pr-4", c.soft)}
            style={c.custom ? { background: `color-mix(in srgb, ${c.color} 18%, var(--card))` } : undefined}
          >
            <button
              type="button"
              disabled={busy !== null}
              onClick={() => add(c)}
              aria-label={`Add 1 ${c.title}`}
              className="flex min-w-0 flex-1 items-center gap-4 rounded-[22px] p-2 text-left transition hover:bg-ink/5 active:scale-[0.99] disabled:opacity-60"
            >
              <span className={cx("grid h-14 w-14 shrink-0 place-items-center rounded-2xl", c.chip)} style={c.custom ? { background: c.color } : undefined}>
                <c.icon size={26} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-xl font-medium">{c.title}</span>
                <span className="block truncate text-sm opacity-80">{c.text}</span>
              </span>
              <Plus size={24} aria-hidden className="shrink-0 opacity-70" />
            </button>
            <button
              type="button"
              disabled={busy !== null || count === 0}
              onClick={() => subtract(c)}
              aria-label={`Remove 1 ${c.title}`}
              title={`Remove 1 ${c.title}`}
              className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-card/70 text-ink transition hover:bg-card disabled:opacity-30"
            >
              <Minus size={20} />
            </button>
          </div>
        );
      })}
    </div>
  );
}

/** The chosen week's entries, where amounts can be changed or entries deleted. */
function WeekEntries({ week, rows, counters }: { week: string; rows: Activity[]; counters: Counter[] }) {
  const { data, actions, notify } = useData();
  const { Link } = useNav();
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  async function setQty(a: Activity, quantity: number) {
    setBusy(a.id);
    try {
      await actions.setActivityQuantity(a.id, quantity);
      if (quantity <= 0) notify("Entry deleted.");
    } catch (e) {
      notify((e as Error).message);
    } finally {
      setBusy(null);
      setConfirmId(null);
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
          Tap a mivtza above to add one.
        </Empty>
      ) : (
        <ul className={listClass}>
          {rows.map((a) => (
            <li key={a.id} className="flex flex-wrap items-center gap-3 px-6 py-3">
              <RowIcon a={a} counters={counters} />
              <span className="min-w-0 flex-1">
                <span className="block font-medium">{categoryName(a, data.categories)}</span>
                <span className="block truncate text-sm text-muted">
                  {formatDay(a.activity_date)}
                  {a.notes ? ` · ${a.notes}` : ""}
                </span>
              </span>
              {confirmId === a.id ? (
                <span className="flex items-center gap-1">
                  <Button variant="danger" className="h-9 px-4" disabled={busy !== null} onClick={() => setQty(a, 0)}>
                    Delete
                  </Button>
                  <Button variant="ghost" className="h-9 px-3" onClick={() => setConfirmId(null)}>
                    Keep
                  </Button>
                </span>
              ) : (
                <span className="flex items-center gap-1">
                  <IconButton aria-label="One less" disabled={busy !== null || a.quantity <= 1} onClick={() => setQty(a, a.quantity - 1)}>
                    <Minus size={18} />
                  </IconButton>
                  <span className="tabular w-8 text-center text-xl">{a.quantity}</span>
                  <IconButton aria-label="One more" disabled={busy !== null} onClick={() => setQty(a, a.quantity + 1)}>
                    <Plus size={18} />
                  </IconButton>
                  <IconButton aria-label="Delete entry" disabled={busy !== null} onClick={() => setConfirmId(a.id)}>
                    <Trash2 size={18} />
                  </IconButton>
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
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

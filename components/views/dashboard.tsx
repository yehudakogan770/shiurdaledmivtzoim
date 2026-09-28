"use client";

import { useState, type ComponentType } from "react";
import { ClipboardList, Flame, Megaphone, Plus, Sparkles } from "lucide-react";
import { TefillinIcon } from "../icons";
import { useData, type LogInput } from "@/lib/data";
import { useNav } from "@/lib/nav";
import { STANDARD, categoryName } from "@/lib/categories";
import { activityWeek, addDays, allWeeks, currentWeek, formatDay, formatShort, hebrewDate, longDate, recentWeeks, weekLabel } from "@/lib/dates";
import { parshaOfWeek } from "@/lib/parsha";
import type { Activity, CategoryType } from "@/lib/types";
import { Card, CardTitle, CategoryIcon, Empty, PageHeader, Select, Stat, cx, listClass } from "../ui";

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
  matches: (a: Activity) => boolean;
  log: LogInput;
};

const EXTRA_TONES = [
  { tone: "sage" as const, soft: "bg-sage-soft text-sage-on-soft", chip: "bg-sage text-card" },
  { tone: "ink" as const, soft: "bg-secondary-soft text-secondary-on-soft", chip: "bg-ink text-card" },
];

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
        icon: Sparkles,
        ...EXTRA_TONES[i % EXTRA_TONES.length],
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
  const recent = [...mine.activity].sort((a, b) => (b.activity_date + b.created_at).localeCompare(a.activity_date + a.created_at)).slice(0, 6);
  const hd = hebrewDate();

  return (
    <div className="grid grid-cols-1 gap-6">
      <PageHeader eyebrow={`${longDate()}${hd ? ` · ${hd}` : ""}`} title={me?.name || "Dashboard"} />

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
            return <Stat key={c.key} label={c.short} icon={c.icon} value={now} delta={now - sum(lastRows.filter(c.matches))} note="vs last week" tone={c.tone} />;
          })}
        </div>
      </div>

      <QuickLog />

      <div className="grid grid-cols-1 gap-6">
        <Card>
          <CardTitle sub="Everything you logged, by week">Activity</CardTitle>
          <WeeklyChart rows={mine.activity} last={week} />
        </Card>
      </div>

      <Card>
        <CardTitle sub="Your latest entries" action={<Link href="/history" className="inline-flex h-9 items-center rounded-full px-3 text-sm font-medium text-accent hover:bg-accent/8">Full history</Link>}>
          Recent activity
        </CardTitle>
        {recent.length === 0 ? (
          <Empty title="Nothing logged yet" icon={ClipboardList}>
            Use the buttons above after your next mivtzoim stop.
          </Empty>
        ) : (
          <ul className={listClass}>
            {recent.map((a) => (
              <li key={a.id} className="flex items-center gap-3 px-6 py-3.5">
                <CategoryIcon type={a.category_type} icon={a.category_type === "tefillin" ? TefillinIcon : a.category_type === "shabbos_candles" ? Flame : Sparkles} />
                <span className="min-w-0 flex-1">
                  <span className="font-medium">{categoryName(a, data.categories)}</span>
                  {a.notes && <span className="block truncate text-sm text-muted">{a.notes}</span>}
                </span>
                <span className="hidden text-sm text-muted sm:inline">{formatDay(a.activity_date)}</span>
                <span className="tabular w-12 text-right text-xl">{a.quantity}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function QuickLog() {
  const { actions, notify } = useData();
  const counters = useCounters();
  const [busy, setBusy] = useState<string | null>(null);

  async function add(c: Counter) {
    setBusy(c.key);
    try {
      await actions.log(c.log);
      notify(`Added 1 ${c.title}`);
    } catch (e) {
      notify((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {counters.map((c) => (
        <button
          key={c.key}
          type="button"
          disabled={busy !== null}
          onClick={() => add(c)}
          className={cx("flex items-center gap-4 rounded-[28px] p-5 text-left transition hover:shadow-card active:scale-[0.99] disabled:opacity-60", c.soft)}
        >
          <span className={cx("grid h-14 w-14 shrink-0 place-items-center rounded-2xl", c.chip)}>
            <c.icon size={26} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-xl font-medium">+1 {c.title}</span>
            <span className="block truncate text-sm opacity-80">{c.text}</span>
          </span>
          <Plus size={24} aria-hidden className="shrink-0 opacity-70" />
        </button>
      ))}
    </div>
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
        <Select id="week-picker" value={week} onChange={(e) => onChange(e.target.value)} className="h-11 py-2 text-sm sm:w-64">
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
  const series: { key: CategoryType; label: string; color: string }[] = [
    { key: "tefillin", label: STANDARD.tefillin.short, color: "bg-accent" },
    { key: "shabbos_candles", label: STANDARD.shabbos_candles.short, color: "bg-candle" },
    { key: "personal", label: "Other", color: "bg-sage" },
  ];
  const totals = weeks.map((w, i) => {
    const inWeek = rows.filter((a) => activityWeek(a) === w);
    return { week: w, parts: series.map((s) => sum(inWeek.filter((a) => a.category_type === s.key))) };
  });
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
                <div key={t.week} className="relative flex h-full flex-1 items-end" title={`Week of ${formatShort(t.week)}: ${total}`}>
                  <div
                    className={cx("relative mx-auto flex w-full max-w-10 flex-col-reverse rounded-t-lg", !current && "opacity-70")}
                    style={{ height: `${(total / top) * 100}%` }}
                  >
                    {total > 0 && (
                      <span className={cx("tabular absolute inset-x-0 -top-5 text-center text-[11px] font-bold", current ? "text-ink" : "text-muted")}>{total}</span>
                    )}
                    {t.parts.map((v, j) =>
                      v ? <div key={j} className={cx(series[j].color, "last:rounded-t-lg")} style={{ height: `${(v / total) * 100}%` }} /> : null,
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
                <span className="hidden sm:inline">{formatShort(t.week)}</span>
                <span className="sm:hidden">{Number(t.week.slice(5, 7))}/{Number(t.week.slice(8))}</span>
              </>
            )}
          </span>
        ))}
      </div>
      <div className="mt-5 flex flex-wrap gap-4 text-xs font-medium text-muted">
        {series.map((s) => (
          <span key={s.key} className="inline-flex items-center gap-1.5">
            <span className={`h-2.5 w-2.5 rounded-sm ${s.color}`} aria-hidden /> {s.label}
          </span>
        ))}
      </div>
    </div>
  );
}

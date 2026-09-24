"use client";

import { useState } from "react";
import { ClipboardList, Flame, Plus, ScrollText, Sparkles, Users } from "lucide-react";
import { useData } from "@/lib/data";
import { useNav } from "@/lib/nav";
import { STANDARD, categoryName } from "@/lib/categories";
import { addDays, formatDay, formatShort, hebrewDate, longDate, recentWeeks, today, weekStart } from "@/lib/dates";
import type { Activity, CategoryType } from "@/lib/types";
import { ButtonLink, Card, CardTitle, CategoryIcon, Empty, PageHeader, Stat, cx, listClass } from "../ui";

export function sum(rows: Activity[]) {
  return rows.reduce((n, a) => n + a.quantity, 0);
}

function niceMax(n: number) {
  if (n <= 4) return 4;
  const pow = 10 ** Math.floor(Math.log10(n));
  for (const m of [1, 2, 2.5, 5, 10]) if (m * pow >= n) return m * pow;
  return 10 * pow;
}

export function DashboardView() {
  const { me, mine, data } = useData();
  const { Link } = useNav();
  const thisWeek = weekStart(today());
  const lastWeek = addDays(thisWeek, -7);
  const weekRows = mine.activity.filter((a) => a.activity_date >= thisWeek);
  const lastRows = mine.activity.filter((a) => a.activity_date >= lastWeek && a.activity_date < thisWeek);
  const by = (rows: Activity[], t: CategoryType) => sum(rows.filter((a) => a.category_type === t));
  const recent = [...mine.activity].sort((a, b) => (b.activity_date + b.created_at).localeCompare(a.activity_date + a.created_at)).slice(0, 6);
  const firstName = me?.name.split(" ")[0] || "";
  const hd = hebrewDate();

  return (
    <div className="grid grid-cols-1 gap-6">
      <PageHeader
        eyebrow={`${longDate()}${hd ? ` · ${hd}` : ""}`}
        title={firstName ? `Shalom, ${firstName}` : "Dashboard"}
        subtitle={`Here is your mivtzoim for the week of ${formatShort(thisWeek)}.`}
        action={
          <ButtonLink href="/log" className="hidden sm:inline-flex">
            <Plus size={16} aria-hidden /> Log mivtzoim
          </ButtonLink>
        }
      />

      <div>
        <div className="grid grid-cols-2 gap-3">
          <Stat label="Tefillin" icon={ScrollText} value={by(weekRows, "tefillin")} delta={by(weekRows, "tefillin") - by(lastRows, "tefillin")} note="vs last week" tone="accent" />
          <Stat label="Candles" icon={Flame} value={by(weekRows, "shabbos_candles")} delta={by(weekRows, "shabbos_candles") - by(lastRows, "shabbos_candles")} note="vs last week" tone="candle" />
        </div>
      </div>

      <QuickLog />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.6fr_1fr]">
        <Card>
          <CardTitle sub="Everything you logged, by week">Activity</CardTitle>
          <WeeklyChart rows={mine.activity} />
        </Card>

        <Card>
          <CardTitle sub="Totals this week" action={<Link href="/groups" className="inline-flex h-9 items-center rounded-full px-3 text-sm font-medium text-accent hover:bg-accent/8">View all</Link>}>
            My groups
          </CardTitle>
          {mine.groups.length === 0 ? (
            <Empty title="No group yet" icon={Users} action={<ButtonLink href="/groups" variant="secondary">Create or join</ButtonLink>}>
              Join your shiur&apos;s group to see how everyone is doing.
            </Empty>
          ) : (
            <ul className={listClass}>
              {mine.groups.map((g) => {
                const memberIds = data.members.filter((m) => m.group_id === g.id).map((m) => m.user_id);
                const total = sum(data.activity.filter((a) => a.group_id === g.id && a.activity_date >= thisWeek));
                return (
                  <li key={g.id}>
                    <Link href={`/groups/view?id=${g.id}`} className="flex items-center gap-3 px-6 py-3.5 transition-colors hover:bg-ink/5">
                      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-accent-soft text-accent-on-soft">
                        <Users size={18} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">{g.name}</span>
                        <span className="text-xs text-muted">
                          {memberIds.length} {memberIds.length === 1 ? "member" : "members"}
                        </span>
                      </span>
                      <span className="tabular text-2xl">{total}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
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
                <CategoryIcon type={a.category_type} icon={a.category_type === "tefillin" ? ScrollText : a.category_type === "shabbos_candles" ? Flame : Sparkles} />
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
  const { actions, notify, mine } = useData();
  const [busy, setBusy] = useState<string | null>(null);
  const groupId = mine.groups.length === 1 ? mine.groups[0].id : null;

  async function add(type: CategoryType, label: string) {
    setBusy(type);
    try {
      await actions.log({ category_type: type, quantity: 1, group_id: groupId });
      notify(`Added 1 ${label}`);
    } catch (e) {
      notify((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  const items = [
    { type: "tefillin" as const, label: "tefillin", title: "Tefillin", text: "Someone just put on tefillin", icon: ScrollText, tone: "bg-accent-soft text-accent-on-soft", chip: "bg-accent text-accent-ink" },
    { type: "shabbos_candles" as const, label: "Shabbos candles", title: "Shabbos Candles", text: "Gave out candles or a kit", icon: Flame, tone: "bg-candle-soft text-candle-on-soft", chip: "bg-candle text-card" },
  ];

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {items.map((it) => (
        <button
          key={it.type}
          type="button"
          disabled={busy !== null}
          onClick={() => add(it.type, it.label)}
          className={cx("flex items-center gap-4 rounded-[28px] p-5 text-left transition hover:shadow-card active:scale-[0.99] disabled:opacity-60", it.tone)}
        >
          <span className={cx("grid h-14 w-14 shrink-0 place-items-center rounded-2xl", it.chip)}>
            <it.icon size={26} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-xl font-medium">+1 {it.title}</span>
            <span className="block text-sm opacity-80">{it.text}</span>
          </span>
          <Plus size={24} aria-hidden className="opacity-70" />
        </button>
      ))}
    </div>
  );
}

function WeeklyChart({ rows }: { rows: Activity[] }) {
  const weeks = recentWeeks(8);
  const series: { key: CategoryType; label: string; color: string }[] = [
    { key: "tefillin", label: STANDARD.tefillin.short, color: "bg-accent" },
    { key: "shabbos_candles", label: STANDARD.shabbos_candles.short, color: "bg-candle" },
    { key: "personal", label: "Other", color: "bg-sage" },
  ];
  const totals = weeks.map((w, i) => {
    const end = weeks[i + 1] ?? "9999-12-31";
    const inWeek = rows.filter((a) => a.activity_date >= w && a.activity_date < end);
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
            {i === totals.length - 1 ? (
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

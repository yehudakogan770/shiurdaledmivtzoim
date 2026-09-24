"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { useData } from "@/lib/data";
import { useNav } from "@/lib/nav";
import { STANDARD, categoryName } from "@/lib/categories";
import { formatDay, formatShort, recentWeeks, today, weekStart } from "@/lib/dates";
import type { Activity, CategoryType } from "@/lib/types";
import { ButtonLink, Card, CardTitle, CategoryDot, Empty, PageHeader, Stat } from "../ui";

export function sum(rows: Activity[]) {
  return rows.reduce((n, a) => n + a.quantity, 0);
}

export function DashboardView() {
  const { me, mine, data } = useData();
  const { Link } = useNav();
  const thisWeek = weekStart(today());
  const weekRows = mine.activity.filter((a) => a.activity_date >= thisWeek);
  const tefillin = sum(weekRows.filter((a) => a.category_type === "tefillin"));
  const candles = sum(weekRows.filter((a) => a.category_type === "shabbos_candles"));
  const other = sum(weekRows.filter((a) => a.category_type === "personal"));
  const recent = [...mine.activity].sort((a, b) => (b.activity_date + b.created_at).localeCompare(a.activity_date + a.created_at)).slice(0, 6);
  const firstName = me?.name.split(" ")[0] || "";

  return (
    <div className="grid grid-cols-1 gap-6">
      <PageHeader
        title={firstName ? `Shalom, ${firstName}` : "Dashboard"}
        subtitle={`Week of ${formatShort(thisWeek)}. Every tefillin and every candle counts.`}
        action={
          <ButtonLink href="/log">
            <Plus size={16} aria-hidden /> Log mivtzoim
          </ButtonLink>
        }
      />

      <QuickLog />

      <Card className="overflow-hidden">
        <div className="grid grid-cols-2 gap-px bg-line sm:grid-cols-4 [&>*]:bg-surface">
          <Stat label="Tefillin" value={tefillin} note="this week" tone="accent" />
          <Stat label="Candles" value={candles} note="this week" tone="candle" />
          <Stat label="Other mivtzoim" value={other} note="this week" tone="sage" />
          <Stat label="All time" value={sum(mine.activity)} note={`${mine.activity.length} entries`} tone="ink" />
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <Card>
          <CardTitle>Last 8 weeks</CardTitle>
          <WeeklyChart rows={mine.activity} />
        </Card>

        <Card>
          <CardTitle action={<Link href="/groups" className="text-sm font-semibold text-accent">All groups</Link>}>My groups this week</CardTitle>
          {mine.groups.length === 0 ? (
            <Empty title="No group yet" action={<ButtonLink href="/groups" variant="secondary">Create or join</ButtonLink>}>
              Join your shiur&apos;s group to see how everyone is doing.
            </Empty>
          ) : (
            <ul className="divide-y divide-line">
              {mine.groups.map((g) => {
                const memberIds = data.members.filter((m) => m.group_id === g.id).map((m) => m.user_id);
                const total = sum(data.activity.filter((a) => a.group_id === g.id && a.activity_date >= thisWeek));
                return (
                  <li key={g.id}>
                    <Link href={`/groups/view?id=${g.id}`} className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-sunken">
                      <span className="min-w-0">
                        <span className="block truncate font-semibold">{g.name}</span>
                        <span className="text-xs text-muted">{memberIds.length} {memberIds.length === 1 ? "member" : "members"}</span>
                      </span>
                      <span className="tabular font-display text-2xl font-bold">{total}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>

      <Card>
        <CardTitle action={<Link href="/history" className="text-sm font-semibold text-accent">Full history</Link>}>Recent activity</CardTitle>
        {recent.length === 0 ? (
          <Empty title="Nothing logged yet">Use the buttons above after your next mivtzoim stop.</Empty>
        ) : (
          <ul className="divide-y divide-line">
            {recent.map((a) => (
              <li key={a.id} className="flex items-center gap-3 px-5 py-3">
                <CategoryDot type={a.category_type} />
                <span className="min-w-0 flex-1">
                  <span className="font-semibold">{categoryName(a, data.categories)}</span>
                  {a.notes && <span className="block truncate text-sm text-muted">{a.notes}</span>}
                </span>
                <span className="text-sm text-muted">{formatDay(a.activity_date)}</span>
                <span className="tabular w-10 text-right font-bold">{a.quantity}</span>
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

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <button
        type="button"
        disabled={busy !== null}
        onClick={() => add("tefillin", "tefillin")}
        className="flex items-center justify-between rounded-lg border border-line bg-accent-soft px-5 py-4 text-left transition-colors hover:border-accent disabled:opacity-60"
      >
        <span>
          <span className="block font-display text-xl font-bold text-accent">+1 Tefillin</span>
          <span className="text-sm text-muted">Someone just put on tefillin</span>
        </span>
        <Plus className="text-accent" aria-hidden />
      </button>
      <button
        type="button"
        disabled={busy !== null}
        onClick={() => add("shabbos_candles", "Shabbos candles")}
        className="flex items-center justify-between rounded-lg border border-line bg-candle-soft px-5 py-4 text-left transition-colors hover:border-candle disabled:opacity-60"
      >
        <span>
          <span className="block font-display text-xl font-bold text-candle">+1 Shabbos Candles</span>
          <span className="text-sm text-muted">Gave out candles or a kit</span>
        </span>
        <Plus className="text-candle" aria-hidden />
      </button>
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
  const max = Math.max(1, ...totals.map((t) => t.parts.reduce((a, b) => a + b, 0)));

  return (
    <div className="px-5 pt-4 pb-5">
      <div className="flex h-44 items-end gap-2 border-b border-line">
        {totals.map((t, i) => {
          const total = t.parts.reduce((a, b) => a + b, 0);
          return (
            <div key={t.week} className="flex h-full flex-1 flex-col justify-end" title={`${formatShort(t.week)}: ${total}`}>
              <span className="tabular mb-1 text-center text-xs font-semibold text-muted">{total || ""}</span>
              <div className="flex flex-col-reverse overflow-hidden rounded-t-sm" style={{ height: `${(total / max) * 85}%` }}>
                {t.parts.map((v, j) => (v ? <div key={j} className={series[j].color} style={{ height: `${(v / total) * 100}%` }} /> : null))}
              </div>
              {i === totals.length - 1 && <span className="sr-only">This week</span>}
            </div>
          );
        })}
      </div>
      <div className="mt-1.5 flex gap-2">
        {totals.map((t, i) => (
          <span key={t.week} className={i === totals.length - 1 ? "flex-1 text-center text-[11px] font-bold text-ink" : "flex-1 text-center text-[11px] text-muted"}>
            {i === totals.length - 1 ? "This wk" : formatShort(t.week)}
          </span>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap gap-4 text-xs text-muted">
        {series.map((s) => (
          <span key={s.key} className="inline-flex items-center gap-1.5">
            <span className={`h-2.5 w-2.5 rounded-sm ${s.color}`} aria-hidden /> {s.label}
          </span>
        ))}
      </div>
    </div>
  );
}

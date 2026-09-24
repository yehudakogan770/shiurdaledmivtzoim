"use client";

import { useState, type FormEvent } from "react";
import { Copy, Trophy } from "lucide-react";
import { useData } from "@/lib/data";
import { useNav } from "@/lib/nav";
import { formatShort, today, weekStart } from "@/lib/dates";
import { Button, ButtonLink, Card, CardTitle, CategoryDot, Empty, Field, Input, PageHeader, cx } from "../ui";
import { sum } from "./dashboard";

export function GroupsView() {
  const { mine, data, actions, notify } = useData();
  const { Link, go } = useNav();
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState<"create" | "join" | null>(null);
  const thisWeek = weekStart(today());

  async function create(e: FormEvent) {
    e.preventDefault();
    setBusy("create");
    try {
      const g = await actions.createGroup(name);
      setName("");
      notify(`Created ${g.name}. Share code ${g.join_code} to invite people.`);
      go(`/groups/view?id=${g.id}`);
    } catch (err) {
      notify((err as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function join(e: FormEvent) {
    e.preventDefault();
    setBusy("join");
    try {
      const id = await actions.joinGroup(code);
      setCode("");
      notify("You joined the group.");
      go(`/groups/view?id=${id}`);
    } catch (err) {
      notify((err as Error).message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="grid grid-cols-1 gap-6">
      <PageHeader title="Groups" subtitle="Go on mivtzoim together. Everyone in a group sees the group's weekly totals." />

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="p-5">
          <form onSubmit={create} className="grid gap-3">
            <Field label="Start a new group" htmlFor="group-name" hint="You'll get a 6-letter code to share.">
              <Input id="group-name" required value={name} onChange={(e) => setName(e.target.value)} placeholder="Shiur Daled – Friday Mivtzoim" />
            </Field>
            <Button type="submit" disabled={busy !== null} className="justify-self-start">
              {busy === "create" ? "Creating…" : "Create group"}
            </Button>
          </form>
        </Card>
        <Card className="p-5">
          <form onSubmit={join} className="grid gap-3">
            <Field label="Join with a code" htmlFor="group-code" hint="Ask the person who made the group for its code.">
              <Input
                id="group-code"
                required
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="ABC123"
                maxLength={6}
                className="font-mono uppercase tracking-[0.3em]"
              />
            </Field>
            <Button type="submit" variant="secondary" disabled={busy !== null} className="justify-self-start">
              {busy === "join" ? "Joining…" : "Join group"}
            </Button>
          </form>
        </Card>
      </div>

      <Card>
        <CardTitle>My groups</CardTitle>
        {mine.groups.length === 0 ? (
          <Empty title="No groups yet">Create one for your shiur, or join with a code.</Empty>
        ) : (
          <ul className="divide-y divide-line">
            {mine.groups.map((g) => {
              const count = data.members.filter((m) => m.group_id === g.id).length;
              const total = sum(data.activity.filter((a) => a.group_id === g.id && a.activity_date >= thisWeek));
              return (
                <li key={g.id}>
                  <Link href={`/groups/view?id=${g.id}`} className="flex items-center justify-between gap-4 px-5 py-4 hover:bg-sunken">
                    <span className="min-w-0">
                      <span className="block truncate font-display text-lg font-bold">{g.name}</span>
                      <span className="text-sm text-muted">
                        {count} {count === 1 ? "member" : "members"} · code <span className="font-mono">{g.join_code}</span>
                      </span>
                    </span>
                    <span className="text-right">
                      <span className="tabular block font-display text-2xl font-bold">{total}</span>
                      <span className="text-xs text-muted">this week</span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}

export function GroupDetailView() {
  const { me, data, mine, actions, notify } = useData();
  const { query, go, Link } = useNav();
  const group = mine.groups.find((g) => g.id === query.id);
  const [confirming, setConfirming] = useState<"leave" | "delete" | null>(null);
  const [period, setPeriod] = useState<"week" | "all">("week");

  if (!group) {
    return (
      <Card>
        <Empty title="Group not found" action={<ButtonLink href="/groups" variant="secondary">Back to groups</ButtonLink>}>
          You may have left it, or it was deleted.
        </Empty>
      </Card>
    );
  }

  const thisWeek = weekStart(today());
  const isOwner = group.created_by === me?.id;
  const members = data.members.filter((m) => m.group_id === group.id);
  const rows = data.activity.filter((a) => a.group_id === group.id && (period === "all" || a.activity_date >= thisWeek));
  const board = members
    .map((m) => {
      const own = rows.filter((a) => a.user_id === m.user_id);
      return {
        member: m,
        tefillin: sum(own.filter((a) => a.category_type === "tefillin")),
        candles: sum(own.filter((a) => a.category_type === "shabbos_candles")),
        other: sum(own.filter((a) => a.category_type === "personal")),
        total: sum(own),
      };
    })
    .sort((a, b) => b.total - a.total);
  const routes = data.routes.filter((r) => r.group_id === group.id);

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(group!.join_code);
      notify("Code copied.");
    } catch {
      notify(`The code is ${group!.join_code}`);
    }
  }

  async function confirm() {
    try {
      if (confirming === "delete") await actions.deleteGroup(group!.id);
      else await actions.leaveGroup(group!.id);
      notify(confirming === "delete" ? "Group deleted." : "You left the group.");
      go("/groups");
    } catch (err) {
      notify((err as Error).message);
    }
  }

  return (
    <div className="grid grid-cols-1 gap-6">
      <PageHeader
        back={{ href: "/groups", label: "Groups" }}
        title={group.name}
        subtitle={`${members.length} ${members.length === 1 ? "member" : "members"}`}
        action={<ButtonLink href={`/log?group=${group.id}`}>Log for this group</ButtonLink>}
      />

      <Card className="flex flex-wrap items-center justify-between gap-4 p-5">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.08em] text-muted">Invite code</p>
          <p className="font-mono text-3xl font-bold tracking-[0.3em] select-all">{group.join_code}</p>
          <p className="text-sm text-muted">Anyone with this code can join from the Groups page.</p>
        </div>
        <Button variant="secondary" onClick={copyCode}>
          <Copy size={16} aria-hidden /> Copy code
        </Button>
      </Card>

      <Card>
        <CardTitle
          action={
            <div className="flex rounded-md border border-line p-0.5 text-sm" role="group" aria-label="Period">
              {(["week", "all"] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  aria-pressed={period === p}
                  onClick={() => setPeriod(p)}
                  className={cx("rounded px-3 py-1 font-semibold", period === p ? "bg-accent-soft text-accent" : "text-muted")}
                >
                  {p === "week" ? `Week of ${formatShort(thisWeek)}` : "All time"}
                </button>
              ))}
            </div>
          }
        >
          Leaderboard
        </CardTitle>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[30rem] text-left text-sm">
            <thead className="text-xs uppercase tracking-[0.06em] text-muted">
              <tr>
                <th className="px-5 py-2 font-bold">Member</th>
                <th className="px-3 py-2 text-right font-bold"><span className="inline-flex items-center gap-1.5"><CategoryDot type="tefillin" />Tefillin</span></th>
                <th className="px-3 py-2 text-right font-bold"><span className="inline-flex items-center gap-1.5"><CategoryDot type="shabbos_candles" />Candles</span></th>
                <th className="px-3 py-2 text-right font-bold"><span className="inline-flex items-center gap-1.5"><CategoryDot type="personal" />Other</span></th>
                <th className="px-5 py-2 text-right font-bold">Total</th>
              </tr>
            </thead>
            <tbody className="tabular divide-y divide-line border-t border-line">
              {board.map((row, i) => (
                <tr key={row.member.id} className={row.member.user_id === me?.id ? "bg-accent-soft/50" : undefined}>
                  <td className="px-5 py-3 font-semibold">
                    <span className="inline-flex items-center gap-2">
                      {i === 0 && row.total > 0 ? <Trophy size={15} className="text-candle" aria-label="Leading" /> : <span className="w-[15px] text-center text-xs text-muted">{i + 1}</span>}
                      {data.names[row.member.user_id] || "Someone"}
                      {row.member.user_id === me?.id && <span className="text-xs font-normal text-muted">(you)</span>}
                      {row.member.member_role === "owner" && <span className="rounded bg-sunken px-1.5 py-0.5 text-[11px] font-semibold text-muted">owner</span>}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-right">{row.tefillin}</td>
                  <td className="px-3 py-3 text-right">{row.candles}</td>
                  <td className="px-3 py-3 text-right">{row.other}</td>
                  <td className="px-5 py-3 text-right font-display text-lg font-bold">{row.total}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="tabular border-t-2 border-line font-bold">
              <tr>
                <td className="px-5 py-3">Group total</td>
                <td className="px-3 py-3 text-right">{board.reduce((n, r) => n + r.tefillin, 0)}</td>
                <td className="px-3 py-3 text-right">{board.reduce((n, r) => n + r.candles, 0)}</td>
                <td className="px-3 py-3 text-right">{board.reduce((n, r) => n + r.other, 0)}</td>
                <td className="px-5 py-3 text-right font-display text-lg">{board.reduce((n, r) => n + r.total, 0)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
        <p className="border-t border-line px-5 py-3 text-xs text-muted">Only entries logged toward this group are counted.</p>
      </Card>

      <Card>
        <CardTitle action={<Link href={`/routes/new?group=${group.id}`} className="text-sm font-semibold text-accent">+ New group route</Link>}>Group routes</CardTitle>
        {routes.length === 0 ? (
          <Empty title="No shared routes">Make a route for the group so everyone knows which stores and offices to visit.</Empty>
        ) : (
          <ul className="divide-y divide-line">
            {routes.map((r) => {
              const stops = data.stops.filter((s) => s.route_id === r.id);
              const done = stops.filter((s) => s.completed).length;
              return (
                <li key={r.id}>
                  <Link href={`/routes/view?id=${r.id}`} className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-sunken">
                    <span className="font-semibold">{r.name}</span>
                    <span className="tabular text-sm text-muted">
                      {done}/{stops.length} stops done
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <div className="flex flex-wrap items-center gap-3">
        {confirming ? (
          <>
            <span className="text-sm font-semibold">{confirming === "delete" ? "Delete this group for everyone?" : "Leave this group?"}</span>
            <Button variant="danger" onClick={confirm}>
              {confirming === "delete" ? "Yes, delete group" : "Yes, leave"}
            </Button>
            <Button variant="ghost" onClick={() => setConfirming(null)}>
              Cancel
            </Button>
          </>
        ) : isOwner ? (
          <Button variant="danger" onClick={() => setConfirming("delete")}>
            Delete group
          </Button>
        ) : (
          <Button variant="danger" onClick={() => setConfirming("leave")}>
            Leave group
          </Button>
        )}
      </div>
    </div>
  );
}

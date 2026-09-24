"use client";

import { useState, type FormEvent } from "react";
import { Copy, Map as MapIcon, Trophy, Users } from "lucide-react";
import { useData } from "@/lib/data";
import { useNav } from "@/lib/nav";
import { formatShort, today, weekStart } from "@/lib/dates";
import { Avatar, Badge, Button, ButtonLink, Card, CardTitle, CategoryDot, Empty, Field, Input, PageHeader, Segmented, listClass } from "../ui";
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

      <div className="grid gap-3 md:grid-cols-2">
        <Card className="p-6">
          <form onSubmit={create} className="grid gap-3">
            <Field label="Start a new group" htmlFor="group-name" hint="You'll get a 6-letter code to share.">
              <Input id="group-name" required value={name} onChange={(e) => setName(e.target.value)} placeholder="Shiur Daled – Friday Mivtzoim" />
            </Field>
            <Button type="submit" disabled={busy !== null} className="justify-self-start">
              {busy === "create" ? "Creating…" : "Create group"}
            </Button>
          </form>
        </Card>
        <Card className="p-6">
          <form onSubmit={join} className="grid gap-3">
            <Field label="Join with a code" htmlFor="group-code" hint="Ask the person who made the group for its code.">
              <Input
                id="group-code"
                required
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="ABC123"
                maxLength={6}
                className="font-mono text-lg uppercase tracking-[0.3em]"
              />
            </Field>
            <Button type="submit" variant="tonal" disabled={busy !== null} className="justify-self-start">
              {busy === "join" ? "Joining…" : "Join group"}
            </Button>
          </form>
        </Card>
      </div>

      <Card>
        <CardTitle>My groups</CardTitle>
        {mine.groups.length === 0 ? (
          <Empty title="No groups yet" icon={Users}>Create one for your shiur, or join with a code.</Empty>
        ) : (
          <ul className={listClass}>
            {mine.groups.map((g) => {
              const count = data.members.filter((m) => m.group_id === g.id).length;
              const total = sum(data.activity.filter((a) => a.group_id === g.id && a.activity_date >= thisWeek));
              return (
                <li key={g.id}>
                  <Link href={`/groups/view?id=${g.id}`} className="flex items-center gap-4 px-6 py-4 hover:bg-ink/5">
                    <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-accent-soft text-accent-on-soft">
                      <Users size={22} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-lg font-medium">{g.name}</span>
                      <span className="text-sm text-muted">
                        {count} {count === 1 ? "member" : "members"} · code <span className="font-mono">{g.join_code}</span>
                      </span>
                    </span>
                    <span className="text-right">
                      <span className="tabular block text-3xl">{total}</span>
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

      <Card className="flex flex-wrap items-center justify-between gap-4 bg-accent-soft p-6 text-accent-on-soft">
        <div>
          <p className="text-sm font-medium opacity-80">Invite code</p>
          <p className="mt-1 font-mono text-4xl font-medium tracking-[0.3em] select-all">{group.join_code}</p>
          <p className="mt-1 text-sm opacity-80">Anyone with this code can join from the Groups page.</p>
        </div>
        <Button onClick={copyCode}>
          <Copy size={16} aria-hidden /> Copy code
        </Button>
      </Card>

      <Card>
        <CardTitle
          action={
            <Segmented
              label="Period"
              value={period}
              onChange={(v) => setPeriod(v as "week" | "all")}
              options={[
                { value: "week", label: `Week of ${formatShort(thisWeek)}` },
                { value: "all", label: "All time" },
              ]}
            />
          }
        >
          Leaderboard
        </CardTitle>
        <ul className="divide-y divide-line/60 sm:hidden">
          {board.map((row, i) => {
            const name = data.names[row.member.user_id] || "Someone";
            return (
              <li key={row.member.id} className={row.member.user_id === me?.id ? "flex items-center gap-3 bg-secondary-soft/60 px-5 py-3" : "flex items-center gap-3 px-5 py-3"}>
                <span className="w-5 shrink-0 text-center text-sm text-muted">
                  {i === 0 && row.total > 0 ? <Trophy size={16} className="inline text-candle" aria-label="Leading" /> : i + 1}
                </span>
                <Avatar name={name} id={row.member.user_id} size={36} />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5">
                    <span className="truncate font-medium">{name}</span>
                    {row.member.user_id === me?.id && <span className="shrink-0 text-xs text-muted">(you)</span>}
                  </span>
                  <span className="tabular flex flex-wrap gap-x-3 text-xs text-muted">
                    <span className="inline-flex items-center gap-1"><CategoryDot type="tefillin" />{row.tefillin}</span>
                    <span className="inline-flex items-center gap-1"><CategoryDot type="shabbos_candles" />{row.candles}</span>
                    <span className="inline-flex items-center gap-1"><CategoryDot type="personal" />{row.other}</span>
                  </span>
                </span>
                <span className="tabular text-2xl">{row.total}</span>
              </li>
            );
          })}
          <li className="tabular flex items-center justify-between px-5 py-3 font-medium">
            <span>Group total</span>
            <span className="text-2xl">{board.reduce((n, r) => n + r.total, 0)}</span>
          </li>
        </ul>
        <div className="hidden overflow-x-auto sm:block">
          <table className="w-full min-w-[34rem] text-left text-sm">
            <thead className="text-xs text-muted">
              <tr>
                <th className="px-6 py-2 font-medium">Member</th>
                <th className="px-3 py-2 text-right font-medium"><span className="inline-flex items-center gap-1.5"><CategoryDot type="tefillin" />Tefillin</span></th>
                <th className="px-3 py-2 text-right font-medium"><span className="inline-flex items-center gap-1.5"><CategoryDot type="shabbos_candles" />Candles</span></th>
                <th className="px-3 py-2 text-right font-medium"><span className="inline-flex items-center gap-1.5"><CategoryDot type="personal" />Other</span></th>
                <th className="px-6 py-2 text-right font-medium">Total</th>
              </tr>
            </thead>
            <tbody className="tabular divide-y divide-line/60">
              {board.map((row, i) => (
                <tr key={row.member.id} className={row.member.user_id === me?.id ? "bg-secondary-soft/60" : undefined}>
                  <td className="px-6 py-3 font-medium">
                    <span className="inline-flex items-center gap-3">
                      <span className="w-5 text-center text-sm text-muted">{i === 0 && row.total > 0 ? <Trophy size={16} className="inline text-candle" aria-label="Leading" /> : i + 1}</span>
                      <Avatar name={data.names[row.member.user_id] || "Someone"} id={row.member.user_id} size={32} />
                      {data.names[row.member.user_id] || "Someone"}
                      {row.member.user_id === me?.id && <span className="text-xs font-normal text-muted">(you)</span>}
                      {row.member.member_role === "owner" && <Badge>Owner</Badge>}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-right">{row.tefillin}</td>
                  <td className="px-3 py-3 text-right">{row.candles}</td>
                  <td className="px-3 py-3 text-right">{row.other}</td>
                  <td className="px-6 py-3 text-right text-xl">{row.total}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="tabular border-t border-line font-medium">
              <tr>
                <td className="px-6 py-4">Group total</td>
                <td className="px-3 py-3 text-right">{board.reduce((n, r) => n + r.tefillin, 0)}</td>
                <td className="px-3 py-3 text-right">{board.reduce((n, r) => n + r.candles, 0)}</td>
                <td className="px-3 py-3 text-right">{board.reduce((n, r) => n + r.other, 0)}</td>
                <td className="px-6 py-4 text-right text-xl">{board.reduce((n, r) => n + r.total, 0)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
        <p className="px-6 pt-2 pb-5 text-xs text-muted">Only entries logged toward this group are counted.</p>
      </Card>

      <Card>
        <CardTitle action={<Link href={`/routes/new?group=${group.id}`} className="inline-flex h-9 items-center rounded-full px-3 text-sm font-medium text-accent hover:bg-accent/8">+ New route</Link>}>Group routes</CardTitle>
        {routes.length === 0 ? (
          <Empty title="No shared routes" icon={MapIcon}>Make a route for the group so everyone knows which stores and offices to visit.</Empty>
        ) : (
          <ul className={listClass}>
            {routes.map((r) => {
              const stops = data.stops.filter((s) => s.route_id === r.id);
              const done = stops.filter((s) => s.completed).length;
              return (
                <li key={r.id}>
                  <Link href={`/routes/view?id=${r.id}`} className="flex items-center justify-between gap-3 px-6 py-4 hover:bg-ink/5">
                    <span className="font-medium">{r.name}</span>
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
            <span className="text-sm font-medium">{confirming === "delete" ? "Delete this group for everyone?" : "Leave this group?"}</span>
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

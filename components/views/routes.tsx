"use client";

import { useState, type FormEvent } from "react";
import { Check, MapPin, Plus, RotateCcw, Trash2, X } from "lucide-react";
import { useData } from "@/lib/data";
import { useNav } from "@/lib/nav";
import { Button, ButtonLink, Card, CardTitle, Empty, Field, IconButton, Input, PageHeader, Select, Textarea, cx } from "../ui";

const STOP_TYPES = ["Store", "Office", "Home", "Hospital", "Campus", "Street corner", "Other"];

type StopDraft = { name: string; address: string; type: string; notes: string };
const blankStop: StopDraft = { name: "", address: "", type: "Store", notes: "" };

export function RoutesView() {
  const { mine, data } = useData();
  const { Link } = useNav();

  return (
    <div className="grid grid-cols-1 gap-6">
      <PageHeader
        title="Routes"
        subtitle="Your regular mivtzoim stops, in order. Check them off as you go."
        action={
          <ButtonLink href="/routes/new">
            <Plus size={16} aria-hidden /> New route
          </ButtonLink>
        }
      />
      {mine.routes.length === 0 ? (
        <Card>
          <Empty title="No routes yet" icon={MapPin} action={<ButtonLink href="/routes/new" variant="secondary">Create your first route</ButtonLink>}>
            A route is a list of places you visit, like the stores on Main Street every Friday.
          </Empty>
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {mine.routes.map((r) => {
            const stops = data.stops.filter((s) => s.route_id === r.id);
            const done = stops.filter((s) => s.completed).length;
            const group = data.groups.find((g) => g.id === r.group_id);
            const pct = stops.length ? (done / stops.length) * 100 : 0;
            return (
              <Link key={r.id} href={`/routes/view?id=${r.id}`} className="block rounded-[28px] bg-card p-6 transition hover:shadow-card">
                <div className="flex items-start justify-between gap-3">
                  <h2 className="text-xl font-medium">{r.name}</h2>
                  <span className="shrink-0 rounded-lg bg-secondary-soft px-2 py-0.5 text-xs font-medium text-secondary-on-soft">{group ? group.name : "Personal"}</span>
                </div>
                {r.description && <p className="mt-1 line-clamp-2 text-sm text-muted">{r.description}</p>}
                <div className="mt-4 h-2 overflow-hidden rounded-full bg-sunken">
                  <div className="h-full rounded-full bg-sage" style={{ width: `${pct}%` }} />
                </div>
                <p className="tabular mt-1.5 text-sm text-muted">
                  {done} of {stops.length} stops done
                </p>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

function StopFields({ value, onChange, idPrefix }: { value: StopDraft; onChange(v: StopDraft): void; idPrefix: string }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Field label="Place name" htmlFor={`${idPrefix}-name`}>
        <Input id={`${idPrefix}-name`} value={value.name} onChange={(e) => onChange({ ...value, name: e.target.value })} placeholder="Goldberg's Pharmacy" />
      </Field>
      <Field label="Type" htmlFor={`${idPrefix}-type`}>
        <Select id={`${idPrefix}-type`} value={value.type} onChange={(e) => onChange({ ...value, type: e.target.value })}>
          {STOP_TYPES.map((t) => (
            <option key={t}>{t}</option>
          ))}
        </Select>
      </Field>
      <Field label="Address" htmlFor={`${idPrefix}-address`}>
        <Input id={`${idPrefix}-address`} value={value.address} onChange={(e) => onChange({ ...value, address: e.target.value })} placeholder="412 Kingston Ave" />
      </Field>
      <Field label="Notes" htmlFor={`${idPrefix}-notes`}>
        <Input id={`${idPrefix}-notes`} value={value.notes} onChange={(e) => onChange({ ...value, notes: e.target.value })} placeholder="Ask for David at the counter" />
      </Field>
    </div>
  );
}

export function NewRouteView() {
  const { mine, actions, notify } = useData();
  const { query, go } = useNav();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [groupId, setGroupId] = useState(query.group ?? "");
  const [stops, setStops] = useState<StopDraft[]>([]);
  const [draft, setDraft] = useState<StopDraft>(blankStop);
  const [busy, setBusy] = useState(false);

  function addDraft() {
    if (!draft.name.trim()) return notify("Give the stop a name first.");
    setStops([...stops, draft]);
    setDraft(blankStop);
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const all = draft.name.trim() ? [...stops, draft] : stops;
      const route = await actions.createRoute({ name, description, group_id: groupId || null, stops: all });
      notify(`Created ${route.name}.`);
      go(`/routes/view?id=${route.id}`);
    } catch (err) {
      notify((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <div className="grid grid-cols-1 gap-6">
      <PageHeader back={{ href: "/routes", label: "Routes" }} title="New route" subtitle="List the places you visit, in the order you visit them." />
      <form onSubmit={submit} className="grid max-w-3xl gap-3">
        <Card className="grid gap-4 p-6">
          <Field label="Route name" htmlFor="route-name">
            <Input id="route-name" required value={name} onChange={(e) => setName(e.target.value)} placeholder="Friday – Main Street stores" />
          </Field>
          <Field label="Description" htmlFor="route-description" hint="Optional.">
            <Textarea id="route-description" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Start at the bakery and work down to the post office." />
          </Field>
          <Field label="Share with" htmlFor="route-group" hint="Group routes can be seen and checked off by everyone in the group.">
            <Select id="route-group" value={groupId} onChange={(e) => setGroupId(e.target.value)}>
              <option value="">Only me</option>
              {mine.groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </Select>
          </Field>
        </Card>

        <Card>
          <CardTitle>Stops ({stops.length})</CardTitle>
          {stops.length > 0 && (
            <ol className="divide-y divide-line/60">
              {stops.map((s, i) => (
                <li key={i} className="flex items-center gap-3 px-6 py-3.5">
                  <span className="tabular grid h-8 w-8 shrink-0 place-items-center rounded-full bg-secondary-soft text-sm text-secondary-on-soft font-medium">{i + 1}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium">{s.name}</span>
                    <span className="block truncate text-sm text-muted">{[s.type, s.address].filter(Boolean).join(" · ")}</span>
                  </span>
                  <IconButton aria-label={`Remove ${s.name}`} onClick={() => setStops(stops.filter((_, j) => j !== i))}>
                    <X size={18} />
                  </IconButton>
                </li>
              ))}
            </ol>
          )}
          <div className="grid gap-3 px-6 pt-2 pb-6">
            <StopFields value={draft} onChange={setDraft} idPrefix="new-stop" />
            <Button variant="tonal" onClick={addDraft} className="justify-self-start">
              <Plus size={16} aria-hidden /> Add stop
            </Button>
          </div>
        </Card>

        <div className="flex gap-3">
          <Button type="submit" disabled={busy}>
            {busy ? "Creating…" : "Create route"}
          </Button>
          <ButtonLink href="/routes" variant="ghost">
            Cancel
          </ButtonLink>
        </div>
      </form>
    </div>
  );
}

export function RouteDetailView() {
  const { me, data, mine, actions, notify } = useData();
  const { query, go } = useNav();
  const route = mine.routes.find((r) => r.id === query.id);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState<StopDraft>(blankStop);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [pending, setPending] = useState<string | null>(null);

  if (!route) {
    return (
      <Card>
        <Empty title="Route not found" action={<ButtonLink href="/routes" variant="secondary">Back to routes</ButtonLink>}>
          It may have been deleted.
        </Empty>
      </Card>
    );
  }

  const group = data.groups.find((g) => g.id === route.group_id);
  const stops = data.stops
    .filter((s) => s.route_id === route.id)
    .sort((a, b) => a.position - b.position)
    .map((s) => ({ stop: s, loc: data.locations.find((l) => l.id === s.location_id) }));
  const done = stops.filter((s) => s.stop.completed).length;
  const logQuery = `route=${route.id}${route.group_id ? `&group=${route.group_id}` : ""}`;

  async function wrap(key: string, work: () => Promise<void>, message?: string) {
    setPending(key);
    try {
      await work();
      if (message) notify(message);
    } catch (err) {
      notify((err as Error).message);
    } finally {
      setPending(null);
    }
  }

  async function addStop(e: FormEvent) {
    e.preventDefault();
    if (!draft.name.trim()) return notify("Give the stop a name first.");
    await wrap("add", () => actions.addStop(route!.id, draft), "Stop added.");
    setDraft(blankStop);
    setAdding(false);
  }

  return (
    <div className="grid grid-cols-1 gap-6">
      <PageHeader
        back={{ href: "/routes", label: "Routes" }}
        title={route.name}
        subtitle={
          <>
            {group ? `Shared with ${group.name}` : "Personal route"} · <span className="tabular">{done} of {stops.length} stops done</span>
          </>
        }
        action={
          <ButtonLink href={route.group_id ? `/routes/new?group=${route.group_id}` : "/routes/new"}>
            <Plus size={16} aria-hidden /> New route
          </ButtonLink>
        }
      />
      {route.description && <p className="-mt-3 max-w-2xl text-muted">{route.description}</p>}

      <Card>
        <CardTitle
          action={
            done > 0 ? (
              <Button variant="ghost" className="h-9 px-3" disabled={pending !== null} onClick={() => wrap("reset", () => actions.resetRoute(route.id), "All stops unchecked.")}>
                <RotateCcw size={14} aria-hidden /> Start over
              </Button>
            ) : undefined
          }
        >
          Stops
        </CardTitle>
        {stops.length === 0 ? (
          <Empty title="No stops yet" icon={MapPin}>Add the first place on this route below.</Empty>
        ) : (
          <ol className="divide-y divide-line/60">
            {stops.map(({ stop, loc }, i) => (
              <li key={stop.id} className="flex items-center gap-3 px-6 py-3.5">
                <button
                  type="button"
                  aria-pressed={stop.completed}
                  aria-label={stop.completed ? `Mark ${loc?.name} not done` : `Mark ${loc?.name} done`}
                  disabled={pending !== null}
                  onClick={() => wrap(stop.id, () => actions.toggleStop(stop))}
                  className={cx(
                    "grid h-10 w-10 shrink-0 place-items-center rounded-full border-2 transition-colors",
                    stop.completed ? "border-sage bg-sage text-card" : "border-outline text-muted hover:border-sage",
                  )}
                >
                  {stop.completed ? <Check size={16} strokeWidth={3} /> : <span className="tabular text-xs font-medium">{i + 1}</span>}
                </button>
                <span className="min-w-0 flex-1">
                  <span className={cx("block font-medium", stop.completed && "text-muted line-through")}>{loc?.name ?? "Unknown place"}</span>
                  <span className="block text-sm text-muted">
                    {[loc?.type, loc?.address].filter(Boolean).join(" · ")}
                    {loc?.notes && <span className="block italic">{loc.notes}</span>}
                  </span>
                </span>
                <ButtonLink href={`/log?${logQuery}&location=${stop.location_id}`} variant="secondary" className="h-9 shrink-0 px-4">
                  Log here
                </ButtonLink>
                <IconButton aria-label={`Remove ${loc?.name}`} disabled={pending !== null} onClick={() => wrap(stop.id, () => actions.removeStop(stop.id), "Stop removed.")}>
                  <Trash2 size={18} />
                </IconButton>
              </li>
            ))}
          </ol>
        )}
        <div className="px-6 pt-2 pb-6">
          {adding ? (
            <form onSubmit={addStop} className="grid gap-3">
              <StopFields value={draft} onChange={setDraft} idPrefix="add-stop" />
              <div className="flex gap-2">
                <Button type="submit" disabled={pending !== null}>
                  <MapPin size={16} aria-hidden /> Add stop
                </Button>
                <Button variant="ghost" onClick={() => setAdding(false)}>
                  Cancel
                </Button>
              </div>
            </form>
          ) : (
            <Button variant="tonal" onClick={() => setAdding(true)}>
              <Plus size={16} aria-hidden /> Add a stop
            </Button>
          )}
        </div>
      </Card>

      {route.created_by === me?.id && (
        <div className="flex flex-wrap items-center gap-3">
          {confirmDelete ? (
            <>
              <span className="text-sm font-medium">Delete this route and its stops?</span>
              <Button variant="danger" onClick={() => wrap("delete", async () => { await actions.deleteRoute(route.id); go("/routes"); }, "Route deleted.")}>
                Yes, delete
              </Button>
              <Button variant="ghost" onClick={() => setConfirmDelete(false)}>
                Cancel
              </Button>
            </>
          ) : (
            <Button variant="danger" onClick={() => setConfirmDelete(true)}>
              Delete route
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

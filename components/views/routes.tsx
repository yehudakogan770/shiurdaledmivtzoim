"use client";

import { useState, type FormEvent } from "react";
import { Check, ChevronDown, ChevronUp, Globe, IdCard, Mail, MapPin, Pencil, Phone, Plus, RotateCcw, Trash2, User, X } from "lucide-react";
import { useEditMode } from "@/lib/edit-mode";
import { chavrusasOf } from "@/lib/chavrusa";
import { getLang, t } from "@/lib/i18n";

/** Just the Chavrusas' English names: "Mendel, Levi". */
const englishNames = (partners: string[] | null | undefined) =>
  chavrusasOf(partners)
    .map((c) => c.name || c.hebrew)
    .join(", ");
import { NOT_ALLOWED } from "@/lib/backend";
import { EditSwitch } from "./dashboard";
import { useData, type StopInput } from "@/lib/data";
import type { LocationCard } from "@/lib/types";
import { ScanCardButton } from "../card-scanner";
import { AddressInput, googleMapsLink } from "../address-input";
import { useNav } from "@/lib/nav";
import { Button, ButtonLink, Card, CardTitle, Empty, Field, IconButton, Input, Modal, PageHeader, Select, Textarea, cx } from "../ui";

const STOP_TYPES = ["Store", "Office", "Home", "Hospital", "Campus", "Street corner", "Other"];
/** A stop type in the site's language ("Home" here is a house, not the Home page). */
const typeLabel = (type: string) => (type === "Home" ? (getLang() === "en" ? "Home" : t("Home (a house)")) : t(type));

type StopDraft = {
  name: string;
  address: string;
  type: string;
  notes: string;
  contact: string;
  phone: string;
  email: string;
  website: string;
  /** The card picture: a new one just scanned, the one already saved (a link), or none. */
  card: { blob?: Blob; url: string } | null;
  /** The saved card picture was taken off. */
  cardRemoved?: boolean;
};
const blankStop: StopDraft = { name: "", address: "", type: "Store", notes: "", contact: "", phone: "", email: "", website: "", card: null };

/** What gets saved: a new card picture, removing the old one, or leaving it as is. */
function toInput(d: StopDraft): StopInput {
  return { ...d, card: d.card?.blob ? d.card.blob : d.cardRemoved ? null : undefined };
}

/** A saved place, ready to change in the form. */
function draftOf(loc: { name: string; address?: string | null; type?: string | null; notes?: string | null }, card?: LocationCard): StopDraft {
  return {
    name: loc.name,
    address: loc.address ?? "",
    type: loc.type ?? "Store",
    notes: loc.notes ?? "",
    contact: card?.contact ?? "",
    phone: card?.phone ?? "",
    email: card?.email ?? "",
    website: card?.website ?? "",
    card: card?.imageUrl ? { url: card.imageUrl } : null,
  };
}

/** The Owner's message when the database doesn't yet let it change other people's routes. */
function ownerMessage(err: Error) {
  return err.message === NOT_ALLOWED ? t("To change other people's routes, run database update 010 in Supabase first.") : err.message;
}

export function RoutesView() {
  const { mine, data, isOwner } = useData();
  const { Link } = useNav();
  if (isOwner) return <AllRoutesView />;

  return (
    <div className="grid grid-cols-1 gap-3">
      <PageHeader
        title={t("Routes")}
        subtitle={t("Your regular Mivtzoim stops, in order. Check them off as you go.")}
        action={
          <ButtonLink href="/routes/new">
            <Plus size={16} aria-hidden /> {t("New route")}
          </ButtonLink>
        }
      />
      {mine.routes.length === 0 ? (
        <Card>
          <Empty title={t("No routes yet")} icon={MapPin} action={<ButtonLink href="/routes/new" variant="secondary">{t("Create your first route")}</ButtonLink>}>
            {t("A route is a list of places you visit, like the stores on Main Street every Friday.")}
          </Empty>
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {mine.routes.map((r) => {
            const stops = data.stops.filter((s) => s.route_id === r.id);
            const done = stops.filter((s) => s.completed).length;
            const pct = stops.length ? (done / stops.length) * 100 : 0;
            return (
              <Link key={r.id} href={`/routes/view?id=${r.id}`} className="block rounded-[28px] bg-card p-6 transition hover:shadow-card">
                <div className="flex items-start justify-between gap-3">
                  <h2 className="text-xl font-medium">{r.name}</h2>
                </div>
                {r.description && <p className="mt-1 line-clamp-2 text-sm text-muted">{r.description}</p>}
                <div className="mt-4 h-2 overflow-hidden rounded-full bg-sunken">
                  <div className="h-full rounded-full bg-sage" style={{ width: `${pct}%` }} />
                </div>
                <p className="tabular mt-1.5 text-sm text-muted">
                  {t("{done} of {total} stops done", { done, total: stops.length })}
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
  const [more, setMore] = useState(!!(value.contact || value.phone || value.email || value.website || value.card));
  const [viewing, setViewing] = useState(false);
  const field = (key: "contact" | "phone" | "email" | "website", label: string, props: Partial<React.ComponentProps<typeof Input>>) => (
    <Field label={label} htmlFor={`${idPrefix}-${key}`}>
      <Input id={`${idPrefix}-${key}`} value={value[key]} onChange={(e) => onChange({ ...value, [key]: e.target.value })} {...props} />
    </Field>
  );
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
        <ScanCardButton
          onScanned={({ details, picture, preview }) => {
            // Fill in what the card shows; keep what's typed where the card had nothing.
            const pick = (card: string, typed: string) => card || typed;
            onChange({
              ...value,
              name: pick(details.name, value.name),
              address: pick(details.address, value.address),
              type: details.type || value.type,
              contact: pick(details.contact, value.contact),
              phone: pick(details.phone, value.phone),
              email: pick(details.email, value.email),
              website: pick(details.website, value.website),
              card: { blob: picture, url: preview },
              cardRemoved: false,
            });
            setMore(true);
          }}
        />
        {value.card && (
          <span className="flex items-center gap-2">
            <button type="button" onClick={() => setViewing(true)} aria-label={t("See the business card")} className="overflow-hidden rounded-lg shadow-card">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={value.card.url} alt="" className="h-12 w-auto" />
            </button>
            <Button variant="ghost" className="h-9 px-3" onClick={() => onChange({ ...value, card: null, cardRemoved: true })}>
              {t("Remove card")}
            </Button>
          </span>
        )}
        {!value.card && <span className="text-sm text-muted">{t("or type the details in")}</span>}
      </div>
      <Field label={t("Place name")} htmlFor={`${idPrefix}-name`}>
        <Input id={`${idPrefix}-name`} value={value.name} onChange={(e) => onChange({ ...value, name: e.target.value })} placeholder={t("Goldberg's Pharmacy")} />
      </Field>
      <Field label={t("Type")} htmlFor={`${idPrefix}-type`}>
        <Select id={`${idPrefix}-type`} value={value.type} onChange={(e) => onChange({ ...value, type: e.target.value })}>
          {STOP_TYPES.map((type) => (
            <option key={type} value={type}>
              {typeLabel(type)}
            </option>
          ))}
        </Select>
      </Field>
      <div className="sm:col-span-2">
        <Field label={t("Address")} htmlFor={`${idPrefix}-address`} hint={t("Start typing and pick the address from the list.")}>
          <AddressInput
            id={`${idPrefix}-address`}
            value={value.address}
            onChange={(address) => onChange({ ...value, address })}
            onPick={({ address, placeName }) => onChange({ ...value, address, name: value.name.trim() ? value.name : placeName ?? address.split(",")[0] })}
            placeholder="412 Kingston Ave"
          />
        </Field>
      </div>
      <Field label={t("Notes")} htmlFor={`${idPrefix}-notes`}>
        <Input id={`${idPrefix}-notes`} value={value.notes} onChange={(e) => onChange({ ...value, notes: e.target.value })} placeholder={t("Ask for David at the counter")} />
      </Field>
      {more ? (
        <>
          {field("contact", t("Contact person"), { placeholder: "David Goldberg", autoComplete: "off" })}
          {field("phone", t("Phone"), { type: "tel", inputMode: "tel", placeholder: "(718) 555-0123", autoComplete: "off" })}
          {field("email", t("Email"), { type: "email", inputMode: "email", placeholder: "david@goldbergsrx.com", autoComplete: "off" })}
          {field("website", t("Website"), { inputMode: "url", placeholder: "goldbergsrx.com", autoComplete: "off" })}
          <p className="text-xs text-muted sm:col-span-2">{t("Only you can see the phone, email, contact, website and card (and the site's Owner).")}</p>
        </>
      ) : (
        <button type="button" onClick={() => setMore(true)} className="justify-self-start self-end pb-3 text-sm font-medium text-accent hover:underline">
          {t("+ Phone, email, contact person, website")}
        </button>
      )}
      {viewing && value.card && <CardPictureViewer url={value.card.url} onClose={() => setViewing(false)} />}
    </div>
  );
}

/** The business card, big. */
function CardPictureViewer({ url, onClose }: { url: string; onClose(): void }) {
  return (
    <Modal onClose={onClose}>
      <figure role="dialog" aria-modal="true" aria-label={t("Business card")} className="grid w-full max-w-xl gap-3" onClick={(e) => e.stopPropagation()}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={url} alt={t("Business card")} className="w-full rounded-2xl bg-white shadow-pop" />
        <Button variant="secondary" className="justify-self-center" onClick={onClose}>
          {t("Close")}
        </Button>
      </figure>
    </Modal>
  );
}

/** A place's card details under its name: tap to call, email or open the website. */
function CardLine({ card }: { card: LocationCard }) {
  const [viewing, setViewing] = useState(false);
  const site = card.website ? (/^https?:\/\//i.test(card.website) ? card.website : `https://${card.website}`) : null;
  const items = [
    card.contact && (
      <span key="c" className="inline-flex items-center gap-1">
        <User size={13} aria-hidden /> {card.contact}
      </span>
    ),
    card.phone && (
      <a key="p" href={`tel:${card.phone.replace(/[^\d+]/g, "")}`} className="inline-flex items-center gap-1 font-medium text-accent hover:underline">
        <Phone size={13} aria-hidden /> {card.phone}
      </a>
    ),
    card.email && (
      <a key="e" href={`mailto:${card.email}`} className="inline-flex items-center gap-1 font-medium text-accent hover:underline">
        <Mail size={13} aria-hidden /> {card.email}
      </a>
    ),
    site && (
      <a key="w" href={site} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-medium text-accent hover:underline">
        <Globe size={13} aria-hidden /> {card.website}
      </a>
    ),
    card.imageUrl && (
      <button key="i" type="button" onClick={() => setViewing(true)} className="inline-flex items-center gap-1 font-medium text-accent hover:underline">
        <IdCard size={13} aria-hidden /> {t("Card")}
      </button>
    ),
  ].filter(Boolean);
  if (!items.length) return null;
  return (
    <span className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-sm text-muted">
      {items}
      {viewing && card.imageUrl && <CardPictureViewer url={card.imageUrl} onClose={() => setViewing(false)} />}
    </span>
  );
}

export function NewRouteView() {
  const { mine, actions, notify } = useData();
  const { query, go } = useNav();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [stops, setStops] = useState<StopDraft[]>([]);
  const [draft, setDraft] = useState<StopDraft>(blankStop);
  const [busy, setBusy] = useState(false);

  function addDraft() {
    if (!draft.name.trim()) return notify(t("Give the stop a name first."));
    setStops([...stops, draft]);
    setDraft(blankStop);
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const all = draft.name.trim() ? [...stops, draft] : stops;
      const route = await actions.createRoute({ name, description, group_id: null, stops: all.map(toInput) });
      notify(t("Created {name}.", { name: route.name }));
      go(`/routes/view?id=${route.id}`);
    } catch (err) {
      notify((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <div className="grid grid-cols-1 gap-3">
      <PageHeader back={{ href: "/routes", label: t("Routes") }} title={t("New route")} subtitle={t("List the places you visit, in the order you visit them.")} />
      <form onSubmit={submit} className="grid max-w-3xl grid-cols-1 gap-3">
        <Card className="grid gap-4 p-6">
          <Field label={t("Route name")} htmlFor="route-name">
            <Input id="route-name" required value={name} onChange={(e) => setName(e.target.value)} placeholder={t("(general location)")} />
          </Field>
          <Field label={t("Description")} htmlFor="route-description" hint={t("Optional.")}>
            <Textarea id="route-description" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} placeholder={t("Start at the bakery and work down to the post office.")} />
          </Field>
        </Card>

        <Card>
          <CardTitle>{t("Stops ({n})", { n: stops.length })}</CardTitle>
          {stops.length > 0 && (
            <ol className="divide-y divide-line/60">
              {stops.map((s, i) => (
                <li key={i} className="flex items-center gap-3 px-6 py-3">
                  <span className="tabular grid h-8 w-8 shrink-0 place-items-center rounded-full bg-secondary-soft text-sm text-secondary-on-soft font-medium">{i + 1}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium">{s.name}</span>
                    <span className="block truncate text-sm text-muted">{[s.type && typeLabel(s.type), s.address].filter(Boolean).join(" · ")}</span>
                  </span>
                  <IconButton aria-label={t("Remove {name}", { name: s.name })} onClick={() => setStops(stops.filter((_, j) => j !== i))}>
                    <X size={18} />
                  </IconButton>
                </li>
              ))}
            </ol>
          )}
          <div className="grid gap-3 px-6 pt-2 pb-6">
            <StopFields value={draft} onChange={setDraft} idPrefix="new-stop" />
            <Button variant="tonal" onClick={addDraft} className="justify-self-start">
              <Plus size={16} aria-hidden /> {t("Add stop")}
            </Button>
          </div>
        </Card>

        <div className="flex gap-3">
          <Button type="submit" disabled={busy}>
            {busy ? t("Creating…") : t("Create route")}
          </Button>
          <ButtonLink href="/routes" variant="ghost">
            {t("Cancel")}
          </ButtonLink>
        </div>
      </form>
    </div>
  );
}

/** The Owner sees everyone's routes, with whose route it is and how far along. */
function AllRoutesView() {
  const { data, people } = useData();
  const { Link } = useNav();
  const owner = (r: { created_by: string }) => data.names[r.created_by] || t("Someone");
  const partners = (r: { created_by: string }) => people.find((p) => p.id === r.created_by)?.partners;
  const routes = [...data.routes].sort((a, b) => owner(a).localeCompare(owner(b)) || a.name.localeCompare(b.name));
  return (
    <div className="grid grid-cols-1 gap-3">
      <PageHeader title={t("Routes")} subtitle={t("Everyone's routes. Open one to see all its stops; turn on Edit there to change it.")} action={<EditSwitch />} />
      {routes.length === 0 ? (
        <Card>
          <Empty title={t("No routes yet")} icon={MapPin}>
            {t("When people make routes, they show up here.")}
          </Empty>
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {routes.map((r) => {
            const stops = data.stops.filter((s) => s.route_id === r.id);
            const done = stops.filter((s) => s.completed).length;
            const pct = stops.length ? (done / stops.length) * 100 : 0;
            return (
              <Link key={r.id} href={`/routes/view?id=${r.id}`} className="block rounded-[28px] bg-card p-6 transition hover:shadow-card">
                <p className="text-sm">
                  <span className="font-medium text-accent">{owner(r)}</span>
                  {englishNames(partners(r)) && <span className="text-xs text-muted"> · {englishNames(partners(r))}</span>}
                </p>
                <h2 className="text-xl font-medium">{r.name}</h2>
                {r.description && <p className="mt-1 line-clamp-2 text-sm text-muted">{r.description}</p>}
                <div className="mt-4 h-2 overflow-hidden rounded-full bg-sunken">
                  <div className="h-full rounded-full bg-sage" style={{ width: `${pct}%` }} />
                </div>
                <p className="tabular mt-1.5 text-sm text-muted">
                  {t("{done} of {total} stops done", { done, total: stops.length })}
                </p>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function RouteDetailView() {
  const { me, data, mine, actions, notify, isOwner, people, cards } = useData();
  const { editing } = useEditMode();
  const { query, go } = useNav();
  // The Owner can open anyone's route; with Edit on it can change everything on it.
  const route = (isOwner ? data.routes : mine.routes).find((r) => r.id === query.id);
  const canEdit = !isOwner || editing;
  // The route's person can always fix a stop's details; the Owner with Edit on.
  const canEditStops = isOwner ? editing : route?.created_by === me?.id;
  const [routeDraft, setRouteDraft] = useState<{ name: string; description: string } | null>(null);
  const [stopDraft, setStopDraft] = useState<{ locationId: string; value: StopDraft } | null>(null);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState<StopDraft>(blankStop);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [pending, setPending] = useState<string | null>(null);

  if (!route) {
    return (
      <Card>
        <Empty title={t("Route not found")} action={<ButtonLink href="/routes" variant="secondary">{t("Back to routes")}</ButtonLink>}>
          {t("It may have been deleted.")}
        </Empty>
      </Card>
    );
  }

  const stops = data.stops
    .filter((s) => s.route_id === route.id)
    .sort((a, b) => a.position - b.position)
    .map((s) => ({ stop: s, loc: data.locations.find((l) => l.id === s.location_id) }));
  const done = stops.filter((s) => s.stop.completed).length;
  const logQuery = `route=${route.id}`;

  async function wrap(key: string, work: () => Promise<void>, message?: string) {
    setPending(key);
    try {
      await work();
      if (message) notify(message);
    } catch (err) {
      notify(isOwner ? ownerMessage(err as Error) : (err as Error).message);
    } finally {
      setPending(null);
    }
  }

  async function addStop(e: FormEvent) {
    e.preventDefault();
    if (!draft.name.trim()) return notify(t("Give the stop a name first."));
    await wrap("add", () => actions.addStop(route!.id, toInput(draft)), t("Stop added."));
    setDraft(blankStop);
    setAdding(false);
  }

  async function saveRoute(e: FormEvent) {
    e.preventDefault();
    if (!routeDraft) return;
    await wrap("route", () => actions.updateRoute(route!.id, routeDraft), t("Route saved."));
    setRouteDraft(null);
  }

  async function saveStop(e: FormEvent) {
    e.preventDefault();
    if (!stopDraft) return;
    await wrap("stop", () => actions.updateStop(stopDraft.locationId, toInput(stopDraft.value)), t("Stop saved."));
    setStopDraft(null);
  }

  return (
    <div className="grid grid-cols-1 gap-3">
      <PageHeader
        back={{ href: "/routes", label: t("Routes") }}
        eyebrow={
          isOwner ? (
            <>
              {t("{name}'s route", { name: data.names[route.created_by] || t("Someone") })}
              {englishNames(people.find((p) => p.id === route.created_by)?.partners) && (
                <span className="text-xs font-normal text-muted"> · {englishNames(people.find((p) => p.id === route.created_by)?.partners)}</span>
              )}
            </>
          ) : undefined
        }
        title={route.name}
        subtitle={
          <>
            <span className="tabular">{t("{done} of {total} stops done", { done, total: stops.length })}</span>
          </>
        }
        action={isOwner ? <EditSwitch /> : <ButtonLink href={`/log?${logQuery}`}>{t("Log on this route")}</ButtonLink>}
      />
      {isOwner && editing && (
        <Card>
          {routeDraft ? (
            <form onSubmit={saveRoute} className="grid gap-3 p-6">
              <Field label={t("Route name")} htmlFor="route-name">
                <Input id="route-name" required autoFocus value={routeDraft.name} onChange={(e) => setRouteDraft({ ...routeDraft, name: e.target.value })} />
              </Field>
              <Field label={t("Description")} htmlFor="route-description">
                <Textarea id="route-description" rows={2} value={routeDraft.description} onChange={(e) => setRouteDraft({ ...routeDraft, description: e.target.value })} />
              </Field>
              <div className="flex gap-2">
                <Button type="submit" disabled={pending !== null} className="h-9 px-4">
                  {t("Save")}
                </Button>
                <Button type="button" variant="ghost" className="h-9 px-3" onClick={() => setRouteDraft(null)}>
                  {t("Cancel")}
                </Button>
              </div>
            </form>
          ) : (
            <div className="flex flex-wrap items-center gap-3 p-6">
              <span className="min-w-0 flex-1">
                <span className="block text-sm text-muted">{t("Route name and description")}</span>
                <span className="block font-medium">{route.name}</span>
                {route.description && <span className="block text-sm text-muted">{route.description}</span>}
              </span>
              <Button variant="tonal" className="h-9 px-4" onClick={() => setRouteDraft({ name: route.name, description: route.description ?? "" })}>
                <Pencil size={16} aria-hidden /> {t("Edit")}
              </Button>
            </div>
          )}
        </Card>
      )}
      {route.description && !(isOwner && editing) && <p className="-mt-3 max-w-2xl text-muted">{route.description}</p>}

      <Card>
        <CardTitle
          action={
            done > 0 && canEdit ? (
              <Button variant="ghost" className="h-9 px-3" disabled={pending !== null} onClick={() => wrap("reset", () => actions.resetRoute(route.id), t("All stops unchecked."))}>
                <RotateCcw size={14} aria-hidden /> {t("Start over")}
              </Button>
            ) : undefined
          }
        >
          {t("Stops")}
        </CardTitle>
        {stops.length === 0 ? (
          <Empty title={t("No stops yet")} icon={MapPin}>{t("Add the first place on this route below.")}</Empty>
        ) : (
          <ol className="divide-y divide-line/60">
            {stops.map(({ stop, loc }, i) =>
              stopDraft?.locationId === stop.location_id ? (
                <li key={stop.id} className="px-6 py-4">
                  <form onSubmit={saveStop} className="grid gap-3">
                    <StopFields value={stopDraft.value} onChange={(value) => setStopDraft({ ...stopDraft, value })} idPrefix={`edit-stop-${stop.id}`} />
                    <div className="flex gap-2">
                      <Button type="submit" disabled={pending !== null} className="h-9 px-4">
                        {t("Save stop")}
                      </Button>
                      <Button type="button" variant="ghost" className="h-9 px-3" onClick={() => setStopDraft(null)}>
                        {t("Cancel")}
                      </Button>
                    </div>
                  </form>
                </li>
              ) : (
              <li key={stop.id} className="flex items-center gap-3 px-6 py-3">
                {isOwner && editing && (
                  <span className="-ms-3 flex shrink-0 flex-col">
                    <IconButton aria-label={t("Move {name} up", { name: loc?.name ?? "" })} disabled={i === 0 || pending !== null} onClick={() => wrap(stop.id, () => actions.moveStop(stop.id, -1))} className="h-7 w-9 disabled:opacity-25">
                      <ChevronUp size={18} />
                    </IconButton>
                    <IconButton aria-label={t("Move {name} down", { name: loc?.name ?? "" })} disabled={i === stops.length - 1 || pending !== null} onClick={() => wrap(stop.id, () => actions.moveStop(stop.id, 1))} className="h-7 w-9 disabled:opacity-25">
                      <ChevronDown size={18} />
                    </IconButton>
                  </span>
                )}
                <button
                  type="button"
                  aria-pressed={stop.completed}
                  aria-label={stop.completed ? t("Mark {name} not done", { name: loc?.name ?? "" }) : t("Mark {name} done", { name: loc?.name ?? "" })}
                  disabled={pending !== null || !canEdit}
                  onClick={() => wrap(stop.id, () => actions.toggleStop(stop))}
                  className={cx(
                    "grid h-10 w-10 shrink-0 place-items-center rounded-full border-2 transition-colors",
                    stop.completed ? "border-sage bg-sage text-card" : "border-outline text-muted hover:border-sage",
                  )}
                >
                  {stop.completed ? <Check size={16} strokeWidth={3} /> : <span className="tabular text-xs font-medium">{i + 1}</span>}
                </button>
                <span className="min-w-0 flex-1">
                  <span className={cx("block font-medium", stop.completed && "text-muted line-through")}>{loc?.name ?? t("Unknown place")}</span>
                  <span className="block text-sm text-muted">
                    {[loc?.type && typeLabel(loc.type), loc?.address].filter(Boolean).join(" · ")}
                    {loc?.address && (
                      <a href={googleMapsLink(loc.address)} target="_blank" rel="noopener noreferrer" className="ms-2 inline-flex items-center gap-1 font-medium text-accent hover:underline">
                        <MapPin size={13} aria-hidden /> {t("Open in Google Maps")}
                      </a>
                    )}
                    {loc?.notes && <span className="block italic">{loc.notes}</span>}
                  </span>
                  {loc && cards[loc.id] && <CardLine card={cards[loc.id]} />}
                </span>
                {!isOwner && (
                  <span className="hidden shrink-0 sm:block">
                    <ButtonLink href={`/log?${logQuery}&location=${stop.location_id}`} variant="secondary" className="px-3 py-1.5">
                      {t("Log here")}
                    </ButtonLink>
                  </span>
                )}
                {canEditStops && loc && (
                  <IconButton aria-label={t("Edit {name}", { name: loc.name })} disabled={pending !== null} onClick={() => setStopDraft({ locationId: loc.id, value: draftOf(loc, cards[loc.id]) })}>
                    <Pencil size={18} />
                  </IconButton>
                )}
                {canEdit && (
                  <IconButton aria-label={t("Remove {name}", { name: loc?.name ?? "" })} disabled={pending !== null} onClick={() => wrap(stop.id, () => actions.removeStop(stop.id), t("Stop removed."))}>
                    <Trash2 size={18} />
                  </IconButton>
                )}
              </li>
              ),
            )}
          </ol>
        )}
        {canEdit && (
        <div className="px-6 pt-2 pb-6">
          {adding ? (
            <form onSubmit={addStop} className="grid gap-3">
              <StopFields value={draft} onChange={setDraft} idPrefix="add-stop" />
              <div className="flex gap-2">
                <Button type="submit" disabled={pending !== null}>
                  <MapPin size={16} aria-hidden /> {t("Add stop")}
                </Button>
                <Button variant="ghost" onClick={() => setAdding(false)}>
                  {t("Cancel")}
                </Button>
              </div>
            </form>
          ) : (
            <Button variant="tonal" onClick={() => setAdding(true)}>
              <Plus size={16} aria-hidden /> {t("Add a stop")}
            </Button>
          )}
        </div>
        )}
        {!canEdit && <div className="pb-4" />}
      </Card>

      {(route.created_by === me?.id || (isOwner && editing)) && (
        <div className="flex flex-wrap items-center gap-3">
          {confirmDelete ? (
            <>
              <span className="text-sm font-medium">{t("Delete this route and its stops?")}</span>
              <Button variant="danger" onClick={() => wrap("delete", async () => { await actions.deleteRoute(route.id); go("/routes"); }, t("Route deleted."))}>
                {t("Yes, delete")}
              </Button>
              <Button variant="ghost" onClick={() => setConfirmDelete(false)}>
                {t("Cancel")}
              </Button>
            </>
          ) : (
            <Button variant="danger" onClick={() => setConfirmDelete(true)}>
              {t("Delete route")}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

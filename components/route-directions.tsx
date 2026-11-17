"use client";

import { useState } from "react";
import { Car, Footprints, Navigation, TrainFront } from "lucide-react";
import { findPlace } from "./address-input";
import { Button, Card, CardTitle, cx } from "./ui";
import { t } from "@/lib/i18n";

type Stop = { id: string; name: string; address: string };
type Point = { lat: number; lon: number };
type Way = "walk" | "drive" | "train";

const GOOGLE_MODE: Record<Way, string> = { walk: "walking", drive: "driving", train: "transit" };
const APPLE_MODE: Record<Way, string> = { walk: "w", drive: "d", train: "r" };
/** Google Maps links take up to 9 stops between the start and the end, but only 3 on a phone's browser. */
const perLink = () => (typeof navigator !== "undefined" && /iPhone|iPad|Android/i.test(navigator.userAgent) ? 4 : 10);

/** Straight-line distance in km, good enough to pick the closest next stop in a city. */
function km(a: Point, b: Point) {
  const r = Math.PI / 180;
  const x = (b.lon - a.lon) * r * Math.cos(((a.lat + b.lat) / 2) * r);
  const y = (b.lat - a.lat) * r;
  return Math.sqrt(x * x + y * y) * 6371;
}

function here(): Promise<Point | null> {
  return new Promise((resolve) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lon: p.coords.longitude }),
      () => resolve(null),
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 120000 },
    );
  });
}

/** From where you are, always the closest stop next. Stops the map can't find go at the end, in route order. */
function closestNext(start: Point | null, stops: { stop: Stop; at: Point | null }[]) {
  const left = stops.filter((s) => s.at);
  const order: Stop[] = [];
  let from = start ?? left[0]?.at ?? null;
  while (left.length && from) {
    let best = 0;
    for (let i = 1; i < left.length; i++) if (km(from, left[i].at!) < km(from, left[best].at!)) best = i;
    const [next] = left.splice(best, 1);
    order.push(next.stop);
    from = next.at;
  }
  return [...order, ...stops.filter((s) => !s.at).map((s) => s.stop)];
}

function googleRoute(stops: Stop[], mode: string, fromHere: boolean) {
  const list = stops.map((s) => s.address);
  const destination = list[list.length - 1];
  const p = new URLSearchParams({ api: "1", destination, travelmode: mode });
  if (!fromHere) p.set("origin", list[0]);
  const between = list.slice(fromHere ? 0 : 1, -1);
  if (between.length) p.set("waypoints", between.join("|"));
  return `https://www.google.com/maps/dir/?${p}`;
}
/**
 * The walk, cut into Google Maps links of at most 11 places each, every link starting where the
 * last one ended. Walking there too: the first link starts from where you are.
 */
function walkParts(order: Stop[], fromHere: boolean) {
  const PER_LINK = perLink();
  const parts: { stops: Stop[]; fromHere: boolean }[] = [];
  let i = 0;
  if (fromHere && order.length) {
    parts.push({ stops: order.slice(0, PER_LINK), fromHere: true });
    i = PER_LINK - 1;
  }
  for (; i < order.length - 1; i += PER_LINK) parts.push({ stops: order.slice(i, i + PER_LINK + 1), fromHere: false });
  return parts;
}
const appleTo = (address: string, way: Way) => `https://maps.apple.com/?${new URLSearchParams({ daddr: address, dirflg: APPLE_MODE[way] })}`;

/**
 * Directions for a route: get to the first stop by car, train or on foot, then walk from stop to
 * stop, closest next. Opens in Google Maps (the whole walk) or Apple Maps (one stop at a time).
 */
export function RouteDirections({ stops }: { stops: Stop[] }) {
  const [way, setWay] = useState<Way>("walk");
  const [busy, setBusy] = useState(false);
  const [plan, setPlan] = useState<{ order: Stop[]; located: boolean; missing: number } | null>(null);
  const withAddress = stops.filter((s) => s.address.trim());
  if (withAddress.length === 0) return null;

  async function makePlan() {
    setBusy(true);
    try {
      const [start, found] = await Promise.all([here(), Promise.all(withAddress.map(async (stop) => ({ stop, at: await findPlace(stop.address) })))]);
      setPlan({ order: closestNext(start, found), located: !!start, missing: found.filter((f) => !f.at).length });
    } finally {
      setBusy(false);
    }
  }

  const ways: { key: Way; label: string; icon: typeof Car }[] = [
    { key: "walk", label: t("Walk"), icon: Footprints },
    { key: "drive", label: t("Drive"), icon: Car },
    { key: "train", label: t("Train"), icon: TrainFront },
  ];
  const order = plan?.order ?? [];
  const parts = walkParts(order, way === "walk");
  const link = "inline-flex h-10 items-center gap-2 rounded-full px-4 text-sm font-medium transition hover:brightness-95";

  return (
    <Card>
      <CardTitle>{t("Directions")}</CardTitle>
      <div className="grid gap-4 px-6 pb-6">
        <div>
          <span className="block text-sm text-muted">{t("How are you getting to the first stop?")}</span>
          <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label={t("How are you getting to the first stop?")}>
            {ways.map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                type="button"
                aria-pressed={way === key}
                onClick={() => setWay(key)}
                className={cx("inline-flex h-9 items-center gap-2 rounded-full border px-4 text-sm font-medium transition-colors", way === key ? "border-transparent bg-accent text-accent-ink" : "border-outline text-ink hover:bg-ink/8")}
              >
                <Icon size={16} aria-hidden /> {label}
              </button>
            ))}
          </div>
          <span className="mt-2 block text-sm text-muted">{t("Between the stops, everyone walks.")}</span>
        </div>

        {!plan ? (
          <Button onClick={makePlan} disabled={busy} className="justify-self-start">
            <Navigation size={18} aria-hidden /> {busy ? t("Finding the best order…") : t("Plan my route")}
          </Button>
        ) : (
          <>
            <div>
              <span className="block text-sm text-muted">
                {plan.located ? t("From where you are, closest stop next:") : t("Closest stop next (turn on location to start from where you are):")}
              </span>
              <ol className="mt-2 grid gap-1">
                {order.map((s, i) => (
                  <li key={s.id} className="flex gap-2 text-sm">
                    <span className="tabular w-5 shrink-0 text-end font-semibold text-accent">{i + 1}.</span>
                    <span className="min-w-0">
                      <span className="font-medium">{s.name}</span> <span className="text-muted">· {s.address}</span>
                    </span>
                  </li>
                ))}
              </ol>
              {plan.missing > 0 && <span className="mt-2 block text-sm text-muted">{t("Couldn't find {n} of the addresses on the map, so they're at the end.", { n: plan.missing })}</span>}
            </div>

            <div className="grid gap-2">
              {way !== "walk" && (
                <div className="flex flex-wrap gap-2">
                  <a href={googleRoute([order[0]], GOOGLE_MODE[way], true)} target="_blank" rel="noopener noreferrer" className={cx(link, "bg-accent text-accent-ink")}>
                    {way === "drive" ? <Car size={16} aria-hidden /> : <TrainFront size={16} aria-hidden />} {t("Get to the first stop: Google Maps")}
                  </a>
                  <a href={appleTo(order[0].address, way)} target="_blank" rel="noopener noreferrer" className={cx(link, "bg-accent-soft text-accent-on-soft")}>
                    {t("Apple Maps")}
                  </a>
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                {parts.map((part, i) => (
                  <a key={i} href={googleRoute(part.stops, "walking", part.fromHere)} target="_blank" rel="noopener noreferrer" className={cx(link, "bg-accent text-accent-ink")}>
                    <Footprints size={16} aria-hidden />
                    {parts.length > 1 ? t("Walk the stops, part {n}: Google Maps", { n: i + 1 }) : way === "walk" ? t("Walk the whole route: Google Maps") : t("Walk the stops: Google Maps")}
                  </a>
                ))}
                <a href={appleTo(order[0].address, "walk")} target="_blank" rel="noopener noreferrer" className={cx(link, "bg-accent-soft text-accent-on-soft")}>
                  {way === "walk" ? t("Next stop: Apple Maps") : t("Next stop on foot: Apple Maps")}
                </a>
              </div>
              <span className="text-xs text-muted">{t("Apple Maps takes one stop at a time. Check off each stop here as you go, then plan again for the next one.")}</span>
            </div>
            <Button variant="ghost" onClick={makePlan} disabled={busy} className="h-9 justify-self-start px-3">
              {busy ? t("Finding the best order…") : t("Plan again from here")}
            </Button>
          </>
        )}
      </div>
    </Card>
  );
}

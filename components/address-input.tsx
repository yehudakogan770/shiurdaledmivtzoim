"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { MapPin } from "lucide-react";
import { useData } from "@/lib/data";
import { Input, cx } from "./ui";

/**
 * Address box with suggestions as you type, from OpenStreetMap's free
 * address search (Photon). No account or key is needed. Results stay inside
 * the area set on the Admin page (or the United States).
 */
const SEARCH_URL = "https://photon.komoot.io/api/";
const BIAS_KEY = "shiur-daled-mivtzoim:address-bias";

export interface AddressPick {
  address: string;
  /** The place's own name when it's a store, shul, office and so on. */
  placeName: string | null;
}

interface Suggestion extends AddressPick {
  line1: string;
  line2: string;
  lat: number;
  lon: number;
}

type PhotonFeature = {
  geometry: { coordinates: [number, number] };
  properties: Record<string, string | undefined>;
};

function toSuggestion(f: PhotonFeature): Suggestion | null {
  const p = f.properties;
  const street = [p.housenumber, p.street].filter(Boolean).join(" ");
  const town = p.district && p.city && p.district !== p.city ? p.district : p.city || p.town || p.village || p.county;
  const region = [p.state, p.postcode].filter(Boolean).join(" ");
  const place = p.name && p.name !== p.housenumber && p.name !== street ? p.name : null;
  const firstPart = street || place || p.name;
  if (!firstPart) return null;
  const address = [street || place || p.name, town, region].filter(Boolean).join(", ");
  return {
    address,
    placeName: place,
    line1: place || firstPart,
    line2: [place ? street : null, town, region, p.country].filter(Boolean).join(", "),
    lat: f.geometry.coordinates[1],
    lon: f.geometry.coordinates[0],
  };
}

function readBias(): { lat: number; lon: number } | null {
  try {
    const raw = localStorage.getItem(BIAS_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

type Area = { bbox: string; lat?: number; lon?: number };
const US: Area = { bbox: "-125,24,-66,50" };
const areaCache = new Map<string, Promise<Area>>();

/** Turn the admin's area ("Crown Heights, Brooklyn, NY") into a search box on the map. */
function resolveArea(area: string): Promise<Area> {
  const key = area.trim().toLowerCase();
  if (!key) return Promise.resolve(US);
  if (!areaCache.has(key)) {
    areaCache.set(
      key,
      (async () => {
        try {
          const stored = localStorage.getItem(`${BIAS_KEY}:area:${key}`);
          if (stored) return JSON.parse(stored) as Area;
        } catch {
          // Look it up again.
        }
        try {
          const res = await fetch(`${SEARCH_URL}?${new URLSearchParams({ q: area, limit: "1", lang: "en" })}`);
          const f = ((await res.json()) as { features: (PhotonFeature & { properties: { extent?: number[] } })[] }).features[0];
          if (!f) return US;
          const [lon, lat] = f.geometry.coordinates;
          const e = f.properties.extent as unknown as number[] | undefined;
          // At least ~15 km around the center, so nearby streets are included.
          const minLon = Math.min(e?.[0] ?? lon, lon - 0.18);
          const maxLat = Math.max(e?.[1] ?? lat, lat + 0.14);
          const maxLon = Math.max(e?.[2] ?? lon, lon + 0.18);
          const minLat = Math.min(e?.[3] ?? lat, lat - 0.14);
          const out: Area = { bbox: [minLon, minLat, maxLon, maxLat].map((n) => n.toFixed(4)).join(","), lat, lon };
          try {
            localStorage.setItem(`${BIAS_KEY}:area:${key}`, JSON.stringify(out));
          } catch {
            // Fine: it's looked up again next time.
          }
          return out;
        } catch {
          return US;
        }
      })(),
    );
  }
  return areaCache.get(key)!;
}

async function photon(params: Record<string, string>, signal: AbortSignal) {
  const res = await fetch(`${SEARCH_URL}?${new URLSearchParams({ lang: "en", ...params })}`, { signal });
  return ((await res.json()) as { features: PhotonFeature[] }).features;
}

/**
 * Suggestions for what was typed, inside the area. The free map doesn't have
 * every house number, so "412 Kingston Ave" also offers "412 Kingston Avenue"
 * built from the matching street.
 */
async function suggest(q: string, area: Area, signal: AbortSignal): Promise<Suggestion[]> {
  const near: Record<string, string> = { bbox: area.bbox };
  const bias = area.lat != null ? { lat: area.lat, lon: area.lon! } : readBias();
  if (bias) Object.assign(near, { lat: String(bias.lat), lon: String(bias.lon) });

  const m = q.match(/^(\d+[a-z]?)\s+(.{2,})$/i);
  const number = m?.[1];
  const [places, streets] = await Promise.all([
    photon({ q, limit: "10", ...near }, signal),
    // Building an address from a street only makes sense inside a known area.
    m && area.lat != null ? photon({ q: m[2], limit: "8", layer: "street", ...near }, signal) : Promise.resolve([] as PhotonFeature[]),
  ]);

  const exact: Suggestion[] = [];
  const others: Suggestion[] = [];
  for (const f of places) {
    // Without an area, stay in the United States (the search box also touches Canada and Mexico).
    if (area.lat == null && f.properties.countrycode && f.properties.countrycode !== "US") continue;
    const s = toSuggestion(f);
    if (!s) continue;
    const hn = f.properties.housenumber;
    if (number) {
      if (hn && hn.toLowerCase() === number.toLowerCase()) exact.push(s);
      else if (hn && hn.toLowerCase().startsWith(number.toLowerCase())) others.push(s);
      // Other house numbers on other streets don't match what was typed.
    } else {
      others.push(s);
    }
  }
  const built: Suggestion[] = [];
  if (number) {
    for (const f of streets) {
      const p = f.properties;
      if (!p.name) continue;
      const town = p.district && p.city && p.district !== p.city ? p.district : p.city || p.town || p.village || p.county;
      // No zip code here: long streets are split into pieces with different zip codes.
      const region = p.state ?? "";
      const street = `${number} ${p.name}`;
      built.push({
        address: [street, town, region].filter(Boolean).join(", "),
        placeName: null,
        line1: street,
        line2: [town, region, p.country].filter(Boolean).join(", "),
        lat: f.geometry.coordinates[1],
        lon: f.geometry.coordinates[0],
      });
    }
  }
  // When the map already has the exact address, drop the copy built from the street.
  const known = new Set([...exact, ...others].map((x) => x.line1.toLowerCase()));
  const extra = built.filter((x) => !known.has(x.line1.toLowerCase()));
  const seen = new Set<string>();
  return [...exact, ...extra, ...others].filter((s) => !seen.has(s.address.toLowerCase()) && !!seen.add(s.address.toLowerCase())).slice(0, 7);
}

export function AddressInput({
  id,
  value,
  onChange,
  onPick,
  placeholder,
}: {
  id: string;
  value: string;
  onChange(value: string): void;
  onPick?(pick: AddressPick): void;
  placeholder?: string;
}) {
  const listId = useId();
  const { settings } = useData();
  const area = settings.address_area;
  const [results, setResults] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [loading, setLoading] = useState(false);
  const typed = useRef(false);

  useEffect(() => {
    const q = value.trim();
    if (!typed.current || q.length < 3) {
      setResults([]);
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const list = await suggest(q, await resolveArea(area), controller.signal);
        setResults(list);
        setActive(-1);
        setOpen(true);
      } catch {
        // Offline or the search didn't answer: typing still works normally.
      } finally {
        setLoading(false);
      }
    }, 280);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [value, area]);

  function choose(s: Suggestion) {
    typed.current = false;
    onChange(s.address);
    onPick?.({ address: s.address, placeName: s.placeName });
    setOpen(false);
    setResults([]);
    try {
      localStorage.setItem(BIAS_KEY, JSON.stringify({ lat: s.lat, lon: s.lon }));
    } catch {
      // Suggestions just won't be biased toward this area next time.
    }
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (!open || results.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => (a + 1) % results.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => (a <= 0 ? results.length - 1 : a - 1));
    } else if (e.key === "Enter" && active >= 0) {
      e.preventDefault();
      choose(results[active]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  const showList = open && results.length > 0;

  return (
    <div className="relative">
      <Input
        id={id}
        value={value}
        autoComplete="off"
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={showList}
        aria-controls={listId}
        aria-activedescendant={showList && active >= 0 ? `${listId}-${active}` : undefined}
        placeholder={placeholder}
        onChange={(e) => {
          typed.current = true;
          onChange(e.target.value);
        }}
        onFocus={() => results.length > 0 && setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={onKeyDown}
      />
      {loading && <span className="pointer-events-none absolute top-1/2 right-4 -translate-y-1/2 text-xs text-muted">Searching…</span>}
      {showList && (
        <div className="absolute inset-x-0 top-full z-40 mt-1 overflow-hidden rounded-2xl bg-card shadow-pop">
          <ul id={listId} role="listbox" className="max-h-72 overflow-y-auto py-1">
            {results.map((s, i) => (
              <li
                key={s.address + i}
                id={`${listId}-${i}`}
                role="option"
                aria-selected={i === active}
                onMouseDown={(e) => {
                  e.preventDefault();
                  choose(s);
                }}
                onMouseEnter={() => setActive(i)}
                className={cx("flex cursor-pointer items-start gap-3 px-4 py-2.5", i === active && "bg-ink/5")}
              >
                <MapPin size={18} aria-hidden className="mt-0.5 shrink-0 text-muted" />
                <span className="min-w-0">
                  <span className="block truncate font-medium">{s.line1}</span>
                  {s.line2 && <span className="block truncate text-sm text-muted">{s.line2}</span>}
                </span>
              </li>
            ))}
          </ul>
          <p className="border-t border-line/60 px-4 py-1.5 text-right text-[11px] text-muted">Suggestions © OpenStreetMap</p>
        </div>
      )}
    </div>
  );
}

/** A plain link that opens the address in Google Maps (nothing is connected). */
export function googleMapsLink(address: string) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
}

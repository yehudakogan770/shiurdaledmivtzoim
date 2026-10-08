"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { MapPin } from "lucide-react";
import { Input, cx } from "./ui";
import { t } from "@/lib/i18n";

/**
 * Address box with suggestions as you type. Free by default: OpenStreetMap's address search
 * (Photon), with no account, key or card. With NEXT_PUBLIC_GOOGLE_MAPS_KEY set it uses Google
 * Places instead.
 */
const GOOGLE_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY || "";
const PHOTON_URL = "https://photon.komoot.io/api/";
/** The last address picked, so suggestions lean toward where people actually go. */
const BIAS_KEY = "shiur-daled-mivtzoim:address-bias";

export interface AddressPick {
  address: string;
  /** The place's own name when it's a store, shul, office and so on. */
  placeName: string | null;
}

interface Suggestion extends AddressPick {
  line1: string;
  line2: string;
  lat?: number;
  lon?: number;
}

type PhotonFeature = {
  geometry: { coordinates: [number, number] };
  properties: Record<string, string | undefined>;
};

function readPoint(key: string): { lat: number; lon: number } | null {
  try {
    const p = JSON.parse(localStorage.getItem(key) || "null");
    return typeof p?.lat === "number" && typeof p?.lon === "number" ? { lat: p.lat, lon: p.lon } : null;
  } catch {
    return null;
  }
}

/** Where to look first: the last address picked, else this device's location (from Shkiah), else Crown Heights. */
function nearPoint() {
  return readPoint(BIAS_KEY) ?? readPoint("sdm-location") ?? { lat: 40.6694, lon: -73.9422 };
}

function townOf(p: Record<string, string | undefined>) {
  return p.district && p.city && p.district !== p.city ? p.district : p.city || p.town || p.village || p.county;
}

function fromPhoton(f: PhotonFeature): Suggestion | null {
  const p = f.properties;
  const street = [p.housenumber, p.street].filter(Boolean).join(" ");
  const town = townOf(p);
  const region = [p.state, p.postcode].filter(Boolean).join(" ");
  const place = p.name && p.name !== p.housenumber && p.name !== street ? p.name : null;
  const firstPart = street || place || p.name;
  if (!firstPart) return null;
  return {
    address: [firstPart, town, region].filter(Boolean).join(", "),
    placeName: place,
    line1: place || firstPart,
    line2: [place ? street : null, town, region].filter(Boolean).join(", "),
    lat: f.geometry.coordinates[1],
    lon: f.geometry.coordinates[0],
  };
}

async function photon(params: Record<string, string>, signal: AbortSignal) {
  const res = await fetch(`${PHOTON_URL}?${new URLSearchParams({ lang: "en", ...params })}`, { signal });
  return ((await res.json()) as { features: PhotonFeature[] }).features;
}

/**
 * Free suggestions near where people go. The free map doesn't have every house number, so
 * "412 Kingston Ave" also offers "412 Kingston Avenue" built from the matching nearby street.
 */
async function photonSuggest(q: string, signal: AbortSignal): Promise<Suggestion[]> {
  const near = nearPoint();
  const box = [near.lon - 0.25, near.lat - 0.2, near.lon + 0.25, near.lat + 0.2].map((n) => n.toFixed(4)).join(",");
  const bias = { lat: String(near.lat), lon: String(near.lon) };
  const m = q.match(/^(\d+[a-z]?)\s+(.{2,})$/i);
  const number = m?.[1]?.toLowerCase();
  const [places, streets] = await Promise.all([
    photon({ q, limit: "12", ...bias }, signal),
    m ? photon({ q: m[2], limit: "6", layer: "street", bbox: box, ...bias }, signal) : Promise.resolve([] as PhotonFeature[]),
  ]);
  const exact: Suggestion[] = [];
  const others: Suggestion[] = [];
  for (const f of places) {
    if (f.properties.countrycode && f.properties.countrycode !== "US") continue;
    const sug = fromPhoton(f);
    if (!sug) continue;
    const hn = f.properties.housenumber?.toLowerCase();
    if (!number) others.push(sug);
    else if (hn === number) exact.push(sug);
    else if (hn?.startsWith(number)) others.push(sug);
  }
  const built: Suggestion[] = [];
  if (m) {
    for (const f of streets) {
      const p = f.properties;
      if (!p.name || (p.countrycode && p.countrycode !== "US")) continue;
      const street = `${m[1]} ${p.name}`;
      const town = townOf(p);
      built.push({
        address: [street, town, p.state].filter(Boolean).join(", "),
        placeName: null,
        line1: street,
        line2: [town, p.state].filter(Boolean).join(", "),
        lat: f.geometry.coordinates[1],
        lon: f.geometry.coordinates[0],
      });
    }
  }
  const known = new Set([...exact, ...others].map((x) => x.line1.toLowerCase()));
  // Closest first: the right house number nearby beats the same number in another state.
  const away = (x: Suggestion) => (x.lat == null || x.lon == null ? 1e9 : (x.lat - near.lat) ** 2 + (x.lon - near.lon) ** 2);
  const byDistance = (a: Suggestion, b: Suggestion) => away(a) - away(b);
  const seen = new Set<string>();
  return [...[...exact, ...built.filter((x) => !known.has(x.line1.toLowerCase()))].sort(byDistance), ...others.sort(byDistance)]
    .filter((x) => !seen.has(x.address.toLowerCase()) && !!seen.add(x.address.toLowerCase()))
    .slice(0, 6);
}

/* Minimal shapes of the Google Maps JavaScript API used here. */
type Prediction = {
  text: { toString(): string };
  mainText?: { toString(): string } | null;
  secondaryText?: { toString(): string } | null;
  types?: string[];
};
type PlacesLibrary = {
  AutocompleteSessionToken: new () => unknown;
  AutocompleteSuggestion: {
    fetchAutocompleteSuggestions(req: Record<string, unknown>): Promise<{ suggestions: { placePrediction?: Prediction | null }[] }>;
  };
};
type GoogleWindow = Window & {
  google?: { maps?: { importLibrary?: (name: string) => Promise<unknown> } };
  __sdmMapsLoading?: Promise<void>;
};

/** Load Google's Maps script once, then its Places library. */
function loadPlaces(): Promise<PlacesLibrary | null> {
  if (!GOOGLE_KEY || typeof window === "undefined") return Promise.resolve(null);
  const w = window as GoogleWindow;
  if (!w.__sdmMapsLoading) {
    w.__sdmMapsLoading = new Promise<void>((resolve, reject) => {
      if (w.google?.maps?.importLibrary) return resolve();
      const script = document.createElement("script");
      script.src = `https://maps.googleapis.com/maps/api/js?${new URLSearchParams({ key: GOOGLE_KEY, v: "weekly", loading: "async", libraries: "places" })}`;
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error("Google Maps didn't load"));
      document.head.appendChild(script);
    });
  }
  return w.__sdmMapsLoading
    .then(() => w.google!.maps!.importLibrary!("places") as Promise<PlacesLibrary>)
    .catch(() => null);
}

function toSuggestion(p: Prediction): Suggestion {
  const full = p.text.toString();
  const main = p.mainText?.toString() || full;
  const secondary = p.secondaryText?.toString() || "";
  const isPlace = (p.types ?? []).some((t) => t === "establishment" || t === "point_of_interest");
  // "770 Eastern Parkway, Brooklyn, NY, USA" → drop the country for a shorter address.
  const address = full.replace(/,\s*(USA|United States)$/, "");
  return {
    address: isPlace ? [main, secondary.replace(/,\s*(USA|United States)$/, "")].filter(Boolean).join(", ") : address,
    placeName: isPlace ? main : null,
    line1: main,
    line2: secondary,
  };
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
  const [results, setResults] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const typed = useRef(false);
  const session = useRef<unknown>(null);
  const [source, setSource] = useState<"google" | "osm">(GOOGLE_KEY ? "google" : "osm");

  useEffect(() => {
    const q = value.trim();
    if (!typed.current || q.length < 3) {
      setResults([]);
      return;
    }
    let cancelled = false;
    if (!GOOGLE_KEY) {
      const controller = new AbortController();
      const timer = setTimeout(async () => {
        try {
          const list = await photonSuggest(q, controller.signal);
          if (cancelled) return;
          setResults(list);
          setActive(-1);
          setOpen(true);
        } catch {
          // Offline or the search didn't answer: typing still works normally.
        }
      }, 300);
      return () => {
        cancelled = true;
        clearTimeout(timer);
        controller.abort();
      };
    }
    const timer = setTimeout(async () => {
      const controller = new AbortController();
      // Google didn't load or answer (for example its daily limit was reached): use the free search.
      const free = async () => {
        try {
          const list = await photonSuggest(q, controller.signal);
          if (cancelled) return;
          setResults(list);
          setActive(-1);
          setOpen(true);
        } catch {
          // Offline: typing still works normally.
        }
      };
      const places = await loadPlaces();
      if (cancelled) return;
      if (!places) {
        setSource("osm");
        return free();
      }
      try {
        // One session token per address typed keeps Google's billing to a single session.
        session.current ??= new places.AutocompleteSessionToken();
        const { suggestions } = await places.AutocompleteSuggestion.fetchAutocompleteSuggestions({
          input: q,
          sessionToken: session.current,
          includedRegionCodes: ["us"],
        });
        if (cancelled) return;
        setResults(suggestions.flatMap((x) => (x.placePrediction ? [toSuggestion(x.placePrediction)] : [])).slice(0, 6));
        setActive(-1);
        setOpen(true);
        setSource("google");
      } catch {
        setSource("osm");
        await free();
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [value]);

  function choose(s: Suggestion) {
    typed.current = false;
    session.current = null;
    onChange(s.address);
    onPick?.({ address: s.address, placeName: s.placeName });
    setOpen(false);
    setResults([]);
    if (s.lat != null && s.lon != null) {
      try {
        localStorage.setItem(BIAS_KEY, JSON.stringify({ lat: s.lat, lon: s.lon }));
      } catch {
        // Suggestions just won't lean toward this area next time.
      }
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
          {/* Each service asks to be credited next to its suggestions. */}
          <p className="border-t border-line/60 px-4 py-1.5 text-end text-[11px] text-muted">{source === "google" ? t("powered by Google") : t("Suggestions © OpenStreetMap")}</p>
        </div>
      )}
    </div>
  );
}

/** A plain link that opens the address in Google Maps. */
export function googleMapsLink(address: string) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
}

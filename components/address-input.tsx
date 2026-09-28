"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { MapPin } from "lucide-react";
import { Input, cx } from "./ui";

/**
 * Address box with suggestions as you type, from OpenStreetMap's free
 * address search (Photon). No account or key is needed.
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
        const params = new URLSearchParams({ q, limit: "6", lang: "en" });
        const bias = readBias();
        if (bias) {
          params.set("lat", String(bias.lat));
          params.set("lon", String(bias.lon));
        }
        const res = await fetch(`${SEARCH_URL}?${params}`, { signal: controller.signal });
        const json = (await res.json()) as { features: PhotonFeature[] };
        const seen = new Set<string>();
        const list = json.features
          .map(toSuggestion)
          .filter((s): s is Suggestion => !!s && !seen.has(s.address) && !!seen.add(s.address));
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
  }, [value]);

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

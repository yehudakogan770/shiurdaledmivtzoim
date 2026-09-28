"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { MapPin } from "lucide-react";
import { Input, cx } from "./ui";

/**
 * Address box with Google Maps suggestions as you type (Google Places).
 * Needs NEXT_PUBLIC_GOOGLE_MAPS_KEY; without it this is a plain text box.
 */
const GOOGLE_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY || "";

export interface AddressPick {
  address: string;
  /** The place's own name when it's a store, shul, office and so on. */
  placeName: string | null;
}

interface Suggestion extends AddressPick {
  line1: string;
  line2: string;
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

  useEffect(() => {
    const q = value.trim();
    if (!GOOGLE_KEY || !typed.current || q.length < 3) {
      setResults([]);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(async () => {
      const places = await loadPlaces();
      if (!places || cancelled) return;
      try {
        // One session token per address typed keeps Google's billing to a single session.
        session.current ??= new places.AutocompleteSessionToken();
        const { suggestions } = await places.AutocompleteSuggestion.fetchAutocompleteSuggestions({
          input: q,
          sessionToken: session.current,
          includedRegionCodes: ["us"],
        });
        if (cancelled) return;
        setResults(suggestions.flatMap((s) => (s.placePrediction ? [toSuggestion(s.placePrediction)] : [])).slice(0, 6));
        setActive(-1);
        setOpen(true);
      } catch {
        // Google didn't answer: typing still works normally.
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
        autoComplete={GOOGLE_KEY ? "off" : "street-address"}
        role={GOOGLE_KEY ? "combobox" : undefined}
        aria-autocomplete={GOOGLE_KEY ? "list" : undefined}
        aria-expanded={GOOGLE_KEY ? showList : undefined}
        aria-controls={GOOGLE_KEY ? listId : undefined}
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
          {/* Google requires its logo next to Places suggestions shown outside a Google map. */}
          <p className="border-t border-line/60 px-4 py-1.5 text-right text-[11px] text-muted">powered by Google</p>
        </div>
      )}
    </div>
  );
}

/** A plain link that opens the address in Google Maps. */
export function googleMapsLink(address: string) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
}

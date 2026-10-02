"use client";

import { useCallback, useEffect, useState } from "react";
import { GeoLocation, Zmanim } from "@hebcal/core";
import { addDays, parseDate, toISODate, today } from "./dates";

interface Place {
  lat: number;
  lon: number;
}

/** Until someone shares their location: 770 Eastern Parkway, Crown Heights. */
const CROWN_HEIGHTS: Place = { lat: 40.6694, lon: -73.9422 };
const CROWN_HEIGHTS_TZ = "America/New_York";
const STORE_KEY = "sdm-location";

function saved(): Place | null {
  try {
    const p = JSON.parse(localStorage.getItem(STORE_KEY) || "null");
    return typeof p?.lat === "number" && typeof p?.lon === "number" ? p : null;
  } catch {
    return null;
  }
}

/** Sunset this coming Friday (today, until sundown), where the person is. */
function fridayShkiah(place: Place, tz: string) {
  try {
    const gloc = new GeoLocation(null, place.lat, place.lon, 0, tz);
    const now = new Date();
    const friday = parseDate(addDays(today(), (5 - now.getDay() + 7) % 7));
    let sunset = new Zmanim(gloc, friday, false).shkiah();
    if (sunset.getTime() < now.getTime()) sunset = new Zmanim(gloc, parseDate(addDays(toISODate(friday), 7)), false).shkiah();
    if (Number.isNaN(sunset.getTime())) return null;
    const time = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", timeZone: tz }).format(sunset);
    const date = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: tz }).format(sunset);
    return { time, date };
  } catch {
    return null;
  }
}

/**
 * This Friday's shkiah for the person's location (asked from the browser, then
 * remembered on this device). Falls back to Crown Heights until they share it.
 */
export function useShkiah() {
  const [place, setPlace] = useState<Place | null>(null);
  const [ready, setReady] = useState(false);

  const locate = useCallback(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const p = { lat: pos.coords.latitude, lon: pos.coords.longitude };
        setPlace(p);
        try {
          localStorage.setItem(STORE_KEY, JSON.stringify(p));
        } catch {
          // Not saved on this device; it's asked again next visit.
        }
      },
      () => {},
      { maximumAge: 24 * 60 * 60 * 1000, timeout: 15000 },
    );
  }, []);

  useEffect(() => {
    setPlace(saved());
    setReady(true);
    locate();
  }, [locate]);

  if (!ready) return null;
  const tz = place ? Intl.DateTimeFormat().resolvedOptions().timeZone : CROWN_HEIGHTS_TZ;
  const result = fridayShkiah(place ?? CROWN_HEIGHTS, tz);
  if (!result) return null;
  return { ...result, located: !!place, locate };
}

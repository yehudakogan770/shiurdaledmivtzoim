"use client";

import { useCallback, useEffect, useState } from "react";
import { GeoLocation, Zmanim } from "@hebcal/core";
import { addDays, parseDate, toISODate, today } from "./dates";
import { locale } from "./i18n";

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
    const time = new Intl.DateTimeFormat(locale(), { hour: "numeric", minute: "2-digit", timeZone: tz }).format(sunset);
    const date = new Intl.DateTimeFormat(locale(), { month: "short", day: "numeric", timeZone: tz }).format(sunset);
    return { time, date };
  } catch {
    return null;
  }
}

/** Asked once already (whatever the answer): not asked again by itself. */
const ASKED_KEY = "sdm-location-asked";
/** When the location was last brought up to date. */
const CHECKED_KEY = "sdm-location-checked";
const REFRESH = 12 * 60 * 60 * 1000;

const store = {
  get: (k: string) => {
    try {
      return localStorage.getItem(k);
    } catch {
      return null;
    }
  },
  set: (k: string, v: string) => {
    try {
      localStorage.setItem(k, v);
    } catch {
      // Not saved on this device.
    }
  },
};

// The shkiah shows in more than one spot: they share one request instead of each asking.
let asking = false;
const listeners = new Set<(p: Place) => void>();

function requestLocation() {
  if (asking || typeof navigator === "undefined" || !navigator.geolocation) return;
  asking = true;
  store.set(ASKED_KEY, "1");
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      asking = false;
      const p = { lat: pos.coords.latitude, lon: pos.coords.longitude };
      store.set(STORE_KEY, JSON.stringify(p));
      store.set(CHECKED_KEY, String(Date.now()));
      listeners.forEach((l) => l(p));
    },
    () => {
      asking = false;
    },
    { maximumAge: REFRESH, timeout: 15000 },
  );
}

/** The phone already lets this site see the location, so checking won't pop up a question. */
async function alreadyAllowed() {
  try {
    return (await navigator.permissions?.query({ name: "geolocation" }))?.state === "granted";
  } catch {
    return false;
  }
}

/**
 * This Friday's shkiah for the person's location, remembered on this device. Phones (the
 * iPhone home-screen app most of all) often forget a website's location answer, so it's only
 * asked once by itself: after that the saved location is used, and only quietly refreshed when
 * the phone already allows it. Tapping the shkiah line asks again. Crown Heights until shared.
 */
export function useShkiah() {
  const [place, setPlace] = useState<Place | null>(null);
  const [ready, setReady] = useState(false);

  const locate = useCallback(() => requestLocation(), []);

  useEffect(() => {
    const have = saved();
    setPlace(have);
    setReady(true);
    listeners.add(setPlace);
    (async () => {
      if (await alreadyAllowed()) {
        if (!have || Date.now() - Number(store.get(CHECKED_KEY) || 0) > REFRESH) requestLocation();
      } else if (!have && !store.get(ASKED_KEY)) {
        requestLocation();
      }
    })();
    return () => {
      listeners.delete(setPlace);
    };
  }, []);

  if (!ready) return null;
  const tz = place ? Intl.DateTimeFormat().resolvedOptions().timeZone : CROWN_HEIGHTS_TZ;
  const result = fridayShkiah(place ?? CROWN_HEIGHTS, tz);
  if (!result) return null;
  return { ...result, located: !!place, locate };
}

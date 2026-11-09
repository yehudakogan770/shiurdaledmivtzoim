"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { HDate, Zmanim, type GeoLocation } from "@hebcal/core";
import { zmanimPlace } from "./shkiah";

/**
 * Chanukah on the site. From Friday 5am a week before the first candle, the site turns Chanukah
 * (purple night, gold candlelight) and counts down. Each night's earliest lighting time is nightfall
 * (tzeis); on Friday the candles go on before Shabbos (by candle-lighting time, 18 minutes before
 * shkiah), and on Motzei Shabbos when Shabbos ends.
 * After the last day the site goes back to normal by itself.
 *
 * The Owner (and accounts the Owner picks) can turn on test mode on their phone and see any moment
 * ahead of time. What they log in test mode is marked as a test, never counts, and is deleted when
 * test mode is turned off.
 */

export type ChanukahPhase = "off" | "countdown" | "eve" | "night";

export interface ChanukahState {
  phase: ChanukahPhase;
  /** 1–8 during Chanukah, else 0. */
  night: number;
  /** The Hebrew year, like 5787. */
  year: number;
  /** When each night's candles are lit (8 of them). */
  lightings: Date[];
  /** When the Chanukah look starts (Friday 5am the week before) and ends (after the last day). */
  start: Date;
  end: Date;
  /** The moment shown (the real time, or the test moment). */
  now: Date;
  /** Test mode is on (Owner or tester, on this phone). */
  testing: boolean;
}

const CANDLE_MINUTES = 18;
/** Nightfall (tzeis): the sun 6° below the horizon, as the Chabad calendar has it. */
const NIGHTFALL_ANGLE = 6;
/** When Shabbos ends: the sun 8.5° below the horizon, as the Chabad calendar has it. */
const SHABBOS_ENDS_ANGLE = 8.5;

const at = (d: Date, h: number, m = 0) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), h, m);
const plusDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);

/** The earliest time to light on the evening of this day (on Friday, the time to light by). */
export function lightingTime(day: Date, place: GeoLocation = zmanimPlace()): Date {
  const z = new Zmanim(place, day, false);
  const dow = day.getDay();
  if (dow === 5) return new Date(z.shkiah().getTime() - CANDLE_MINUTES * 60_000);
  if (dow === 6) return z.tzeit(SHABBOS_ENDS_ANGLE);
  return z.tzeit(NIGHTFALL_ANGLE);
}

/** Sunset today, for the Day / Night switch. */
export function isNightNow(now = new Date(), place: GeoLocation = zmanimPlace()) {
  const z = new Zmanim(place, now, false);
  return now >= z.shkiah() || now < z.sunrise();
}

/** The Chanukah of the Hebrew year we're in (it always comes after Rosh Hashana). */
export function chanukahDates(year: number, place: GeoLocation = zmanimPlace()) {
  const firstDay = new HDate(25, "Kislev", year).greg();
  const firstNight = plusDays(firstDay, -1);
  const lightings = Array.from({ length: 8 }, (_, i) => lightingTime(plusDays(firstNight, i), place));
  // The Friday on or before the first night, a week earlier, at 5am.
  const friday = plusDays(firstNight, -((firstNight.getDay() - 5 + 7) % 7));
  const start = at(plusDays(friday, -7), 5);
  const eve = at(firstNight, 5);
  const end = lightingTime(plusDays(firstNight, 8), place);
  return { firstNight, lightings, start, eve, end };
}

export function chanukahAt(now: Date, testing = false, place: GeoLocation = zmanimPlace()): ChanukahState {
  const year = new HDate(now).getFullYear();
  const { lightings, start, eve, end } = chanukahDates(year, place);
  let phase: ChanukahPhase = "off";
  let night = 0;
  if (now >= start && now < end) {
    if (now < eve) phase = "countdown";
    else if (now < lightings[0]) phase = "eve";
    else {
      phase = "night";
      night = lightings.filter((l) => now >= l).length;
    }
  }
  return { phase, night, year, lightings, start, end, now, testing };
}

// ---- Test mode: a moment picked on this phone ----

/** "countdown", "eve", "night-1" … "night-8", or "" for off. */
export type TestMoment = "" | "countdown" | "eve" | `night-${number}`;
export const TEST_MOMENTS: TestMoment[] = ["countdown", "eve", ...Array.from({ length: 8 }, (_, i) => `night-${i + 1}` as TestMoment)];
const TEST_KEY = "sdm-chanukah-test";
const listeners = new Set<() => void>();

function readTest(): TestMoment {
  try {
    const v = localStorage.getItem(TEST_KEY) || "";
    return (TEST_MOMENTS as string[]).includes(v) ? (v as TestMoment) : "";
  } catch {
    return "";
  }
}

export function setTestMoment(m: TestMoment) {
  try {
    if (m) localStorage.setItem(TEST_KEY, m);
    else localStorage.removeItem(TEST_KEY);
  } catch {
    // Test mode isn't remembered on this phone.
  }
  listeners.forEach((l) => l());
}

export function useTestMoment(): TestMoment {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    readTest,
    () => "",
  );
}

/** The time to show for a test moment: partway through the countdown, the morning before, or an hour after a night's lighting. */
export function testTime(m: TestMoment, place: GeoLocation = zmanimPlace()): Date {
  const year = new HDate(new Date()).getFullYear();
  // Already past this year's Chanukah: test next year's.
  const past = new Date() >= chanukahDates(year, place).end;
  return testTimeFor(past ? year + 1 : year, m, place);
}

function testTimeFor(year: number, m: TestMoment, place: GeoLocation): Date {
  const { start, firstNight, lightings } = chanukahDates(year, place);
  if (m === "countdown") return new Date(start.getTime() + 2 * 86_400_000 + 7 * 3_600_000);
  if (m === "eve") return at(firstNight, 11);
  const n = Number(m.split("-")[1]) || 1;
  return new Date(lightings[n - 1].getTime() + 60 * 60_000);
}

/**
 * Chanukah right now, updated every 20 seconds. `allowed` is whether this account may use test
 * mode (the Owner or a tester); anyone else always sees the real time.
 */
export function useChanukah(allowed: boolean): ChanukahState {
  const test = useTestMoment();
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setTick((n) => n + 1), 20_000);
    return () => clearInterval(timer);
  }, []);
  void tick;
  const testing = allowed && !!test;
  const now = testing ? testTime(test) : new Date();
  return chanukahAt(now, testing);
}

export const isChanukahOn = (s: ChanukahState) => s.phase !== "off";

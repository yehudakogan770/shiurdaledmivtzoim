"use client";

import { useEffect, useState } from "react";

/**
 * Opens the "Who went?" pop-up for a week from anywhere: the Yes on Home, or logging a Mivtza
 * before answering the week's question. The pop-up itself is shown once, by the app shell.
 */
const EVENT = "sdm-who-went";
let current: string | null = null;

export function askWhoWent(week: string | null) {
  current = week;
  window.dispatchEvent(new Event(EVENT));
}

/** The week the pop-up is open for, or null. */
export function useWhoWentWeek() {
  const [week, setWeek] = useState<string | null>(current);
  useEffect(() => {
    const update = () => setWeek(current);
    update();
    window.addEventListener(EVENT, update);
    return () => window.removeEventListener(EVENT, update);
  }, []);
  return week;
}

"use client";

import { useEffect, useState } from "react";

/**
 * The account desk: the Owner's device handed to someone so they can make their own account.
 * While it's on, the device shows only the sign-up form; leaving it takes the Owner's password.
 * Remembered on this device, so reloading the page doesn't open the Owner screens.
 */
const KEY = "sdm-account-desk";
const EVENT = "sdm-account-desk";

function read() {
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

export function setAccountDesk(on: boolean) {
  try {
    if (on) localStorage.setItem(KEY, "1");
    else localStorage.removeItem(KEY);
  } catch {
    // Not remembered on this device; it still works until the page reloads.
  }
  window.dispatchEvent(new Event(EVENT));
}

export function useAccountDesk() {
  const [on, setOn] = useState(false);
  useEffect(() => {
    const update = () => setOn(read());
    update();
    window.addEventListener(EVENT, update);
    window.addEventListener("storage", update);
    return () => {
      window.removeEventListener(EVENT, update);
      window.removeEventListener("storage", update);
    };
  }, []);
  return on;
}

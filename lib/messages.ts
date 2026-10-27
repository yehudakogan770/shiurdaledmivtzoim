import type { Activity } from "./types";

/**
 * A message from the Owner to one account, shown to that person as a pop-up the next time they
 * open the site. Like the week's question, it's saved as a hidden entry among that account's
 * Mivtzoim entries (counting 0), so it needs no database update. The person's own "OK" deletes
 * it. The site takes these entries out as soon as it loads, so they're never counted.
 */
const MARK = "sdm-message:";

export interface Message {
  id: string;
  user_id: string;
  text: string;
  /** Where the button takes them, one of DESTINATIONS' keys; empty for just "OK". */
  go: string;
  created_at: string;
}

/** The places a message's button can take someone. */
export const DESTINATIONS: { key: string; label: string; button: string; href: string }[] = [
  { key: "", label: "No button (just OK)", button: "", href: "" },
  { key: "chavrusas", label: "Edit Chavrusas", button: "Edit my Chavrusas", href: "/profile?edit=chavrusas" },
  { key: "profile", label: "Profile", button: "Open my Profile", href: "/profile" },
  { key: "home", label: "Log Mivtzoim (Home)", button: "Log my Mivtzoim", href: "/" },
  { key: "photos", label: "Add photos", button: "Add photos", href: "/photos" },
  { key: "routes", label: "Routes", button: "Open my Routes", href: "/routes" },
];

export function isMessage(a: Pick<Activity, "notes">) {
  return !!a.notes?.startsWith(MARK);
}

export function readMessage(a: Activity): Message | null {
  try {
    const v = JSON.parse(a.notes!.slice(MARK.length));
    if (typeof v.text !== "string" || !v.text.trim()) return null;
    return { id: a.id, user_id: a.user_id, text: v.text, go: typeof v.go === "string" ? v.go : "", created_at: a.created_at };
  } catch {
    return null;
  }
}

/** The entry's fields for a message to this account. */
export function messageEntry(user_id: string, text: string, go: string, date: string) {
  return {
    user_id,
    group_id: null,
    route_id: null,
    location_id: null,
    category_type: "personal" as const,
    personal_category_id: null,
    quantity: 0,
    notes: MARK + JSON.stringify({ text: text.trim(), go }),
    activity_date: date,
  };
}

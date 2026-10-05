import { t } from "../i18n";
import type { LocationCard, PersonalCategory, Photo, Profile, SignUpInput, SiteSettings, TableName, Tables } from "../types";

/**
 * Where the app keeps its data. The UI talks only to this interface, so the
 * same screens run on Supabase (the hosted website), inside a Claude artifact
 * (shared with everyone the artifact is shared with), or on one device.
 */
export interface Backend {
  kind: "supabase" | "claude" | "local";
  /** Short description shown on the Profile page. */
  storageLabel: string;
  /** false when identity comes from the host and there is no sign-in form. */
  hasAuth: boolean;

  currentUser(): Promise<Profile | null>;
  signIn(username: string, password: string): Promise<void>;
  /** needsConfirmation: a confirmation link was emailed and must be clicked before signing in. */
  signUp(input: SignUpInput): Promise<{ needsConfirmation: boolean }>;
  signOut(): Promise<void>;
  updateProfile(patch: { name: string; partners: string[] }): Promise<void>;
  /** Emails a link to set a new password; the email also reminds them of their username. */
  requestPasswordReset(email: string): Promise<void>;
  /** Sets a new password after arriving from the reset link (or from Profile, after checkPassword). */
  updatePassword(password: string): Promise<void>;
  /** Throws unless this is the signed-in person's current password. */
  verifyPassword(password: string): Promise<void>;
  /** Change the username people sign in with. */
  changeUsername(username: string): Promise<void>;
  /** Change the email address; needsConfirmation when a link was sent to the new address first. */
  changeEmail(email: string): Promise<{ needsConfirmation: boolean }>;
  /** Called when the page was opened from a password-reset link. */
  onPasswordRecovery(cb: () => void): void;

  list<T extends TableName>(table: T): Promise<Tables[T][]>;
  insert<T extends TableName>(table: T, row: Omit<Tables[T], "id" | "created_at"> & { id?: string }): Promise<Tables[T]>;
  update<T extends TableName>(table: T, id: string, patch: Partial<Tables[T]>): Promise<void>;
  remove(table: TableName, id: string): Promise<void>;

  joinGroup(code: string): Promise<string>;
  /** Display names for people referenced in the data. */
  names(ids: string[]): Promise<Record<string, string>>;

  /** Website text; readable before sign-in. */
  getSettings(): Promise<Partial<SiteSettings>>;
  /** Admins only. */
  saveSettings(settings: SiteSettings): Promise<void>;
  /** Admins only: make someone an admin or a regular user. */
  setRole(userId: string, role: "user" | "admin"): Promise<void>;
  /** Every account (admins only; others get just the people they share a group with). */
  listPeople(): Promise<Profile[]>;
  /** Admins only: give someone who forgot their password a new one. */
  adminSetPassword(userId: string, password: string): Promise<void>;
  /** Admins only: change someone's name, username, email and chavrusas. */
  adminUpdatePerson(userId: string, patch: PersonPatch): Promise<void>;
  /** Admins only: delete an account and everything in it. */
  adminDeletePerson(userId: string): Promise<void>;
  /**
   * Everyone's entries between two dates, without names (for the totals strip).
   * Only where the backend can't already see everyone's entries; null if unavailable.
   */
  communityActivity?(from: string, to: string): Promise<CommunityRow[] | null>;
  /** The mivtzoim everyone shares (names, icons, order), readable without an account for the sample. */
  sharedMivtzoim?(): Promise<PersonalCategory[]>;
  /** Everyone's photos, newest first (anyone can see them, even without an account). */
  listPhotos?(): Promise<Photo[]>;
  /** Save one photo (already made smaller) and its preview. */
  uploadPhoto?(full: Blob, thumb: Blob, info: { width: number; height: number; color?: string }): Promise<Photo>;
  /** The person who shared it, or an admin. */
  deletePhoto?(photo: Photo): Promise<void>;
  /** Save the language this account sees the site in. */
  setLanguage?(language: string): Promise<void>;
  /** Business card details this account may see: its own, or everyone's for the Owner. */
  listCards?(): Promise<LocationCard[]>;
  /** Save a place's card details; `image` replaces the card picture, `null` removes it, leaving it out keeps it. */
  saveCard?(card: Omit<LocationCard, "image_path" | "imageUrl" | "updated_at">, image?: Blob | null): Promise<void>;
}

/**
 * When the database doesn't let this account change something (it may have been deleted meanwhile).
 * Thrown in English on purpose, so `err.message === NOT_ALLOWED` keeps working in every language;
 * it's a dictionary key, so show it with t(err.message).
 */
export const NOT_ALLOWED = "That didn't save: this account isn't allowed to change it, or it was already deleted.";

export interface CommunityRow {
  activity_date: string;
  created_at: string;
  category_type: "tefillin" | "shabbos_candles" | "personal";
  personal_category_id: string | null;
  quantity: number;
  /** true for the signed-in person's own entries */
  mine: boolean;
}

export interface PersonPatch {
  name: string;
  username: string;
  email: string;
  partners: string[];
}

export function newId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return "id-" + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Usernames: 3–20 lowercase letters, numbers, dots, dashes or underscores. */
export function normalizeUsername(raw: string) {
  const u = raw.trim().toLowerCase().replace(/^@/, "");
  if (!/^[a-z0-9._-]{3,20}$/.test(u)) {
    throw new Error(t("Usernames are 3 to 20 characters: letters, numbers, dots, dashes or underscores."));
  }
  return u;
}

/** Lowercased sign-in name for lookups (no validation). */
export function loginKey(raw: string) {
  return raw.trim().toLowerCase().replace(/^@/, "");
}

export function checkEmail(raw: string) {
  const e = raw.trim().toLowerCase();
  if (!EMAIL_RE.test(e)) throw new Error(t("Enter a real email address. We send a confirmation link to it."));
  return e;
}

export function checkPassword(password: string) {
  if (password.length < 6) throw new Error(t("Passwords need at least 6 characters."));
}

export function newJoinCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

export async function pickBackend(): Promise<Backend> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (url && key) {
    const { createSupabaseBackend } = await import("./supabase");
    return createSupabaseBackend(url, key);
  }
  const claude = typeof window !== "undefined" ? (window as unknown as { claude?: { use?: unknown } }).claude : undefined;
  if (claude && typeof claude.use === "function") {
    const { createClaudeBackend } = await import("./claude");
    const backend = await createClaudeBackend();
    if (backend) return backend;
  }
  const { createLocalBackend } = await import("./local");
  return createLocalBackend();
}

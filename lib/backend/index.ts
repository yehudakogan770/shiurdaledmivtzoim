import type { Profile, TableName, Tables } from "../types";

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
  signUp(name: string, username: string, password: string): Promise<{ needsConfirmation: boolean }>;
  signOut(): Promise<void>;
  updateProfile(patch: { name: string }): Promise<void>;

  list<T extends TableName>(table: T): Promise<Tables[T][]>;
  insert<T extends TableName>(table: T, row: Omit<Tables[T], "id" | "created_at"> & { id?: string }): Promise<Tables[T]>;
  update<T extends TableName>(table: T, id: string, patch: Partial<Tables[T]>): Promise<void>;
  remove(table: TableName, id: string): Promise<void>;

  joinGroup(code: string): Promise<string>;
  /** Display names for people referenced in the data. */
  names(ids: string[]): Promise<Record<string, string>>;
}

export function newId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return "id-" + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

/** Usernames: 3–20 lowercase letters, numbers, dots, dashes or underscores. */
export function normalizeUsername(raw: string) {
  const u = raw.trim().toLowerCase().replace(/^@/, "");
  if (!/^[a-z0-9._-]{3,20}$/.test(u)) {
    throw new Error("Usernames are 3 to 20 characters: letters, numbers, dots, dashes or underscores.");
  }
  return u;
}

export function checkPassword(password: string) {
  if (password.length < 6) throw new Error("Passwords need at least 6 characters.");
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

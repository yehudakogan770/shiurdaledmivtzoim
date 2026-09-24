import { displayName, type Profile, type SiteSettings, type TableName, type Tables } from "../types";
import { isAdminIdentifier } from "../admin";
import { checkEmail, checkPassword, loginKey, newId, normalizeUsername, type Backend } from "./index";

const KEY = "shiur-daled-mivtzoim:v1";

type LocalProfile = Profile & { password_hash?: string };
type Store = { [K in Exclude<TableName, "profiles">]: Tables[K][] } & { profiles: LocalProfile[]; session: string | null; settings: Partial<SiteSettings> };

/** Salted SHA-256 so passwords are never stored as plain text. */
async function hashPassword(password: string, salt: string) {
  const data = new TextEncoder().encode(`${salt}:${password}`);
  if (typeof crypto !== "undefined" && crypto.subtle) {
    const digest = await crypto.subtle.digest("SHA-256", data);
    return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
  }
  let h = 5381;
  for (const b of data) h = ((h << 5) + h + b) >>> 0;
  return "djb2-" + h.toString(16);
}

function empty(): Store {
  return {
    session: null,
    settings: {},
    profiles: [],
    groups: [],
    group_members: [],
    routes: [],
    locations: [],
    route_locations: [],
    personal_categories: [],
    mivtzoim_activity: [],
  };
}

function load(): Store {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...empty(), ...JSON.parse(raw) };
  } catch {
    // Storage blocked or corrupt: start fresh in memory.
  }
  return memory ?? (memory = empty());
}

let memory: Store | null = null;

function roleOf(p: LocalProfile): "user" | "admin" {
  return isAdminIdentifier(p.email) || isAdminIdentifier(p.username) || p.role === "admin" ? "admin" : "user";
}

function publicProfile(p: LocalProfile): Profile {
  return { id: p.id, name: p.name, username: p.username, email: p.email ?? null, partners: p.partners ?? [], role: roleOf(p) };
}

function requireAdmin(s: Store) {
  const me = s.profiles.find((x) => x.id === s.session);
  if (!me || roleOf(me) !== "admin") throw new Error("Only an admin can do that.");
}

function save(store: Store) {
  memory = store;
  try {
    localStorage.setItem(KEY, JSON.stringify(store));
  } catch {
    // Keep working from memory when storage is unavailable.
  }
}

/** Data saved in this browser only. Used when no server is configured. */
export function createLocalBackend(): Backend {
  return {
    kind: "local",
    storageLabel: "Saved in this browser on this device only.",
    hasAuth: true,

    async currentUser() {
      const s = load();
      const p = s.profiles.find((x) => x.id === s.session);
      return p ? publicProfile(p) : null;
    },
    async signIn(rawUsername, password) {
      const username = loginKey(rawUsername);
      const s = load();
      const p = s.profiles.find((x) => x.username === username);
      if (!p || !p.password_hash || p.password_hash !== (await hashPassword(password, p.id))) {
        throw new Error("That username and password don't match.");
      }
      s.session = p.id;
      save(s);
    },
    async signUp({ name, partners, username: rawUsername, email: rawEmail, password }) {
      const username = normalizeUsername(rawUsername);
      const email = checkEmail(rawEmail);
      checkPassword(password);
      const s = load();
      if (s.profiles.some((x) => x.username === username)) throw new Error("That username is taken. Try another.");
      if (s.profiles.some((x) => x.email === email)) throw new Error("That email already has an account.");
      const id = newId();
      s.profiles.push({ id, name: name.trim(), partners, username, email, password_hash: await hashPassword(password, id) });
      s.session = id;
      save(s);
      return { needsConfirmation: false };
    },
    async signOut() {
      const s = load();
      s.session = null;
      save(s);
    },
    async updateProfile({ name, partners }) {
      const s = load();
      const p = s.profiles.find((x) => x.id === s.session);
      if (p) Object.assign(p, { name, partners });
      save(s);
    },
    async requestPasswordReset() {
      throw new Error("Password reset by email works once the site is connected to its online database. Until then, ask the admin for help.");
    },
    async updatePassword(password) {
      checkPassword(password);
      const s = load();
      const p = s.profiles.find((x) => x.id === s.session);
      if (p) p.password_hash = await hashPassword(password, p.id);
      save(s);
    },
    onPasswordRecovery() {},

    async list(table) {
      if (table === "profiles") return load().profiles.map(publicProfile) as Tables[typeof table][];
      return [...load()[table]] as unknown as Tables[typeof table][];
    },
    async insert(table, row) {
      const s = load();
      const full = { created_at: new Date().toISOString(), ...row, id: row.id ?? newId() } as unknown as Tables[typeof table];
      (s[table] as unknown[]).push(full);
      save(s);
      return full;
    },
    async update(table, id, patch) {
      const s = load();
      const list = s[table] as { id: string }[];
      const i = list.findIndex((r) => r.id === id);
      if (i >= 0) list[i] = { ...list[i], ...patch };
      save(s);
    },
    async remove(table, id) {
      const s = load();
      (s as unknown as Record<string, { id: string }[]>)[table] = (s[table] as { id: string }[]).filter((r) => r.id !== id);
      save(s);
    },

    async joinGroup(code) {
      const s = load();
      const g = s.groups.find((x) => x.join_code === code.trim().toUpperCase());
      if (!g) throw new Error("No group has that code.");
      if (!s.group_members.some((m) => m.group_id === g.id && m.user_id === s.session)) {
        s.group_members.push({
          id: newId(),
          group_id: g.id,
          user_id: s.session!,
          member_role: "member",
          joined_at: new Date().toISOString(),
        });
        save(s);
      }
      return g.id;
    },
    async names(ids) {
      const s = load();
      const out: Record<string, string> = {};
      for (const id of ids) {
        const p = s.profiles.find((x) => x.id === id);
        out[id] = p ? displayName(p) : "Someone";
      }
      return out;
    },

    async getSettings() {
      return load().settings;
    },
    async saveSettings(settings) {
      const s = load();
      requireAdmin(s);
      s.settings = settings;
      save(s);
    },
    async setRole(userId, role) {
      const s = load();
      requireAdmin(s);
      const p = s.profiles.find((x) => x.id === userId);
      if (p) p.role = role;
      save(s);
    },
    async listPeople() {
      return load().profiles.map(publicProfile);
    },
  };
}

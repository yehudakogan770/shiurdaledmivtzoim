import type { Profile, TableName, Tables } from "../types";
import { newId, type Backend } from "./index";

const KEY = "shiur-daled-mivtzoim:v1";

type Store = { [K in TableName]: Tables[K][] } & { session: string | null };

function empty(): Store {
  return {
    session: null,
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
    usesPassword: false,

    async currentUser() {
      const s = load();
      return s.profiles.find((p) => p.id === s.session) ?? null;
    },
    async signIn(email) {
      const s = load();
      const p = s.profiles.find((x) => x.email?.toLowerCase() === email.trim().toLowerCase());
      if (!p) throw new Error("No account with that email on this device. Create one instead.");
      s.session = p.id;
      save(s);
    },
    async signUp(name, email) {
      const s = load();
      const existing = s.profiles.find((x) => x.email?.toLowerCase() === email.trim().toLowerCase());
      if (existing) {
        s.session = existing.id;
      } else {
        const p: Profile = { id: newId(), name: name.trim(), email: email.trim() };
        s.profiles.push(p);
        s.session = p.id;
      }
      save(s);
      return { needsConfirmation: false };
    },
    async signOut() {
      const s = load();
      s.session = null;
      save(s);
    },
    async updateProfile({ name }) {
      const s = load();
      const p = s.profiles.find((x) => x.id === s.session);
      if (p) p.name = name;
      save(s);
    },

    async list(table) {
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
      for (const id of ids) out[id] = s.profiles.find((p) => p.id === id)?.name || "Someone";
      return out;
    },
  };
}

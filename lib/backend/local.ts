import { displayName, type LocationCard, type Photo, type Profile, type SiteSettings, type TableName, type Tables } from "../types";
import { t } from "../i18n";
import { isAdminIdentifier } from "../admin";
import { checkEmail, checkPassword, loginKey, newId, normalizeUsername, type Backend } from "./index";

const KEY = "shiur-daled-mivtzoim:v1";

type LocalProfile = Profile & { password_hash?: string };
type Store = { [K in Exclude<TableName, "profiles">]: Tables[K][] } & {
  profiles: LocalProfile[];
  session: string | null;
  settings: Partial<SiteSettings>;
  /** Photos kept as small data URLs, only on this device. */
  photos?: (Photo & { data: string; thumbData: string })[];
  /** Business card details, with the card picture as a data URL. */
  cards?: (LocationCard & { data?: string | null })[];
};

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
  return { id: p.id, name: p.name, username: p.username, email: p.email ?? null, partners: p.partners ?? [], role: roleOf(p), language: p.language ?? null };
}

function requireAdmin(s: Store) {
  const me = s.profiles.find((x) => x.id === s.session);
  if (!me || roleOf(me) !== "admin") throw new Error(t("Only an admin can do that."));
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
    get storageLabel() {
      return t("Saved in this browser on this device only.");
    },
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
        throw new Error(t("That username and password don't match."));
      }
      s.session = p.id;
      save(s);
    },
    async signUp({ name, partners, username: rawUsername, email: rawEmail, password, language }) {
      const username = normalizeUsername(rawUsername);
      const email = checkEmail(rawEmail);
      checkPassword(password);
      const s = load();
      if (s.profiles.some((x) => x.username === username)) throw new Error(t("That username is taken. Try another."));
      if (s.profiles.some((x) => x.email === email)) throw new Error(t("That email already has an account."));
      const id = newId();
      s.profiles.push({ id, name: name.trim(), partners, username, email, language: language || "en", password_hash: await hashPassword(password, id) });
      s.session = id;
      save(s);
      return { needsConfirmation: false };
    },
    async signOut() {
      const s = load();
      s.session = null;
      save(s);
    },
    async setLanguage(language) {
      const s = load();
      const p = s.profiles.find((x) => x.id === s.session);
      if (p) p.language = language;
      save(s);
    },
    async updateProfile({ name, partners }) {
      const s = load();
      const p = s.profiles.find((x) => x.id === s.session);
      if (p) Object.assign(p, { name, partners });
      save(s);
    },
    async requestPasswordReset() {
      throw new Error(t("Password reset by email works once the site is connected to its online database. Until then, ask the admin for help."));
    },
    async updatePassword(password) {
      checkPassword(password);
      const s = load();
      const p = s.profiles.find((x) => x.id === s.session);
      if (p) p.password_hash = await hashPassword(password, p.id);
      save(s);
    },
    onPasswordRecovery() {},
    async verifyPassword(password) {
      const s = load();
      const p = s.profiles.find((x) => x.id === s.session);
      if (!p || p.password_hash !== (await hashPassword(password, p.id))) throw new Error(t("Your current password isn't right."));
    },
    async changeUsername(raw) {
      const username = normalizeUsername(raw);
      const s = load();
      if (s.profiles.some((x) => x.id !== s.session && x.username === username)) throw new Error(t("That username is taken. Try another."));
      const p = s.profiles.find((x) => x.id === s.session);
      if (p) p.username = username;
      save(s);
    },
    async changeEmail(raw) {
      const email = checkEmail(raw);
      const s = load();
      if (s.profiles.some((x) => x.id !== s.session && x.email === email)) throw new Error(t("That email already has an account."));
      const p = s.profiles.find((x) => x.id === s.session);
      if (p) p.email = email;
      save(s);
      return { needsConfirmation: false };
    },

    async listCards() {
      const s = load();
      const me = s.profiles.find((x) => x.id === s.session);
      if (!me) return [];
      const owner = isAdminIdentifier(me.email) || isAdminIdentifier(me.username);
      return (s.cards ?? []).filter((c) => owner || c.user_id === me.id).map(({ data, ...c }) => ({ ...c, imageUrl: data ?? null }));
    },
    async saveCard(card, image) {
      const s = load();
      const me = s.profiles.find((x) => x.id === s.session);
      const owner = !!me && (isAdminIdentifier(me.email) || isAdminIdentifier(me.username));
      const loc = s.locations.find((l) => l.id === card.location_id);
      if (!me || !loc || loc.created_by !== card.user_id || (card.user_id !== me.id && !owner)) throw new Error(t("Only the person whose route it is can change this."));
      const asData = (b: Blob) => new Promise<string>((res) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.readAsDataURL(b); });
      const old = (s.cards ?? []).find((c) => c.location_id === card.location_id);
      const data = image === undefined ? old?.data ?? null : image ? await asData(image) : null;
      const fresh = load();
      fresh.cards = [
        ...(fresh.cards ?? []).filter((c) => c.location_id !== card.location_id),
        { ...card, image_path: data ? `${card.user_id}/${card.location_id}` : null, updated_at: new Date().toISOString(), data },
      ];
      save(fresh);
    },
    async listPhotos() {
      return [...(load().photos ?? [])].sort((a, b) => b.created_at.localeCompare(a.created_at)).map(({ data, thumbData, ...p }) => ({ ...p, url: data, thumbUrl: thumbData }));
    },
    async uploadPhoto(full, thumb, info) {
      const s = load();
      if (!s.session) throw new Error(t("Please sign in first."));
      const asData = (b: Blob) => new Promise<string>((res) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.readAsDataURL(b); });
      const id = newId();
      const photo = { id, user_id: s.session, path: `${id}`, thumb_path: `${id}-thumb`, width: info.width, height: info.height, color: info.color ?? null, bytes: full.size + thumb.size, created_at: new Date().toISOString() };
      const [data, thumbData] = await Promise.all([asData(full), asData(thumb)]);
      const fresh = load(); // another upload may have saved while this one was reading the file
      fresh.photos = [...(fresh.photos ?? []), { ...photo, data, thumbData }];
      save(fresh);
      return { ...photo, url: data, thumbUrl: thumbData };
    },
    async deletePhoto(photo) {
      const s = load();
      const me = s.profiles.find((x) => x.id === s.session);
      if (!me || (photo.user_id !== me.id && roleOf(me) !== "admin")) throw new Error(t("Only the person who shared it, or an admin, can delete it."));
      s.photos = (s.photos ?? []).filter((p) => p.id !== photo.id);
      save(s);
    },
    async sharedMivtzoim() {
      return load().personal_categories.filter((c) => c.shared);
    },
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
      if (!g) throw new Error(t("No group has that code."));
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
    async adminSetPassword(userId, password) {
      checkPassword(password);
      const s = load();
      requireAdmin(s);
      const p = s.profiles.find((x) => x.id === userId);
      if (!p) throw new Error(t("No account found."));
      p.password_hash = await hashPassword(password, p.id);
      save(s);
    },
    async adminUpdatePerson(userId, { name, username: rawUsername, email: rawEmail, partners }) {
      const s = load();
      requireAdmin(s);
      const username = normalizeUsername(rawUsername);
      const email = checkEmail(rawEmail);
      if (!name.trim()) throw new Error(t("Enter their name."));
      if (s.profiles.some((x) => x.id !== userId && x.username === username)) throw new Error(t("That username is taken."));
      if (s.profiles.some((x) => x.id !== userId && x.email === email)) throw new Error(t("That email already has an account."));
      const p = s.profiles.find((x) => x.id === userId);
      if (!p) throw new Error(t("No account found."));
      Object.assign(p, { name: name.trim(), username, email, partners });
      save(s);
    },
    async ownerCreateAccount({ name, partners, username: rawUsername, email: rawEmail, password, language }) {
      const username = normalizeUsername(rawUsername);
      const email = checkEmail(rawEmail);
      checkPassword(password);
      const s = load();
      requireAdmin(s);
      if (s.profiles.some((x) => x.username === username)) throw new Error(t("That username is taken. Try another."));
      if (s.profiles.some((x) => x.email === email)) throw new Error(t("That email already has an account."));
      const id = newId();
      // Like signing up, but the Owner stays signed in.
      s.profiles.push({ id, name: name.trim(), partners, username, email, language: language || "en", password_hash: await hashPassword(password, id) });
      save(s);
    },
    async adminDeletePerson(userId) {
      const s = load();
      requireAdmin(s);
      if (userId === s.session) throw new Error(t("You can't delete your own account from here."));
      if (!s.profiles.some((x) => x.id === userId)) throw new Error(t("No account found."));
      s.profiles = s.profiles.filter((x) => x.id !== userId);
      s.mivtzoim_activity = s.mivtzoim_activity.filter((x) => x.user_id !== userId);
      s.personal_categories = s.personal_categories.filter((x) => x.user_id !== userId || x.shared);
      s.routes = s.routes.filter((x) => x.created_by !== userId);
      s.group_members = s.group_members.filter((x) => x.user_id !== userId);
      save(s);
    },
    async listPeople() {
      return load().profiles.map(publicProfile);
    },
  };
}

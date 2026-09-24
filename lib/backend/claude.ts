import type { TableName, Tables } from "../types";
import { newId, type Backend } from "./index";

/* Minimal shapes of the Claude artifact runtime used here. */
type Snap = { id: string; exists: boolean; data(): Record<string, unknown> | undefined };
type DocRef = {
  get(): Promise<Snap>;
  set(d: Record<string, unknown>): Promise<void>;
  update(d: Record<string, unknown>): Promise<void>;
  delete(): Promise<void>;
};
type CollRef = { get(): Promise<{ docs: Snap[] }>; doc(id?: string): DocRef; where(f: string, op: string, v: unknown): CollRef };
type DB = { doc(path: string): DocRef; collection(path: string): CollRef };
type User = {
  me(): Promise<{ id: string | null; name: string }>;
  profiles(ids: string[]): Promise<Record<string, { name: string }>>;
};
type ClaudeRuntime = { use(name: string): Promise<unknown> };

function clean(row: object) {
  // The store takes plain JSON only.
  return JSON.parse(JSON.stringify(row)) as Record<string, unknown>;
}

function explain(e: unknown): Error {
  const code = (e as { code?: string })?.code;
  if (code === "invalid_argument") return new Error("You can view this page but not change it. Ask the owner for access to add entries.");
  if (code === "quota_exceeded") return new Error("The shared storage is full. Delete old entries and try again.");
  return new Error((e as { message?: string })?.message || "Could not save. Try again.");
}

/** Shared storage inside a Claude artifact. Identity comes from the viewer's Claude account. */
export async function createClaudeBackend(): Promise<Backend | null> {
  const claude = (window as unknown as { claude: ClaudeRuntime }).claude;
  const [db, user] = (await Promise.all([claude.use("db"), claude.use("user")])) as [DB | null, User | null];
  if (!db || !user) return null;
  const me = await user.me();
  if (!me.id) return null;
  const myId = me.id;

  return {
    kind: "claude",
    storageLabel: "Shared with everyone this page is shared with. You're signed in with your Claude account.",
    hasAuth: false,

    async currentUser() {
      const m = await user.me();
      return { id: myId, name: m.name || "You", username: null };
    },
    async signIn() {},
    async signUp() {
      return { needsConfirmation: false };
    },
    async signOut() {},
    async updateProfile() {},

    async list(table) {
      if (table === "profiles") return [];
      try {
        const snap = await db.collection(table).get();
        return snap.docs.map((d) => ({ ...(d.data() as object), id: d.id })) as Tables[typeof table][];
      } catch (e) {
        throw explain(e);
      }
    },
    async insert(table, row) {
      const id = row.id ?? newId();
      const full = { created_at: new Date().toISOString(), ...row, id };
      try {
        await db.collection(table).doc(id).set(clean(full));
      } catch (e) {
        throw explain(e);
      }
      return full as unknown as Tables[typeof table];
    },
    async update(table, id, patch) {
      try {
        await db.collection(table).doc(id).update(clean(patch));
      } catch (e) {
        throw explain(e);
      }
    },
    async remove(table: TableName, id) {
      try {
        await db.collection(table).doc(id).delete();
      } catch (e) {
        throw explain(e);
      }
    },

    async joinGroup(code) {
      const snap = await db.collection("groups").where("join_code", "==", code.trim().toUpperCase()).get();
      const g = snap.docs[0];
      if (!g) throw new Error("No group has that code.");
      const memberId = `${g.id}__${myId}`;
      try {
        await db.collection("group_members").doc(memberId).set({
          id: memberId,
          group_id: g.id,
          user_id: myId,
          member_role: "member",
          joined_at: new Date().toISOString(),
        });
      } catch (e) {
        throw explain(e);
      }
      return g.id;
    },
    async names(ids) {
      const ps = await user.profiles(ids);
      const out: Record<string, string> = {};
      for (const id of ids) out[id] = ps[id]?.name || (id === myId ? "You" : "Someone");
      return out;
    },
  };
}

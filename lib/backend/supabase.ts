import { createBrowserClient } from "@supabase/ssr";
import type { TableName, Tables } from "../types";
import type { Backend } from "./index";

function fail(error: { message: string } | null) {
  if (error) throw new Error(error.message);
}

/** The hosted website: Supabase auth and Postgres with row level security. */
export function createSupabaseBackend(url: string, key: string): Backend {
  const sb = createBrowserClient(url, key);

  async function uid() {
    const { data } = await sb.auth.getUser();
    if (!data.user) throw new Error("Please sign in again.");
    return data.user.id;
  }

  return {
    kind: "supabase",
    storageLabel: "Saved to your account. Sign in on any device to see it.",
    hasAuth: true,
    usesPassword: true,

    async currentUser() {
      const { data } = await sb.auth.getUser();
      if (!data.user) return null;
      const { data: p } = await sb.from("profiles").select("id, name").eq("id", data.user.id).maybeSingle();
      return { id: data.user.id, name: p?.name || data.user.email?.split("@")[0] || "You", email: data.user.email };
    },
    async signIn(email, password) {
      const { error } = await sb.auth.signInWithPassword({ email, password });
      fail(error);
    },
    async signUp(name, email, password) {
      const { data, error } = await sb.auth.signUp({ email, password, options: { data: { name } } });
      fail(error);
      return { needsConfirmation: !data.session };
    },
    async signOut() {
      await sb.auth.signOut();
    },
    async updateProfile({ name }) {
      const { error } = await sb.from("profiles").update({ name }).eq("id", await uid());
      fail(error);
    },

    async list(table) {
      const { data, error } = await sb.from(table).select("*");
      fail(error);
      return (data ?? []) as Tables[typeof table][];
    },
    async insert(table, row) {
      const { data, error } = await sb.from(table).insert(row as never).select().single();
      fail(error);
      return data as Tables[typeof table];
    },
    async update(table, id, patch) {
      const { error } = await sb.from(table).update(patch as never).eq("id", id);
      fail(error);
    },
    async remove(table: TableName, id) {
      const { error } = await sb.from(table).delete().eq("id", id);
      fail(error);
    },

    async joinGroup(code) {
      const { data, error } = await sb.rpc("join_group", { code });
      fail(error);
      return data as string;
    },
    async names(ids) {
      const { data } = await sb.from("profiles").select("id, name").in("id", ids);
      const out: Record<string, string> = {};
      for (const id of ids) out[id] = data?.find((p) => p.id === id)?.name || "Someone";
      return out;
    },
  };
}

import { createBrowserClient } from "@supabase/ssr";
import type { Profile, TableName, Tables } from "../types";
import { checkPassword, loginKey, normalizeUsername, type Backend } from "./index";

/**
 * Supabase sign-in needs an email address, so each username maps to an
 * internal address that is never shown or emailed. Turn off "Confirm email"
 * in Supabase (Authentication → Sign In / Providers → Email) for this to work.
 */
const LOGIN_DOMAIN = "users.shiurdaledmivtzoim.app";
function loginEmail(login: string) {
  // Real email addresses (the admin account) are used as they are.
  return login.includes("@") ? login : `${login}@${LOGIN_DOMAIN}`;
}

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

    async currentUser() {
      const { data } = await sb.auth.getUser();
      if (!data.user) return null;
      const { data: p } = await sb.from("profiles").select("id, name, username, role").eq("id", data.user.id).maybeSingle();
      const username = p?.username || data.user.user_metadata?.username || null;
      return { id: data.user.id, name: p?.name || username || "You", username, role: p?.role === "admin" ? "admin" : "user" };
    },
    async signIn(rawUsername, password) {
      const username = loginKey(rawUsername);
      const { error } = await sb.auth.signInWithPassword({ email: loginEmail(username), password });
      if (error) throw new Error(error.message.includes("Invalid login") ? "That username (or email) and password don't match." : error.message);
    },
    async signUp(name, rawUsername, password) {
      const username = normalizeUsername(rawUsername);
      checkPassword(password);
      const { data, error } = await sb.auth.signUp({ email: loginEmail(username), password, options: { data: { name, username } } });
      if (error) throw new Error(error.message.includes("already registered") ? "That username or email is already used. Try another." : error.message);
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

    async getSettings() {
      const { data } = await sb.from("site_settings").select("site_name, tagline, welcome, announcement").eq("id", 1).maybeSingle();
      return data ?? {};
    },
    async saveSettings(settings) {
      const { error } = await sb.from("site_settings").update({ ...settings, updated_at: new Date().toISOString(), updated_by: await uid() }).eq("id", 1);
      fail(error);
    },
    async setRole(userId, role) {
      const { error } = await sb.from("profiles").update({ role }).eq("id", userId);
      fail(error);
    },
    async listPeople() {
      const { data, error } = await sb.from("profiles").select("id, name, username, role");
      fail(error);
      return (data ?? []) as Profile[];
    },
  };
}

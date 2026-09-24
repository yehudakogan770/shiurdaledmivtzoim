import { createClient } from "@supabase/supabase-js";
import { displayName, type Profile, type TableName, type Tables } from "../types";
import { checkEmail, checkPassword, loginKey, normalizeUsername, type Backend } from "./index";

/** Where email links (confirmation, password reset) send people back to. */
function siteUrl() {
  return `${window.location.origin}${process.env.NEXT_PUBLIC_BASE_PATH || ""}/`;
}

function fail(error: { message: string } | null) {
  if (error) throw new Error(error.message);
}

/** The hosted website: Supabase auth and Postgres with row level security. */
export function createSupabaseBackend(url: string, key: string): Backend {
  // Implicit flow: email links (confirmation, password reset) work on any device,
  // not only in the browser that asked for them.
  const sb = createClient(url, key, {
    auth: { flowType: "implicit", persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
  });

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
      const { data: p } = await sb.from("profiles").select("id, name, username, partners, role").eq("id", data.user.id).maybeSingle();
      const username = p?.username || data.user.user_metadata?.username || null;
      return {
        id: data.user.id,
        name: p?.name || username || "You",
        username,
        email: data.user.email ?? null,
        partners: p?.partners ?? [],
        role: p?.role === "admin" ? "admin" : "user",
      };
    },
    async signIn(rawUsername, password) {
      // People sign in with their username; look up the email it belongs to.
      const { data: email } = await sb.rpc("login_email", { p_username: loginKey(rawUsername) });
      if (!email) throw new Error("That username and password don't match.");
      const { error } = await sb.auth.signInWithPassword({ email, password });
      if (!error) return;
      if (error.message.includes("not confirmed")) throw new Error("Confirm your email first: open the link we sent you, then sign in.");
      throw new Error(error.message.includes("Invalid login") ? "That username and password don't match." : error.message);
    },
    async signUp({ name, partners, username: rawUsername, email: rawEmail, password }) {
      const username = normalizeUsername(rawUsername);
      const email = checkEmail(rawEmail);
      checkPassword(password);
      const { data: free } = await sb.rpc("username_available", { p_username: username });
      if (free === false) throw new Error("That username is taken. Try another.");
      const { data, error } = await sb.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: siteUrl(), data: { name, username, partners } },
      });
      if (error) throw new Error(error.message.includes("already registered") ? "That email already has an account." : error.message);
      return { needsConfirmation: !data.session };
    },
    async signOut() {
      await sb.auth.signOut();
    },
    async updateProfile({ name, partners }) {
      const { error } = await sb.from("profiles").update({ name, partners }).eq("id", await uid());
      fail(error);
    },
    async requestPasswordReset(rawEmail) {
      const { error } = await sb.auth.resetPasswordForEmail(checkEmail(rawEmail), { redirectTo: siteUrl() });
      fail(error);
    },
    async updatePassword(password) {
      checkPassword(password);
      const { error } = await sb.auth.updateUser({ password });
      fail(error);
    },
    onPasswordRecovery(cb) {
      sb.auth.onAuthStateChange((event) => {
        if (event === "PASSWORD_RECOVERY") cb();
      });
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
      const { data } = await sb.from("profiles").select("id, name, partners").in("id", ids);
      const out: Record<string, string> = {};
      for (const id of ids) {
        const p = data?.find((x) => x.id === id);
        out[id] = p ? displayName(p) : "Someone";
      }
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
      const withEmail = await sb.rpc("admin_people");
      if (!withEmail.error && withEmail.data) return withEmail.data as Profile[];
      const { data, error } = await sb.from("profiles").select("id, name, username, partners, role");
      fail(error);
      return (data ?? []) as Profile[];
    },
  };
}

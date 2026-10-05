import { createClient } from "@supabase/supabase-js";
import { displayName, type PersonalCategory, type Photo, type Profile, type TableName, type Tables } from "../types";
import { NOT_ALLOWED, checkEmail, checkPassword, loginKey, normalizeUsername, type Backend, type CommunityRow } from "./index";

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
      if (error.message.includes("not confirmed")) throw new Error("Confirm your email first: open the link we sent you, then sign in. Don't see it? Check your Spam or Promotions folder.");
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
      // Only this device. Supabase's default ("global") would sign the account out on every phone and computer.
      await sb.auth.signOut({ scope: "local" });
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
    async verifyPassword(password) {
      const { data } = await sb.auth.getUser();
      if (!data.user?.email) throw new Error("Please sign in again.");
      const { error } = await sb.auth.signInWithPassword({ email: data.user.email, password });
      if (error) throw new Error("Your current password isn't right.");
    },
    async changeUsername(raw) {
      const username = normalizeUsername(raw);
      const id = await uid();
      const { data: mine } = await sb.from("profiles").select("username").eq("id", id).maybeSingle();
      if (mine?.username?.toLowerCase() === username) return;
      const { data: free } = await sb.rpc("username_available", { p_username: username });
      if (free === false) throw new Error("That username is taken. Try another.");
      const { error } = await sb.from("profiles").update({ username }).eq("id", id);
      if (error?.message.includes("duplicate")) throw new Error("That username is taken. Try another.");
      fail(error);
    },
    async changeEmail(raw) {
      const email = checkEmail(raw);
      const { data, error } = await sb.auth.updateUser({ email }, { emailRedirectTo: siteUrl() });
      if (error) throw new Error(error.message.includes("already") ? "That email already has an account." : error.message);
      return { needsConfirmation: data.user?.email?.toLowerCase() !== email };
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
      const { data, error } = await sb.from(table).update(patch as never).eq("id", id).select("id");
      fail(error);
      // The database skips rows this account may not change, without an error: say so.
      if (Array.isArray(data) && data.length === 0) throw new Error(NOT_ALLOWED);
    },
    async remove(table: TableName, id) {
      const { data, error } = await sb.from(table).delete().eq("id", id).select("id");
      fail(error);
      if (Array.isArray(data) && data.length === 0) throw new Error(NOT_ALLOWED);
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
      const { data } = await sb.from("site_settings").select("*").eq("id", 1).maybeSingle();
      return data ?? {};
    },
    async saveSettings(settings) {
      const row = { ...settings, updated_at: new Date().toISOString(), updated_by: await uid() };
      const { error } = await sb.from("site_settings").update(row).eq("id", 1);
      fail(error);
    },
    async setRole(userId, role) {
      const { error } = await sb.from("profiles").update({ role }).eq("id", userId);
      fail(error);
    },
    async adminSetPassword(userId, password) {
      checkPassword(password);
      const { error } = await sb.rpc("admin_set_password", { p_user: userId, p_password: password });
      fail(error);
    },
    async adminUpdatePerson(userId, { name, username, email, partners }) {
      const { error } = await sb.rpc("admin_update_person", {
        p_user: userId,
        p_name: name.trim(),
        p_username: normalizeUsername(username),
        p_email: checkEmail(email),
        p_partners: partners,
      });
      if (error?.message.includes("admin_update_person")) throw new Error("Run the latest setup file in Supabase first.");
      fail(error);
    },
    async adminDeletePerson(userId) {
      const { error } = await sb.rpc("admin_delete_person", { p_user: userId });
      if (error?.message.includes("admin_delete_person")) throw new Error("Run the latest setup file in Supabase first.");
      fail(error);
    },
    async listPhotos() {
      const { data, error } = await sb.from("photos").select("*").order("created_at", { ascending: false }).limit(2000);
      if (error) return [];
      const url = (path: string) => sb.storage.from("photos").getPublicUrl(path).data.publicUrl;
      return (data as Photo[]).map((p) => ({ ...p, url: url(p.path), thumbUrl: url(p.thumb_path) }));
    },
    async uploadPhoto(full, thumb, info) {
      const me = await uid();
      const id = crypto.randomUUID();
      const ext = (b: Blob) => (b.type === "image/webp" ? "webp" : "jpg");
      // Each person's photos go in their own folder; the database only lets them write there.
      const path = `${me}/${id}.${ext(full)}`;
      const thumbPath = `${me}/${id}-thumb.${ext(thumb)}`;
      const store = sb.storage.from("photos");
      const put = (p: string, b: Blob) => store.upload(p, b, { contentType: b.type, cacheControl: "31536000", upsert: false });
      const [a, b] = await Promise.all([put(path, full), put(thumbPath, thumb)]);
      if (a.error || b.error) {
        await store.remove([path, thumbPath]).catch(() => {});
        const msg = (a.error ?? b.error)!.message;
        throw new Error(/bucket not found/i.test(msg) ? "Photos aren't set up yet: run database update 011 in Supabase first." : `The photo didn't upload: ${msg}`);
      }
      const row = { id, user_id: me, path, thumb_path: thumbPath, width: info.width, height: info.height, color: info.color ?? null, bytes: full.size + thumb.size };
      const { data, error } = await sb.from("photos").insert(row).select().single();
      if (error) {
        await store.remove([path, thumbPath]).catch(() => {});
        throw new Error(error.message.includes("photos") ? "Photos aren't set up yet: run database update 011 in Supabase first." : error.message);
      }
      return { ...(data as Photo), url: store.getPublicUrl(path).data.publicUrl, thumbUrl: store.getPublicUrl(thumbPath).data.publicUrl };
    },
    async deletePhoto(photo) {
      const { data, error } = await sb.from("photos").delete().eq("id", photo.id).select("id");
      fail(error);
      if (Array.isArray(data) && data.length === 0) throw new Error(NOT_ALLOWED);
      await sb.storage.from("photos").remove([photo.path, photo.thumb_path]);
    },
    async sharedMivtzoim() {
      const { data, error } = await sb.rpc("shared_mivtzoim");
      if (error || !data) return [];
      return (data as Omit<PersonalCategory, "user_id" | "shared">[]).map((c) => ({ ...c, user_id: "", shared: true }));
    },
    async communityActivity(from, to) {
      const { data, error } = await sb.rpc("community_activity", { p_from: from, p_to: to });
      return error ? null : (data as CommunityRow[]);
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

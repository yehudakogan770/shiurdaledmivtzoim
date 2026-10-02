"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { newId, newJoinCode, pickBackend, type Backend, type PersonPatch } from "./backend";
import type {
  Activity,
  Group,
  GroupMember,
  Location,
  PersonalCategory,
  Profile,
  SiteSettings,
  Route,
  RouteLocation,
} from "./types";
import { DEFAULT_SETTINGS, type SignUpInput } from "./types";
import { today } from "./dates";
import { newVersionOnline } from "./install";
import { isAdminIdentifier } from "./admin";
import { builtinDescription, builtinIcon, builtins, isBuiltinRow, type Builtin, type BuiltinType } from "./categories";

export interface AppData {
  groups: Group[];
  members: GroupMember[];
  routes: Route[];
  locations: Location[];
  stops: RouteLocation[];
  categories: PersonalCategory[];
  activity: Activity[];
  names: Record<string, string>;
}

const EMPTY: AppData = {
  groups: [],
  members: [],
  routes: [],
  locations: [],
  stops: [],
  categories: [],
  activity: [],
  names: {},
};

export interface LogInput {
  category_type: Activity["category_type"];
  personal_category_id?: string | null;
  quantity: number;
  notes?: string;
  activity_date?: string;
  group_id?: string | null;
  route_id?: string | null;
  location_id?: string | null;
}

interface DataContextValue {
  status: "loading" | "ready" | "error";
  error: string | null;
  backend: Backend | null;
  me: Profile | null;
  /** Nobody is signed in: the site shows a blank sample and nothing can be saved. */
  guest: boolean;
  data: AppData;
  /** Rows visible to me after applying membership rules (needed for shared stores). */
  mine: {
    groups: Group[];
    routes: Route[];
    activity: Activity[];
    categories: PersonalCategory[];
  };
  /** Categories an admin offers to everyone. */
  shared: PersonalCategory[];
  /** Tefillin and Shabbos Candles, with any admin renames, hiding or removal. */
  builtins: Builtin[];
  settings: SiteSettings;
  isAdmin: boolean;
  /** The site's main account (sdmivtzoim87@gmail.com): it runs the site and edits it right on the pages. */
  isOwner: boolean;
  /** Every account; filled in for admins only. */
  people: Profile[];
  toast: string | null;
  notify(message: string): void;
  refresh(): Promise<void>;
  auth: {
    signIn(username: string, password: string): Promise<void>;
    signUp(input: SignUpInput): Promise<{ needsConfirmation: boolean }>;
    requestPasswordReset(email: string): Promise<void>;
    updatePassword(password: string): Promise<void>;
    /** true while someone who arrived from a reset link is choosing a new password. */
    recovering: boolean;
    finishRecovery(): void;
    signOut(): Promise<void>;
    updateProfile(name: string, partners: string[]): Promise<void>;
    changeUsername(username: string): Promise<void>;
    changeEmail(email: string): Promise<{ needsConfirmation: boolean }>;
    /** Throws unless this is the signed-in person's current password. */
    verifyPassword(password: string): Promise<void>;
    /** Checks the current password, then sets the new one. */
    changePassword(current: string, next: string): Promise<void>;
  };
  actions: {
    log(input: LogInput): Promise<void>;
    deleteActivity(id: string): Promise<void>;
    /** Change how many an entry counts; 0 deletes it. */
    setActivityQuantity(id: string, quantity: number): Promise<void>;
    createGroup(name: string): Promise<Group>;
    joinGroup(code: string): Promise<string>;
    leaveGroup(groupId: string): Promise<void>;
    deleteGroup(groupId: string): Promise<void>;
    createRoute(input: { name: string; description?: string; group_id: string | null; stops: { name: string; address?: string; type?: string; notes?: string }[] }): Promise<Route>;
    deleteRoute(routeId: string): Promise<void>;
    addStop(routeId: string, stop: { name: string; address?: string; type?: string; notes?: string }): Promise<void>;
    removeStop(stopId: string): Promise<void>;
    toggleStop(stop: RouteLocation): Promise<void>;
    resetRoute(routeId: string): Promise<void>;
    addCategory(name: string, description?: string, shared?: boolean, icon?: string): Promise<void>;
    /** Hide (or show) a mivtza; `from` is the first week it's hidden in (none: every week). */
    archiveCategory(id: string, archived: boolean, from?: string | null): Promise<void>;
    deleteCategory(id: string): Promise<void>;
    /** Admins: delete a mivtza for everyone together with all of its entries in everyone's history. */
    deleteMivtzaEverywhere(key: string): Promise<void>;
    updateCategory(id: string, name: string, description: string, icon?: string): Promise<void>;
    /** Admins: rename, hide or remove Tefillin or Shabbos Candles for everyone. */
    updateBuiltin(type: BuiltinType, patch: { name?: string; hidden?: boolean; hiddenFrom?: string | null; removed?: boolean }): Promise<void>;
    /** Admins: the new front-page order, as mivtza keys (built-in type or category id). */
    reorderMivtzoim(keys: string[]): Promise<void>;
    saveSettings(settings: SiteSettings): Promise<void>;
    setRole(userId: string, role: "user" | "admin"): Promise<void>;
    adminSetPassword(userId: string, password: string): Promise<void>;
    adminUpdatePerson(userId: string, patch: PersonPatch): Promise<void>;
    adminDeletePerson(userId: string): Promise<void>;
  };
}

/** What someone without an account sees when they tap anything that would save. */
export const GUEST_MESSAGE = "This is a sample. Create an account to save your Mivtzoim.";

/** The same functions, except each one only says "create an account" and changes nothing. */
function sampleOnly<T extends object>(fns: T): T {
  const blocked = {} as T;
  for (const k of Object.keys(fns) as (keyof T)[]) (blocked as Record<keyof T, unknown>)[k] = () => Promise.reject(new Error(GUEST_MESSAGE));
  return blocked;
}

const DataContext = createContext<DataContextValue | null>(null);

export function useData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error("useData must be used inside DataProvider");
  return ctx;
}

export function DataProvider({ children }: { children: ReactNode }) {
  const [backend, setBackend] = useState<Backend | null>(null);
  const [status, setStatus] = useState<DataContextValue["status"]>("loading");
  const [error, setError] = useState<string | null>(null);
  const [me, setMe] = useState<Profile | null>(null);
  const [data, setData] = useState<AppData>(EMPTY);
  const [settings, setSettings] = useState<SiteSettings>(DEFAULT_SETTINGS);
  const [people, setPeople] = useState<Profile[]>([]);
  const [recovering, setRecovering] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Quick changes (add, −/+, delete, check off a stop) show on screen at once and
  // are saved in the background, one after another, in the order they were made.
  const saveQueue = useRef<Promise<void>>(Promise.resolve());
  const unsaved = useRef(0);
  const savedIds = useRef(new Map<string, string>());

  const notify = useCallback((message: string) => {
    setToast(message);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 3200);
  }, []);

  const load = useCallback(async (b: Backend) => {
    const [user, saved] = await Promise.all([b.currentUser(), b.getSettings().catch(() => ({}))]);
    const merged = { ...DEFAULT_SETTINGS };
    for (const [k, v] of Object.entries(saved)) if (typeof v === "string" && (v || k === "announcement")) merged[k as keyof SiteSettings] = v;
    setSettings(merged);
    setMe(user);
    if (!user) {
      // The sample: nothing logged, but the same mivtzoim everyone has.
      const categories = b.sharedMivtzoim ? await b.sharedMivtzoim().catch(() => []) : [];
      setData({ ...EMPTY, categories });
      setPeople([]);
      return;
    }
    const [everyone, groups, members, routes, locations, stops, categories, activity] = await Promise.all([
      user.role === "admin" ? b.listPeople().catch(() => [] as Profile[]) : Promise.resolve([] as Profile[]),
      b.list("groups"),
      b.list("group_members"),
      b.list("routes"),
      b.list("locations"),
      b.list("route_locations"),
      b.list("personal_categories"),
      b.list("mivtzoim_activity"),
    ]);
    const ids = new Set<string>([user.id]);
    members.forEach((m) => ids.add(m.user_id));
    activity.forEach((a) => ids.add(a.user_id));
    everyone.forEach((p) => ids.add(p.id));
    const names = await b.names([...ids]);
    names[user.id] = user.name || names[user.id];
    setPeople(everyone);
    setData({ groups, members, routes, locations, stops, categories, activity, names });
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const b = await pickBackend();
        if (cancelled) return;
        b.onPasswordRecovery(() => setRecovering(true));
        setBackend(b);
        await load(b);
        if (!cancelled) setStatus("ready");
      } catch (e) {
        if (!cancelled) {
          setError((e as Error).message);
          setStatus("error");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [load]);

  // Pick up other people's changes when the tab comes back into view.
  useEffect(() => {
    if (!backend) return;
    const onVisible = async () => {
      if (document.visibilityState !== "visible" || unsaved.current > 0) return;
      // A newer version of the site went live while this was in the background: load it.
      if (await newVersionOnline()) return window.location.reload();
      load(backend).catch(() => {});
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [backend, load]);

  const refresh = useCallback(async () => {
    if (backend) await load(backend);
  }, [backend, load]);

  const mine = useMemo(() => {
    if (!me) return { groups: [], routes: [], activity: [], categories: [] };
    const myGroupIds = new Set(data.members.filter((m) => m.user_id === me.id).map((m) => m.group_id));
    const groups = data.groups.filter((g) => myGroupIds.has(g.id));
    const routes = data.routes.filter((r) => r.created_by === me.id || (r.group_id && myGroupIds.has(r.group_id)));
    const activity = data.activity.filter((a) => a.user_id === me.id);
    const categories = data.categories.filter((c) => c.user_id === me.id && !c.shared);
    return { groups, routes, activity, categories };
  }, [data, me]);

  const value = useMemo<DataContextValue>(() => {
    const b = backend!;
    const uid = () => {
      if (!me) throw new Error("Please sign in first.");
      return me.id;
    };
    const run = async <T,>(work: () => Promise<T>): Promise<T> => {
      const result = await work();
      await load(b);
      return result;
    };
    /** Save in the background after the screen already changed; on failure, reload what's really saved. */
    const saveLater = (job: () => Promise<void>) => {
      unsaved.current++;
      saveQueue.current = saveQueue.current
        .then(job)
        .catch(async (e: Error) => {
          notify(`That didn't save: ${e.message}`);
          await load(b).catch(() => {});
        })
        .finally(() => {
          unsaved.current--;
        });
    };
    /**
     * The fields that hide or show a row. The starting week needs database update 009;
     * it's only sent when a week was chosen or the database already has the column.
     */
    const hideFields = (row: PersonalCategory | null | undefined, archived: boolean, from: string | null | undefined) => {
      const fields: Partial<PersonalCategory> = { status: archived ? "archived" : "active" };
      if (from || (row && "hidden_from" in row)) fields.hidden_from = archived ? from ?? null : null;
      return fields;
    };
    const needs009 = (e: Error) => {
      throw new Error(e.message.includes("hidden_from") ? "To hide from a certain week, run database update 009 in Supabase first." : e.message);
    };
    /** Rows added a moment ago have a temporary id until the server gives them their real one. */
    const realId = (id: string) => savedIds.current.get(id) ?? id;
    const patchActivity = (fn: (rows: Activity[]) => Activity[]) => setData((d) => ({ ...d, activity: fn(d.activity) }));
    const removeActivity = (id: string) => {
      patchActivity((rows) => rows.filter((a) => a.id !== id));
      saveLater(() => b.remove("mivtzoim_activity", realId(id)));
    };

    const guest = status === "ready" && !me && !!backend?.hasAuth;
    const value: DataContextValue = {
      status,
      error,
      backend,
      me,
      guest,
      data,
      mine,
      shared: data.categories.filter((c) => c.shared && !isBuiltinRow(c)),
      builtins: builtins(data.categories),
      settings,
      isAdmin: me?.role === "admin",
      isOwner: isAdminIdentifier(me?.email) || isAdminIdentifier(me?.username),
      people,
      toast,
      notify,
      refresh,
      auth: {
        signIn: (username, password) => run(() => b.signIn(username, password)),
        signUp: (input) => run(() => b.signUp(input)),
        requestPasswordReset: (email) => b.requestPasswordReset(email),
        updatePassword: (password) => b.updatePassword(password),
        recovering,
        finishRecovery: () => setRecovering(false),
        signOut: () => run(() => b.signOut()),
        updateProfile: (name, partners) => run(() => b.updateProfile({ name, partners })),
        changeUsername: (username) => run(() => b.changeUsername(username)),
        changeEmail: (email) => run(() => b.changeEmail(email)),
        verifyPassword: (password) => b.verifyPassword(password),
        changePassword: async (current, next) => {
          await b.verifyPassword(current);
          await b.updatePassword(next);
        },
      },
      actions: {
        log: async (input) => {
          const row = {
            user_id: uid(),
            category_type: input.category_type,
            personal_category_id: input.category_type === "personal" ? input.personal_category_id ?? null : null,
            quantity: Math.max(0, Math.round(input.quantity)),
            notes: input.notes?.trim() || null,
            activity_date: input.activity_date || today(),
            group_id: input.group_id ?? null,
            route_id: input.route_id ?? null,
            location_id: input.location_id ?? null,
          };
          const tempId = `new-${newId()}`;
          patchActivity((rows) => [...rows, { ...row, id: tempId, created_at: new Date().toISOString() }]);
          saveLater(async () => {
            const saved = await b.insert("mivtzoim_activity", row);
            savedIds.current.set(tempId, saved.id);
            // Keep what's on screen (it may have been changed meanwhile); just take the real id.
            patchActivity((rows) => rows.map((x) => (x.id === tempId ? { ...x, id: saved.id, created_at: saved.created_at } : x)));
          });
        },
        deleteActivity: async (id) => removeActivity(id),
        setActivityQuantity: async (id, quantity) => {
          if (quantity <= 0) return removeActivity(id);
          const q = Math.round(quantity);
          patchActivity((rows) => rows.map((x) => (x.id === id ? { ...x, quantity: q } : x)));
          saveLater(() => b.update("mivtzoim_activity", realId(id), { quantity: q }));
        },
        createGroup: (name) =>
          run(async () => {
            const g = await b.insert("groups", { name: name.trim(), join_code: newJoinCode(), created_by: uid() });
            // Supabase adds the owner with a database trigger.
            if (b.kind !== "supabase") {
              await b.insert("group_members", {
                id: `${g.id}__${uid()}`,
                group_id: g.id,
                user_id: uid(),
                member_role: "owner",
                joined_at: new Date().toISOString(),
              });
            }
            return g;
          }),
        joinGroup: (code) => run(() => b.joinGroup(code)),
        leaveGroup: (groupId) =>
          run(async () => {
            const m = data.members.find((x) => x.group_id === groupId && x.user_id === uid());
            if (m) await b.remove("group_members", m.id);
          }),
        deleteGroup: (groupId) =>
          run(async () => {
            if (b.kind !== "supabase") {
              for (const m of data.members.filter((x) => x.group_id === groupId)) await b.remove("group_members", m.id);
              for (const r of data.routes.filter((x) => x.group_id === groupId)) await b.update("routes", r.id, { group_id: null });
            }
            await b.remove("groups", groupId);
          }),
        createRoute: (input) =>
          run(async () => {
            const route = await b.insert("routes", {
              name: input.name.trim(),
              description: input.description?.trim() || null,
              group_id: input.group_id,
              created_by: uid(),
            });
            let position = 0;
            for (const s of input.stops) {
              const loc = await b.insert("locations", {
                name: s.name.trim(),
                address: s.address?.trim() || null,
                type: s.type || null,
                notes: s.notes?.trim() || null,
                created_by: uid(),
              });
              await b.insert("route_locations", { route_id: route.id, location_id: loc.id, position: position++, completed: false });
            }
            return route;
          }),
        deleteRoute: (routeId) =>
          run(async () => {
            if (b.kind !== "supabase") {
              for (const s of data.stops.filter((x) => x.route_id === routeId)) await b.remove("route_locations", s.id);
            }
            await b.remove("routes", routeId);
          }),
        addStop: (routeId, s) =>
          run(async () => {
            const loc = await b.insert("locations", {
              name: s.name.trim(),
              address: s.address?.trim() || null,
              type: s.type || null,
              notes: s.notes?.trim() || null,
              created_by: uid(),
            });
            const last = Math.max(-1, ...data.stops.filter((x) => x.route_id === routeId).map((x) => x.position));
            await b.insert("route_locations", { route_id: routeId, location_id: loc.id, position: last + 1, completed: false });
          }),
        removeStop: async (stopId) => {
          setData((d) => ({ ...d, stops: d.stops.filter((x) => x.id !== stopId) }));
          saveLater(() => b.remove("route_locations", stopId));
        },
        toggleStop: async (stop) => {
          const completed = !stop.completed;
          setData((d) => ({ ...d, stops: d.stops.map((x) => (x.id === stop.id ? { ...x, completed } : x)) }));
          saveLater(() => b.update("route_locations", stop.id, { completed }));
        },
        resetRoute: (routeId) =>
          run(async () => {
            for (const s of data.stops.filter((x) => x.route_id === routeId && x.completed)) {
              await b.update("route_locations", s.id, { completed: false });
            }
          }),
        addCategory: (name, description, shared, icon) =>
          run(async () => {
            await b.insert("personal_categories", {
              user_id: uid(),
              name: name.trim(),
              description: description?.trim() || null,
              icon: icon || "auto",
              status: "active",
              ...(shared ? { shared: true } : {}),
            });
          }),
        saveSettings: (next) => run(() => b.saveSettings(next)),
        setRole: (userId, role) => run(() => b.setRole(userId, role)),
        adminSetPassword: (userId, password) => b.adminSetPassword(userId, password),
        adminUpdatePerson: (userId, patch) => run(() => b.adminUpdatePerson(userId, patch)),
        adminDeletePerson: (userId) => run(() => b.adminDeletePerson(userId)),
        archiveCategory: (id, archived, from) =>
          run(() => b.update("personal_categories", id, hideFields(data.categories.find((c) => c.id === id), archived, from))).catch(needs009),
        deleteCategory: (id) => run(() => b.remove("personal_categories", id)),
        deleteMivtzaEverywhere: (key) =>
          run(async () => {
            // Every entry of this mivtza, from everyone's history, then the mivtza itself.
            const isBuiltin = key === "tefillin" || key === "shabbos_candles";
            const entries = data.activity.filter((a) => (isBuiltin ? a.category_type === key : a.personal_category_id === key));
            for (const a of entries) await b.remove("mivtzoim_activity", a.id);
            if (isBuiltin) {
              const current = builtins(data.categories).find((x) => x.type === key)!;
              const status = current.hidden ? "archived" : "active";
              if (current.row) await b.update("personal_categories", current.row.id, { description: builtinDescription(true), status });
              else await b.insert("personal_categories", { user_id: uid(), name: current.name, description: builtinDescription(true), icon: builtinIcon(current.type), status, shared: true });
            } else {
              await b.remove("personal_categories", key);
            }
          }),
        updateBuiltin: (type, patch) =>
          run(async () => {
            const current = builtins(data.categories).find((x) => x.type === type)!;
            if (patch.name !== undefined && !patch.name.trim()) throw new Error("Give it a name.");
            const name = patch.name?.trim() ?? current.name;
            const hidden = patch.hidden ?? current.hidden;
            const from = patch.hidden === undefined ? current.hiddenFrom : patch.hiddenFrom;
            const fields = { ...hideFields(current.row, hidden, from), name, description: builtinDescription(patch.removed ?? current.removed) };
            if (current.row) await b.update("personal_categories", current.row.id, fields);
            else await b.insert("personal_categories", { user_id: uid(), icon: builtinIcon(type), shared: true, ...fields } as Parameters<typeof b.insert<"personal_categories">>[1]);
          }).catch(needs009),
        reorderMivtzoim: async (keys) => {
          const list = builtins(data.categories);
          const rowId = (key: string) => list.find((x) => x.type === key)?.row?.id ?? key;
          // Once Tefillin and Candles have their settings rows, moves show instantly and save in the background.
          if (list.every((x) => x.row)) {
            const changed = keys.map((key, position) => ({ id: rowId(key), position })).filter(({ id, position }) => data.categories.find((c) => c.id === id)?.position !== position);
            setData((d) => ({ ...d, categories: d.categories.map((c) => ({ ...c, position: changed.find((x) => x.id === c.id)?.position ?? c.position })) }));
            for (const { id, position } of changed) saveLater(() => b.update("personal_categories", id, { position }));
            return;
          }
          return run(async () => {
            const list = builtins(data.categories);
            for (const [position, key] of keys.entries()) {
              const bi = list.find((x) => x.type === key);
              if (bi) {
                if (bi.row) {
                  if (bi.row.position !== position) await b.update("personal_categories", bi.row.id, { position });
                } else {
                  await b.insert("personal_categories", { user_id: uid(), name: bi.name, description: null, icon: builtinIcon(bi.type), status: "active", shared: true, position });
                }
              } else if (data.categories.find((c) => c.id === key)?.position !== position) {
                await b.update("personal_categories", key, { position });
              }
            }
          }).catch((e: Error) => {
            throw new Error(e.message.includes("position") ? "Run the latest database update (007) in Supabase first." : e.message);
          });
        },
        updateCategory: (id, name, description, icon) =>
          run(async () => {
            if (!name.trim()) throw new Error("Give it a name.");
            await b.update("personal_categories", id, { name: name.trim(), description: description.trim() || null, ...(icon ? { icon } : {}) });
          }),
      },
    };
    if (!guest) return value;
    // Signing in, creating an account and resetting a password still work; nothing else saves.
    const { signIn, signUp, requestPasswordReset, updatePassword, finishRecovery } = value.auth;
    return {
      ...value,
      actions: sampleOnly(value.actions),
      auth: { ...sampleOnly(value.auth), signIn, signUp, requestPasswordReset, updatePassword, finishRecovery, recovering },
    };
  }, [backend, status, error, me, data, mine, settings, people, recovering, toast, notify, refresh, load]);

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

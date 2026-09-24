"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { newJoinCode, pickBackend, type Backend } from "./backend";
import type {
  Activity,
  Group,
  GroupMember,
  Location,
  PersonalCategory,
  Profile,
  Route,
  RouteLocation,
} from "./types";
import { today } from "./dates";

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
  data: AppData;
  /** Rows visible to me after applying membership rules (needed for shared stores). */
  mine: {
    groups: Group[];
    routes: Route[];
    activity: Activity[];
    categories: PersonalCategory[];
  };
  toast: string | null;
  notify(message: string): void;
  refresh(): Promise<void>;
  auth: {
    signIn(email: string, password: string): Promise<void>;
    signUp(name: string, email: string, password: string): Promise<{ needsConfirmation: boolean }>;
    signOut(): Promise<void>;
    updateName(name: string): Promise<void>;
  };
  actions: {
    log(input: LogInput): Promise<void>;
    deleteActivity(id: string): Promise<void>;
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
    addCategory(name: string, description?: string): Promise<void>;
    archiveCategory(id: string, archived: boolean): Promise<void>;
  };
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
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const notify = useCallback((message: string) => {
    setToast(message);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 3200);
  }, []);

  const load = useCallback(async (b: Backend) => {
    const user = await b.currentUser();
    setMe(user);
    if (!user) {
      setData(EMPTY);
      return;
    }
    const [groups, members, routes, locations, stops, categories, activity] = await Promise.all([
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
    const names = await b.names([...ids]);
    names[user.id] = user.name || names[user.id];
    setData({ groups, members, routes, locations, stops, categories, activity, names });
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const b = await pickBackend();
        if (cancelled) return;
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
    const onVisible = () => {
      if (document.visibilityState === "visible") load(backend).catch(() => {});
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
    const categories = data.categories.filter((c) => c.user_id === me.id);
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

    return {
      status,
      error,
      backend,
      me,
      data,
      mine,
      toast,
      notify,
      refresh,
      auth: {
        signIn: (email, password) => run(() => b.signIn(email, password)),
        signUp: (name, email, password) => run(() => b.signUp(name, email, password)),
        signOut: () => run(() => b.signOut()),
        updateName: (name) => run(() => b.updateProfile({ name })),
      },
      actions: {
        log: (input) =>
          run(async () => {
            await b.insert("mivtzoim_activity", {
              user_id: uid(),
              category_type: input.category_type,
              personal_category_id: input.category_type === "personal" ? input.personal_category_id ?? null : null,
              quantity: Math.max(0, Math.round(input.quantity)),
              notes: input.notes?.trim() || null,
              activity_date: input.activity_date || today(),
              group_id: input.group_id ?? null,
              route_id: input.route_id ?? null,
              location_id: input.location_id ?? null,
            });
          }),
        deleteActivity: (id) => run(() => b.remove("mivtzoim_activity", id)),
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
        removeStop: (stopId) => run(() => b.remove("route_locations", stopId)),
        toggleStop: (stop) => run(() => b.update("route_locations", stop.id, { completed: !stop.completed })),
        resetRoute: (routeId) =>
          run(async () => {
            for (const s of data.stops.filter((x) => x.route_id === routeId && x.completed)) {
              await b.update("route_locations", s.id, { completed: false });
            }
          }),
        addCategory: (name, description) =>
          run(async () => {
            await b.insert("personal_categories", {
              user_id: uid(),
              name: name.trim(),
              description: description?.trim() || null,
              icon: "circle",
              status: "active",
            });
          }),
        archiveCategory: (id, archived) => run(() => b.update("personal_categories", id, { status: archived ? "archived" : "active" })),
      },
    };
  }, [backend, status, error, me, data, mine, toast, notify, refresh, load]);

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

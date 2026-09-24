"use client";

import { DashboardView } from "./views/dashboard";
import { GroupDetailView, GroupsView } from "./views/groups";
import { HistoryView } from "./views/history";
import { LogView } from "./views/log";
import { ProfileView } from "./views/profile";
import { NewRouteView, RouteDetailView, RoutesView } from "./views/routes";

/** Path to screen, shared by the Next.js pages and the single-file build. */
export const SCREENS: Record<string, () => React.JSX.Element> = {
  "/": DashboardView,
  "/dashboard": DashboardView,
  "/login": DashboardView,
  "/log": LogView,
  "/mivtzoim": LogView,
  "/groups": GroupsView,
  "/groups/view": GroupDetailView,
  "/routes": RoutesView,
  "/routes/new": NewRouteView,
  "/routes/view": RouteDetailView,
  "/history": HistoryView,
  "/profile": ProfileView,
};

export function Screen({ path }: { path: string }) {
  const View = SCREENS[path] ?? DashboardView;
  return <View />;
}

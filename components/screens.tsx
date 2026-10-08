"use client";

import { AdminView } from "./views/admin";
import { DashboardView } from "./views/dashboard";
import { HistoryView } from "./views/history";
import { LogView } from "./views/log";
import { ProfileView } from "./views/profile";
import { NewRouteView, RouteDetailView, RoutesView } from "./views/routes";
import { PhotosView } from "./views/photos";

/** Path to screen, shared by the Next.js pages and the single-file build. */
export const SCREENS: Record<string, () => React.JSX.Element> = {
  "/": DashboardView,
  "/dashboard": DashboardView,
  "/login": DashboardView,
  "/log": LogView,
  "/mivtzoim": LogView,
  "/routes": RoutesView,
  "/routes/new": NewRouteView,
  "/routes/view": RouteDetailView,
  "/history": HistoryView,
  "/photos": PhotosView,
  "/profile": ProfileView,
  "/admin": AdminView,
  // The account desk fills the whole screen (see AppShell); this is only its address.
  "/accounts": AdminView,
};

export function Screen({ path }: { path: string }) {
  const View = SCREENS[path] ?? DashboardView;
  return <View />;
}

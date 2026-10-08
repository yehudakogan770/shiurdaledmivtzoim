export type CategoryType = "tefillin" | "shabbos_candles" | "personal";

export interface Profile {
  id: string;
  name: string;
  username?: string | null;
  email?: string | null;
  /** Mivtzoim chavrusas (partners) who go out with this person. */
  partners?: string[] | null;
  role?: "user" | "admin";
  /** The site's language for this account: "en", "he", "fr" or "es". */
  language?: string | null;
}

/** "Mendel Cohen & Yossi Levi" */
/** An account is named after its route; the Chavrusas' names are kept separately (never mixed in). */
export function displayName(p: Pick<Profile, "name" | "partners">) {
  return p.name?.trim() || "Route";
}

/** A photo someone shared. Stored twice, small: a full photo and a preview for the scrolling wall. */
export interface Photo {
  id: string;
  user_id: string;
  path: string;
  thumb_path: string;
  width: number;
  height: number;
  /** Size of both files together, for the storage meter. */
  bytes: number;
  /** The photo's overall colour ("#rrggbb"), measured on the phone, for arranging the wall. */
  color?: string | null;
  created_at: string;
  /** Filled in when the photos are loaded. */
  url?: string;
  thumbUrl?: string;
}

export interface SignUpInput {
  name: string;
  partners: string[];
  username: string;
  email: string;
  password: string;
  /** Chosen on the sign-up form; English unless they pick another. */
  language?: string;
}

export interface Group {
  id: string;
  name: string;
  join_code: string;
  created_by: string;
  created_at: string;
}

export interface GroupMember {
  id: string;
  group_id: string;
  user_id: string;
  member_role: "owner" | "member";
  joined_at: string;
}

export interface Route {
  id: string;
  name: string;
  description?: string | null;
  group_id: string | null;
  created_by: string;
  created_at: string;
}

export interface Location {
  id: string;
  name: string;
  address?: string | null;
  type?: string | null;
  notes?: string | null;
  created_by: string;
  created_at: string;
}

/**
 * Extra details for a place on a route, often from its business card. Only the person whose
 * route it is, and the Owner, can see these and the card picture (not other admins).
 */
export interface LocationCard {
  location_id: string;
  user_id: string;
  contact?: string | null;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  image_path?: string | null;
  updated_at?: string;
  /** Filled in when loaded: a link to the card picture that works for a while. */
  imageUrl?: string | null;
}

export interface RouteLocation {
  id: string;
  route_id: string;
  location_id: string;
  position: number;
  completed: boolean;
}

/** A stretch of weeks a mivtza is hidden: from `from` (none: the start) until `to` (none: from then on). */
export interface HiddenRange {
  from: string | null;
  to: string | null;
}

export interface PersonalCategory {
  id: string;
  user_id: string;
  name: string;
  description?: string | null;
  icon: string;
  status: "active" | "archived";
  /** Set by an admin: the category is offered to everyone. */
  shared?: boolean;
  /** Where an admin placed it on the front page (lower first). */
  position?: number | null;
  /**
   * The stretches of weeks it's hidden in (weeks are their Friday, YYYY-MM-DD; `to` is the first week
   * it shows again). None: hidden in every week when archived, otherwise never.
   */
  hidden_weeks?: HiddenRange[] | null;
  created_at: string;
}

export interface Activity {
  id: string;
  user_id: string;
  group_id: string | null;
  route_id: string | null;
  location_id: string | null;
  category_type: CategoryType;
  personal_category_id: string | null;
  quantity: number;
  notes: string | null;
  activity_date: string; // YYYY-MM-DD
  created_at: string;
}

export interface Tables {
  profiles: Profile;
  groups: Group;
  group_members: GroupMember;
  routes: Route;
  locations: Location;
  route_locations: RouteLocation;
  personal_categories: PersonalCategory;
  mivtzoim_activity: Activity;
}

export type TableName = keyof Tables;

/** Website text an admin can edit from the Admin page. */
export interface SiteSettings {
  site_name: string;
  tagline: string;
  welcome: string;
  announcement: string;
}

export const DEFAULT_SETTINGS: SiteSettings = {
  site_name: "Shiur Daled Mivtzoim",
  tagline: "",
  welcome: "Track your Mivtzoim, your routes and the people you visit, all in one place.",
  announcement: "",
};

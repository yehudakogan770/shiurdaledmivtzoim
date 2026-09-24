export type CategoryType = "tefillin" | "shabbos_candles" | "personal";

export interface Profile {
  id: string;
  name: string;
  email?: string | null;
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

export interface RouteLocation {
  id: string;
  route_id: string;
  location_id: string;
  position: number;
  completed: boolean;
}

export interface PersonalCategory {
  id: string;
  user_id: string;
  name: string;
  description?: string | null;
  icon: string;
  status: "active" | "archived";
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

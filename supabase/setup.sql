-- Shiur Daled Mivtzoim: complete database setup.
-- Paste this whole file into Supabase → SQL Editor → New query, then click Run.
-- It is the five files in supabase/migrations/ joined in order.

-- ============================================================
-- supabase/migrations/001_initial.sql
-- ============================================================
-- Shiur Daled Mivtzoim starter schema
create extension if not exists "uuid-ossp";

create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text,
  avatar_url text,
  role text not null default 'user' check (role in ('user','admin')),
  created_at timestamptz not null default now()
);

create table if not exists groups (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  created_by uuid not null references profiles(id) on delete restrict,
  created_at timestamptz not null default now()
);

create table if not exists group_members (
  id uuid primary key default uuid_generate_v4(),
  group_id uuid not null references groups(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  member_role text not null default 'member' check (member_role in ('owner','member')),
  joined_at timestamptz not null default now(),
  unique(group_id, user_id)
);

create table if not exists group_invitations (
  id uuid primary key default uuid_generate_v4(),
  group_id uuid not null references groups(id) on delete cascade,
  invited_user_id uuid not null references profiles(id) on delete cascade,
  invited_by uuid not null references profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','accepted','declined')),
  created_at timestamptz not null default now()
);

create table if not exists routes (
  id uuid primary key default uuid_generate_v4(),
  group_id uuid not null references groups(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists locations (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  address text,
  type text,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists route_locations (
  id uuid primary key default uuid_generate_v4(),
  route_id uuid not null references routes(id) on delete cascade,
  location_id uuid not null references locations(id) on delete cascade,
  position integer not null default 0,
  completed boolean not null default false,
  unique(route_id, location_id)
);

create table if not exists weeks (
  id uuid primary key default uuid_generate_v4(),
  start_date date not null,
  end_date date not null,
  title text not null,
  status text not null default 'open' check (status in ('open','closed')),
  created_at timestamptz not null default now()
);

create table if not exists personal_categories (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references profiles(id) on delete cascade,
  name text not null,
  description text,
  icon text not null default 'circle',
  status text not null default 'active' check (status in ('active','archived')),
  created_at timestamptz not null default now()
);

create table if not exists mivtzoim_activity (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references profiles(id) on delete restrict,
  group_id uuid references groups(id) on delete set null,
  week_id uuid references weeks(id) on delete set null,
  route_id uuid references routes(id) on delete set null,
  location_id uuid references locations(id) on delete set null,
  category_type text not null check (category_type in ('tefillin','shabbos_candles','personal')),
  personal_category_id uuid references personal_categories(id) on delete set null,
  quantity integer not null check (quantity >= 0),
  notes text,
  activity_date date not null default current_date,
  created_at timestamptz not null default now()
);

-- Standard categories are represented by category_type:
-- tefillin, shabbos_candles.
-- Personal categories are user-specific via personal_category_id.

create index if not exists idx_activity_user on mivtzoim_activity(user_id);
create index if not exists idx_activity_date on mivtzoim_activity(activity_date);
create index if not exists idx_activity_group on mivtzoim_activity(group_id);
create index if not exists idx_personal_categories_user on personal_categories(user_id);

alter table profiles enable row level security;
alter table personal_categories enable row level security;
alter table mivtzoim_activity enable row level security;

create policy "Users can view own profile"
on profiles for select using (auth.uid() = id);

create policy "Users can update own profile"
on profiles for update using (auth.uid() = id);

create policy "Users manage own personal categories"
on personal_categories for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Users view own activity"
on mivtzoim_activity for select using (auth.uid() = user_id);

create policy "Users create own activity"
on mivtzoim_activity for insert with check (auth.uid() = user_id);

create policy "Users update own activity"
on mivtzoim_activity for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Users delete own activity"
on mivtzoim_activity for delete using (auth.uid() = user_id);

-- ============================================================
-- supabase/migrations/002_app.sql
-- ============================================================
-- Shiur Daled Mivtzoim: everything the app needs on top of 001_initial.sql.
-- Join codes, personal routes, location ownership, profile creation on
-- sign-up, and row level security for every table.

alter table groups add column if not exists join_code text;
update groups set join_code = upper(substr(md5(random()::text), 1, 6)) where join_code is null;
alter table groups alter column join_code set not null;
alter table groups alter column join_code set default upper(substr(md5(random()::text), 1, 6));
create unique index if not exists idx_groups_join_code on groups(join_code);

alter table routes alter column group_id drop not null;
alter table routes add column if not exists created_by uuid references profiles(id) on delete cascade;
alter table routes add column if not exists description text;

alter table locations add column if not exists created_by uuid references profiles(id) on delete cascade;

-- Create a profile row whenever someone signs up.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, name)
  values (new.id, coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)))
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
for each row execute function public.handle_new_user();

-- Helpers used by the policies. security definer avoids recursive RLS checks.
create or replace function public.is_group_member(gid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from group_members where group_id = gid and user_id = auth.uid());
$$;

create or replace function public.shares_group(uid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from group_members a join group_members b on a.group_id = b.group_id
    where a.user_id = auth.uid() and b.user_id = uid
  );
$$;

create or replace function public.can_access_route(rid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from routes r
    where r.id = rid and (r.created_by = auth.uid() or (r.group_id is not null and public.is_group_member(r.group_id)))
  );
$$;

-- Join a group by its code. Returns the group id.
create or replace function public.join_group(code text)
returns uuid language plpgsql security definer set search_path = public as $$
declare gid uuid;
begin
  select id into gid from groups where join_code = upper(trim(code));
  if gid is null then raise exception 'No group has that code'; end if;
  insert into group_members (group_id, user_id, member_role)
  values (gid, auth.uid(), 'member') on conflict (group_id, user_id) do nothing;
  return gid;
end $$;

-- Add the creator as owner when a group is made.
create or replace function public.handle_new_group()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into group_members (group_id, user_id, member_role) values (new.id, new.created_by, 'owner')
  on conflict (group_id, user_id) do nothing;
  return new;
end $$;

drop trigger if exists on_group_created on groups;
create trigger on_group_created after insert on groups
for each row execute function public.handle_new_group();

-- Row level security on every table.
alter table groups enable row level security;
alter table group_members enable row level security;
alter table group_invitations enable row level security;
alter table routes enable row level security;
alter table locations enable row level security;
alter table route_locations enable row level security;
alter table weeks enable row level security;

drop policy if exists "Users can view own profile" on profiles;
create policy "View own and group members' profiles" on profiles for select
using (auth.uid() = id or public.shares_group(id));

create policy "Members view group" on groups for select
using (created_by = auth.uid() or public.is_group_member(id));
create policy "Create own group" on groups for insert with check (created_by = auth.uid());
create policy "Owner updates group" on groups for update using (created_by = auth.uid());
create policy "Owner deletes group" on groups for delete using (created_by = auth.uid());

create policy "Members view membership" on group_members for select
using (public.is_group_member(group_id));
create policy "Leave group or owner removes" on group_members for delete
using (user_id = auth.uid() or exists (select 1 from groups g where g.id = group_id and g.created_by = auth.uid()));

create policy "View own invitations" on group_invitations for select
using (invited_user_id = auth.uid() or invited_by = auth.uid());

create policy "View accessible routes" on routes for select
using (created_by = auth.uid() or (group_id is not null and public.is_group_member(group_id)));
create policy "Create routes" on routes for insert
with check (created_by = auth.uid() and (group_id is null or public.is_group_member(group_id)));
create policy "Edit accessible routes" on routes for update
using (created_by = auth.uid() or (group_id is not null and public.is_group_member(group_id)));
create policy "Creator deletes route" on routes for delete using (created_by = auth.uid());

create policy "View reachable locations" on locations for select
using (created_by = auth.uid() or exists (
  select 1 from route_locations rl where rl.location_id = locations.id and public.can_access_route(rl.route_id)));
create policy "Create own locations" on locations for insert with check (created_by = auth.uid());
create policy "Edit reachable locations" on locations for update
using (created_by = auth.uid() or exists (
  select 1 from route_locations rl where rl.location_id = locations.id and public.can_access_route(rl.route_id)));
create policy "Delete own locations" on locations for delete using (created_by = auth.uid());

create policy "Route stops follow route access" on route_locations for all
using (public.can_access_route(route_id)) with check (public.can_access_route(route_id));

create policy "Anyone signed in reads weeks" on weeks for select using (auth.uid() is not null);

create policy "Group members view group activity" on mivtzoim_activity for select
using (group_id is not null and public.is_group_member(group_id));

-- ============================================================
-- supabase/migrations/003_usernames.sql
-- ============================================================
-- Sign in with a username instead of an email address.
-- The app signs users in with an internal address (<username>@users.shiurdaledmivtzoim.app),
-- so turn OFF "Confirm email" under Authentication → Sign In / Providers → Email.

alter table profiles add column if not exists username text;
create unique index if not exists idx_profiles_username on profiles (lower(username));

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, name, username)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;
  return new;
end $$;

-- ============================================================
-- supabase/migrations/004_admin.sql
-- ============================================================
-- Admin accounts, editable website settings and categories shared with everyone.
-- The account signed up with sdmivtzoim87@gmail.com becomes an admin automatically.
-- Create that account right after running this file, before sharing the site.

-- Who is an admin ----------------------------------------------------------

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and role = 'admin');
$$;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, name, username, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data->>'username', new.email),
    case when lower(new.email) in ('sdmivtzoim87@gmail.com') then 'admin' else 'user' end
  )
  on conflict (id) do nothing;
  return new;
end $$;

-- If the admin account already exists, promote it now.
update profiles p set role = 'admin'
from auth.users u
where u.id = p.id and lower(u.email) in ('sdmivtzoim87@gmail.com');

-- Only admins may change anyone's role (including their own).
create or replace function public.protect_role()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.role is distinct from old.role and not public.is_admin() then
    raise exception 'Only an admin can change roles';
  end if;
  return new;
end $$;

drop trigger if exists protect_profile_role on profiles;
create trigger protect_profile_role before update on profiles
for each row execute function public.protect_role();

create policy "Admins view all profiles" on profiles for select using (public.is_admin());
create policy "Admins update profiles" on profiles for update using (public.is_admin());

-- Admins see and manage everything --------------------------------------------

create policy "Admins view all groups" on groups for select using (public.is_admin());
create policy "Admins delete groups" on groups for delete using (public.is_admin());
create policy "Admins view all memberships" on group_members for select using (public.is_admin());
create policy "Admins view all activity" on mivtzoim_activity for select using (public.is_admin());

-- Website settings -------------------------------------------------------------

create table if not exists site_settings (
  id integer primary key default 1 check (id = 1),
  site_name text not null default 'Shiur Daled Mivtzoim',
  tagline text not null default '',
  welcome text not null default 'Start tracking tefillin, Shabbos candles and every other mivtza.',
  announcement text not null default '',
  updated_at timestamptz not null default now(),
  updated_by uuid references profiles(id) on delete set null
);
insert into site_settings (id) values (1) on conflict (id) do nothing;

alter table site_settings enable row level security;
create policy "Everyone reads site settings" on site_settings for select using (true);
create policy "Admins edit site settings" on site_settings for update using (public.is_admin()) with check (public.is_admin());

-- Categories an admin shares with everyone ---------------------------------------

alter table personal_categories add column if not exists shared boolean not null default false;

create policy "Everyone signed in sees shared categories" on personal_categories for select
using (shared and auth.uid() is not null);

create or replace function public.protect_shared_category()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.shared and not public.is_admin() then
    raise exception 'Only an admin can share a category with everyone';
  end if;
  return new;
end $$;

drop trigger if exists protect_shared_category on personal_categories;
create trigger protect_shared_category before insert or update on personal_categories
for each row execute function public.protect_shared_category();

-- Admins see everything people do ------------------------------------------------

create policy "Admins view all routes" on routes for select using (public.is_admin());
create policy "Admins view all locations" on locations for select using (public.is_admin());
create policy "Admins view all route stops" on route_locations for select using (public.is_admin());
create policy "Admins view all categories" on personal_categories for select using (public.is_admin());

-- ============================================================
-- supabase/migrations/005_email_accounts.sql
-- ============================================================
-- Accounts have a real email address (for the confirmation link and password
-- resets) and a username (for signing in). Profiles can list mivtzoim chavrusas.
--
-- After running this file:
--   * Authentication → Sign In / Providers → Email: turn ON "Confirm email".
--   * Authentication → URL Configuration: set Site URL to the website address
--     (for example https://yehudakogan770.github.io/shiurdaledmivtzoim/) and add it to Redirect URLs.
--   * Authentication → Email Templates → Reset Password: add the line
--       Your username is {{ .Data.username }}
--     so a forgotten username comes back with the reset link.

alter table profiles add column if not exists partners text[] not null default '{}';

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, name, username, partners, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)),
    lower(coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1))),
    coalesce(array(select jsonb_array_elements_text(new.raw_user_meta_data->'partners')), '{}'),
    case when lower(new.email) in ('sdmivtzoim87@gmail.com') then 'admin' else 'user' end
  )
  on conflict (id) do nothing;
  return new;
end $$;

-- Sign in with a username: find the email address it belongs to.
create or replace function public.login_email(p_username text)
returns text language sql stable security definer set search_path = public as $$
  select u.email::text from auth.users u join profiles p on p.id = u.id
  where lower(p.username) = lower(trim(p_username)) limit 1;
$$;

create or replace function public.username_available(p_username text)
returns boolean language sql stable security definer set search_path = public as $$
  select not exists (select 1 from profiles where lower(username) = lower(trim(p_username)));
$$;

grant execute on function public.login_email(text) to anon, authenticated;
grant execute on function public.username_available(text) to anon, authenticated;

-- Admins see everyone's email address on the Admin page.
create or replace function public.admin_people()
returns table (id uuid, name text, username text, email text, partners text[], role text)
language sql stable security definer set search_path = public as $$
  select p.id, p.name, p.username, u.email::text, p.partners, p.role
  from profiles p join auth.users u on u.id = p.id
  where public.is_admin();
$$;
grant execute on function public.admin_people() to authenticated;

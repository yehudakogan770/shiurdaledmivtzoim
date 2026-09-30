-- Shiur Daled Mivtzoim: complete database setup.
-- Paste this whole file into Supabase → SQL Editor → New query, then click Run.
-- It is the files in supabase/migrations/ joined in order.

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

drop policy if exists "Users can view own profile" on profiles;
create policy "Users can view own profile"
on profiles for select using (auth.uid() = id);

drop policy if exists "Users can update own profile" on profiles;
create policy "Users can update own profile"
on profiles for update using (auth.uid() = id);

drop policy if exists "Users manage own personal categories" on personal_categories;
create policy "Users manage own personal categories"
on personal_categories for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Users view own activity" on mivtzoim_activity;
create policy "Users view own activity"
on mivtzoim_activity for select using (auth.uid() = user_id);

drop policy if exists "Users create own activity" on mivtzoim_activity;
create policy "Users create own activity"
on mivtzoim_activity for insert with check (auth.uid() = user_id);

drop policy if exists "Users update own activity" on mivtzoim_activity;
create policy "Users update own activity"
on mivtzoim_activity for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Users delete own activity" on mivtzoim_activity;
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
drop policy if exists "View own and group members' profiles" on profiles;
create policy "View own and group members' profiles" on profiles for select
using (auth.uid() = id or public.shares_group(id));

drop policy if exists "Members view group" on groups;
create policy "Members view group" on groups for select
using (created_by = auth.uid() or public.is_group_member(id));
drop policy if exists "Create own group" on groups;
create policy "Create own group" on groups for insert with check (created_by = auth.uid());
drop policy if exists "Owner updates group" on groups;
create policy "Owner updates group" on groups for update using (created_by = auth.uid());
drop policy if exists "Owner deletes group" on groups;
create policy "Owner deletes group" on groups for delete using (created_by = auth.uid());

drop policy if exists "Members view membership" on group_members;
create policy "Members view membership" on group_members for select
using (public.is_group_member(group_id));
drop policy if exists "Leave group or owner removes" on group_members;
create policy "Leave group or owner removes" on group_members for delete
using (user_id = auth.uid() or exists (select 1 from groups g where g.id = group_id and g.created_by = auth.uid()));

drop policy if exists "View own invitations" on group_invitations;
create policy "View own invitations" on group_invitations for select
using (invited_user_id = auth.uid() or invited_by = auth.uid());

drop policy if exists "View accessible routes" on routes;
create policy "View accessible routes" on routes for select
using (created_by = auth.uid() or (group_id is not null and public.is_group_member(group_id)));
drop policy if exists "Create routes" on routes;
create policy "Create routes" on routes for insert
with check (created_by = auth.uid() and (group_id is null or public.is_group_member(group_id)));
drop policy if exists "Edit accessible routes" on routes;
create policy "Edit accessible routes" on routes for update
using (created_by = auth.uid() or (group_id is not null and public.is_group_member(group_id)));
drop policy if exists "Creator deletes route" on routes;
create policy "Creator deletes route" on routes for delete using (created_by = auth.uid());

drop policy if exists "View reachable locations" on locations;
create policy "View reachable locations" on locations for select
using (created_by = auth.uid() or exists (
  select 1 from route_locations rl where rl.location_id = locations.id and public.can_access_route(rl.route_id)));
drop policy if exists "Create own locations" on locations;
create policy "Create own locations" on locations for insert with check (created_by = auth.uid());
drop policy if exists "Edit reachable locations" on locations;
create policy "Edit reachable locations" on locations for update
using (created_by = auth.uid() or exists (
  select 1 from route_locations rl where rl.location_id = locations.id and public.can_access_route(rl.route_id)));
drop policy if exists "Delete own locations" on locations;
create policy "Delete own locations" on locations for delete using (created_by = auth.uid());

drop policy if exists "Route stops follow route access" on route_locations;
create policy "Route stops follow route access" on route_locations for all
using (public.can_access_route(route_id)) with check (public.can_access_route(route_id));

drop policy if exists "Anyone signed in reads weeks" on weeks;
create policy "Anyone signed in reads weeks" on weeks for select using (auth.uid() is not null);

drop policy if exists "Group members view group activity" on mivtzoim_activity;
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

drop policy if exists "Admins view all profiles" on profiles;
create policy "Admins view all profiles" on profiles for select using (public.is_admin());
drop policy if exists "Admins update profiles" on profiles;
create policy "Admins update profiles" on profiles for update using (public.is_admin());

-- Admins see and manage everything --------------------------------------------

drop policy if exists "Admins view all groups" on groups;
create policy "Admins view all groups" on groups for select using (public.is_admin());
drop policy if exists "Admins delete groups" on groups;
create policy "Admins delete groups" on groups for delete using (public.is_admin());
drop policy if exists "Admins view all memberships" on group_members;
create policy "Admins view all memberships" on group_members for select using (public.is_admin());
drop policy if exists "Admins view all activity" on mivtzoim_activity;
create policy "Admins view all activity" on mivtzoim_activity for select using (public.is_admin());

-- Website settings -------------------------------------------------------------

create table if not exists site_settings (
  id integer primary key default 1 check (id = 1),
  site_name text not null default 'Shiur Daled Mivtzoim',
  tagline text not null default '',
  welcome text not null default 'Track your Mivtzoim, your routes and the people you visit, all in one place.',
  announcement text not null default '',
  updated_at timestamptz not null default now(),
  updated_by uuid references profiles(id) on delete set null
);
insert into site_settings (id) values (1) on conflict (id) do nothing;

alter table site_settings enable row level security;
drop policy if exists "Everyone reads site settings" on site_settings;
create policy "Everyone reads site settings" on site_settings for select using (true);
drop policy if exists "Admins edit site settings" on site_settings;
create policy "Admins edit site settings" on site_settings for update using (public.is_admin()) with check (public.is_admin());

-- Categories an admin shares with everyone ---------------------------------------

alter table personal_categories add column if not exists shared boolean not null default false;

drop policy if exists "Everyone signed in sees shared categories" on personal_categories;
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

drop policy if exists "Admins view all routes" on routes;
create policy "Admins view all routes" on routes for select using (public.is_admin());
drop policy if exists "Admins view all locations" on locations;
create policy "Admins view all locations" on locations for select using (public.is_admin());
drop policy if exists "Admins view all route stops" on route_locations;
create policy "Admins view all route stops" on route_locations for select using (public.is_admin());
drop policy if exists "Admins view all categories" on personal_categories;
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

-- ============================================================
-- supabase/migrations/006_admin_password_reset.sql
-- ============================================================
-- Password help without an email service: an admin can set a new password
-- for someone who forgot theirs (from the Admin page).

create extension if not exists pgcrypto with schema extensions;

create or replace function public.admin_set_password(p_user uuid, p_password text)
returns void language plpgsql security definer set search_path = public, extensions as $$
begin
  if not public.is_admin() then
    raise exception 'Only an admin can set passwords';
  end if;
  if length(coalesce(p_password, '')) < 6 then
    raise exception 'Passwords need at least 6 characters';
  end if;
  update auth.users
     set encrypted_password = crypt(p_password, gen_salt('bf')),
         updated_at = now()
   where id = p_user;
  if not found then
    raise exception 'No account found';
  end if;
end $$;

revoke all on function public.admin_set_password(uuid, text) from public, anon;
grant execute on function public.admin_set_password(uuid, text) to authenticated;

-- Any admin can edit, hide or remove the mivtzoim shared with everyone,
-- not only the admin who added them.
drop policy if exists "Admins manage shared categories" on personal_categories;
create policy "Admins manage shared categories" on personal_categories for all
  using (shared and public.is_admin()) with check (shared and public.is_admin());

-- Admins can fix or remove anyone's entries.
drop policy if exists "Admins edit all activity" on mivtzoim_activity;
create policy "Admins edit all activity" on mivtzoim_activity for update
  using (public.is_admin()) with check (public.is_admin());
drop policy if exists "Admins delete all activity" on mivtzoim_activity;
create policy "Admins delete all activity" on mivtzoim_activity for delete using (public.is_admin());

-- Admins can change someone's name, username, email and chavrusas.
create or replace function public.admin_update_person(
  p_user uuid, p_name text, p_username text, p_email text, p_partners text[]
)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_username text := lower(trim(coalesce(p_username, '')));
  v_email text := lower(trim(coalesce(p_email, '')));
  v_old_email text;
begin
  if not public.is_admin() then
    raise exception 'Only an admin can edit accounts';
  end if;
  if length(trim(coalesce(p_name, ''))) = 0 then
    raise exception 'Enter their name';
  end if;
  if v_username !~ '^[a-z0-9._-]{3,20}$' then
    raise exception 'Usernames are 3 to 20 characters: letters, numbers, dots, dashes or underscores.';
  end if;
  if v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception 'Enter a real email address';
  end if;
  if exists (select 1 from profiles where lower(username) = v_username and id <> p_user) then
    raise exception 'That username is taken';
  end if;
  if exists (select 1 from auth.users where lower(email) = v_email and id <> p_user) then
    raise exception 'That email already has an account';
  end if;

  select email into v_old_email from auth.users where id = p_user;
  if not found then
    raise exception 'No account found';
  end if;

  update profiles
     set name = trim(p_name), username = v_username, partners = coalesce(p_partners, '{}')
   where id = p_user;

  if v_email is distinct from lower(v_old_email) then
    -- The admin vouches for the new address, so it counts as confirmed.
    update auth.users
       set email = v_email, email_confirmed_at = coalesce(email_confirmed_at, now()), updated_at = now()
     where id = p_user;
    update auth.identities
       set identity_data = identity_data || jsonb_build_object('email', v_email), updated_at = now()
     where user_id = p_user and provider = 'email';
  end if;
  update auth.users
     set raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb)
           || jsonb_build_object('name', trim(p_name), 'username', v_username)
   where id = p_user;
end $$;

revoke all on function public.admin_update_person(uuid, text, text, text, text[]) from public, anon;
grant execute on function public.admin_update_person(uuid, text, text, text, text[]) to authenticated;

-- Admins can delete an account with everything in it (entries, routes, own mivtzoim).
create or replace function public.admin_delete_person(p_user uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then
    raise exception 'Only an admin can delete accounts';
  end if;
  if p_user = auth.uid() then
    raise exception 'You can''t delete your own account from here';
  end if;
  delete from mivtzoim_activity where user_id = p_user;
  delete from groups where created_by = p_user;
  delete from auth.users where id = p_user;
  if not found then
    raise exception 'No account found';
  end if;
end $$;

revoke all on function public.admin_delete_person(uuid) from public, anon;
grant execute on function public.admin_delete_person(uuid) to authenticated;

-- Everyone's totals for the "this week" strip on the home page. Only the date,
-- mivtza and amount are shared (no names, notes or places).
create or replace function public.community_activity(p_from date, p_to date)
returns table (activity_date date, created_at timestamptz, category_type text, personal_category_id uuid, quantity integer, mine boolean)
language sql stable security definer set search_path = public as $$
  select a.activity_date, a.created_at, a.category_type, a.personal_category_id, a.quantity, a.user_id = auth.uid()
  from mivtzoim_activity a
  where auth.uid() is not null
    and a.activity_date between p_from and p_to
    and (a.category_type <> 'personal'
         or exists (select 1 from personal_categories c where c.id = a.personal_category_id and c.shared))
$$;

revoke all on function public.community_activity(date, date) from public, anon;
grant execute on function public.community_activity(date, date) to authenticated;

-- ============================================================
-- supabase/migrations/007_mivtza_order.sql
-- ============================================================
-- The order of the mivtzoim on everyone's front page, set by an admin.
alter table personal_categories add column if not exists position integer;

-- 008 ---------------------------------------------------------------------------
-- People without an account see the same mivtzoim as everyone else in the sample:
-- the names, icons and order of the shared items only. No one's entries or accounts.
create or replace function public.shared_mivtzoim()
returns table (id uuid, name text, description text, icon text, status text, "position" integer, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select c.id, c.name, c.description, c.icon, c.status, c.position, c.created_at
  from personal_categories c
  where c.shared;
$$;

revoke all on function public.shared_mivtzoim() from public;
grant execute on function public.shared_mivtzoim() to anon, authenticated;

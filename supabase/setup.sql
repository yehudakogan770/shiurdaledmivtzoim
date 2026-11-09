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

-- 009 ---------------------------------------------------------------------------
-- Hide or bring back a mivtza by week: the stretches of weeks it's hidden in, like
-- [{"from": "2026-10-09", "to": null}]. Weeks outside them still show it.
alter table personal_categories add column if not exists hidden_weeks jsonb;

-- The sample (people without an account) needs the hidden weeks too.
drop function if exists public.shared_mivtzoim();
create function public.shared_mivtzoim()
returns table (id uuid, name text, description text, icon text, status text, "position" integer, hidden_weeks jsonb, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select c.id, c.name, c.description, c.icon, c.status, c.position, c.hidden_weeks, c.created_at
  from personal_categories c
  where c.shared;
$$;

revoke all on function public.shared_mivtzoim() from public;
grant execute on function public.shared_mivtzoim() to anon, authenticated;

-- 010 ---------------------------------------------------------------------------
-- The Owner (the site's main account) can change and delete anyone's routes and stops.
create or replace function public.is_owner()
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_admin() and exists (
    select 1 from auth.users u where u.id = auth.uid() and lower(u.email) = 'sdmivtzoim87@gmail.com');
$$;

drop policy if exists "Owner edits all routes" on routes;
create policy "Owner edits all routes" on routes for update using (public.is_owner()) with check (public.is_owner());
drop policy if exists "Owner deletes all routes" on routes;
create policy "Owner deletes all routes" on routes for delete using (public.is_owner());
drop policy if exists "Owner edits all locations" on locations;
create policy "Owner edits all locations" on locations for update using (public.is_owner()) with check (public.is_owner());
drop policy if exists "Owner deletes all locations" on locations;
create policy "Owner deletes all locations" on locations for delete using (public.is_owner());
drop policy if exists "Owner manages all route stops" on route_locations;
create policy "Owner manages all route stops" on route_locations for all using (public.is_owner()) with check (public.is_owner());

-- 011 ---------------------------------------------------------------------------
-- Photos: everyone can see them; anyone signed in can add their own; the person who shared a
-- photo, or an admin, can delete it. Files live in a public "photos" storage bucket, made small
-- on the phone first (about 100 KB each with its preview).
create table if not exists public.photos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  path text not null,
  thumb_path text not null,
  width integer not null default 0,
  height integer not null default 0,
  bytes integer not null default 0,
  color text,
  created_at timestamptz not null default now()
);
-- Each photo's overall colour, so the wall can put photos that set each other off side by side.
alter table public.photos add column if not exists color text;
create index if not exists idx_photos_created on public.photos(created_at desc);
alter table public.photos enable row level security;

drop policy if exists "Everyone sees photos" on public.photos;
create policy "Everyone sees photos" on public.photos for select using (true);
drop policy if exists "People add their own photos" on public.photos;
create policy "People add their own photos" on public.photos for insert with check (user_id = auth.uid());
drop policy if exists "Sharer or admin deletes a photo" on public.photos;
create policy "Sharer or admin deletes a photo" on public.photos for delete using (user_id = auth.uid() or public.is_admin());
grant select on public.photos to anon, authenticated;
grant insert, delete on public.photos to authenticated;

-- The files: public to look at, at most 2 MB each, only WebP or JPEG.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('photos', 'photos', true, 2097152, array['image/webp', 'image/jpeg'])
on conflict (id) do update set public = true, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Photos: see files" on storage.objects;
create policy "Photos: see files" on storage.objects for select using (bucket_id = 'photos');
drop policy if exists "Photos: add to your own folder" on storage.objects;
create policy "Photos: add to your own folder" on storage.objects for insert to authenticated
with check (bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "Photos: sharer or admin deletes" on storage.objects;
create policy "Photos: sharer or admin deletes" on storage.objects for delete to authenticated
using (bucket_id = 'photos' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin()));

-- 012: Business cards for places on routes.
-- Phone, email, contact person, website and the card picture for a place. Only the person whose
-- route it is, and the Owner, can see or change them; other admins can't. Safe to run again.

create table if not exists public.location_cards (
  location_id uuid primary key references public.locations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  contact text,
  phone text,
  email text,
  website text,
  image_path text,
  updated_at timestamptz not null default now()
);
alter table public.location_cards enable row level security;

drop policy if exists "Own cards, or the Owner: see" on public.location_cards;
create policy "Own cards, or the Owner: see" on public.location_cards for select
using (user_id = auth.uid() or public.is_owner());
-- Only for a place that person made.
drop policy if exists "Own cards, or the Owner: add" on public.location_cards;
create policy "Own cards, or the Owner: add" on public.location_cards for insert to authenticated
with check (
  (user_id = auth.uid() or public.is_owner())
  and exists (select 1 from public.locations l where l.id = location_id and l.created_by = user_id)
);
drop policy if exists "Own cards, or the Owner: change" on public.location_cards;
create policy "Own cards, or the Owner: change" on public.location_cards for update to authenticated
using (user_id = auth.uid() or public.is_owner())
with check (
  (user_id = auth.uid() or public.is_owner())
  and exists (select 1 from public.locations l where l.id = location_id and l.created_by = user_id)
);
drop policy if exists "Own cards, or the Owner: delete" on public.location_cards;
create policy "Own cards, or the Owner: delete" on public.location_cards for delete to authenticated
using (user_id = auth.uid() or public.is_owner());

grant select, insert, update, delete on public.location_cards to authenticated;

-- The card pictures: a private folder per person, 1 MB each at most (they're about 30 KB).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('cards', 'cards', false, 1048576, array['image/webp', 'image/jpeg'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Cards: see own, or the Owner" on storage.objects;
create policy "Cards: see own, or the Owner" on storage.objects for select to authenticated
using (bucket_id = 'cards' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_owner()));
drop policy if exists "Cards: add own, or the Owner" on storage.objects;
create policy "Cards: add own, or the Owner" on storage.objects for insert to authenticated
with check (bucket_id = 'cards' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_owner()));
drop policy if exists "Cards: replace own, or the Owner" on storage.objects;
create policy "Cards: replace own, or the Owner" on storage.objects for update to authenticated
using (bucket_id = 'cards' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_owner()))
with check (bucket_id = 'cards' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_owner()));
drop policy if exists "Cards: delete own, or the Owner" on storage.objects;
create policy "Cards: delete own, or the Owner" on storage.objects for delete to authenticated
using (bucket_id = 'cards' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_owner()));

-- ============================================================
-- supabase/migrations/013_owner_create_account.sql
-- ============================================================
-- 013: The Owner can create an account for someone who has no phone or computer of their own,
-- right on the Owner's device. No confirmation email: the Owner vouches for the address, and
-- the Owner stays signed in. The usual sign-up trigger makes the profile, so the new route
-- shows up everywhere like any other account.

create extension if not exists pgcrypto with schema extensions;

create or replace function public.owner_create_account(
  p_name text, p_username text, p_email text, p_password text, p_partners text[], p_language text
)
returns uuid language plpgsql security definer set search_path = public, extensions as $$
declare
  v_id uuid := gen_random_uuid();
  v_username text := lower(trim(coalesce(p_username, '')));
  v_email text := lower(trim(coalesce(p_email, '')));
begin
  if not public.is_owner() then
    raise exception 'Only the Owner can create accounts here';
  end if;
  if length(trim(coalesce(p_name, ''))) = 0 then
    raise exception 'Enter the route name';
  end if;
  if v_username !~ '^[a-z0-9._-]{3,20}$' then
    raise exception 'Usernames are 3 to 20 characters: letters, numbers, dots, dashes or underscores.';
  end if;
  if v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception 'Enter a real email address';
  end if;
  if length(coalesce(p_password, '')) < 6 then
    raise exception 'Passwords need at least 6 characters';
  end if;
  if exists (select 1 from profiles where lower(username) = v_username) then
    raise exception 'That username is taken';
  end if;
  if exists (select 1 from auth.users where lower(email) = v_email) then
    raise exception 'That email already has an account';
  end if;

  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change,
    email_change_token_current, reauthentication_token, phone_change, phone_change_token
  ) values (
    '00000000-0000-0000-0000-000000000000', v_id, 'authenticated', 'authenticated', v_email,
    crypt(p_password, gen_salt('bf')), now(),
    jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email')),
    jsonb_build_object(
      'name', trim(p_name), 'username', v_username,
      'partners', to_jsonb(coalesce(p_partners, '{}'::text[])),
      'language', coalesce(nullif(trim(p_language), ''), 'en'),
      'email_verified', true
    ),
    now(), now(), '', '', '', '', '', '', '', ''
  );

  insert into auth.identities (id, user_id, provider_id, identity_data, provider, created_at, updated_at)
  values (
    gen_random_uuid(), v_id, v_id::text,
    jsonb_build_object('sub', v_id::text, 'email', v_email, 'email_verified', true, 'phone_verified', false),
    'email', now(), now()
  );

  return v_id;
end $$;

revoke all on function public.owner_create_account(text, text, text, text, text[], text) from public, anon;
grant execute on function public.owner_create_account(text, text, text, text, text[], text) to authenticated;

-- ============================================================
-- supabase/migrations/014_owner_logs_for_anyone.sql
-- ============================================================
-- 014: On the account desk, someone without a phone of their own finds their account on the
-- Owner's device and logs their Mivtzoim there. The Owner can already see, fix and remove
-- everyone's entries; this lets the Owner's device add entries for them too.
drop policy if exists "Owner logs for anyone" on mivtzoim_activity;
create policy "Owner logs for anyone" on mivtzoim_activity for insert with check (public.is_owner());

-- ============================================================
-- supabase/migrations/015_photo_drive.sql
-- ============================================================
-- 015: Print copies of photos in the Owner's Google Drive. The address of the Owner's Google
-- Apps Script is kept here: signed-in people's phones read it (to send the print copies there),
-- and only the Owner can set it. It isn't shown to visitors without an account.
create table if not exists photo_drive (
  id integer primary key default 1 check (id = 1),
  url text,
  updated_at timestamptz not null default now()
);

alter table photo_drive enable row level security;
drop policy if exists "Signed-in people read the photo drive" on photo_drive;
create policy "Signed-in people read the photo drive" on photo_drive for select to authenticated using (true);
drop policy if exists "Owner sets the photo drive" on photo_drive;
create policy "Owner sets the photo drive" on photo_drive for all using (public.is_owner()) with check (public.is_owner());

-- ============================================================
-- supabase/migrations/016_report_viewers.sql
-- ============================================================
-- 016: The weekly report. The Owner sets up the items (Scrolls, Candles…); each week the Owner,
-- admins, and accounts the Owner allows fill in how many were sold and how many are needed for
-- next week. Only the Owner adds, renames or removes items, and only the Owner chooses who else
-- can see and fill in the report (report_viewers). Safe to run twice.
create table if not exists report_viewers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table report_viewers enable row level security;
drop policy if exists "Owner manages report viewers" on report_viewers;
create policy "Owner manages report viewers" on report_viewers for all using (public.is_owner()) with check (public.is_owner());
drop policy if exists "See whether you can see the report" on report_viewers;
create policy "See whether you can see the report" on report_viewers for select using (user_id = auth.uid() or public.is_admin());
grant select, insert, delete on report_viewers to authenticated;

-- Admins, and accounts the Owner allowed.
create or replace function public.can_report()
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_admin() or exists (select 1 from report_viewers v where v.user_id = auth.uid());
$$;

create table if not exists report_items (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  position integer,
  created_at timestamptz not null default now()
);
alter table report_items enable row level security;
drop policy if exists "Report people see the items" on report_items;
create policy "Report people see the items" on report_items for select using (public.can_report());
drop policy if exists "Owner manages the items" on report_items;
create policy "Owner manages the items" on report_items for all using (public.is_owner()) with check (public.is_owner());
grant select, insert, update, delete on report_items to authenticated;

create table if not exists report_counts (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references report_items(id) on delete cascade,
  week date not null,
  sold integer check (sold >= 0),
  needed integer check (needed >= 0),
  updated_by uuid references profiles(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  unique (item_id, week)
);
alter table report_counts enable row level security;
drop policy if exists "Report people fill in the numbers" on report_counts;
create policy "Report people fill in the numbers" on report_counts for all using (public.can_report()) with check (public.can_report());
grant select, insert, update, delete on report_counts to authenticated;

-- An earlier version of this update counted logged Mivtzoim instead; no longer used.
drop function if exists public.report_activity(date, date);

-- ============================================================
-- supabase/migrations/017_posters.sql
-- ============================================================
-- 017: Posters. The Owner uploads a picture that pops up for every account when they open the
-- site, as many times as the Owner chooses (or every time), until an end date if one is set.
-- Everyone signed in can read the posters; only the Owner adds, changes or removes them. The
-- picture itself goes in the Owner's own folder of the "photos" bucket. Safe to run twice.
create table if not exists posters (
  id uuid primary key default gen_random_uuid(),
  image_url text not null,
  times integer check (times is null or times > 0),
  ends date,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
alter table posters enable row level security;
drop policy if exists "Signed-in people see posters" on posters;
create policy "Signed-in people see posters" on posters for select to authenticated using (true);
drop policy if exists "Owner manages posters" on posters;
create policy "Owner manages posters" on posters for all using (public.is_owner()) with check (public.is_owner());
grant select, insert, update, delete on posters to authenticated;

-- ============================================================
-- supabase/migrations/018_poster_start.sql
-- ============================================================
-- 018: A poster can have a starting date: it shows from that day on. Safe to run twice.
alter table posters add column if not exists starts date;

-- ============================================================
-- supabase/migrations/019_chanukah.sql
-- ============================================================
-- 019: Chanukah. Each entry is one stop: who went, where, day or night, every menorah lit there
-- (with how many people lit it), how many menorahs were given out, and anything else. One person
-- logs it for the group. Everyone sees only their own entries (the Owner sees all of them), but
-- everyone sees the shiur's totals through chanukah_totals(). Test entries (from the Owner's test
-- mode or a tester) never count in the totals. Safe to run twice.
create table if not exists chanukah_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade default auth.uid(),
  -- The Hebrew year, like 5787.
  year integer not null,
  entry_date date not null,
  time_of_day text not null default 'night' check (time_of_day in ('day', 'night')),
  place text not null default '',
  -- Names of everyone who went.
  people jsonb not null default '[]'::jsonb,
  -- One number per menorah lit: how many people lit it.
  menorahs jsonb not null default '[]'::jsonb,
  given_out integer not null default 0 check (given_out >= 0),
  notes text,
  is_test boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists chanukah_entries_year on chanukah_entries (year);
alter table chanukah_entries enable row level security;
drop policy if exists "See own Chanukah entries" on chanukah_entries;
create policy "See own Chanukah entries" on chanukah_entries for select using (user_id = auth.uid() or public.is_owner());
drop policy if exists "Add own Chanukah entries" on chanukah_entries;
create policy "Add own Chanukah entries" on chanukah_entries for insert with check (user_id = auth.uid());
drop policy if exists "Change own Chanukah entries" on chanukah_entries;
create policy "Change own Chanukah entries" on chanukah_entries for update using (user_id = auth.uid() or public.is_owner()) with check (user_id = auth.uid() or public.is_owner());
drop policy if exists "Delete own Chanukah entries" on chanukah_entries;
create policy "Delete own Chanukah entries" on chanukah_entries for delete using (user_id = auth.uid() or public.is_owner());
grant select, insert, update, delete on chanukah_entries to authenticated;

-- The shiur's totals for a year, without anyone's names. Test entries don't count.
create or replace function public.chanukah_totals(p_year integer)
returns table (lit bigint, people bigint, given bigint)
language sql stable security definer set search_path = public as $$
  select
    coalesce(sum(jsonb_array_length(e.menorahs)), 0)::bigint,
    coalesce(sum(p.n), 0)::bigint,
    coalesce(sum(e.given_out), 0)::bigint
  from chanukah_entries e
  cross join lateral (select coalesce(sum(v::int), 0) as n from jsonb_array_elements_text(e.menorahs) v) p
  where e.year = p_year and not e.is_test;
$$;
grant execute on function public.chanukah_totals(integer) to anon, authenticated;

-- Accounts the Owner lets try Chanukah ahead of time (test mode).
create table if not exists chanukah_testers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table chanukah_testers enable row level security;
drop policy if exists "Owner manages Chanukah testers" on chanukah_testers;
create policy "Owner manages Chanukah testers" on chanukah_testers for all using (public.is_owner()) with check (public.is_owner());
drop policy if exists "See whether you can test Chanukah" on chanukah_testers;
create policy "See whether you can test Chanukah" on chanukah_testers for select using (user_id = auth.uid() or public.is_owner());
grant select, insert, delete on chanukah_testers to authenticated;

-- ============================================================
-- supabase/migrations/020_dreidel.sql
-- ============================================================
-- 020: The dreidel game on many phones. A game has a code (and a QR code and link); the host
-- creates it, others join with the code, even without an account (guests type a name). Everyone
-- can read a game and its players (no secrets in them), but every change goes through the
-- functions below, which check who is asking (each player has a private key kept on their phone)
-- and apply the rules on the server: the server picks every spin's letter, so nobody can cheat,
-- a spin can't happen twice, and coins never go below zero. Safe to run twice.
--
-- The rules (the same as on one phone): נ nothing; ג take the whole pot, then everyone still in,
-- the spinner too, puts 1 back in; ה take the smaller half; ש put in 2. Out when you have to put
-- in and can't (what you have left goes into the pot), unless you have a life token (one per game
-- won this session), which is used up instead and you stay in. Turn order: youngest to oldest,
-- the same age shuffled, no age last. Ends with one player left, or when the time runs out (most
-- coins wins; a tie, they all win).

create table if not exists dreidel_games (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  host uuid,
  status text not null default 'waiting' check (status in ('waiting', 'playing', 'over')),
  settings jsonb not null default '{"startCoins": 10, "startPot": 5, "minutes": 0}'::jsonb,
  pot integer not null default 0 check (pot >= 0),
  turn_order uuid[] not null default '{}',
  turn integer not null default 0,
  ends_at timestamptz,
  winners uuid[] not null default '{}',
  last jsonb,
  spins integer not null default 0,
  spin_letter integer,
  game_no integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists dreidel_players (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references dreidel_games(id) on delete cascade,
  secret uuid not null default gen_random_uuid(),
  name text not null,
  age integer,
  design text not null default 'gold',
  coins integer not null default 0 check (coins >= 0),
  out boolean not null default false,
  tokens integer not null default 0 check (tokens >= 0),
  wins integer not null default 0,
  joined_at timestamptz not null default now(),
  last_seen timestamptz not null default now()
);
create index if not exists dreidel_players_game on dreidel_players (game_id);

alter table dreidel_games enable row level security;
alter table dreidel_players enable row level security;
drop policy if exists "Anyone sees dreidel games" on dreidel_games;
create policy "Anyone sees dreidel games" on dreidel_games for select using (true);
drop policy if exists "Anyone sees dreidel players" on dreidel_players;
create policy "Anyone sees dreidel players" on dreidel_players for select using (true);
grant select on dreidel_games to anon, authenticated;
-- Everything about a player except their private key and age (age only decides the turn order).
revoke all on dreidel_players from anon, authenticated;
grant select (id, game_id, name, design, coins, out, tokens, wins, joined_at, last_seen) on dreidel_players to anon, authenticated;

-- Live updates: every change touches the game row, so phones only need to watch that.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'dreidel_games') then
    alter publication supabase_realtime add table dreidel_games;
  end if;
end $$;

-- ---- Helpers ----
create or replace function public.dreidel_check(p_player uuid, p_secret uuid)
returns dreidel_players language plpgsql security definer set search_path = public as $$
declare me dreidel_players;
begin
  select * into me from dreidel_players where id = p_player and secret = p_secret;
  if not found then raise exception 'You are not in this game.'; end if;
  update dreidel_players set last_seen = now() where id = me.id;
  return me;
end $$;

create or replace function public.dreidel_settings_clean(p jsonb)
returns jsonb language sql immutable as $$
  select jsonb_build_object(
    'startCoins', least(500, greatest(1, coalesce((p->>'startCoins')::int, 10))),
    'startPot', least(500, greatest(0, coalesce((p->>'startPot')::int, 5))),
    'minutes', case when coalesce((p->>'minutes')::int, 0) in (0, 3, 5, 10, 15) then coalesce((p->>'minutes')::int, 0) else 0 end
  );
$$;

create or replace function public.dreidel_name_clean(p text)
returns text language plpgsql immutable as $$
begin
  p := btrim(coalesce(p, ''));
  if length(p) < 1 then raise exception 'Type your name.'; end if;
  return left(p, 24);
end $$;

-- Start (or restart) a game with the players in it: coins, pot, turn order, timer.
create or replace function public.dreidel_begin(g dreidel_games)
returns void language plpgsql security definer set search_path = public as $$
declare ord uuid[];
begin
  select array_agg(id order by (age is null), age, random()) into ord from dreidel_players where game_id = g.id;
  update dreidel_players set coins = (g.settings->>'startCoins')::int, out = false where game_id = g.id;
  update dreidel_games set
    status = 'playing', turn_order = ord, turn = 0, pot = (g.settings->>'startPot')::int,
    winners = '{}', last = null, spin_letter = null, spins = 0,
    ends_at = case when (g.settings->>'minutes')::int > 0 then now() + make_interval(mins => (g.settings->>'minutes')::int) else null end,
    updated_at = now()
  where id = g.id;
end $$;

-- Pay n into the pot, or use a life token, or go out. Returns 'paid', 'token' or 'out'.
create or replace function public.dreidel_pay(p_game uuid, p_player uuid, n int)
returns text language plpgsql security definer set search_path = public as $$
declare q dreidel_players;
begin
  select * into q from dreidel_players where id = p_player for update;
  if q.coins >= n then
    update dreidel_players set coins = coins - n where id = q.id;
    update dreidel_games set pot = pot + n where id = p_game;
    return 'paid';
  elsif q.tokens > 0 then
    update dreidel_players set tokens = tokens - 1 where id = q.id;
    return 'token';
  else
    update dreidel_games set pot = pot + q.coins where id = p_game;
    update dreidel_players set coins = 0, out = true where id = q.id;
    return 'out';
  end if;
end $$;

-- The game ends: these players win, and each gets a win and a life token.
create or replace function public.dreidel_finish(p_game uuid, p_winners uuid[])
returns void language plpgsql security definer set search_path = public as $$
begin
  update dreidel_players set wins = wins + 1, tokens = tokens + 1 where id = any(p_winners);
  update dreidel_games set status = 'over', winners = p_winners, updated_at = now() where id = p_game;
end $$;

-- ---- What players can do ----
create or replace function public.dreidel_create(p_name text, p_age int, p_design text, p_settings jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; c text; g dreidel_games; me dreidel_players; i int;
begin
  -- Old games are cleared away after two days.
  delete from dreidel_games where updated_at < now() - interval '2 days';
  loop
    c := '';
    for i in 1..6 loop c := c || substr(chars, 1 + floor(random() * length(chars))::int, 1); end loop;
    exit when not exists (select 1 from dreidel_games where code = c);
  end loop;
  insert into dreidel_games (code, settings) values (c, public.dreidel_settings_clean(p_settings)) returning * into g;
  insert into dreidel_players (game_id, name, age, design)
    values (g.id, public.dreidel_name_clean(p_name), case when p_age between 0 and 120 then p_age end, left(coalesce(p_design, 'gold'), 40))
    returning * into me;
  update dreidel_games set host = me.id where id = g.id;
  return jsonb_build_object('gameId', g.id, 'playerId', me.id, 'secret', me.secret, 'code', g.code);
end $$;

create or replace function public.dreidel_join(p_code text, p_name text, p_age int, p_design text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare g dreidel_games; me dreidel_players; nm text := public.dreidel_name_clean(p_name);
begin
  select * into g from dreidel_games where code = upper(btrim(p_code)) for update;
  if not found then raise exception 'No game has that code.'; end if;
  if g.status <> 'waiting' then raise exception 'That game already started.'; end if;
  if exists (select 1 from dreidel_players where game_id = g.id and lower(name) = lower(nm)) then
    raise exception 'Someone with that name is already in this game.';
  end if;
  insert into dreidel_players (game_id, name, age, design)
    values (g.id, nm, case when p_age between 0 and 120 then p_age end, left(coalesce(p_design, 'gold'), 40))
    returning * into me;
  update dreidel_games set updated_at = now() where id = g.id;
  return jsonb_build_object('gameId', g.id, 'playerId', me.id, 'secret', me.secret, 'code', g.code);
end $$;

-- In the waiting room: change your name, age or dreidel (no age given keeps the one you had).
create or replace function public.dreidel_update_me(p_player uuid, p_secret uuid, p_name text, p_age int, p_design text)
returns void language plpgsql security definer set search_path = public as $$
declare me dreidel_players := public.dreidel_check(p_player, p_secret); g dreidel_games;
begin
  select * into g from dreidel_games where id = me.game_id;
  if g.status = 'waiting' then
    update dreidel_players set name = public.dreidel_name_clean(p_name), age = coalesce(case when p_age between 0 and 120 then p_age end, age), design = left(coalesce(p_design, 'gold'), 40) where id = me.id;
  else
    -- During a game, only the dreidel can change.
    update dreidel_players set design = left(coalesce(p_design, 'gold'), 40) where id = me.id;
  end if;
  update dreidel_games set updated_at = now() where id = g.id;
end $$;

create or replace function public.dreidel_set_settings(p_player uuid, p_secret uuid, p_settings jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare me dreidel_players := public.dreidel_check(p_player, p_secret); g dreidel_games;
begin
  select * into g from dreidel_games where id = me.game_id for update;
  if g.host <> me.id then raise exception 'Only the host can change the settings.'; end if;
  if g.status <> 'waiting' then raise exception 'The game already started.'; end if;
  update dreidel_games set settings = public.dreidel_settings_clean(p_settings), updated_at = now() where id = g.id;
end $$;

create or replace function public.dreidel_start(p_player uuid, p_secret uuid)
returns void language plpgsql security definer set search_path = public as $$
declare me dreidel_players := public.dreidel_check(p_player, p_secret); g dreidel_games;
begin
  select * into g from dreidel_games where id = me.game_id for update;
  if g.host <> me.id then raise exception 'Only the host can start the game.'; end if;
  if g.status <> 'waiting' then raise exception 'The game already started.'; end if;
  if (select count(*) from dreidel_players where game_id = g.id) < 2 then raise exception 'At least two players are needed.'; end if;
  perform public.dreidel_begin(g);
end $$;

-- Spin. p_spins is how many spins this phone has seen, so a double tap can't spin twice.
-- The server picks the letter and applies it. Returns the letter (0 נ, 1 ג, 2 ה, 3 ש).
create or replace function public.dreidel_spin(p_player uuid, p_secret uuid, p_spins int)
returns int language plpgsql security definer set search_path = public as $$
declare
  me dreidel_players := public.dreidel_check(p_player, p_secret);
  g dreidel_games; cur dreidel_players; q dreidel_players;
  n int; k int; letter int; took int := 0; paid int := 0; r text; used boolean := false; went_out boolean := false;
  refill jsonb := '[]'::jsonb; left_ids uuid[];
begin
  select * into g from dreidel_games where id = me.game_id for update;
  if g.status <> 'playing' then raise exception 'The game isn''t on.'; end if;
  if g.spins <> p_spins then raise exception 'Someone already spun.'; end if;
  n := array_length(g.turn_order, 1);
  select * into cur from dreidel_players where id = g.turn_order[g.turn + 1] for update;
  -- Your own turn, or the host spinning for a player whose phone has gone quiet.
  if cur.id <> me.id and not (g.host = me.id and cur.last_seen < now() - interval '45 seconds') then
    raise exception 'It isn''t your turn.';
  end if;
  letter := floor(random() * 4)::int;
  if letter = 1 then
    took := g.pot;
    update dreidel_players set coins = coins + g.pot where id = cur.id;
    update dreidel_games set pot = 0 where id = g.id;
    for k in 0..n - 1 loop
      select * into q from dreidel_players where id = g.turn_order[((g.turn + k) % n) + 1];
      if not q.out then
        r := public.dreidel_pay(g.id, q.id, 1);
        refill := refill || jsonb_build_object('playerId', q.id, 'paid', r = 'paid', 'usedToken', r = 'token', 'out', r = 'out');
        if q.id = cur.id and r = 'paid' then paid := 1; end if;
      end if;
    end loop;
  elsif letter = 2 then
    took := g.pot / 2;
    update dreidel_players set coins = coins + took where id = cur.id;
    update dreidel_games set pot = pot - took where id = g.id;
  elsif letter = 3 then
    r := public.dreidel_pay(g.id, cur.id, 2);
    if r = 'paid' then paid := 2; end if;
    used := r = 'token';
    went_out := r = 'out';
  end if;
  update dreidel_games set
    spins = spins + 1, spin_letter = letter, updated_at = now(),
    last = jsonb_build_object('playerId', cur.id, 'letter', letter, 'took', took, 'paid', paid, 'usedToken', used, 'out', went_out, 'refill', refill)
  where id = g.id;
  select array_agg(id) into left_ids from dreidel_players where game_id = g.id and not out;
  if coalesce(array_length(left_ids, 1), 0) <= 1 then
    perform public.dreidel_finish(g.id, coalesce(left_ids, '{}'));
  else
    -- The next player still in.
    for k in 1..n loop
      if not (select out from dreidel_players where id = g.turn_order[((g.turn + k) % n) + 1]) then
        update dreidel_games set turn = (g.turn + k) % n where id = g.id;
        exit;
      end if;
    end loop;
  end if;
  return letter;
end $$;

-- When the time is up (any player's phone asks; the server checks the clock): most coins wins.
create or replace function public.dreidel_time_up(p_player uuid, p_secret uuid)
returns void language plpgsql security definer set search_path = public as $$
declare me dreidel_players := public.dreidel_check(p_player, p_secret); g dreidel_games; top int; ws uuid[];
begin
  select * into g from dreidel_games where id = me.game_id for update;
  if g.status <> 'playing' or g.ends_at is null or g.ends_at > now() then return; end if;
  select max(coins) into top from dreidel_players where game_id = g.id and not out;
  select array_agg(id) into ws from dreidel_players where game_id = g.id and not out and coins = top;
  perform public.dreidel_finish(g.id, coalesce(ws, '{}'));
end $$;

-- The host starts the next game with the same players (wins and life tokens carry over).
create or replace function public.dreidel_play_again(p_player uuid, p_secret uuid)
returns void language plpgsql security definer set search_path = public as $$
declare me dreidel_players := public.dreidel_check(p_player, p_secret); g dreidel_games;
begin
  select * into g from dreidel_games where id = me.game_id for update;
  if g.host <> me.id then raise exception 'Only the host can start the next game.'; end if;
  if g.status <> 'over' then raise exception 'The game isn''t over yet.'; end if;
  if (select count(*) from dreidel_players where game_id = g.id) < 2 then raise exception 'At least two players are needed.'; end if;
  update dreidel_games set game_no = game_no + 1 where id = g.id;
  perform public.dreidel_begin(g);
end $$;

-- Leave the game. In the waiting room you're removed; during a game you're out (your coins go
-- into the pot). If the host leaves, the next player becomes host.
create or replace function public.dreidel_leave(p_player uuid, p_secret uuid)
returns void language plpgsql security definer set search_path = public as $$
declare me dreidel_players := public.dreidel_check(p_player, p_secret); g dreidel_games; nxt uuid; left_ids uuid[]; n int; k int;
begin
  select * into g from dreidel_games where id = me.game_id for update;
  if g.status = 'playing' then
    update dreidel_games set pot = pot + me.coins where id = g.id;
    update dreidel_players set coins = 0, out = true where id = me.id;
    select array_agg(id) into left_ids from dreidel_players where game_id = g.id and not out;
    if coalesce(array_length(left_ids, 1), 0) <= 1 then
      perform public.dreidel_finish(g.id, coalesce(left_ids, '{}'));
    elsif g.turn_order[g.turn + 1] = me.id then
      n := array_length(g.turn_order, 1);
      for k in 1..n loop
        if not (select out from dreidel_players where id = g.turn_order[((g.turn + k) % n) + 1]) then
          update dreidel_games set turn = (g.turn + k) % n where id = g.id;
          exit;
        end if;
      end loop;
    end if;
  else
    delete from dreidel_players where id = me.id;
    if not exists (select 1 from dreidel_players where game_id = g.id) then
      delete from dreidel_games where id = g.id;
      return;
    end if;
  end if;
  if g.host = me.id then
    select id into nxt from dreidel_players where game_id = g.id and id <> me.id order by out, joined_at limit 1;
    update dreidel_games set host = nxt where id = g.id;
  end if;
  update dreidel_games set updated_at = now() where id = g.id;
end $$;

-- Each phone says it's still here every little while. If the host's phone has gone quiet for a
-- minute, the next player who checks in becomes host.
create or replace function public.dreidel_ping(p_player uuid, p_secret uuid)
returns void language plpgsql security definer set search_path = public as $$
declare me dreidel_players := public.dreidel_check(p_player, p_secret); g dreidel_games;
begin
  select * into g from dreidel_games where id = me.game_id;
  if g.host <> me.id and exists (select 1 from dreidel_players where id = g.host and last_seen < now() - interval '60 seconds') then
    update dreidel_games set host = me.id, updated_at = now() where id = g.id;
  end if;
end $$;

grant execute on function public.dreidel_create(text, int, text, jsonb) to anon, authenticated;
grant execute on function public.dreidel_join(text, text, int, text) to anon, authenticated;
grant execute on function public.dreidel_update_me(uuid, uuid, text, int, text) to anon, authenticated;
grant execute on function public.dreidel_set_settings(uuid, uuid, jsonb) to anon, authenticated;
grant execute on function public.dreidel_start(uuid, uuid) to anon, authenticated;
grant execute on function public.dreidel_spin(uuid, uuid, int) to anon, authenticated;
grant execute on function public.dreidel_time_up(uuid, uuid) to anon, authenticated;
grant execute on function public.dreidel_play_again(uuid, uuid) to anon, authenticated;
grant execute on function public.dreidel_leave(uuid, uuid) to anon, authenticated;
grant execute on function public.dreidel_ping(uuid, uuid) to anon, authenticated;
-- The helpers are only for the functions above.
revoke execute on function public.dreidel_check(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.dreidel_begin(dreidel_games) from public, anon, authenticated;
revoke execute on function public.dreidel_pay(uuid, uuid, int) from public, anon, authenticated;
revoke execute on function public.dreidel_finish(uuid, uuid[]) from public, anon, authenticated;

-- ============================================================
-- supabase/migrations/021_emails.sql
-- ============================================================
-- 021: Emails from the Owner. The Owner writes an email on the site and it goes out from the
-- Owner's Gmail (through a small Google script). This keeps who doesn't want these emails (each
-- email has an Unsubscribe link with a private key for that person) and the address of the
-- Owner's Google script. Only the Owner can see the list of email addresses. Safe to run twice.

create table if not exists email_prefs (
  user_id uuid primary key references profiles(id) on delete cascade,
  token uuid not null unique default gen_random_uuid(),
  off boolean not null default false,
  changed_at timestamptz not null default now()
);
alter table email_prefs enable row level security;
-- Nobody reads or changes it directly; only through the functions below.
revoke all on email_prefs from anon, authenticated;

create table if not exists email_sender (
  id integer primary key default 1 check (id = 1),
  url text,
  updated_at timestamptz not null default now()
);
alter table email_sender enable row level security;
drop policy if exists "Owner sets the email sender" on email_sender;
create policy "Owner sets the email sender" on email_sender for all using (public.is_owner()) with check (public.is_owner());
grant select, insert, update, delete on email_sender to authenticated;

-- The Owner: everyone with an account and an email address, and whether they unsubscribed.
create or replace function public.email_list()
returns table (id uuid, name text, email text, token uuid, off boolean)
language plpgsql security definer set search_path = public as $$
#variable_conflict use_column
begin
  if not public.is_owner() then raise exception 'Only the Owner can send emails.'; end if;
  insert into email_prefs (user_id) select p.id from profiles p on conflict (user_id) do nothing;
  return query
    select p.id, p.name::text, u.email::text, e.token, e.off
    from profiles p
    join auth.users u on u.id = p.id
    join email_prefs e on e.user_id = p.id
    where coalesce(u.email, '') <> ''
    order by p.name;
end $$;
revoke execute on function public.email_list() from public, anon;
grant execute on function public.email_list() to authenticated;

-- The Unsubscribe link (works without signing in): stop or start these emails.
create or replace function public.email_unsubscribe(p_token uuid, p_off boolean default true)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  update email_prefs set off = p_off, changed_at = now() where token = p_token;
  return found;
end $$;
grant execute on function public.email_unsubscribe(uuid, boolean) to anon, authenticated;

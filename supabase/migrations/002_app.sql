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

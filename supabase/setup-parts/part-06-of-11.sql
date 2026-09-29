-- Shiur Daled Mivtzoim database setup: PART 6 of 11. Run the parts in order.
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

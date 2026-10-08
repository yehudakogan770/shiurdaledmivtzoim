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

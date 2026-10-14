-- Shiur Daled Mivtzoim database setup: PART 6 of 12. Run the parts in order.
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

-- Shiur Daled Mivtzoim database setup: PART 5 of 11. Run the parts in order.
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

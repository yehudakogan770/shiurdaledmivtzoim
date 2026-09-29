-- Shiur Daled Mivtzoim database setup: PART 5 of 12. Run the parts in order.
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

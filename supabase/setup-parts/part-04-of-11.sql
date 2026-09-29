-- Shiur Daled Mivtzoim database setup: PART 4 of 11. Run the parts in order.
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

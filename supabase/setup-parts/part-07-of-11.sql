-- Shiur Daled Mivtzoim database setup: PART 7 of 11. Run the parts in order.
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

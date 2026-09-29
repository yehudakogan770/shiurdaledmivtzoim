-- Shiur Daled Mivtzoim database setup: PART 8 of 12. Run the parts in order.
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
  welcome text not null default 'Start tracking tefillin, Shabbos candles and every other mivtza.',
  announcement text not null default '',
  updated_at timestamptz not null default now(),
  updated_by uuid references profiles(id) on delete set null
);

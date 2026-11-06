-- Shiur Daled Mivtzoim database setup: PART 7 of 12. Run the parts in order.
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

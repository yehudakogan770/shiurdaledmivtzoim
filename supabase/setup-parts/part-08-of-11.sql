-- Shiur Daled Mivtzoim database setup: PART 8 of 11. Run the parts in order.
insert into site_settings (id) values (1) on conflict (id) do nothing;

alter table site_settings enable row level security;
create policy "Everyone reads site settings" on site_settings for select using (true);
create policy "Admins edit site settings" on site_settings for update using (public.is_admin()) with check (public.is_admin());

-- Categories an admin shares with everyone ---------------------------------------

alter table personal_categories add column if not exists shared boolean not null default false;

create policy "Everyone signed in sees shared categories" on personal_categories for select
using (shared and auth.uid() is not null);

create or replace function public.protect_shared_category()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.shared and not public.is_admin() then
    raise exception 'Only an admin can share a category with everyone';
  end if;
  return new;
end $$;

drop trigger if exists protect_shared_category on personal_categories;
create trigger protect_shared_category before insert or update on personal_categories
for each row execute function public.protect_shared_category();

-- Admins see everything people do ------------------------------------------------

create policy "Admins view all routes" on routes for select using (public.is_admin());
create policy "Admins view all locations" on locations for select using (public.is_admin());
create policy "Admins view all route stops" on route_locations for select using (public.is_admin());
create policy "Admins view all categories" on personal_categories for select using (public.is_admin());

-- ============================================================
-- supabase/migrations/005_email_accounts.sql
-- ============================================================
-- Accounts have a real email address (for the confirmation link and password
-- resets) and a username (for signing in). Profiles can list mivtzoim chavrusas.
--
-- After running this file:
--   * Authentication → Sign In / Providers → Email: turn ON "Confirm email".
--   * Authentication → URL Configuration: set Site URL to the website address
--     (for example https://yehudakogan770.github.io/shiurdaledmivtzoim/) and add it to Redirect URLs.
--   * Authentication → Email Templates → Reset Password: add the line
--       Your username is {{ .Data.username }}
--     so a forgotten username comes back with the reset link.

alter table profiles add column if not exists partners text[] not null default '{}';

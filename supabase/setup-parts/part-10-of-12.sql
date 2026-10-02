-- Shiur Daled Mivtzoim database setup: PART 10 of 12. Run the parts in order.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, name, username, partners, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)),
    lower(coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1))),
    coalesce(array(select jsonb_array_elements_text(new.raw_user_meta_data->'partners')), '{}'),
    case when lower(new.email) in ('sdmivtzoim87@gmail.com') then 'admin' else 'user' end
  )
  on conflict (id) do nothing;
  return new;
end $$;

-- Sign in with a username: find the email address it belongs to.
create or replace function public.login_email(p_username text)
returns text language sql stable security definer set search_path = public as $$
  select u.email::text from auth.users u join profiles p on p.id = u.id
  where lower(p.username) = lower(trim(p_username)) limit 1;
$$;

create or replace function public.username_available(p_username text)
returns boolean language sql stable security definer set search_path = public as $$
  select not exists (select 1 from profiles where lower(username) = lower(trim(p_username)));
$$;

grant execute on function public.login_email(text) to anon, authenticated;
grant execute on function public.username_available(text) to anon, authenticated;

-- Admins see everyone's email address on the Admin page.
create or replace function public.admin_people()
returns table (id uuid, name text, username text, email text, partners text[], role text)
language sql stable security definer set search_path = public as $$
  select p.id, p.name, p.username, u.email::text, p.partners, p.role
  from profiles p join auth.users u on u.id = p.id
  where public.is_admin();
$$;
grant execute on function public.admin_people() to authenticated;

-- ============================================================
-- supabase/migrations/006_admin_password_reset.sql
-- ============================================================
-- Password help without an email service: an admin can set a new password
-- for someone who forgot theirs (from the Admin page).

create extension if not exists pgcrypto with schema extensions;

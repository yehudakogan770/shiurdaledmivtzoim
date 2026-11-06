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

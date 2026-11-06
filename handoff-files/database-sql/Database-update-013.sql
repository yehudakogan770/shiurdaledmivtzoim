-- 013: The Owner can create an account for someone who has no phone or computer of their own,
-- right on the Owner's device. No confirmation email: the Owner vouches for the address, and
-- the Owner stays signed in. The usual sign-up trigger makes the profile, so the new route
-- shows up everywhere like any other account.

create extension if not exists pgcrypto with schema extensions;

create or replace function public.owner_create_account(
  p_name text, p_username text, p_email text, p_password text, p_partners text[], p_language text
)
returns uuid language plpgsql security definer set search_path = public, extensions as $$
declare
  v_id uuid := gen_random_uuid();
  v_username text := lower(trim(coalesce(p_username, '')));
  v_email text := lower(trim(coalesce(p_email, '')));
begin
  if not public.is_owner() then
    raise exception 'Only the Owner can create accounts here';
  end if;
  if length(trim(coalesce(p_name, ''))) = 0 then
    raise exception 'Enter the route name';
  end if;
  if v_username !~ '^[a-z0-9._-]{3,20}$' then
    raise exception 'Usernames are 3 to 20 characters: letters, numbers, dots, dashes or underscores.';
  end if;
  if v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception 'Enter a real email address';
  end if;
  if length(coalesce(p_password, '')) < 6 then
    raise exception 'Passwords need at least 6 characters';
  end if;
  if exists (select 1 from profiles where lower(username) = v_username) then
    raise exception 'That username is taken';
  end if;
  if exists (select 1 from auth.users where lower(email) = v_email) then
    raise exception 'That email already has an account';
  end if;

  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change,
    email_change_token_current, reauthentication_token, phone_change, phone_change_token
  ) values (
    '00000000-0000-0000-0000-000000000000', v_id, 'authenticated', 'authenticated', v_email,
    crypt(p_password, gen_salt('bf')), now(),
    jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email')),
    jsonb_build_object(
      'name', trim(p_name), 'username', v_username,
      'partners', to_jsonb(coalesce(p_partners, '{}'::text[])),
      'language', coalesce(nullif(trim(p_language), ''), 'en'),
      'email_verified', true
    ),
    now(), now(), '', '', '', '', '', '', '', ''
  );

  insert into auth.identities (id, user_id, provider_id, identity_data, provider, created_at, updated_at)
  values (
    gen_random_uuid(), v_id, v_id::text,
    jsonb_build_object('sub', v_id::text, 'email', v_email, 'email_verified', true, 'phone_verified', false),
    'email', now(), now()
  );

  return v_id;
end $$;

revoke all on function public.owner_create_account(text, text, text, text, text[], text) from public, anon;
grant execute on function public.owner_create_account(text, text, text, text, text[], text) to authenticated;

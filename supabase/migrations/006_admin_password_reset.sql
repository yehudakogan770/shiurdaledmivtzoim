-- Password help without an email service: an admin can set a new password
-- for someone who forgot theirs (from the Admin page).

create extension if not exists pgcrypto with schema extensions;

create or replace function public.admin_set_password(p_user uuid, p_password text)
returns void language plpgsql security definer set search_path = public, extensions as $$
begin
  if not public.is_admin() then
    raise exception 'Only an admin can set passwords';
  end if;
  if length(coalesce(p_password, '')) < 6 then
    raise exception 'Passwords need at least 6 characters';
  end if;
  update auth.users
     set encrypted_password = crypt(p_password, gen_salt('bf')),
         updated_at = now()
   where id = p_user;
  if not found then
    raise exception 'No account found';
  end if;
end $$;

revoke all on function public.admin_set_password(uuid, text) from public, anon;
grant execute on function public.admin_set_password(uuid, text) to authenticated;

-- Any admin can edit, hide or remove the mivtzoim shared with everyone,
-- not only the admin who added them.
drop policy if exists "Admins manage shared categories" on personal_categories;
create policy "Admins manage shared categories" on personal_categories for all
  using (shared and public.is_admin()) with check (shared and public.is_admin());

-- Admins can fix or remove anyone's entries.
drop policy if exists "Admins edit all activity" on mivtzoim_activity;
create policy "Admins edit all activity" on mivtzoim_activity for update
  using (public.is_admin()) with check (public.is_admin());
drop policy if exists "Admins delete all activity" on mivtzoim_activity;
create policy "Admins delete all activity" on mivtzoim_activity for delete using (public.is_admin());

-- Admins can change someone's name, username, email and chavrusas.
create or replace function public.admin_update_person(
  p_user uuid, p_name text, p_username text, p_email text, p_partners text[]
)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_username text := lower(trim(coalesce(p_username, '')));
  v_email text := lower(trim(coalesce(p_email, '')));
  v_old_email text;
begin
  if not public.is_admin() then
    raise exception 'Only an admin can edit accounts';
  end if;
  if length(trim(coalesce(p_name, ''))) = 0 then
    raise exception 'Enter their name';
  end if;
  if v_username !~ '^[a-z0-9._-]{3,20}$' then
    raise exception 'Usernames are 3 to 20 characters: letters, numbers, dots, dashes or underscores.';
  end if;
  if v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception 'Enter a real email address';
  end if;
  if exists (select 1 from profiles where lower(username) = v_username and id <> p_user) then
    raise exception 'That username is taken';
  end if;
  if exists (select 1 from auth.users where lower(email) = v_email and id <> p_user) then
    raise exception 'That email already has an account';
  end if;

  select email into v_old_email from auth.users where id = p_user;
  if not found then
    raise exception 'No account found';
  end if;

  update profiles
     set name = trim(p_name), username = v_username, partners = coalesce(p_partners, '{}')
   where id = p_user;

  if v_email is distinct from lower(v_old_email) then
    -- The admin vouches for the new address, so it counts as confirmed.
    update auth.users
       set email = v_email, email_confirmed_at = coalesce(email_confirmed_at, now()), updated_at = now()
     where id = p_user;
    update auth.identities
       set identity_data = identity_data || jsonb_build_object('email', v_email), updated_at = now()
     where user_id = p_user and provider = 'email';
  end if;
  update auth.users
     set raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb)
           || jsonb_build_object('name', trim(p_name), 'username', v_username)
   where id = p_user;
end $$;

revoke all on function public.admin_update_person(uuid, text, text, text, text[]) from public, anon;
grant execute on function public.admin_update_person(uuid, text, text, text, text[]) to authenticated;

-- Admins can delete an account with everything in it (entries, routes, own mivtzoim).
create or replace function public.admin_delete_person(p_user uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then
    raise exception 'Only an admin can delete accounts';
  end if;
  if p_user = auth.uid() then
    raise exception 'You can''t delete your own account from here';
  end if;
  delete from mivtzoim_activity where user_id = p_user;
  delete from groups where created_by = p_user;
  delete from auth.users where id = p_user;
  if not found then
    raise exception 'No account found';
  end if;
end $$;

revoke all on function public.admin_delete_person(uuid) from public, anon;
grant execute on function public.admin_delete_person(uuid) to authenticated;

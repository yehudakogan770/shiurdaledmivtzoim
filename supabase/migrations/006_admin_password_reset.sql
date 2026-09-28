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

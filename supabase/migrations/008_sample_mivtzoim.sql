-- People without an account see the same mivtzoim as everyone else in the sample:
-- the names, icons and order of the shared items only. No one's entries or accounts.
create or replace function public.shared_mivtzoim()
returns table (id uuid, name text, description text, icon text, status text, "position" integer, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select c.id, c.name, c.description, c.icon, c.status, c.position, c.created_at
  from personal_categories c
  where c.shared;
$$;

revoke all on function public.shared_mivtzoim() from public;
grant execute on function public.shared_mivtzoim() to anon, authenticated;

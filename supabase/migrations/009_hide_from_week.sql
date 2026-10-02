-- Hide a mivtza starting from a certain week: earlier weeks still show it.
alter table personal_categories add column if not exists hidden_from date;

-- The sample (people without an account) needs the starting week too.
drop function if exists public.shared_mivtzoim();
create function public.shared_mivtzoim()
returns table (id uuid, name text, description text, icon text, status text, "position" integer, hidden_from date, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select c.id, c.name, c.description, c.icon, c.status, c.position, c.hidden_from, c.created_at
  from personal_categories c
  where c.shared;
$$;

revoke all on function public.shared_mivtzoim() from public;
grant execute on function public.shared_mivtzoim() to anon, authenticated;

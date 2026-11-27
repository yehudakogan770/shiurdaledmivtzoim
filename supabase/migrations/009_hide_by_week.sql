-- Hide or bring back a mivtza by week: the stretches of weeks it's hidden in, like
-- [{"from": "2026-10-09", "to": null}]. Weeks outside them still show it.
alter table personal_categories add column if not exists hidden_weeks jsonb;

-- The sample (people without an account) needs the hidden weeks too.
drop function if exists public.shared_mivtzoim();
create function public.shared_mivtzoim()
returns table (id uuid, name text, description text, icon text, status text, "position" integer, hidden_weeks jsonb, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select c.id, c.name, c.description, c.icon, c.status, c.position, c.hidden_weeks, c.created_at
  from personal_categories c
  where c.shared;
$$;

revoke all on function public.shared_mivtzoim() from public;
grant execute on function public.shared_mivtzoim() to anon, authenticated;

-- 019: Chanukah. Each entry is one stop: who went, where, day or night, every menorah lit there
-- (with how many people lit it), how many menorahs were given out, and anything else. One person
-- logs it for the group. Everyone sees only their own entries (the Owner sees all of them), but
-- everyone sees the shiur's totals through chanukah_totals(). Test entries (from the Owner's test
-- mode or a tester) never count in the totals. Safe to run twice.
create table if not exists chanukah_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade default auth.uid(),
  -- The Hebrew year, like 5787.
  year integer not null,
  entry_date date not null,
  time_of_day text not null default 'night' check (time_of_day in ('day', 'night')),
  place text not null default '',
  -- Names of everyone who went.
  people jsonb not null default '[]'::jsonb,
  -- One number per menorah lit: how many people lit it.
  menorahs jsonb not null default '[]'::jsonb,
  given_out integer not null default 0 check (given_out >= 0),
  notes text,
  is_test boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists chanukah_entries_year on chanukah_entries (year);
alter table chanukah_entries enable row level security;
drop policy if exists "See own Chanukah entries" on chanukah_entries;
create policy "See own Chanukah entries" on chanukah_entries for select using (user_id = auth.uid() or public.is_owner());
drop policy if exists "Add own Chanukah entries" on chanukah_entries;
create policy "Add own Chanukah entries" on chanukah_entries for insert with check (user_id = auth.uid());
drop policy if exists "Change own Chanukah entries" on chanukah_entries;
create policy "Change own Chanukah entries" on chanukah_entries for update using (user_id = auth.uid() or public.is_owner()) with check (user_id = auth.uid() or public.is_owner());
drop policy if exists "Delete own Chanukah entries" on chanukah_entries;
create policy "Delete own Chanukah entries" on chanukah_entries for delete using (user_id = auth.uid() or public.is_owner());
grant select, insert, update, delete on chanukah_entries to authenticated;

-- The shiur's totals for a year, without anyone's names. Test entries don't count.
create or replace function public.chanukah_totals(p_year integer)
returns table (lit bigint, people bigint, given bigint)
language sql stable security definer set search_path = public as $$
  select
    coalesce(sum(jsonb_array_length(e.menorahs)), 0)::bigint,
    coalesce(sum(p.n), 0)::bigint,
    coalesce(sum(e.given_out), 0)::bigint
  from chanukah_entries e
  cross join lateral (select coalesce(sum(v::int), 0) as n from jsonb_array_elements_text(e.menorahs) v) p
  where e.year = p_year and not e.is_test;
$$;
grant execute on function public.chanukah_totals(integer) to anon, authenticated;

-- Accounts the Owner lets try Chanukah ahead of time (test mode).
create table if not exists chanukah_testers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table chanukah_testers enable row level security;
drop policy if exists "Owner manages Chanukah testers" on chanukah_testers;
create policy "Owner manages Chanukah testers" on chanukah_testers for all using (public.is_owner()) with check (public.is_owner());
drop policy if exists "See whether you can test Chanukah" on chanukah_testers;
create policy "See whether you can test Chanukah" on chanukah_testers for select using (user_id = auth.uid() or public.is_owner());
grant select, insert, delete on chanukah_testers to authenticated;

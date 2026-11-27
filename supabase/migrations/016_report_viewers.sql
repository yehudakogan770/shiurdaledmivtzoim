-- 016: The weekly report. The Owner sets up the items (Scrolls, Candles…); each week the Owner,
-- admins, and accounts the Owner allows fill in how many were sold and how many are needed for
-- next week. Only the Owner adds, renames or removes items, and only the Owner chooses who else
-- can see and fill in the report (report_viewers). Safe to run twice.
create table if not exists report_viewers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table report_viewers enable row level security;
drop policy if exists "Owner manages report viewers" on report_viewers;
create policy "Owner manages report viewers" on report_viewers for all using (public.is_owner()) with check (public.is_owner());
drop policy if exists "See whether you can see the report" on report_viewers;
create policy "See whether you can see the report" on report_viewers for select using (user_id = auth.uid() or public.is_admin());
grant select, insert, delete on report_viewers to authenticated;

-- Admins, and accounts the Owner allowed.
create or replace function public.can_report()
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_admin() or exists (select 1 from report_viewers v where v.user_id = auth.uid());
$$;

create table if not exists report_items (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  position integer,
  created_at timestamptz not null default now()
);
alter table report_items enable row level security;
drop policy if exists "Report people see the items" on report_items;
create policy "Report people see the items" on report_items for select using (public.can_report());
drop policy if exists "Owner manages the items" on report_items;
create policy "Owner manages the items" on report_items for all using (public.is_owner()) with check (public.is_owner());
grant select, insert, update, delete on report_items to authenticated;

create table if not exists report_counts (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references report_items(id) on delete cascade,
  week date not null,
  sold integer check (sold >= 0),
  needed integer check (needed >= 0),
  updated_by uuid references profiles(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  unique (item_id, week)
);
alter table report_counts enable row level security;
drop policy if exists "Report people fill in the numbers" on report_counts;
create policy "Report people fill in the numbers" on report_counts for all using (public.can_report()) with check (public.can_report());
grant select, insert, update, delete on report_counts to authenticated;

-- An earlier version of this update counted logged Mivtzoim instead; no longer used.
drop function if exists public.report_activity(date, date);

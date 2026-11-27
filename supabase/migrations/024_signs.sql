-- 024: Signs kept from the Sign Creator, so last week's sign can be opened and changed. Only
-- the words and choices are kept (no pictures), and only admins see or change them. Safe to run twice.
create table if not exists signs (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  data jsonb not null,
  created_at timestamptz not null default now()
);
alter table signs enable row level security;
drop policy if exists "Admins keep saved signs" on signs;
create policy "Admins keep saved signs" on signs for all
  using (public.is_admin() or public.is_owner()) with check (public.is_admin() or public.is_owner());
grant select, insert, update, delete on signs to authenticated;

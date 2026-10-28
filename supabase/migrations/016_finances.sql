-- 016: Finances, for the Owner only: money in (donations) and money out (expenses). Only the
-- Owner can see or change it; the database itself blocks everyone else, admins included.
-- Safe to run twice.
create table if not exists finance_entries (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('in', 'out')),
  entry_date date not null default current_date,
  amount numeric(12, 2) not null check (amount >= 0),
  method text,
  who text,
  category text,
  notes text,
  created_by uuid references profiles(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);
create index if not exists idx_finance_entries_date on finance_entries(entry_date);


alter table finance_entries enable row level security;
drop policy if exists "Owner manages finances" on finance_entries;
create policy "Owner manages finances" on finance_entries for all using (public.is_owner()) with check (public.is_owner());
grant select, insert, update, delete on finance_entries to authenticated;

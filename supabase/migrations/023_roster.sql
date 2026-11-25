-- 023: The Shiur Daled names list. Only names on it can be on an account: people pick their
-- yeshiva and then their name, so every account spells a name the same way. Everyone can read
-- the list (the sign-up form needs it before there is an account); only admins change it.
-- The names themselves are added with a separate file, never kept in the code. Safe to run twice.
create table if not exists roster (
  id uuid primary key default gen_random_uuid(),
  yeshiva text not null,
  last_name text not null,
  first_name text not null,
  created_at timestamptz not null default now()
);
create unique index if not exists roster_one_of_each on roster (lower(yeshiva), lower(last_name), lower(first_name));
alter table roster enable row level security;
drop policy if exists "Everyone reads the names list" on roster;
create policy "Everyone reads the names list" on roster for select using (true);
drop policy if exists "Admins change the names list" on roster;
create policy "Admins change the names list" on roster for all using (public.is_admin()) with check (public.is_admin());
grant select on roster to anon, authenticated;
grant insert, update, delete on roster to authenticated;

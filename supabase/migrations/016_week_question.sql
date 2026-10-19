-- 016: The week's question on Home: did this route go on Mivtzoim, and who went (the route's
-- Chavrusas and anyone else typed in by name). One answer per account per week. Each account
-- answers for itself; admins can see everyone's answers, and the Owner can change them.
create table if not exists mivtzoim_weeks (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references profiles(id) on delete cascade,
  week date not null,
  went boolean not null,
  people text[] not null default '{}',
  created_at timestamptz not null default now(),
  unique (user_id, week)
);

alter table mivtzoim_weeks enable row level security;
drop policy if exists "Read own or admin reads all week answers" on mivtzoim_weeks;
create policy "Read own or admin reads all week answers" on mivtzoim_weeks for select using (user_id = auth.uid() or public.is_admin());
drop policy if exists "Answer own week" on mivtzoim_weeks;
create policy "Answer own week" on mivtzoim_weeks for insert with check (user_id = auth.uid() or public.is_owner());
drop policy if exists "Change own week answer" on mivtzoim_weeks;
create policy "Change own week answer" on mivtzoim_weeks for update using (user_id = auth.uid() or public.is_owner()) with check (user_id = auth.uid() or public.is_owner());
drop policy if exists "Delete own week answer" on mivtzoim_weeks;
create policy "Delete own week answer" on mivtzoim_weeks for delete using (user_id = auth.uid() or public.is_owner());

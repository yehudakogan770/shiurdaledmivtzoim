-- Shiur Daled Mivtzoim database setup: PART 3 of 12. Run the parts in order.
-- Standard categories are represented by category_type:
-- tefillin, shabbos_candles.
-- Personal categories are user-specific via personal_category_id.

create index if not exists idx_activity_user on mivtzoim_activity(user_id);
create index if not exists idx_activity_date on mivtzoim_activity(activity_date);
create index if not exists idx_activity_group on mivtzoim_activity(group_id);
create index if not exists idx_personal_categories_user on personal_categories(user_id);

alter table profiles enable row level security;
alter table personal_categories enable row level security;
alter table mivtzoim_activity enable row level security;

drop policy if exists "Users can view own profile" on profiles;
create policy "Users can view own profile"
on profiles for select using (auth.uid() = id);

drop policy if exists "Users can update own profile" on profiles;
create policy "Users can update own profile"
on profiles for update using (auth.uid() = id);

drop policy if exists "Users manage own personal categories" on personal_categories;
create policy "Users manage own personal categories"
on personal_categories for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Users view own activity" on mivtzoim_activity;
create policy "Users view own activity"
on mivtzoim_activity for select using (auth.uid() = user_id);

drop policy if exists "Users create own activity" on mivtzoim_activity;
create policy "Users create own activity"
on mivtzoim_activity for insert with check (auth.uid() = user_id);

drop policy if exists "Users update own activity" on mivtzoim_activity;
create policy "Users update own activity"
on mivtzoim_activity for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Users delete own activity" on mivtzoim_activity;
create policy "Users delete own activity"
on mivtzoim_activity for delete using (auth.uid() = user_id);

-- ============================================================
-- supabase/migrations/002_app.sql
-- ============================================================
-- Shiur Daled Mivtzoim: everything the app needs on top of 001_initial.sql.
-- Join codes, personal routes, location ownership, profile creation on
-- sign-up, and row level security for every table.

alter table groups add column if not exists join_code text;

-- 016: The weekly report for people who aren't admins. Admins can already read everyone's
-- entries; the Owner can also let chosen accounts see the weekly report, and only that. Their
-- names go in report_viewers (only the Owner can add or remove them), and report_activity gives
-- them everyone's counts, with each route's name, but nothing else. Safe to run twice.
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

create or replace function public.report_activity(p_from date, p_to date)
returns table (id uuid, user_id uuid, route text, activity_date date, created_at timestamptz, category_type text, personal_category_id uuid, quantity integer)
language sql stable security definer set search_path = public as $$
  select a.id, a.user_id, p.name, a.activity_date, a.created_at, a.category_type, a.personal_category_id, a.quantity
  from mivtzoim_activity a left join profiles p on p.id = a.user_id
  where (public.is_admin() or exists (select 1 from report_viewers v where v.user_id = auth.uid()))
    and a.activity_date between p_from and p_to
    and a.quantity > 0;
$$;
revoke all on function public.report_activity(date, date) from public, anon;
grant execute on function public.report_activity(date, date) to authenticated;

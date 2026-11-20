-- 022: Weekly report access levels. The Owner chooses, for each account on the report, whether it
-- can only look ('view'), fill in the numbers ('fill'), or also add, rename and remove the items
-- ('edit'). Admins can do everything. Accounts already on the report keep filling in numbers.
-- Safe to run twice.
alter table report_viewers add column if not exists access text not null default 'fill';
alter table report_viewers drop constraint if exists report_viewers_access_check;
alter table report_viewers add constraint report_viewers_access_check check (access in ('view', 'fill', 'edit'));
grant update on report_viewers to authenticated;

-- What this account may do on the report: 'edit' for admins, the Owner's choice for the rest, null for no access.
create or replace function public.report_access()
returns text language sql stable security definer set search_path = public as $$
  select case when public.is_admin() then 'edit'
    else (select v.access from report_viewers v where v.user_id = auth.uid()) end;
$$;
revoke all on function public.report_access() from public, anon;
grant execute on function public.report_access() to authenticated;

-- The items: everyone on the report sees them; 'edit' accounts (and admins) change them.
drop policy if exists "Owner manages the items" on report_items;
drop policy if exists "Report editors manage the items" on report_items;
create policy "Report editors manage the items" on report_items for all
  using (public.report_access() = 'edit') with check (public.report_access() = 'edit');

-- The numbers: everyone on the report sees them; 'fill' and 'edit' accounts type them in.
drop policy if exists "Report people fill in the numbers" on report_counts;
drop policy if exists "Report people see the numbers" on report_counts;
create policy "Report people see the numbers" on report_counts for select using (public.can_report());
drop policy if exists "Report people add numbers" on report_counts;
create policy "Report people add numbers" on report_counts for insert with check (public.report_access() in ('fill', 'edit'));
drop policy if exists "Report people change numbers" on report_counts;
create policy "Report people change numbers" on report_counts for update
  using (public.report_access() in ('fill', 'edit')) with check (public.report_access() in ('fill', 'edit'));
drop policy if exists "Report people clear numbers" on report_counts;
create policy "Report people clear numbers" on report_counts for delete using (public.report_access() in ('fill', 'edit'));

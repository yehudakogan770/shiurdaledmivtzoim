-- Shiur Daled Mivtzoim database setup: PART 12 of 12. Run the parts in order.
revoke all on function public.admin_update_person(uuid, text, text, text, text[]) from public, anon;
grant execute on function public.admin_update_person(uuid, text, text, text, text[]) to authenticated;

-- Admins can delete an account with everything in it (entries, routes, own mivtzoim).
create or replace function public.admin_delete_person(p_user uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then
    raise exception 'Only an admin can delete accounts';
  end if;
  if p_user = auth.uid() then
    raise exception 'You can''t delete your own account from here';
  end if;
  delete from mivtzoim_activity where user_id = p_user;
  delete from groups where created_by = p_user;
  delete from auth.users where id = p_user;
  if not found then
    raise exception 'No account found';
  end if;
end $$;

revoke all on function public.admin_delete_person(uuid) from public, anon;
grant execute on function public.admin_delete_person(uuid) to authenticated;

-- Everyone's totals for the "this week" strip on the home page. Only the date,
-- mivtza and amount are shared (no names, notes or places).
create or replace function public.community_activity(p_from date, p_to date)
returns table (activity_date date, created_at timestamptz, category_type text, personal_category_id uuid, quantity integer, mine boolean)
language sql stable security definer set search_path = public as $$
  select a.activity_date, a.created_at, a.category_type, a.personal_category_id, a.quantity, a.user_id = auth.uid()
  from mivtzoim_activity a
  where auth.uid() is not null
    and a.activity_date between p_from and p_to
    and (a.category_type <> 'personal'
         or exists (select 1 from personal_categories c where c.id = a.personal_category_id and c.shared))
$$;

revoke all on function public.community_activity(date, date) from public, anon;
grant execute on function public.community_activity(date, date) to authenticated;

-- ============================================================
-- supabase/migrations/007_mivtza_order.sql
-- ============================================================
-- The order of the mivtzoim on everyone's front page, set by an admin.
alter table personal_categories add column if not exists position integer;

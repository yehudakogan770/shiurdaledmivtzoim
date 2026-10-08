-- 014: On the account desk, someone without a phone of their own finds their account on the
-- Owner's device and logs their Mivtzoim there. The Owner can already see, fix and remove
-- everyone's entries; this lets the Owner's device add entries for them too.
drop policy if exists "Owner logs for anyone" on mivtzoim_activity;
create policy "Owner logs for anyone" on mivtzoim_activity for insert with check (public.is_owner());

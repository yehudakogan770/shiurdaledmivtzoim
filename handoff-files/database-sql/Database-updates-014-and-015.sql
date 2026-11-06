-- Shiur Daled Mivtzoim: database updates 014 and 015. Paste all of this into Supabase → SQL Editor → New query, then click Run.

-- 014: On the account desk, someone without a phone of their own finds their account on the
-- Owner's device and logs their Mivtzoim there. The Owner can already see, fix and remove
-- everyone's entries; this lets the Owner's device add entries for them too.
drop policy if exists "Owner logs for anyone" on mivtzoim_activity;
create policy "Owner logs for anyone" on mivtzoim_activity for insert with check (public.is_owner());

-- 015: Print copies of photos in the Owner's Google Drive. The address of the Owner's Google
-- Apps Script is kept here: signed-in people's phones read it (to send the print copies there),
-- and only the Owner can set it. It isn't shown to visitors without an account.
create table if not exists photo_drive (
  id integer primary key default 1 check (id = 1),
  url text,
  updated_at timestamptz not null default now()
);

alter table photo_drive enable row level security;
drop policy if exists "Signed-in people read the photo drive" on photo_drive;
create policy "Signed-in people read the photo drive" on photo_drive for select to authenticated using (true);
drop policy if exists "Owner sets the photo drive" on photo_drive;
create policy "Owner sets the photo drive" on photo_drive for all using (public.is_owner()) with check (public.is_owner());

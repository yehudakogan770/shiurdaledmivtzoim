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

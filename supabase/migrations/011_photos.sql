-- Photos: everyone can see them; anyone signed in can add their own; the person who shared a
-- photo, or an admin, can delete it. Files live in a public "photos" storage bucket, made small
-- on the phone first (about 100 KB each with its preview).
create table if not exists public.photos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  path text not null,
  thumb_path text not null,
  width integer not null default 0,
  height integer not null default 0,
  bytes integer not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists idx_photos_created on public.photos(created_at desc);
alter table public.photos enable row level security;

drop policy if exists "Everyone sees photos" on public.photos;
create policy "Everyone sees photos" on public.photos for select using (true);
drop policy if exists "People add their own photos" on public.photos;
create policy "People add their own photos" on public.photos for insert with check (user_id = auth.uid());
drop policy if exists "Sharer or admin deletes a photo" on public.photos;
create policy "Sharer or admin deletes a photo" on public.photos for delete using (user_id = auth.uid() or public.is_admin());
grant select on public.photos to anon, authenticated;
grant insert, delete on public.photos to authenticated;

-- The files: public to look at, at most 2 MB each, only WebP or JPEG.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('photos', 'photos', true, 2097152, array['image/webp', 'image/jpeg'])
on conflict (id) do update set public = true, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Photos: see files" on storage.objects;
create policy "Photos: see files" on storage.objects for select using (bucket_id = 'photos');
drop policy if exists "Photos: add to your own folder" on storage.objects;
create policy "Photos: add to your own folder" on storage.objects for insert to authenticated
with check (bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "Photos: sharer or admin deletes" on storage.objects;
create policy "Photos: sharer or admin deletes" on storage.objects for delete to authenticated
using (bucket_id = 'photos' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin()));

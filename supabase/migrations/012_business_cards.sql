-- 012: Business cards for places on routes.
-- Phone, email, contact person, website and the card picture for a place. Only the person whose
-- route it is, and the Owner, can see or change them; other admins can't. Safe to run again.

create table if not exists public.location_cards (
  location_id uuid primary key references public.locations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  contact text,
  phone text,
  email text,
  website text,
  image_path text,
  updated_at timestamptz not null default now()
);
alter table public.location_cards enable row level security;

drop policy if exists "Own cards, or the Owner: see" on public.location_cards;
create policy "Own cards, or the Owner: see" on public.location_cards for select
using (user_id = auth.uid() or public.is_owner());
-- Only for a place that person made.
drop policy if exists "Own cards, or the Owner: add" on public.location_cards;
create policy "Own cards, or the Owner: add" on public.location_cards for insert to authenticated
with check (
  (user_id = auth.uid() or public.is_owner())
  and exists (select 1 from public.locations l where l.id = location_id and l.created_by = user_id)
);
drop policy if exists "Own cards, or the Owner: change" on public.location_cards;
create policy "Own cards, or the Owner: change" on public.location_cards for update to authenticated
using (user_id = auth.uid() or public.is_owner())
with check (
  (user_id = auth.uid() or public.is_owner())
  and exists (select 1 from public.locations l where l.id = location_id and l.created_by = user_id)
);
drop policy if exists "Own cards, or the Owner: delete" on public.location_cards;
create policy "Own cards, or the Owner: delete" on public.location_cards for delete to authenticated
using (user_id = auth.uid() or public.is_owner());

grant select, insert, update, delete on public.location_cards to authenticated;

-- The card pictures: a private folder per person, 1 MB each at most (they're about 30 KB).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('cards', 'cards', false, 1048576, array['image/webp', 'image/jpeg'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Cards: see own, or the Owner" on storage.objects;
create policy "Cards: see own, or the Owner" on storage.objects for select to authenticated
using (bucket_id = 'cards' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_owner()));
drop policy if exists "Cards: add own, or the Owner" on storage.objects;
create policy "Cards: add own, or the Owner" on storage.objects for insert to authenticated
with check (bucket_id = 'cards' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_owner()));
drop policy if exists "Cards: replace own, or the Owner" on storage.objects;
create policy "Cards: replace own, or the Owner" on storage.objects for update to authenticated
using (bucket_id = 'cards' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_owner()))
with check (bucket_id = 'cards' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_owner()));
drop policy if exists "Cards: delete own, or the Owner" on storage.objects;
create policy "Cards: delete own, or the Owner" on storage.objects for delete to authenticated
using (bucket_id = 'cards' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_owner()));

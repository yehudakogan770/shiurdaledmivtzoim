-- 017: Posters. The Owner uploads a picture that pops up for every account when they open the
-- site, as many times as the Owner chooses (or every time), until an end date if one is set.
-- Everyone signed in can read the posters; only the Owner adds, changes or removes them. The
-- picture itself goes in the Owner's own folder of the "photos" bucket. Safe to run twice.
create table if not exists posters (
  id uuid primary key default gen_random_uuid(),
  image_url text not null,
  times integer check (times is null or times > 0),
  ends date,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
alter table posters enable row level security;
drop policy if exists "Signed-in people see posters" on posters;
create policy "Signed-in people see posters" on posters for select to authenticated using (true);
drop policy if exists "Owner manages posters" on posters;
create policy "Owner manages posters" on posters for all using (public.is_owner()) with check (public.is_owner());
grant select, insert, update, delete on posters to authenticated;

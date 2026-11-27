-- 021: Emails from the Owner. The Owner writes an email on the site and it goes out from the
-- Owner's Gmail (through a small Google script). This keeps who doesn't want these emails (each
-- email has an Unsubscribe link with a private key for that person) and the address of the
-- Owner's Google script. Only the Owner can see the list of email addresses. Safe to run twice.

create table if not exists email_prefs (
  user_id uuid primary key references profiles(id) on delete cascade,
  token uuid not null unique default gen_random_uuid(),
  off boolean not null default false,
  changed_at timestamptz not null default now()
);
alter table email_prefs enable row level security;
-- Nobody reads or changes it directly; only through the functions below.
revoke all on email_prefs from anon, authenticated;

create table if not exists email_sender (
  id integer primary key default 1 check (id = 1),
  url text,
  updated_at timestamptz not null default now()
);
alter table email_sender enable row level security;
drop policy if exists "Owner sets the email sender" on email_sender;
create policy "Owner sets the email sender" on email_sender for all using (public.is_owner()) with check (public.is_owner());
grant select, insert, update, delete on email_sender to authenticated;

-- The Owner: everyone with an account and an email address, and whether they unsubscribed.
create or replace function public.email_list()
returns table (id uuid, name text, email text, token uuid, off boolean)
language plpgsql security definer set search_path = public as $$
#variable_conflict use_column
begin
  if not public.is_owner() then raise exception 'Only the Owner can send emails.'; end if;
  insert into email_prefs (user_id) select p.id from profiles p on conflict (user_id) do nothing;
  return query
    select p.id, p.name::text, u.email::text, e.token, e.off
    from profiles p
    join auth.users u on u.id = p.id
    join email_prefs e on e.user_id = p.id
    where coalesce(u.email, '') <> ''
    order by p.name;
end $$;
revoke execute on function public.email_list() from public, anon;
grant execute on function public.email_list() to authenticated;

-- The Unsubscribe link (works without signing in): stop or start these emails.
create or replace function public.email_unsubscribe(p_token uuid, p_off boolean default true)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  update email_prefs set off = p_off, changed_at = now() where token = p_token;
  return found;
end $$;
grant execute on function public.email_unsubscribe(uuid, boolean) to anon, authenticated;

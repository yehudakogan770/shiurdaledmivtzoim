-- Shiur Daled Mivtzoim starter schema
create extension if not exists "uuid-ossp";

create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text,
  avatar_url text,
  role text not null default 'user' check (role in ('user','admin')),
  created_at timestamptz not null default now()
);

create table if not exists groups (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  created_by uuid not null references profiles(id) on delete restrict,
  created_at timestamptz not null default now()
);

create table if not exists group_members (
  id uuid primary key default uuid_generate_v4(),
  group_id uuid not null references groups(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  member_role text not null default 'member' check (member_role in ('owner','member')),
  joined_at timestamptz not null default now(),
  unique(group_id, user_id)
);

create table if not exists group_invitations (
  id uuid primary key default uuid_generate_v4(),
  group_id uuid not null references groups(id) on delete cascade,
  invited_user_id uuid not null references profiles(id) on delete cascade,
  invited_by uuid not null references profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','accepted','declined')),
  created_at timestamptz not null default now()
);

create table if not exists routes (
  id uuid primary key default uuid_generate_v4(),
  group_id uuid not null references groups(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists locations (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  address text,
  type text,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists route_locations (
  id uuid primary key default uuid_generate_v4(),
  route_id uuid not null references routes(id) on delete cascade,
  location_id uuid not null references locations(id) on delete cascade,
  position integer not null default 0,
  completed boolean not null default false,
  unique(route_id, location_id)
);

create table if not exists weeks (
  id uuid primary key default uuid_generate_v4(),
  start_date date not null,
  end_date date not null,
  title text not null,
  status text not null default 'open' check (status in ('open','closed')),
  created_at timestamptz not null default now()
);

create table if not exists personal_categories (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references profiles(id) on delete cascade,
  name text not null,
  description text,
  icon text not null default 'circle',
  status text not null default 'active' check (status in ('active','archived')),
  created_at timestamptz not null default now()
);

create table if not exists mivtzoim_activity (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references profiles(id) on delete restrict,
  group_id uuid references groups(id) on delete set null,
  week_id uuid references weeks(id) on delete set null,
  route_id uuid references routes(id) on delete set null,
  location_id uuid references locations(id) on delete set null,
  category_type text not null check (category_type in ('tefillin','shabbos_candles','personal')),
  personal_category_id uuid references personal_categories(id) on delete set null,
  quantity integer not null check (quantity >= 0),
  notes text,
  activity_date date not null default current_date,
  created_at timestamptz not null default now()
);

-- Standard categories are represented by category_type:
-- tefillin, shabbos_candles.
-- Personal categories are user-specific via personal_category_id.

create index if not exists idx_activity_user on mivtzoim_activity(user_id);
create index if not exists idx_activity_date on mivtzoim_activity(activity_date);
create index if not exists idx_activity_group on mivtzoim_activity(group_id);
create index if not exists idx_personal_categories_user on personal_categories(user_id);

alter table profiles enable row level security;
alter table personal_categories enable row level security;
alter table mivtzoim_activity enable row level security;

create policy "Users can view own profile"
on profiles for select using (auth.uid() = id);

create policy "Users can update own profile"
on profiles for update using (auth.uid() = id);

create policy "Users manage own personal categories"
on personal_categories for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Users view own activity"
on mivtzoim_activity for select using (auth.uid() = user_id);

create policy "Users create own activity"
on mivtzoim_activity for insert with check (auth.uid() = user_id);

create policy "Users update own activity"
on mivtzoim_activity for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Users delete own activity"
on mivtzoim_activity for delete using (auth.uid() = user_id);

-- Shiur Daled Mivtzoim database setup: PART 2 of 12. Run the parts in order.
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

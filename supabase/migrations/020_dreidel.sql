-- 020: The dreidel game on many phones. A game has a code (and a QR code and link); the host
-- creates it, others join with the code, even without an account (guests type a name). Everyone
-- can read a game and its players (no secrets in them), but every change goes through the
-- functions below, which check who is asking (each player has a private key kept on their phone)
-- and apply the rules on the server: the server picks every spin's letter, so nobody can cheat,
-- a spin can't happen twice, and coins never go below zero. Safe to run twice.
--
-- The rules (the same as on one phone): נ nothing; ג take the whole pot, then everyone still in,
-- the spinner too, puts 1 back in; ה take the smaller half; ש put in 2. Out when you have to put
-- in and can't (what you have left goes into the pot), unless you have a life token (one per game
-- won this session), which is used up instead and you stay in. Turn order: youngest to oldest,
-- the same age shuffled, no age last. Ends with one player left, or when the time runs out (most
-- coins wins; a tie, they all win).

create table if not exists dreidel_games (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  host uuid,
  status text not null default 'waiting' check (status in ('waiting', 'playing', 'over')),
  settings jsonb not null default '{"startCoins": 10, "startPot": 5, "minutes": 0}'::jsonb,
  pot integer not null default 0 check (pot >= 0),
  turn_order uuid[] not null default '{}',
  turn integer not null default 0,
  ends_at timestamptz,
  winners uuid[] not null default '{}',
  last jsonb,
  spins integer not null default 0,
  spin_letter integer,
  game_no integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists dreidel_players (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references dreidel_games(id) on delete cascade,
  secret uuid not null default gen_random_uuid(),
  name text not null,
  age integer,
  design text not null default 'gold',
  coins integer not null default 0 check (coins >= 0),
  out boolean not null default false,
  tokens integer not null default 0 check (tokens >= 0),
  wins integer not null default 0,
  joined_at timestamptz not null default now(),
  last_seen timestamptz not null default now()
);
create index if not exists dreidel_players_game on dreidel_players (game_id);

alter table dreidel_games enable row level security;
alter table dreidel_players enable row level security;
drop policy if exists "Anyone sees dreidel games" on dreidel_games;
create policy "Anyone sees dreidel games" on dreidel_games for select using (true);
drop policy if exists "Anyone sees dreidel players" on dreidel_players;
create policy "Anyone sees dreidel players" on dreidel_players for select using (true);
grant select on dreidel_games to anon, authenticated;
-- Everything about a player except their private key and age (age only decides the turn order).
revoke all on dreidel_players from anon, authenticated;
grant select (id, game_id, name, design, coins, out, tokens, wins, joined_at, last_seen) on dreidel_players to anon, authenticated;

-- Live updates: every change touches the game row, so phones only need to watch that.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'dreidel_games') then
    alter publication supabase_realtime add table dreidel_games;
  end if;
end $$;

-- ---- Helpers ----
create or replace function public.dreidel_check(p_player uuid, p_secret uuid)
returns dreidel_players language plpgsql security definer set search_path = public as $$
declare me dreidel_players;
begin
  select * into me from dreidel_players where id = p_player and secret = p_secret;
  if not found then raise exception 'You are not in this game.'; end if;
  update dreidel_players set last_seen = now() where id = me.id;
  return me;
end $$;

create or replace function public.dreidel_settings_clean(p jsonb)
returns jsonb language sql immutable as $$
  select jsonb_build_object(
    'startCoins', least(500, greatest(1, coalesce((p->>'startCoins')::int, 10))),
    'startPot', least(500, greatest(0, coalesce((p->>'startPot')::int, 5))),
    'minutes', case when coalesce((p->>'minutes')::int, 0) in (0, 3, 5, 10, 15) then coalesce((p->>'minutes')::int, 0) else 0 end
  );
$$;

create or replace function public.dreidel_name_clean(p text)
returns text language plpgsql immutable as $$
begin
  p := btrim(coalesce(p, ''));
  if length(p) < 1 then raise exception 'Type your name.'; end if;
  return left(p, 24);
end $$;

-- Start (or restart) a game with the players in it: coins, pot, turn order, timer.
create or replace function public.dreidel_begin(g dreidel_games)
returns void language plpgsql security definer set search_path = public as $$
declare ord uuid[];
begin
  select array_agg(id order by (age is null), age, random()) into ord from dreidel_players where game_id = g.id;
  update dreidel_players set coins = (g.settings->>'startCoins')::int, out = false where game_id = g.id;
  update dreidel_games set
    status = 'playing', turn_order = ord, turn = 0, pot = (g.settings->>'startPot')::int,
    winners = '{}', last = null, spin_letter = null, spins = 0,
    ends_at = case when (g.settings->>'minutes')::int > 0 then now() + make_interval(mins => (g.settings->>'minutes')::int) else null end,
    updated_at = now()
  where id = g.id;
end $$;

-- Pay n into the pot, or use a life token, or go out. Returns 'paid', 'token' or 'out'.
create or replace function public.dreidel_pay(p_game uuid, p_player uuid, n int)
returns text language plpgsql security definer set search_path = public as $$
declare q dreidel_players;
begin
  select * into q from dreidel_players where id = p_player for update;
  if q.coins >= n then
    update dreidel_players set coins = coins - n where id = q.id;
    update dreidel_games set pot = pot + n where id = p_game;
    return 'paid';
  elsif q.tokens > 0 then
    update dreidel_players set tokens = tokens - 1 where id = q.id;
    return 'token';
  else
    update dreidel_games set pot = pot + q.coins where id = p_game;
    update dreidel_players set coins = 0, out = true where id = q.id;
    return 'out';
  end if;
end $$;

-- The game ends: these players win, and each gets a win and a life token.
create or replace function public.dreidel_finish(p_game uuid, p_winners uuid[])
returns void language plpgsql security definer set search_path = public as $$
begin
  update dreidel_players set wins = wins + 1, tokens = tokens + 1 where id = any(p_winners);
  update dreidel_games set status = 'over', winners = p_winners, updated_at = now() where id = p_game;
end $$;

-- ---- What players can do ----
create or replace function public.dreidel_create(p_name text, p_age int, p_design text, p_settings jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; c text; g dreidel_games; me dreidel_players; i int;
begin
  -- Old games are cleared away after two days.
  delete from dreidel_games where updated_at < now() - interval '2 days';
  loop
    c := '';
    for i in 1..6 loop c := c || substr(chars, 1 + floor(random() * length(chars))::int, 1); end loop;
    exit when not exists (select 1 from dreidel_games where code = c);
  end loop;
  insert into dreidel_games (code, settings) values (c, public.dreidel_settings_clean(p_settings)) returning * into g;
  insert into dreidel_players (game_id, name, age, design)
    values (g.id, public.dreidel_name_clean(p_name), case when p_age between 0 and 120 then p_age end, left(coalesce(p_design, 'gold'), 40))
    returning * into me;
  update dreidel_games set host = me.id where id = g.id;
  return jsonb_build_object('gameId', g.id, 'playerId', me.id, 'secret', me.secret, 'code', g.code);
end $$;

create or replace function public.dreidel_join(p_code text, p_name text, p_age int, p_design text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare g dreidel_games; me dreidel_players; nm text := public.dreidel_name_clean(p_name);
begin
  select * into g from dreidel_games where code = upper(btrim(p_code)) for update;
  if not found then raise exception 'No game has that code.'; end if;
  if g.status <> 'waiting' then raise exception 'That game already started.'; end if;
  if exists (select 1 from dreidel_players where game_id = g.id and lower(name) = lower(nm)) then
    raise exception 'Someone with that name is already in this game.';
  end if;
  insert into dreidel_players (game_id, name, age, design)
    values (g.id, nm, case when p_age between 0 and 120 then p_age end, left(coalesce(p_design, 'gold'), 40))
    returning * into me;
  update dreidel_games set updated_at = now() where id = g.id;
  return jsonb_build_object('gameId', g.id, 'playerId', me.id, 'secret', me.secret, 'code', g.code);
end $$;

-- In the waiting room: change your name, age or dreidel (no age given keeps the one you had).
create or replace function public.dreidel_update_me(p_player uuid, p_secret uuid, p_name text, p_age int, p_design text)
returns void language plpgsql security definer set search_path = public as $$
declare me dreidel_players := public.dreidel_check(p_player, p_secret); g dreidel_games;
begin
  select * into g from dreidel_games where id = me.game_id;
  if g.status = 'waiting' then
    update dreidel_players set name = public.dreidel_name_clean(p_name), age = coalesce(case when p_age between 0 and 120 then p_age end, age), design = left(coalesce(p_design, 'gold'), 40) where id = me.id;
  else
    -- During a game, only the dreidel can change.
    update dreidel_players set design = left(coalesce(p_design, 'gold'), 40) where id = me.id;
  end if;
  update dreidel_games set updated_at = now() where id = g.id;
end $$;

create or replace function public.dreidel_set_settings(p_player uuid, p_secret uuid, p_settings jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare me dreidel_players := public.dreidel_check(p_player, p_secret); g dreidel_games;
begin
  select * into g from dreidel_games where id = me.game_id for update;
  if g.host <> me.id then raise exception 'Only the host can change the settings.'; end if;
  if g.status <> 'waiting' then raise exception 'The game already started.'; end if;
  update dreidel_games set settings = public.dreidel_settings_clean(p_settings), updated_at = now() where id = g.id;
end $$;

create or replace function public.dreidel_start(p_player uuid, p_secret uuid)
returns void language plpgsql security definer set search_path = public as $$
declare me dreidel_players := public.dreidel_check(p_player, p_secret); g dreidel_games;
begin
  select * into g from dreidel_games where id = me.game_id for update;
  if g.host <> me.id then raise exception 'Only the host can start the game.'; end if;
  if g.status <> 'waiting' then raise exception 'The game already started.'; end if;
  if (select count(*) from dreidel_players where game_id = g.id) < 2 then raise exception 'At least two players are needed.'; end if;
  perform public.dreidel_begin(g);
end $$;

-- Spin. p_spins is how many spins this phone has seen, so a double tap can't spin twice.
-- The server picks the letter and applies it. Returns the letter (0 נ, 1 ג, 2 ה, 3 ש).
create or replace function public.dreidel_spin(p_player uuid, p_secret uuid, p_spins int)
returns int language plpgsql security definer set search_path = public as $$
declare
  me dreidel_players := public.dreidel_check(p_player, p_secret);
  g dreidel_games; cur dreidel_players; q dreidel_players;
  n int; k int; letter int; took int := 0; paid int := 0; r text; used boolean := false; went_out boolean := false;
  refill jsonb := '[]'::jsonb; left_ids uuid[];
begin
  select * into g from dreidel_games where id = me.game_id for update;
  if g.status <> 'playing' then raise exception 'The game isn''t on.'; end if;
  if g.spins <> p_spins then raise exception 'Someone already spun.'; end if;
  n := array_length(g.turn_order, 1);
  select * into cur from dreidel_players where id = g.turn_order[g.turn + 1] for update;
  -- Your own turn, or the host spinning for a player whose phone has gone quiet.
  if cur.id <> me.id and not (g.host = me.id and cur.last_seen < now() - interval '45 seconds') then
    raise exception 'It isn''t your turn.';
  end if;
  letter := floor(random() * 4)::int;
  if letter = 1 then
    took := g.pot;
    update dreidel_players set coins = coins + g.pot where id = cur.id;
    update dreidel_games set pot = 0 where id = g.id;
    for k in 0..n - 1 loop
      select * into q from dreidel_players where id = g.turn_order[((g.turn + k) % n) + 1];
      if not q.out then
        r := public.dreidel_pay(g.id, q.id, 1);
        refill := refill || jsonb_build_object('playerId', q.id, 'paid', r = 'paid', 'usedToken', r = 'token', 'out', r = 'out');
        if q.id = cur.id and r = 'paid' then paid := 1; end if;
      end if;
    end loop;
  elsif letter = 2 then
    took := g.pot / 2;
    update dreidel_players set coins = coins + took where id = cur.id;
    update dreidel_games set pot = pot - took where id = g.id;
  elsif letter = 3 then
    r := public.dreidel_pay(g.id, cur.id, 2);
    if r = 'paid' then paid := 2; end if;
    used := r = 'token';
    went_out := r = 'out';
  end if;
  update dreidel_games set
    spins = spins + 1, spin_letter = letter, updated_at = now(),
    last = jsonb_build_object('playerId', cur.id, 'letter', letter, 'took', took, 'paid', paid, 'usedToken', used, 'out', went_out, 'refill', refill)
  where id = g.id;
  select array_agg(id) into left_ids from dreidel_players where game_id = g.id and not out;
  if coalesce(array_length(left_ids, 1), 0) <= 1 then
    perform public.dreidel_finish(g.id, coalesce(left_ids, '{}'));
  else
    -- The next player still in.
    for k in 1..n loop
      if not (select out from dreidel_players where id = g.turn_order[((g.turn + k) % n) + 1]) then
        update dreidel_games set turn = (g.turn + k) % n where id = g.id;
        exit;
      end if;
    end loop;
  end if;
  return letter;
end $$;

-- When the time is up (any player's phone asks; the server checks the clock): most coins wins.
create or replace function public.dreidel_time_up(p_player uuid, p_secret uuid)
returns void language plpgsql security definer set search_path = public as $$
declare me dreidel_players := public.dreidel_check(p_player, p_secret); g dreidel_games; top int; ws uuid[];
begin
  select * into g from dreidel_games where id = me.game_id for update;
  if g.status <> 'playing' or g.ends_at is null or g.ends_at > now() then return; end if;
  select max(coins) into top from dreidel_players where game_id = g.id and not out;
  select array_agg(id) into ws from dreidel_players where game_id = g.id and not out and coins = top;
  perform public.dreidel_finish(g.id, coalesce(ws, '{}'));
end $$;

-- The host starts the next game with the same players (wins and life tokens carry over).
create or replace function public.dreidel_play_again(p_player uuid, p_secret uuid)
returns void language plpgsql security definer set search_path = public as $$
declare me dreidel_players := public.dreidel_check(p_player, p_secret); g dreidel_games;
begin
  select * into g from dreidel_games where id = me.game_id for update;
  if g.host <> me.id then raise exception 'Only the host can start the next game.'; end if;
  if g.status <> 'over' then raise exception 'The game isn''t over yet.'; end if;
  if (select count(*) from dreidel_players where game_id = g.id) < 2 then raise exception 'At least two players are needed.'; end if;
  update dreidel_games set game_no = game_no + 1 where id = g.id;
  perform public.dreidel_begin(g);
end $$;

-- Leave the game. In the waiting room you're removed; during a game you're out (your coins go
-- into the pot). If the host leaves, the next player becomes host.
create or replace function public.dreidel_leave(p_player uuid, p_secret uuid)
returns void language plpgsql security definer set search_path = public as $$
declare me dreidel_players := public.dreidel_check(p_player, p_secret); g dreidel_games; nxt uuid; left_ids uuid[]; n int; k int;
begin
  select * into g from dreidel_games where id = me.game_id for update;
  if g.status = 'playing' then
    update dreidel_games set pot = pot + me.coins where id = g.id;
    update dreidel_players set coins = 0, out = true where id = me.id;
    select array_agg(id) into left_ids from dreidel_players where game_id = g.id and not out;
    if coalesce(array_length(left_ids, 1), 0) <= 1 then
      perform public.dreidel_finish(g.id, coalesce(left_ids, '{}'));
    elsif g.turn_order[g.turn + 1] = me.id then
      n := array_length(g.turn_order, 1);
      for k in 1..n loop
        if not (select out from dreidel_players where id = g.turn_order[((g.turn + k) % n) + 1]) then
          update dreidel_games set turn = (g.turn + k) % n where id = g.id;
          exit;
        end if;
      end loop;
    end if;
  else
    delete from dreidel_players where id = me.id;
    if not exists (select 1 from dreidel_players where game_id = g.id) then
      delete from dreidel_games where id = g.id;
      return;
    end if;
  end if;
  if g.host = me.id then
    select id into nxt from dreidel_players where game_id = g.id and id <> me.id order by out, joined_at limit 1;
    update dreidel_games set host = nxt where id = g.id;
  end if;
  update dreidel_games set updated_at = now() where id = g.id;
end $$;

-- Each phone says it's still here every little while. If the host's phone has gone quiet for a
-- minute, the next player who checks in becomes host.
create or replace function public.dreidel_ping(p_player uuid, p_secret uuid)
returns void language plpgsql security definer set search_path = public as $$
declare me dreidel_players := public.dreidel_check(p_player, p_secret); g dreidel_games;
begin
  select * into g from dreidel_games where id = me.game_id;
  if g.host <> me.id and exists (select 1 from dreidel_players where id = g.host and last_seen < now() - interval '60 seconds') then
    update dreidel_games set host = me.id, updated_at = now() where id = g.id;
  end if;
end $$;

grant execute on function public.dreidel_create(text, int, text, jsonb) to anon, authenticated;
grant execute on function public.dreidel_join(text, text, int, text) to anon, authenticated;
grant execute on function public.dreidel_update_me(uuid, uuid, text, int, text) to anon, authenticated;
grant execute on function public.dreidel_set_settings(uuid, uuid, jsonb) to anon, authenticated;
grant execute on function public.dreidel_start(uuid, uuid) to anon, authenticated;
grant execute on function public.dreidel_spin(uuid, uuid, int) to anon, authenticated;
grant execute on function public.dreidel_time_up(uuid, uuid) to anon, authenticated;
grant execute on function public.dreidel_play_again(uuid, uuid) to anon, authenticated;
grant execute on function public.dreidel_leave(uuid, uuid) to anon, authenticated;
grant execute on function public.dreidel_ping(uuid, uuid) to anon, authenticated;
-- The helpers are only for the functions above.
revoke execute on function public.dreidel_check(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.dreidel_begin(dreidel_games) from public, anon, authenticated;
revoke execute on function public.dreidel_pay(uuid, uuid, int) from public, anon, authenticated;
revoke execute on function public.dreidel_finish(uuid, uuid[]) from public, anon, authenticated;

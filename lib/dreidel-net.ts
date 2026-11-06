import { applySpin, endOnTime, newGame, type GamePlayer, type GameSettings, type GameState, type Outcome } from "./dreidel-game";
import { t } from "./i18n";

/**
 * The dreidel game on many phones. On the website the game lives in Supabase (see migration
 * 020): every change goes through a database function that checks who is asking and applies the
 * rules there, and phones hear about changes live (with a check every few seconds as a backup).
 * Without Supabase (local testing) the game is kept in this browser and shared between its tabs.
 */
export interface NetPlayer extends GamePlayer {
  /** When this player's phone last checked in (ms). */
  lastSeen: number;
}

export interface NetGame {
  id: string;
  code: string;
  host: string | null;
  status: "waiting" | "playing" | "over";
  settings: GameSettings;
  pot: number;
  order: string[];
  turn: number;
  endsAt: number | null;
  winners: string[];
  last: Outcome | null;
  spins: number;
  /** The letter of the latest spin. */
  spinLetter: number | null;
  /** Which game of the session (Play Again adds one). */
  game: number;
  /** Players in the order they joined. */
  players: NetPlayer[];
}

/** Who this phone is in a game. The secret proves it; it never leaves this phone except to the server. */
export interface Session {
  gameId: string;
  playerId: string;
  secret: string;
  code: string;
}

export interface Me {
  name: string;
  age: number | null;
  design: string;
}

export interface DreidelNet {
  create(me: Me, settings: GameSettings): Promise<Session>;
  join(code: string, me: Me): Promise<Session>;
  /** null when the game is gone. */
  load(gameId: string): Promise<NetGame | null>;
  /** Calls back whenever the game changes. Returns a function that stops listening. */
  subscribe(gameId: string, onChange: () => void): () => void;
  updateMe(s: Session, me: Me): Promise<void>;
  setSettings(s: Session, settings: GameSettings): Promise<void>;
  start(s: Session): Promise<void>;
  /** `spins`: how many spins this phone has seen, so a double tap can't spin twice. */
  spin(s: Session, spins: number): Promise<number>;
  timeUp(s: Session): Promise<void>;
  playAgain(s: Session): Promise<void>;
  leave(s: Session): Promise<void>;
  ping(s: Session): Promise<void>;
}

/** The game as the one-phone rules see it (for the shared screens). */
export function asState(g: NetGame): GameState {
  return {
    settings: g.settings,
    players: g.players,
    order: g.order,
    turn: g.turn,
    pot: g.pot,
    status: g.status === "over" ? "over" : "playing",
    endsAt: g.endsAt,
    winners: g.winners,
    last: g.last,
    game: g.game,
    spins: g.spins,
  };
}

// ---- This phone's place in a game ----
const SESSION_KEY = "sdm-dreidel-session";
// Without Supabase the "phones" are tabs of one browser, so each tab keeps its own place.
const sessionStore = () => (process.env.NEXT_PUBLIC_SUPABASE_URL ? localStorage : sessionStorage);
export function savedSession(): Session | null {
  try {
    const s = JSON.parse(sessionStore().getItem(SESSION_KEY) || "null");
    return s && s.gameId && s.playerId && s.secret ? s : null;
  } catch {
    return null;
  }
}
export function saveSession(s: Session | null) {
  try {
    if (s) sessionStore().setItem(SESSION_KEY, JSON.stringify(s));
    else sessionStore().removeItem(SESSION_KEY);
  } catch {
    // Not remembered on this phone.
  }
}

/** A link that opens the game with its code filled in. */
export function joinLink(code: string) {
  return `${window.location.origin}${process.env.NEXT_PUBLIC_BASE_PATH || ""}/dreidel/?join=${code}`;
}

/** Finds a game code in what a QR code holds: a join link, or just the code. */
export function codeFrom(text: string): string | null {
  const s = text.trim();
  try {
    const c = new URL(s).searchParams.get("join");
    if (c) return c.toUpperCase();
  } catch {
    // Not a link.
  }
  const m = s.toUpperCase().match(/\b[A-Z2-9]{6}\b/);
  return m ? m[0] : null;
}

let net: Promise<DreidelNet> | null = null;
export function getDreidelNet(): Promise<DreidelNet> {
  net ??= (async () => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    return url && key ? supabaseNet(url, key) : localNet();
  })();
  return net;
}

// ---- On the website: Supabase ----
type GameRow = {
  id: string;
  code: string;
  host: string | null;
  status: NetGame["status"];
  settings: GameSettings;
  pot: number;
  turn_order: string[];
  turn: number;
  ends_at: string | null;
  winners: string[];
  last: Outcome | null;
  spins: number;
  spin_letter: number | null;
  game_no: number;
};
type PlayerRow = { id: string; name: string; age: number | null; design: string; coins: number; out: boolean; tokens: number; wins: number; last_seen: string };

/** The database update hasn't been run yet, or another problem: a message people can read. */
function friendly(error: { message: string; code?: string }) {
  if (error.code === "PGRST202" || error.code === "42P01" || /could not find the function|does not exist|schema cache/i.test(error.message)) {
    return new Error(t("Playing on many phones isn't ready yet. Please let the Owner know."));
  }
  // The messages from the game's own checks.
  const known: Record<string, string> = {
    "No game has that code.": t("No game has that code."),
    "That game already started.": t("That game already started."),
    "Someone with that name is already in this game.": t("Someone with that name is already in this game."),
    "Type your name.": t("Type your name."),
    "Someone already spun.": t("Someone already spun."),
    "It isn't your turn.": t("It isn't your turn."),
    "You are not in this game.": t("You are not in this game."),
    "At least two players are needed.": t("At least two players are needed."),
  };
  return new Error(known[error.message] ?? error.message);
}

async function supabaseNet(url: string, key: string): Promise<DreidelNet> {
  const { createClient } = await import("@supabase/supabase-js");
  // Its own connection that never signs in: guests play too, and it doesn't touch the account's sign-in.
  const sb = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false, storageKey: "sdm-dreidel" } });

  async function rpc<R>(fn: string, args: Record<string, unknown>): Promise<R> {
    const { data, error } = await sb.rpc(fn, args);
    if (error) throw friendly(error);
    return data as R;
  }
  const mine = (s: Session) => ({ p_player: s.playerId, p_secret: s.secret });

  return {
    create: (me, settings) => rpc("dreidel_create", { p_name: me.name, p_age: me.age, p_design: me.design, p_settings: settings }),
    join: (code, me) => rpc("dreidel_join", { p_code: code, p_name: me.name, p_age: me.age, p_design: me.design }),
    async load(gameId) {
      const [g, p] = await Promise.all([
        sb.from("dreidel_games").select("id, code, host, status, settings, pot, turn_order, turn, ends_at, winners, last, spins, spin_letter, game_no").eq("id", gameId).maybeSingle(),
        // Every column but the private key (which can't be read anyway).
        sb.from("dreidel_players").select("id, name, age, design, coins, out, tokens, wins, last_seen").eq("game_id", gameId).order("joined_at"),
      ]);
      if (g.error) throw friendly(g.error);
      if (p.error) throw friendly(p.error);
      const row = g.data as GameRow | null;
      if (!row) return null;
      return {
        id: row.id,
        code: row.code,
        host: row.host,
        status: row.status,
        settings: row.settings,
        pot: row.pot,
        order: row.turn_order ?? [],
        turn: row.turn,
        endsAt: row.ends_at ? Date.parse(row.ends_at) : null,
        winners: row.winners ?? [],
        last: row.last,
        spins: row.spins,
        spinLetter: row.spin_letter,
        game: row.game_no,
        players: ((p.data ?? []) as PlayerRow[]).map((x) => ({ id: x.id, name: x.name, age: x.age, design: x.design, coins: x.coins, out: x.out, tokens: x.tokens, wins: x.wins, lastSeen: Date.parse(x.last_seen) })),
      };
    },
    subscribe(gameId, onChange) {
      const ch = sb
        .channel(`dreidel-${gameId}`)
        .on("postgres_changes", { event: "*", schema: "public", table: "dreidel_games", filter: `id=eq.${gameId}` }, () => onChange())
        .subscribe();
      // A backup in case a live update is missed (or live updates aren't switched on).
      const timer = setInterval(() => {
        if (document.visibilityState === "visible") onChange();
      }, 3000);
      return () => {
        clearInterval(timer);
        void sb.removeChannel(ch);
      };
    },
    updateMe: (s, me) => rpc("dreidel_update_me", { ...mine(s), p_name: me.name, p_age: me.age, p_design: me.design }),
    setSettings: (s, settings) => rpc("dreidel_set_settings", { ...mine(s), p_settings: settings }),
    start: (s) => rpc("dreidel_start", mine(s)),
    spin: (s, spins) => rpc("dreidel_spin", { ...mine(s), p_spins: spins }),
    timeUp: (s) => rpc("dreidel_time_up", mine(s)),
    playAgain: (s) => rpc("dreidel_play_again", mine(s)),
    leave: (s) => rpc("dreidel_leave", mine(s)),
    ping: (s) => rpc("dreidel_ping", mine(s)),
  };
}

// ---- Without Supabase: this browser's tabs (for testing) ----
type LocalGame = NetGame & { secrets: Record<string, string>; joined: Record<string, number> };
const LOCAL_KEY = "sdm-dreidel-net";

function localNet(): DreidelNet {
  const bc = typeof BroadcastChannel !== "undefined" ? new BroadcastChannel("sdm-dreidel") : null;
  const all = (): Record<string, LocalGame> => {
    try {
      return JSON.parse(localStorage.getItem(LOCAL_KEY) || "{}");
    } catch {
      return {};
    }
  };
  const write = (games: Record<string, LocalGame>) => {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(games));
    bc?.postMessage("changed");
  };
  const id = () => crypto.randomUUID();
  const fail = (m: string): never => {
    throw new Error(t(m));
  };
  /** Change a game as one player, after checking their secret. */
  function as<R>(s: Session, fn: (g: LocalGame, me: NetPlayer) => R): R {
    const games = all();
    const g = games[s.gameId];
    const me = g?.players.find((p) => p.id === s.playerId);
    if (!g || !me || g.secrets[me.id] !== s.secret) fail("You are not in this game.");
    me!.lastSeen = Date.now();
    const r = fn(g, me!);
    write(games);
    return r;
  }
  const clean = (n: string) => n.trim().slice(0, 24) || fail("Type your name.");
  const addPlayer = (g: LocalGame, me: Me) => {
    const p: NetPlayer = { id: id(), name: clean(me.name), age: me.age, design: me.design, coins: 0, out: false, tokens: 0, wins: 0, lastSeen: Date.now() };
    g.players.push(p);
    g.secrets[p.id] = id();
    g.joined[p.id] = Date.now();
    return { gameId: g.id, playerId: p.id, secret: g.secrets[p.id], code: g.code };
  };
  // The one-phone rules, applied to the shared game.
  const begin = (g: LocalGame, game: number) => {
    const s = newGame(g.settings, g.players, game);
    Object.assign(g, { status: "playing", pot: s.pot, order: s.order, turn: 0, endsAt: s.endsAt, winners: [], last: null, spins: 0, spinLetter: null, game });
    for (const p of g.players) Object.assign(p, { coins: s.settings.startCoins, out: false });
  };
  const adopt = (g: LocalGame, s: GameState) => {
    Object.assign(g, { pot: s.pot, turn: s.turn, winners: s.winners, last: s.last, spins: s.spins, status: s.status });
    for (const p of g.players) Object.assign(p, s.players.find((x) => x.id === p.id));
  };

  return {
    async create(me, settings) {
      const games = all();
      const g: LocalGame = { id: id(), code: Math.random().toString(36).slice(2, 8).toUpperCase().replace(/[01IO]/g, "7"), host: null, status: "waiting", settings, pot: 0, order: [], turn: 0, endsAt: null, winners: [], last: null, spins: 0, spinLetter: null, game: 1, players: [], secrets: {}, joined: {} };
      const s = addPlayer(g, me);
      g.host = s.playerId;
      games[g.id] = g;
      write(games);
      return s;
    },
    async join(code, me) {
      const games = all();
      const g = Object.values(games).find((x) => x.code === code.trim().toUpperCase()) ?? fail("No game has that code.");
      if (g.status !== "waiting") fail("That game already started.");
      if (g.players.some((p) => p.name.toLowerCase() === me.name.trim().toLowerCase())) fail("Someone with that name is already in this game.");
      const s = addPlayer(g, me);
      write(games);
      return s;
    },
    async load(gameId) {
      const g = all()[gameId];
      if (!g) return null;
      const { secrets: _s, joined: _j, ...rest } = g;
      return rest;
    },
    subscribe(_gameId, onChange) {
      const onMsg = () => onChange();
      bc?.addEventListener("message", onMsg);
      window.addEventListener("storage", onMsg);
      return () => {
        bc?.removeEventListener("message", onMsg);
        window.removeEventListener("storage", onMsg);
      };
    },
    async updateMe(s, me) {
      as(s, (g, p) => Object.assign(p, g.status === "waiting" ? { name: clean(me.name), age: me.age, design: me.design } : { design: me.design }));
    },
    async setSettings(s, settings) {
      as(s, (g, me) => {
        if (g.host !== me.id) fail("Only the host can change the settings.");
        g.settings = settings;
      });
    },
    async start(s) {
      as(s, (g, me) => {
        if (g.host !== me.id) fail("Only the host can start the game.");
        if (g.players.length < 2) fail("At least two players are needed.");
        begin(g, g.game);
      });
    },
    async spin(s, spins) {
      return as(s, (g, me) => {
        if (g.status !== "playing") fail("The game isn't on.");
        if (g.spins !== spins) fail("Someone already spun.");
        const cur = g.order[g.turn];
        const quiet = (g.players.find((p) => p.id === cur)?.lastSeen ?? 0) < Date.now() - 45_000;
        if (cur !== me.id && !(g.host === me.id && quiet)) fail("It isn't your turn.");
        const letter = Math.floor(Math.random() * 4);
        adopt(g, applySpin(asState(g), letter));
        g.spinLetter = letter;
        return letter;
      });
    },
    async timeUp(s) {
      as(s, (g) => {
        if (g.status === "playing" && g.endsAt && g.endsAt <= Date.now()) adopt(g, endOnTime(asState(g)));
      });
    },
    async playAgain(s) {
      as(s, (g, me) => {
        if (g.host !== me.id) fail("Only the host can start the next game.");
        begin(g, g.game + 1);
      });
    },
    async leave(s) {
      as(s, (g, me) => {
        if (g.status === "playing") {
          g.pot += me.coins;
          Object.assign(me, { coins: 0, out: true });
          const left = g.players.filter((p) => !p.out);
          if (left.length <= 1) {
            Object.assign(g, { status: "over", winners: left.map((p) => p.id) });
            for (const w of left) Object.assign(w, { wins: w.wins + 1, tokens: w.tokens + 1 });
          } else if (g.order[g.turn] === me.id) {
            for (let k = 1; k <= g.order.length; k++) {
              const i = (g.turn + k) % g.order.length;
              if (!g.players.find((p) => p.id === g.order[i])?.out) {
                g.turn = i;
                break;
              }
            }
          }
        } else g.players = g.players.filter((p) => p.id !== me.id);
        if (g.host === me.id) g.host = g.players.find((p) => p.id !== me.id && !p.out)?.id ?? null;
      });
    },
    async ping(s) {
      as(s, (g, me) => {
        const host = g.players.find((p) => p.id === g.host);
        if (g.host !== me.id && (!host || host.lastSeen < Date.now() - 60_000)) g.host = me.id;
      });
    },
  };
}

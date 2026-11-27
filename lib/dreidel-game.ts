/**
 * The dreidel game's rules, kept apart from the screens (the same rules run on one phone now and
 * on many phones later):
 *
 * - נ Nun: nothing happens.
 * - ג Gimmel: take the whole pot, then everyone still playing, the spinner too, puts 1 back in.
 * - ה Hey: take the smaller half of the pot (5 in the pot: take 2).
 * - ש Shin: put 2 in.
 *
 * A player who has to put coins in and can't is out right away (whatever they have left goes into
 * the pot). A player with 0 coins stays in until they have to put something in, so a Gimmel can
 * still bring them back. Winning a game earns a life token: the next time that player would go
 * out, the token is used up instead, that turn is skipped, and they stay in.
 *
 * Turn order: youngest to oldest; the same age, or no age given, in random order (no age goes last).
 * The game ends when one player is left, or when the time runs out (most coins wins; a tie, both win).
 */
export interface GamePlayer {
  id: string;
  name: string;
  /** Optional; decides the turn order. */
  age: number | null;
  design: string;
  coins: number;
  out: boolean;
  /** Life tokens (one for each game won in this session). */
  tokens: number;
  /** Games won in this session. */
  wins: number;
}

export interface GameSettings {
  startCoins: number;
  startPot: number;
  /** 0 for no time limit. */
  minutes: number;
}

export const DEFAULT_SETTINGS: GameSettings = { startCoins: 10, startPot: 5, minutes: 0 };
export const TIME_LIMITS = [0, 3, 5, 10, 15];

/** What a spin did, to show everyone. */
export interface Outcome {
  playerId: string;
  letter: number;
  /** Coins taken from the pot (Gimmel, Hey). */
  took: number;
  /** Coins put in (Shin), or 1 after a Gimmel. */
  paid: number;
  /** The spinner used a life token instead of going out. */
  usedToken: boolean;
  /** The spinner went out. */
  out: boolean;
  /** After a Gimmel: who put 1 in, who used a token, who went out. */
  refill: { playerId: string; paid: boolean; usedToken: boolean; out: boolean }[];
}

export interface GameState {
  settings: GameSettings;
  players: GamePlayer[];
  /** Player ids in turn order. */
  order: string[];
  /** Index into `order` of whose turn it is. */
  turn: number;
  pot: number;
  status: "playing" | "over";
  /** When the time runs out (ms), or null. */
  endsAt: number | null;
  winners: string[];
  last: Outcome | null;
  /** Which game of the session this is (1, 2, 3…). */
  game: number;
  /** Counts spins, so each one is only applied once. */
  spins: number;
}

const shuffle = <X>(list: X[]) => {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

/** Youngest to oldest; the same age shuffled; no age at the end, shuffled. */
export function turnOrder(players: Pick<GamePlayer, "id" | "age">[]) {
  const withAge = shuffle(players.filter((p) => p.age != null)).sort((a, b) => (a.age as number) - (b.age as number));
  const noAge = shuffle(players.filter((p) => p.age == null));
  return [...withAge, ...noAge].map((p) => p.id);
}

/** A new game. Players keep their wins and life tokens from earlier games in the session. */
export function newGame(settings: GameSettings, players: Pick<GamePlayer, "id" | "name" | "age" | "design" | "tokens" | "wins">[], game = 1): GameState {
  return {
    settings,
    players: players.map((p) => ({ ...p, coins: settings.startCoins, out: false })),
    order: turnOrder(players),
    turn: 0,
    pot: settings.startPot,
    status: "playing",
    endsAt: settings.minutes ? Date.now() + settings.minutes * 60_000 : null,
    winners: [],
    last: null,
    game,
    spins: 0,
  };
}

export const currentPlayer = (s: GameState) => s.players.find((p) => p.id === s.order[s.turn])!;

/** Pay `n` into the pot, or use a life token, or go out. */
function pay(p: GamePlayer, n: number, s: { pot: number }) {
  if (p.coins >= n) {
    p.coins -= n;
    s.pot += n;
    return { paid: true, usedToken: false, out: false };
  }
  if (p.tokens > 0) {
    p.tokens -= 1;
    return { paid: false, usedToken: true, out: false };
  }
  // Out: what they have left goes into the pot.
  s.pot += p.coins;
  p.coins = 0;
  p.out = true;
  return { paid: false, usedToken: false, out: true };
}

function finish(s: GameState, winners: GamePlayer[]) {
  s.status = "over";
  s.winners = winners.map((w) => w.id);
  // Each win earns a life token for the next game in the session.
  for (const w of winners) {
    w.wins += 1;
    w.tokens += 1;
  }
}

/** Apply a spin's letter (0–3) for the player whose turn it is. Returns the new state. */
export function applySpin(state: GameState, letter: number): GameState {
  if (state.status !== "playing") return state;
  const s: GameState = structuredClone(state);
  const p = currentPlayer(s);
  const o: Outcome = { playerId: p.id, letter, took: 0, paid: 0, usedToken: false, out: false, refill: [] };
  if (letter === 1) {
    o.took = s.pot;
    p.coins += s.pot;
    s.pot = 0;
    // Everyone still playing, the spinner too, puts 1 back in, in turn order from the spinner.
    for (let k = 0; k < s.order.length; k++) {
      const q = s.players.find((x) => x.id === s.order[(s.turn + k) % s.order.length])!;
      if (q.out) continue;
      const r = pay(q, 1, s);
      o.refill.push({ playerId: q.id, ...r });
      if (q.id === p.id && r.paid) o.paid = 1;
    }
  } else if (letter === 2) {
    o.took = Math.floor(s.pot / 2);
    p.coins += o.took;
    s.pot -= o.took;
  } else if (letter === 3) {
    const r = pay(p, 2, s);
    if (r.paid) o.paid = 2;
    o.usedToken = r.usedToken;
    o.out = r.out;
  }
  s.last = o;
  s.spins += 1;
  const left = s.players.filter((x) => !x.out);
  if (left.length <= 1) {
    finish(s, left);
    return s;
  }
  // Next player still in.
  for (let k = 1; k <= s.order.length; k++) {
    const i = (s.turn + k) % s.order.length;
    if (!s.players.find((x) => x.id === s.order[i])!.out) {
      s.turn = i;
      break;
    }
  }
  return s;
}

/** When the time is up: most coins wins (a tie, they all win). */
export function endOnTime(state: GameState): GameState {
  if (state.status !== "playing") return state;
  const s: GameState = structuredClone(state);
  const left = s.players.filter((x) => !x.out);
  const top = Math.max(...left.map((x) => x.coins));
  finish(s, left.filter((x) => x.coins === top));
  return s;
}

/** Play again with the same players: wins and life tokens carry over. */
export function playAgain(state: GameState): GameState {
  return newGame(state.settings, state.players, state.game + 1);
}

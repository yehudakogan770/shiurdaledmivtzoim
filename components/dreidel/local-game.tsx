"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronLeft, Minus, Plus, Trash2, Trophy, UserPlus } from "lucide-react";
import { randomLetter, savedDesign } from "@/lib/dreidel";
import { applySpin, currentPlayer, DEFAULT_SETTINGS, endOnTime, newGame, playAgain, TIME_LIMITS, type GameSettings, type GameState, type Outcome } from "@/lib/dreidel-game";
import { t } from "@/lib/i18n";
import { GeltShower } from "../gelt-shower";
import { Input, cx } from "../ui";
import { DreidelView, type Spin } from "./dreidel-view";
import { DreidelGlobe } from "./globe";
import { DreidelThumb } from "./thumb";

/**
 * Dreidel on one phone: type in the players (an age is optional; youngest goes first), each
 * picks a dreidel, the host sets the coins and an optional time limit, then pass the phone around.
 * The game is kept on this phone, so it isn't lost if the page reloads.
 */
interface SetupPlayer {
  id: string;
  name: string;
  age: string;
  design: string;
}
interface Saved {
  players: SetupPlayer[];
  settings: GameSettings;
  game: GameState | null;
}
const KEY = "sdm-dreidel-local";
const newId = () => Math.random().toString(36).slice(2, 10);

function load(): Saved {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) || "null");
    if (s && Array.isArray(s.players)) return s;
  } catch {
    // Start fresh.
  }
  const d = savedDesign();
  return {
    players: [
      { id: newId(), name: "", age: "", design: d },
      { id: newId(), name: "", age: "", design: "wood" },
    ],
    settings: DEFAULT_SETTINGS,
    game: null,
  };
}
function save(s: Saved) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    // Not kept on this phone.
  }
}

export function LocalGame({ onExit }: { onExit(): void }) {
  const [saved, setSaved] = useState<Saved | null>(null);
  useEffect(() => setSaved(load()), []);
  const update = (next: Saved) => {
    setSaved(next);
    save(next);
  };
  if (!saved) return null;
  if (saved.game) return <Game state={saved.game} onChange={(game) => update({ ...saved, game })} onExit={() => update({ ...saved, game: null })} />;
  return (
    <Setup
      saved={saved}
      onChange={update}
      onBack={onExit}
      onStart={() => {
        const players = saved.players.map((p, i) => ({
          id: p.id,
          name: p.name.trim() || t("Player {n}", { n: i + 1 }),
          age: p.age.trim() ? Math.max(0, Math.round(Number(p.age))) : null,
          design: p.design,
          tokens: 0,
          wins: 0,
        }));
        update({ ...saved, game: newGame(saved.settings, players) });
      }}
    />
  );
}

// ---- Setting up ----
function Setup({ saved, onChange, onBack, onStart }: { saved: Saved; onChange(s: Saved): void; onBack(): void; onStart(): void }) {
  const [choosing, setChoosing] = useState<string | null>(null);
  const players = saved.players;
  const set = (id: string, patch: Partial<SetupPlayer>) => onChange({ ...saved, players: players.map((p) => (p.id === id ? { ...p, ...patch } : p)) });
  const settings = saved.settings;
  const setS = (patch: Partial<GameSettings>) => onChange({ ...saved, settings: { ...settings, ...patch } });
  const ready = players.length >= 2;

  return (
    <div className="mx-auto max-w-xl pb-6">
      <BackBar onBack={onBack} title={t("Play on This Phone")} />

      <Label>{t("Players")}</Label>
      <p className="text-sm text-muted">{t("Add everyone who's playing. Age is optional: the youngest goes first.")}</p>
      <div className="mt-3 grid gap-3">
        {players.map((p, i) => (
          <div key={p.id} className="flex items-center gap-2 rounded-[20px] border border-white/12 bg-white/5 p-2">
            <button type="button" onClick={() => setChoosing(p.id)} aria-label={t("Choose a dreidel for {name}", { name: p.name || t("Player {n}", { n: i + 1 }) })} className="rounded-2xl bg-white/5 p-1">
              <DreidelThumb design={p.design} size={52} />
            </button>
            <Input value={p.name} onChange={(e) => set(p.id, { name: e.target.value })} placeholder={t("e.g. Mendel")} aria-label={t("Name")} maxLength={24} className="!w-auto min-w-0 flex-1 py-2.5" />
            <Input value={p.age} onChange={(e) => set(p.id, { age: e.target.value.replace(/\D/g, "").slice(0, 3) })} inputMode="numeric" placeholder={t("Age")} aria-label={t("Age")} className="!w-[4.25rem] shrink-0 px-2 py-2.5 text-center" />
            {players.length > 2 && (
              <button type="button" onClick={() => onChange({ ...saved, players: players.filter((x) => x.id !== p.id) })} aria-label={t("Remove {name}", { name: p.name || t("Player {n}", { n: i + 1 }) })} className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-muted hover:bg-white/10">
                <Trash2 size={17} />
              </button>
            )}
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={() => onChange({ ...saved, players: [...players, { id: newId(), name: "", age: "", design: savedDesign() }] })}
        className="mt-3 flex h-12 w-full items-center justify-center gap-2 rounded-[18px] border border-white/15 bg-gradient-to-b from-white/15 to-white/5 font-medium shadow-[inset_0_1px_0_rgba(255,255,255,.25)]"
      >
        <UserPlus size={18} aria-hidden /> {t("Add a Player")}
      </button>
      <p className="mt-1.5 px-1 text-xs text-muted">{t("Tap a dreidel to choose a different one.")}</p>

      <SettingsForm settings={settings} onChange={setS} />

      <div className="mt-7">
        <Big disabled={!ready} onClick={onStart}>
          {t("Start the Game")}
        </Big>
      </div>

      {choosing && (
        <DreidelGlobe
          value={players.find((p) => p.id === choosing)?.design ?? "gold"}
          onClose={() => setChoosing(null)}
          onChoose={(d) => {
            set(choosing, { design: d });
            setChoosing(null);
          }}
        />
      )}
    </div>
  );
}

/** Coins and time limit. Read-only for players who aren't the host. */
export function SettingsForm({ settings, onChange, readOnly }: { settings: GameSettings; onChange(patch: Partial<GameSettings>): void; readOnly?: boolean }) {
  const setS = onChange;
  if (readOnly)
    return (
      <div className="mt-2 grid gap-1 rounded-[18px] border border-white/10 bg-white/5 px-4 py-3 text-start text-sm">
        <span>{t("Coins for each player")}: <b className="tabular">{settings.startCoins}</b></span>
        <span>{t("Coins in the pot to start")}: <b className="tabular">{settings.startPot}</b></span>
        <span>{t("Time Limit")}: <b>{settings.minutes ? t("{n} min", { n: settings.minutes }) : t("Until there's a winner")}</b></span>
      </div>
    );
  return (
    <>
  <Label>{t("Coins")}</Label>
  <Row label={t("Coins for each player")}>
    <Stepper value={settings.startCoins} min={1} max={500} onChange={(v) => setS({ startCoins: v })} label={t("Coins for each player")} />
  </Row>
  <Row label={t("Coins in the pot to start")}>
    <Stepper value={settings.startPot} min={0} max={500} onChange={(v) => setS({ startPot: v })} label={t("Coins in the pot to start")} />
  </Row>

  <Label>{t("Time Limit")}</Label>
  <div className="flex flex-wrap gap-2">
    {TIME_LIMITS.map((m) => (
      <button
        key={m}
        type="button"
        aria-pressed={settings.minutes === m}
        onClick={() => setS({ minutes: m })}
        className={cx("h-11 rounded-full px-4 text-sm transition", settings.minutes === m ? gold : "border border-white/15 bg-white/5")}
      >
        <span className="relative">{m ? t("{n} min", { n: m }) : t("Until there's a winner")}</span>
      </button>
    ))}
  </div>
    </>
  );
}

// ---- Playing ----
function Game({ state, onChange, onExit }: { state: GameState; onChange(s: GameState): void; onExit(): void }) {
  const [spin, setSpin] = useState<Spin | null>(null);
  const [spinning, setSpinning] = useState(false);
  // Whose dreidel is on screen: the spinner's until the result has been shown, then the next player's.
  const [showing, setShowing] = useState(currentPlayer(state).id);
  const [message, setMessage] = useState<string | null>(null);
  const [gelt, setGelt] = useState(0);
  const [now, setNow] = useState(Date.now());
  const pending = useRef<number | null>(null);
  const stateRef = useRef(state);
  stateRef.current = state;

  // A new game (Play Again): start on its first player.
  useEffect(() => {
    setShowing(currentPlayer(stateRef.current).id);
    setMessage(null);
  }, [state.game]);
  // When a game ends, show the last spin for a moment before the results.
  const [over, setOver] = useState(state.status === "over");
  useEffect(() => {
    if (state.status !== "over") return setOver(false);
    const timer = setTimeout(() => setOver(true), 2400);
    return () => clearTimeout(timer);
  }, [state.status]);

  useEffect(() => {
    if (!state.endsAt || state.status !== "playing") return;
    const timer = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(timer);
  }, [state.endsAt, state.status]);
  // Time's up: finish the game (after a spin in progress lands).
  useEffect(() => {
    if (state.status === "playing" && state.endsAt && now >= state.endsAt && !spinning) onChange(endOnTime(state));
  }, [now, spinning, state, onChange]);

  const nameOf = (id: string) => state.players.find((p) => p.id === id)?.name ?? "";
  const shown = state.players.find((p) => p.id === showing) ?? currentPlayer(state);
  const turnPlayer = currentPlayer(state);

  const go = (direction: 1 | -1 = 1) => {
    if (spinning || state.status !== "playing" || showing !== turnPlayer.id) return;
    const letter = randomLetter();
    pending.current = letter;
    setSpinning(true);
    setMessage(null);
    setSpin({ id: `${state.game}-${state.spins}`, result: letter, direction });
  };

  const landed = (letter: number) => {
    if (pending.current !== letter) return;
    pending.current = null;
    const before = stateRef.current;
    const after = applySpin(before, letter);
    setMessage(outcomeText(after.last!, nameOf));
    if (letter === 1) setGelt((n) => n + 1);
    onChange(after);
    setSpinning(false);
    // Give everyone a moment to see the result, then hand over to the next player.
    setTimeout(() => setShowing(currentPlayer(after).id), 2200);
  };

  if (state.status === "over" && over) return <Results state={state} onAgain={() => onChange(playAgain(state))} onExit={onExit} />;

  const left = state.endsAt ? Math.max(0, state.endsAt - now) : null;
  const myTurn = showing === turnPlayer.id;

  return (
    <div className="mx-auto max-w-xl pb-6 text-center">
      {gelt > 0 && <GeltShower key={gelt} />}
      <BackBar
        onBack={() => {
          if (confirm(t("Leave this game? It will be lost."))) onExit();
        }}
        title={t("Dreidel Game")}
        right={left != null ? <span className="tabular rounded-full bg-white/10 px-3 py-1 text-sm">{`${Math.floor(left / 60000)}:${String(Math.floor((left % 60000) / 1000)).padStart(2, "0")}`}</span> : null}
      />

      {/* The pot */}
      <div className="mt-1 flex items-center justify-center gap-2.5">
        <Gelt size={34} />
        <span key={state.pot} className="tally-pop chanukah-gold tabular text-[2.2rem] leading-none">
          {state.pot}
        </span>
        <span className="text-sm text-muted">{t("in the pot")}</span>
      </div>

      <p className="mt-3 text-lg font-semibold">{myTurn ? t("{name}'s turn", { name: turnPlayer.name }) : t("{name} spun", { name: shown.name })}</p>
      <DreidelView design={shown.design} spin={spin} onSpinRequest={go} onLanded={landed} className="-mt-2" />
      <p className="min-h-[3rem] px-2 text-[0.95rem]" aria-live="polite">
        {message ?? (spinning ? t("Spinning…") : myTurn ? t("Swipe or tap the dreidel to spin it") : "")}
      </p>
      <Big disabled={spinning || !myTurn} onClick={() => go(1)}>
        {myTurn ? t("Spin, {name}", { name: turnPlayer.name }) : t("Next: {name}", { name: turnPlayer.name })}
      </Big>

      <PlayerList state={state} turnId={turnPlayer.id} />
      <p className="mt-3 text-xs text-muted">{t("A small gold coin by a name is a life token: it saves that player once from going out.")}</p>
    </div>
  );
}

/** What a spin did, in words. */
export function outcomeText(o: Outcome, nameOf: (id: string) => string) {
  const who = nameOf(o.playerId);
  const lines: string[] = [];
  if (o.letter === 0) lines.push(t("{name} got Nun: nothing happens.", { name: who }));
  if (o.letter === 1) lines.push(t("{name} got Gimmel and takes the whole pot: {n}!", { name: who, n: o.took }), t("Everyone puts 1 back in."));
  if (o.letter === 2) lines.push(t("{name} got Hey and takes half the pot: {n}.", { name: who, n: o.took }));
  if (o.letter === 3) lines.push(o.out ? t("{name} got Shin and can't put in 2: {name} is out.", { name: who }) : o.usedToken ? t("{name} got Shin and used a life token to stay in.", { name: who }) : t("{name} got Shin and puts 2 in the pot.", { name: who }));
  for (const r of o.refill) {
    if (r.out) lines.push(t("{name} couldn't put 1 in and is out.", { name: nameOf(r.playerId) }));
    if (r.usedToken) lines.push(t("{name} used a life token to stay in.", { name: nameOf(r.playerId) }));
  }
  return lines.join(" ");
}

/** The players in turn order: their dreidel, life tokens and coins. `you` marks this phone's player. */
export function PlayerList({ state, turnId, you }: { state: GameState; turnId: string; you?: string }) {
  const ordered = state.order.map((id) => state.players.find((p) => p.id === id)).filter((p) => p != null);
  return (
  <ul className="mt-6 grid gap-2 text-start">
    {ordered.map((p) => (
      <li
        key={p.id}
        className={cx(
          "flex items-center gap-3 rounded-[18px] border px-3 py-2 transition",
          p.id === turnId && !p.out ? "border-[#ffbd52]/70 bg-[#ffbd52]/10" : "border-white/10 bg-white/5",
          p.out && "opacity-45",
        )}
      >
        <DreidelThumb design={p.design} size={40} />
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5 font-medium">
            <span className="truncate">{p.name}</span>
            {p.id === you && <span className="shrink-0 text-xs text-muted">{t("(you)")}</span>}
            <Coins n={p.tokens} title={t("Life token")} />
          </span>
          <span className="block text-xs text-muted">{p.out ? t("Out") : p.id === turnId ? t("Their turn") : ""}</span>
        </span>
        <span className="flex items-center gap-1.5">
          <Gelt size={20} />
          <span key={p.coins} className="tally-pop tabular text-lg font-semibold">
            {p.coins}
          </span>
        </span>
      </li>
    ))}
  </ul>
  );
}

// ---- The end ----
/** Without onAgain (on many phones, for everyone but the host), `waiting` is shown instead. */
export function Results({ state, onAgain, onExit, waiting }: { state: GameState; onAgain?: () => void; onExit(): void; waiting?: string }) {
  const winners = state.players.filter((p) => state.winners.includes(p.id));
  const ranked = [...state.players].sort((a, b) => b.coins - a.coins || Number(a.out) - Number(b.out));
  return (
    <div className="mx-auto max-w-xl pb-6 text-center">
      <GeltShower />
      <p className="pt-4 text-xs font-semibold uppercase tracking-[0.14em] text-accent">{t("Game {n} Over", { n: state.game })}</p>
      <h1 className="mt-2 text-[2.2rem] leading-tight">
        <span className="chanukah-gold">{winners.length > 1 ? t("It's a Tie!") : t("{name} Wins!", { name: winners[0]?.name ?? "" })}</span>
      </h1>
      <div className="mt-4 flex justify-center gap-4">
        {winners.map((w) => (
          <div key={w.id} className="grid justify-items-center gap-1">
            <DreidelThumb design={w.design} size={110} />
            <span className="font-medium">{w.name}</span>
          </div>
        ))}
      </div>
      <p className="mt-2 text-sm text-muted">{t("Each winner gets a life token for the next game.")}</p>
      <ul className="mt-5 grid gap-2 text-start">
        {ranked.map((p) => (
          <li key={p.id} className="flex items-center gap-3 rounded-[18px] border border-white/10 bg-white/5 px-3 py-2">
            {state.winners.includes(p.id) ? <Trophy size={20} className="shrink-0 text-accent" aria-label={t("Winner")} /> : <span className="w-5" />}
            <DreidelThumb design={p.design} size={36} />
            <span className="flex min-w-0 flex-1 items-center gap-1.5 font-medium">
              <span className="truncate">{p.name}</span>
              <Coins n={p.wins} title={t("Wins")} />
            </span>
            <span className="flex items-center gap-1.5">
              <Gelt size={18} />
              <span className="tabular font-semibold">{p.coins}</span>
            </span>
          </li>
        ))}
      </ul>
      <div className="mt-6 grid gap-3">
        {onAgain ? <Big onClick={onAgain}>{t("Play Again")}</Big> : <p className="text-sm text-muted">{waiting}</p>}
        <Big ghost onClick={onExit}>
          {t("Done")}
        </Big>
      </div>
    </div>
  );
}

// ---- Small pieces ----
export const gold =
  "relative overflow-hidden bg-gradient-to-b from-[#ffe29a] via-[#ffbd52] to-[#f28a2e] font-semibold text-[#2a1300] shadow-[inset_0_1px_0_rgba(255,255,255,.7)] before:absolute before:inset-x-0 before:top-0 before:h-1/2 before:bg-gradient-to-b before:from-white/40 before:to-transparent";

export function Big({ children, onClick, disabled, ghost }: { children: ReactNode; onClick(): void; disabled?: boolean; ghost?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cx(
        "flex h-14 w-full items-center justify-center rounded-[20px] text-[1.05rem] transition active:scale-[0.98] disabled:opacity-45",
        ghost ? "border border-white/15 bg-gradient-to-b from-white/15 to-white/5 font-medium shadow-[inset_0_1px_0_rgba(255,255,255,.25)]" : cx(gold, "shadow-[0_10px_30px_rgba(255,140,50,.3),inset_0_1px_0_rgba(255,255,255,.75)]"),
      )}
    >
      <span className="relative">{children}</span>
    </button>
  );
}

export function BackBar({ onBack, title, right }: { onBack(): void; title: string; right?: ReactNode }) {
  return (
    <div className="flex items-center gap-2 pt-1">
      <button type="button" onClick={onBack} aria-label={t("Back")} className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-white/15 bg-white/5">
        <ChevronLeft size={20} className="rtl:rotate-180" />
      </button>
      <h1 className="min-w-0 flex-1 truncate text-start text-xl font-semibold">{title}</h1>
      {right}
    </div>
  );
}

export function Label({ children }: { children: ReactNode }) {
  return <p className="mt-7 mb-1 text-xs font-semibold uppercase tracking-[0.14em] text-accent">{children}</p>;
}

export function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center gap-3 py-2">
      <span className="min-w-0 flex-1">{label}</span>
      {children}
    </div>
  );
}

export function Stepper({ value, min, max, label, onChange }: { value: number; min: number; max: number; label: string; onChange(v: number): void }) {
  return (
    <div className="flex h-12 shrink-0 items-center rounded-full border border-white/15 bg-white/5" role="group" aria-label={label}>
      <button type="button" aria-label={t("Less")} disabled={value <= min} onClick={() => onChange(Math.max(min, value - 1))} className="grid h-12 w-11 place-items-center text-accent disabled:opacity-30">
        <Minus size={18} />
      </button>
      <input
        aria-label={label}
        inputMode="numeric"
        value={value}
        onChange={(e) => onChange(Math.max(min, Math.min(max, Number(e.target.value.replace(/\D/g, "")) || min)))}
        className="tabular w-12 bg-transparent text-center text-lg font-medium focus:outline-none"
      />
      <button type="button" aria-label={t("More")} disabled={value >= max} onClick={() => onChange(Math.min(max, value + 1))} className="grid h-12 w-11 place-items-center text-accent disabled:opacity-30">
        <Plus size={18} />
      </button>
    </div>
  );
}

/** One small coin for each (life token or win), overlapping; nothing at all for none. */
export function Coins({ n, size = 16, title }: { n: number; size?: number; title: string }) {
  if (n <= 0) return null;
  return (
    <span role="img" aria-label={`${title}: ${n}`} title={`${title}: ${n}`} className="flex shrink-0 items-center">
      {Array.from({ length: n }, (_, i) => (
        <span key={i} className="rounded-full shadow-[0_1px_2px_rgba(0,0,0,.35)]" style={{ marginInlineStart: i ? -size * 0.45 : 0 }}>
          <Gelt size={size} />
        </span>
      ))}
    </span>
  );
}

/** A little gold gelt coin with a menorah, for coin counts and life tokens. */
export function Gelt({ size = 20, title }: { size?: number; title?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden={!title} role={title ? "img" : undefined} aria-label={title} className="shrink-0">
      {title && <title>{title}</title>}
      <defs>
        <radialGradient id="gelt-g" cx="35%" cy="30%" r="75%">
          <stop offset="0" stopColor="#fff2c2" />
          <stop offset="0.45" stopColor="#f2c14e" />
          <stop offset="1" stopColor="#a8701c" />
        </radialGradient>
      </defs>
      <circle cx="12" cy="12" r="11" fill="url(#gelt-g)" stroke="#8a5a14" strokeWidth="0.8" />
      <circle cx="12" cy="12" r="8.4" fill="none" stroke="#8a5a14" strokeOpacity="0.5" strokeWidth="0.7" strokeDasharray="0.9 1.1" />
      <path d="M12 7.2v8.6M8.9 18h6.2M6.6 9.4l5.4 5.1 5.4-5.1M8.4 9.4l3.6 3.4 3.6-3.4M10.2 9.4l1.8 1.7 1.8-1.7" fill="none" stroke="#7a4d10" strokeWidth="0.8" strokeLinecap="round" />
    </svg>
  );
}


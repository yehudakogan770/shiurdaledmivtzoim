"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Copy, Crown, QrCode, Share2 } from "lucide-react";
import { savedDesign, saveDesign } from "@/lib/dreidel";
import { DEFAULT_SETTINGS, type GameSettings } from "@/lib/dreidel-game";
import { asState, codeFrom, getDreidelNet, joinLink, savedSession, saveSession, type DreidelNet, type Me, type NetGame, type Session } from "@/lib/dreidel-net";
import { useData } from "@/lib/data";
import { t } from "@/lib/i18n";
import { GeltShower } from "../gelt-shower";
import { Input, cx } from "../ui";
import { DreidelView, type Spin } from "./dreidel-view";
import { DreidelGlobe } from "./globe";
import { BackBar, Big, Gelt, Label, outcomeText, PlayerList, Results, SettingsForm } from "./local-game";
import { QrScan } from "./qr-scan";
import { DreidelThumb } from "./thumb";

/**
 * Dreidel on many phones. One phone starts a game and gets a code (and a QR code and a link);
 * everyone else joins with it, even without an account. Every spin is seen live on every phone,
 * and the coins change on their own. The server picks each spin's letter and keeps the score.
 */
const ME_KEY = "sdm-dreidel-me";
function savedMe(): { name: string; age: string } {
  try {
    const m = JSON.parse(localStorage.getItem(ME_KEY) || "null");
    if (m && typeof m.name === "string") return { name: m.name, age: String(m.age ?? "") };
  } catch {
    // Nothing saved.
  }
  return { name: "", age: "" };
}

const errorText = (e: unknown) => (e instanceof Error ? e.message : t("Something went wrong. Please try again."));

export function OnlineGame({ onExit, joinCode }: { onExit(): void; joinCode?: string }) {
  const [net, setNet] = useState<DreidelNet | null>(null);
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [game, setGame] = useState<NetGame | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [lastOk, setLastOk] = useState(Date.now());

  useEffect(() => {
    getDreidelNet().then(setNet);
    // A link with a different game's code wins over the game this phone was in.
    const s = savedSession();
    setSession(s && (!joinCode || s.code === joinCode.toUpperCase()) ? s : null);
  }, [joinCode]);

  const enter = (s: Session | null) => {
    saveSession(s);
    setSession(s);
    setGame(null);
  };

  const reload = useCallback(async () => {
    if (!net || !session) return;
    try {
      const g = await net.load(session.gameId);
      setLastOk(Date.now());
      if (!g || !g.players.some((p) => p.id === session.playerId)) {
        setNotice(t("That game has ended."));
        return enter(null);
      }
      setGame(g);
    } catch {
      // Try again on the next check.
    }
  }, [net, session]);

  // Live updates while in a game, and "still here" every 20 seconds.
  useEffect(() => {
    if (!net || !session) return;
    reload();
    const stop = net.subscribe(session.gameId, reload);
    const ping = () => net.ping(session).catch(() => {});
    ping();
    const timer = setInterval(ping, 20_000);
    const onShow = () => {
      if (document.visibilityState === "visible") {
        ping();
        reload();
      }
    };
    document.addEventListener("visibilitychange", onShow);
    return () => {
      stop();
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onShow);
    };
  }, [net, session, reload]);

  const leave = async () => {
    if (net && session) await net.leave(session).catch(() => {});
    enter(null);
  };

  if (!net || session === undefined) return null;
  if (!session) return <Entry net={net} joinCode={joinCode} notice={notice} onEnter={(s) => (setNotice(null), enter(s))} onBack={onExit} />;
  if (!game) return <p className="pt-16 text-center text-sm text-muted">{t("Loading the game…")}</p>;
  const props = { net, session, game, reload, live: Date.now() - lastOk < 12_000 };
  if (game.status === "waiting") return <Lobby {...props} onLeave={leave} />;
  return <Play {...props} onLeave={leave} />;
}

type Props = { net: DreidelNet; session: Session; game: NetGame; reload(): Promise<void>; live: boolean; onLeave(): Promise<void> };

// ---- Start or join ----
function Entry({ net, joinCode, notice, onEnter, onBack }: { net: DreidelNet; joinCode?: string; notice: string | null; onEnter(s: Session): void; onBack(): void }) {
  const { me } = useData();
  const [name, setName] = useState("");
  const [age, setAge] = useState("");
  const [design, setDesign] = useState("gold");
  const [code, setCode] = useState(joinCode?.toUpperCase() ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [choosing, setChoosing] = useState(false);
  const [scanning, setScanning] = useState(false);

  useEffect(() => {
    const m = savedMe();
    setName(m.name || me?.name || "");
    setAge(m.age);
    setDesign(savedDesign());
  }, [me?.name]);

  const who = (): Me | null => {
    if (!name.trim()) {
      setError(t("Type your name."));
      return null;
    }
    try {
      localStorage.setItem(ME_KEY, JSON.stringify({ name: name.trim(), age }));
    } catch {
      // Not remembered.
    }
    return { name: name.trim(), age: age ? Math.round(Number(age)) : null, design };
  };
  const run = async (fn: (m: Me) => Promise<Session>) => {
    const m = who();
    if (!m || busy) return;
    setBusy(true);
    setError(null);
    try {
      onEnter(await fn(m));
    } catch (e) {
      setError(errorText(e));
      setBusy(false);
    }
  };
  const join = (c = code) => {
    const clean = codeFrom(c) ?? c.trim().toUpperCase();
    if (clean.length !== 6) return setError(t("Type the 6-letter game code."));
    run((m) => net.join(clean, m));
  };

  return (
    <div className="mx-auto max-w-xl pb-6">
      <BackBar onBack={onBack} title={t("Play on Many Phones")} />
      {notice && <p className="mt-3 rounded-2xl bg-white/10 px-4 py-2 text-sm">{notice}</p>}

      <Label>{t("You")}</Label>
      <div className="flex items-center gap-2 rounded-[20px] border border-white/12 bg-white/5 p-2">
        <button type="button" onClick={() => setChoosing(true)} aria-label={t("Choose a Different Dreidel")} className="rounded-2xl bg-white/5 p-1">
          <DreidelThumb design={design} size={52} />
        </button>
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={t("Your name")} aria-label={t("Name")} maxLength={24} className="!w-auto min-w-0 flex-1 py-2.5" />
        <Input value={age} onChange={(e) => setAge(e.target.value.replace(/\D/g, "").slice(0, 3))} inputMode="numeric" placeholder={t("Age")} aria-label={t("Age")} className="!w-[4.25rem] shrink-0 px-2 py-2.5 text-center" />
      </div>
      <p className="mt-1.5 px-1 text-xs text-muted">{t("Age is optional: the youngest goes first. Tap the dreidel to choose a different one.")}</p>

      <Label>{t("Join a Game")}</Label>
      <div className="flex gap-2">
        <Input
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6))}
          placeholder={t("Game code")}
          aria-label={t("Game code")}
          autoCapitalize="characters"
          autoComplete="off"
          className="tabular !w-auto min-w-0 flex-1 py-3 text-center text-xl tracking-[0.3em]"
        />
        <button type="button" onClick={() => setScanning(true)} aria-label={t("Scan the QR Code")} className="grid h-[3.25rem] w-[3.25rem] shrink-0 place-items-center rounded-[18px] border border-white/15 bg-gradient-to-b from-white/15 to-white/5">
          <QrCode size={22} />
        </button>
      </div>
      <div className="mt-3">
        <Big disabled={busy} onClick={() => join()}>
          {t("Join")}
        </Big>
      </div>

      <div className="my-6 flex items-center gap-3 text-xs text-muted">
        <span className="h-px flex-1 bg-white/15" />
        {t("or")}
        <span className="h-px flex-1 bg-white/15" />
      </div>
      <Big ghost disabled={busy} onClick={() => run((m) => net.create(m, DEFAULT_SETTINGS))}>
        {t("Start a New Game")}
      </Big>
      <p className="mt-1.5 px-1 text-center text-xs text-muted">{t("You'll get a code and a QR code for everyone to join.")}</p>

      {error && (
        <p role="alert" className="mt-4 rounded-2xl bg-danger-soft px-4 py-3 text-sm text-danger">
          {error}
        </p>
      )}

      {choosing && (
        <DreidelGlobe
          value={design}
          onClose={() => setChoosing(false)}
          onChoose={(d) => {
            setDesign(d);
            saveDesign(d);
            setChoosing(false);
          }}
        />
      )}
      {scanning && (
        <QrScan
          onClose={() => setScanning(false)}
          onCode={(c) => {
            setScanning(false);
            setCode(c);
            join(c);
          }}
        />
      )}
    </div>
  );
}

// ---- The waiting room ----
function Lobby({ net, session, game, reload, live, onLeave }: Props) {
  const isHost = game.host === session.playerId;
  const host = game.players.find((p) => p.id === game.host);
  const mine = game.players.find((p) => p.id === session.playerId)!;
  const [qr, setQr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [settings, setSettings] = useState<GameSettings>(game.settings);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [choosing, setChoosing] = useState(false);
  const link = joinLink(game.code);

  useEffect(() => {
    import("qrcode").then((Q) => Q.toDataURL(link, { margin: 1, width: 420, color: { dark: "#1a1033", light: "#ffffff" } }).then(setQr));
  }, [link]);
  // Others see the host's settings as they change.
  const editing = useRef(0);
  useEffect(() => {
    if (Date.now() - editing.current > 2500) setSettings(game.settings);
  }, [game.settings]);

  const act = async (fn: () => Promise<unknown>) => {
    setError(null);
    try {
      await fn();
      await reload();
    } catch (e) {
      setError(errorText(e));
    }
  };
  const share = async () => {
    const text = t("Join my dreidel game! Code: {code}", { code: game.code });
    try {
      if (navigator.share) return await navigator.share({ title: t("Dreidel"), text, url: link });
    } catch {
      return;
    }
    await navigator.clipboard?.writeText(link).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="mx-auto max-w-xl pb-6 text-center">
      <BackBar
        onBack={() => {
          if (confirm(t("Leave this game?"))) onLeave();
        }}
        title={t("Waiting Room")}
        right={<LiveDot live={live} />}
      />

      <p className="mt-4 text-sm text-muted">{t("Game code")}</p>
      <p className="chanukah-gold tabular text-[2.8rem] leading-tight tracking-[0.18em]">{game.code}</p>
      <div className="mx-auto mt-2 w-[min(62vw,15rem)] rounded-[22px] border border-white/20 bg-white/90 p-2.5 shadow-[0_10px_30px_rgba(0,0,0,.25)]">
        {qr ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={qr} alt={t("QR code to join the game")} className="aspect-square w-full rounded-[14px]" />
        ) : (
          <span className="block aspect-square w-full animate-pulse rounded-[14px] bg-black/10" />
        )}
      </div>
      <p className="mt-2 text-sm text-muted">{t("Everyone scans this, or types the code, to join.")}</p>
      <button type="button" onClick={share} className="mx-auto mt-3 flex h-11 items-center gap-2 rounded-full border border-white/15 bg-white/5 px-5 text-sm font-medium">
        {copied ? <Copy size={17} aria-hidden /> : <Share2 size={17} aria-hidden />}
        {copied ? t("Link copied") : t("Share the Link")}
      </button>

      <Label>{t("Players ({n})", { n: game.players.length })}</Label>
      <ul className="grid gap-2 text-start">
        {game.players.map((p) => (
          <li key={p.id} className="flex items-center gap-3 rounded-[18px] border border-white/10 bg-white/5 px-3 py-2">
            <DreidelThumb design={p.design} size={40} />
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-1.5 font-medium">
                <span className="truncate">{p.name}</span>
                {p.id === session.playerId && <span className="shrink-0 text-xs text-muted">{t("(you)")}</span>}
                {Array.from({ length: p.tokens }, (_, i) => (
                  <Gelt key={i} size={16} title={t("Life token")} />
                ))}
              </span>
              <span className="block text-xs text-muted">{p.age != null ? t("Age {n}", { n: p.age }) : ""}</span>
            </span>
            {p.id === game.host && (
              <span className="flex items-center gap-1 text-xs text-accent">
                <Crown size={16} aria-hidden /> {t("Host")}
              </span>
            )}
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={() => setChoosing(true)}
        className="mt-3 flex h-12 w-full items-center justify-center rounded-[18px] border border-white/15 bg-gradient-to-b from-white/15 to-white/5 font-medium shadow-[inset_0_1px_0_rgba(255,255,255,.25)]"
      >
        {t("Choose a Different Dreidel")}
      </button>

      <div className="text-start">
        <SettingsForm
          settings={settings}
          readOnly={!isHost}
          onChange={(patch) => {
            const next = { ...settings, ...patch };
            editing.current = Date.now();
            setSettings(next);
            act(() => net.setSettings(session, next));
          }}
        />
      </div>

      <div className="mt-7">
        {isHost ? (
          <>
            <Big
              disabled={busy || game.players.length < 2}
              onClick={async () => {
                setBusy(true);
                await act(() => net.start(session));
                setBusy(false);
              }}
            >
              {t("Start the Game")}
            </Big>
            {game.players.length < 2 && <p className="mt-2 text-sm text-muted">{t("Waiting for players to join…")}</p>}
          </>
        ) : (
          <p className="rounded-2xl bg-white/10 px-4 py-3 text-sm">{t("Waiting for {name} to start the game…", { name: host?.name ?? t("the host") })}</p>
        )}
      </div>
      {error && (
        <p role="alert" className="mt-4 rounded-2xl bg-danger-soft px-4 py-3 text-sm text-danger">
          {error}
        </p>
      )}

      {choosing && (
        <DreidelGlobe
          value={mine.design}
          onClose={() => setChoosing(false)}
          onChoose={(d) => {
            setChoosing(false);
            saveDesign(d);
            act(() => net.updateMe(session, { name: mine.name, age: mine.age, design: d }));
          }}
        />
      )}
    </div>
  );
}

// ---- Playing ----
const currentId = (g: NetGame) => g.order[g.turn];

function Play({ net, session, game, reload, live, onLeave }: Props) {
  // What's on screen: the game as it was before the spin that's still turning, so the coins only
  // change when the dreidel lands.
  const [shown, setShown] = useState(game);
  const shownRef = useRef(shown);
  shownRef.current = shown;
  const latest = useRef(game);
  latest.current = game;
  const [spin, setSpin] = useState<Spin | null>(null);
  const turning = useRef<NetGame | null>(null);
  const [spinning, setSpinning] = useState(false);
  const [asking, setAsking] = useState(false);
  const [showing, setShowing] = useState(currentId(game));
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [gelt, setGelt] = useState(0);
  const [now, setNow] = useState(Date.now());
  const direction = useRef<1 | -1>(1);
  const handOver = useRef<number | undefined>(undefined);

  // A change from the server: a new spin turns the dreidel first; anything else shows at once.
  useEffect(() => {
    if (turning.current) return;
    const s = shownRef.current;
    if (game.game !== s.game) {
      setShown(game);
      setShowing(currentId(game));
      setMessage(null);
      return;
    }
    if (game.spins === s.spins + 1 && game.spinLetter != null && game.last) {
      turning.current = game;
      clearTimeout(handOver.current);
      setShowing(game.last.playerId);
      setMessage(null);
      setSpinning(true);
      setSpin({ id: `${game.game}-${game.spins}`, result: game.spinLetter, direction: game.last.playerId === session.playerId ? direction.current : 1 });
      return;
    }
    if (game.spins !== s.spins) setShowing(currentId(game));
    setShown(game);
  }, [game, session.playerId]);

  const landed = () => {
    const g = turning.current;
    if (!g) return;
    turning.current = null;
    setSpinning(false);
    const now = latest.current;
    setShown(now);
    const nameOf = (id: string) => now.players.find((p) => p.id === id)?.name ?? "";
    setMessage(outcomeText(g.last!, nameOf));
    // The gelt falls on the spinner's own phone.
    if (g.spinLetter === 1 && g.last!.playerId === session.playerId) setGelt((n) => n + 1);
    handOver.current = window.setTimeout(() => setShowing(currentId(latest.current)), 2200);
  };

  // Your turn: a little buzz.
  const myTurn = shown.status === "playing" && currentId(shown) === session.playerId && !spinning;
  useEffect(() => {
    if (myTurn) navigator.vibrate?.(120);
  }, [myTurn]);

  // The timer. When it runs out, any phone asks the server to end the game (it checks the clock).
  useEffect(() => {
    if (!shown.endsAt || shown.status !== "playing") return;
    const timer = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(timer);
  }, [shown.endsAt, shown.status]);
  const asked = useRef(0);
  useEffect(() => {
    if (shown.status === "playing" && shown.endsAt && now >= shown.endsAt && !spinning && now - asked.current > 4000) {
      asked.current = now;
      net.timeUp(session).then(reload, () => {});
    }
  }, [now, shown, spinning, net, session, reload]);

  // A moment to see the last spin before the results.
  const [over, setOver] = useState(shown.status === "over");
  useEffect(() => {
    if (shown.status !== "over") return setOver(false);
    const timer = setTimeout(() => setOver(true), 2400);
    return () => clearTimeout(timer);
  }, [shown.status]);

  const turnPlayer = shown.players.find((p) => p.id === currentId(shown));
  const isHost = shown.host === session.playerId;
  // The host can spin for a player whose phone has gone quiet.
  const quiet = isHost && !myTurn && turnPlayer && now - turnPlayer.lastSeen > 50_000;
  useEffect(() => {
    if (!isHost) return;
    const timer = setInterval(() => setNow(Date.now()), 5000);
    return () => clearInterval(timer);
  }, [isHost]);

  const go = async (dir: 1 | -1 = 1) => {
    if (spinning || asking || shown.status !== "playing" || (!myTurn && !quiet) || latest.current.spins !== shown.spins) return;
    direction.current = dir;
    setAsking(true);
    setError(null);
    setMessage(null);
    try {
      await net.spin(session, shown.spins);
      await reload();
    } catch (e) {
      setError(errorText(e));
      reload();
    }
    setAsking(false);
  };

  if (shown.status === "over" && over) {
    const host = shown.players.find((p) => p.id === shown.host);
    return (
      <Results
        state={asState(shown)}
        onAgain={isHost ? () => net.playAgain(session).then(reload, (e) => setError(errorText(e))) : undefined}
        waiting={t("Waiting for {name} to start the next game…", { name: host?.name ?? t("the host") })}
        onExit={() => {
          if (confirm(t("Leave this game?"))) onLeave();
        }}
      />
    );
  }

  const state = asState(shown);
  const shownPlayer = shown.players.find((p) => p.id === showing) ?? turnPlayer;
  const left = shown.endsAt ? Math.max(0, shown.endsAt - now) : null;
  const status: ReactNode = asking
    ? t("Spinning…")
    : spinning
      ? t("{name} is spinning…", { name: shownPlayer?.name ?? "" })
      : (message ?? (myTurn ? t("Your turn! Swipe or tap the dreidel to spin it") : ""));

  return (
    <div className="mx-auto max-w-xl pb-6 text-center">
      {gelt > 0 && <GeltShower key={gelt} />}
      <BackBar
        onBack={() => {
          if (confirm(t("Leave this game? You'll be out."))) onLeave();
        }}
        title={t("Game {n}", { n: shown.game })}
        right={
          <span className="flex items-center gap-2">
            {left != null && <span className="tabular rounded-full bg-white/10 px-3 py-1 text-sm">{`${Math.floor(left / 60000)}:${String(Math.floor((left % 60000) / 1000)).padStart(2, "0")}`}</span>}
            <LiveDot live={live} />
          </span>
        }
      />

      <div className="mt-1 flex items-center justify-center gap-2.5">
        <Gelt size={34} />
        <span key={shown.pot} className="tally-pop chanukah-gold tabular text-[2.2rem] leading-none">
          {shown.pot}
        </span>
        <span className="text-sm text-muted">{t("in the pot")}</span>
      </div>

      <p className={cx("mt-3 text-lg font-semibold", myTurn && "chanukah-gold")}>
        {myTurn ? t("Your turn!") : showing === currentId(shown) ? t("{name}'s turn", { name: turnPlayer?.name ?? "" }) : t("{name} spun", { name: shownPlayer?.name ?? "" })}
      </p>
      <DreidelView design={shownPlayer?.design ?? "gold"} spin={spin} onSpinRequest={myTurn ? go : undefined} onLanded={landed} className="-mt-2" />
      <p className="min-h-[3rem] px-2 text-[0.95rem]" aria-live="polite">
        {status}
      </p>
      {myTurn || asking ? (
        <Big disabled={asking || spinning} onClick={() => go(1)}>
          {t("Spin")}
        </Big>
      ) : quiet && !spinning ? (
        <Big ghost onClick={() => go(1)}>
          {t("Spin for {name}", { name: turnPlayer!.name })}
        </Big>
      ) : (
        <p className={cx("rounded-2xl bg-white/10 px-4 py-3 text-sm transition-opacity", (spinning || !turnPlayer || shown.status !== "playing") && "opacity-0")}>
          {turnPlayer ? t("Waiting for {name} to spin…", { name: turnPlayer.name }) : " "}
        </p>
      )}
      {error && (
        <p role="alert" className="mt-3 rounded-2xl bg-danger-soft px-4 py-3 text-sm text-danger">
          {error}
        </p>
      )}

      <PlayerList state={state} turnId={currentId(shown)} you={session.playerId} />
      <p className="mt-3 text-xs text-muted">{t("A small gold coin by a name is a life token: it saves that player once from going out.")}</p>
    </div>
  );
}

/** Shows whether this phone is hearing from the game. */
function LiveDot({ live }: { live: boolean }) {
  return (
    <span className="flex items-center gap-1.5 text-xs text-muted" role="status">
      <span className={cx("h-2.5 w-2.5 rounded-full", live ? "bg-[#4ade80] shadow-[0_0_8px_#4ade80]" : "animate-pulse bg-white/40")} />
      {live ? t("Live") : t("Reconnecting…")}
    </span>
  );
}

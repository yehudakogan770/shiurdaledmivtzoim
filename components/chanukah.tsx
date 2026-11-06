"use client";

import { useEffect, useId, useMemo } from "react";
import { FlaskConical } from "lucide-react";
import { useData, sumChanukah } from "@/lib/data";
import { useNav } from "@/lib/nav";
import { isChanukahOn, useChanukah, type ChanukahState } from "@/lib/chanukah";
import { zmanimPlace } from "@/lib/shkiah";
import { locale, t } from "@/lib/i18n";
import { MenorahIcon } from "./icons";
import { Menorah3D } from "./menorah-3d";
import { cx } from "./ui";

/** Each night in Hebrew (it stays Hebrew in every language) and its English title. */
const NIGHTS_HE = ["נר ראשון", "נר שני", "נר שלישי", "נר רביעי", "נר חמישי", "נר שישי", "נר שביעי", "נר שמיני"];
const NIGHTS = [
  "The First Night of Chanukah",
  "The Second Night of Chanukah",
  "The Third Night of Chanukah",
  "The Fourth Night of Chanukah",
  "The Fifth Night of Chanukah",
  "The Sixth Night of Chanukah",
  "The Seventh Night of Chanukah",
  "The Eighth Night of Chanukah",
];

/** Chanukah right now, for this account (the Owner and testers can be in test mode). */
export function useChanukahNow(): ChanukahState {
  const { canTestChanukah } = useData();
  return useChanukah(canTestChanukah);
}

/**
 * Turns the Chanukah look on and off by itself (the "chanukah" class on the page), and holds the
 * soft lighting used for the rounded gold lettering.
 */
export function ChanukahTheme() {
  const now = useChanukahNow();
  const on = isChanukahOn(now);
  useEffect(() => {
    document.documentElement.classList.toggle("chanukah", on);
    return () => document.documentElement.classList.remove("chanukah");
  }, [on]);
  return (
    <svg width="0" height="0" aria-hidden style={{ position: "absolute" }}>
      <filter id="chanukah-puffy" x="-5%" y="-10%" width="110%" height="130%" colorInterpolationFilters="sRGB">
        <feGaussianBlur in="SourceAlpha" stdDeviation="2" result="blur" />
        <feSpecularLighting in="blur" surfaceScale="2.6" specularConstant="0.8" specularExponent="22" lightingColor="#fffbe8" result="spec">
          <feDistantLight azimuth="240" elevation="48" />
        </feSpecularLighting>
        <feComposite in="spec" in2="SourceAlpha" operator="in" result="specIn" />
        <feDiffuseLighting in="blur" surfaceScale="2.6" diffuseConstant="1.35" lightingColor="#ffffff" result="diff">
          <feDistantLight azimuth="240" elevation="58" />
        </feDiffuseLighting>
        <feComposite in="SourceGraphic" in2="diff" operator="arithmetic" k1="1" k2="0" k3="0" k4="0" result="shaded" />
        <feComposite in="shaded" in2="specIn" operator="arithmetic" k1="0" k2="1" k3="0.55" k4="0" result="lit" />
        <feComposite in="lit" in2="SourceAlpha" operator="in" />
      </filter>
    </svg>
  );
}

/**
 * The menorah, in 3D gold: straight branches, round cups, a flat round base. `lit` is how many
 * candles are burning (from the right, as you face it); the shamash burns whenever any candle does.
 * The flames flicker, each a little differently.
 */
export function Menorah({ lit, className }: { lit: number; className?: string }) {
  const uid = useId().replace(/:/g, "");
  const id = (name: string) => `${name}-${uid}`;
  const cx0 = 170;
  const cupY = 70;
  const gap = 34;
  const offs = [-4, -3, -2, -1, 1, 2, 3, 4].map((k) => Math.sign(k) * (28 + (Math.abs(k) - 1) * gap));
  const xs = offs.map((o) => cx0 + o);
  const isLit = (i: number) => i >= 8 - lit;

  // A straight branch as a round metal tube, shaded across its width.
  const tube = (key: string, x1: number, y1: number, x2: number, y2: number, r = 3.6) => {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.hypot(dx, dy);
    const nx = -dy / len;
    const ny = dx / len;
    const p = [
      [x1 + nx * r, y1 + ny * r],
      [x2 + nx * r, y2 + ny * r],
      [x2 - nx * r, y2 - ny * r],
      [x1 - nx * r, y1 - ny * r],
    ];
    const g = id(`tube-${key}`);
    return (
      <g key={key}>
        <linearGradient id={g} gradientUnits="userSpaceOnUse" x1={x1 + nx * r} y1={y1 + ny * r} x2={x1 - nx * r} y2={y1 - ny * r}>
          <stop offset="0" stopColor="#7a4a14" />
          <stop offset=".28" stopColor="#ffe9b0" />
          <stop offset=".45" stopColor="#f3c463" />
          <stop offset=".8" stopColor="#b9782a" />
          <stop offset="1" stopColor="#6b3f10" />
        </linearGradient>
        <path d={`M${p.map((q) => q.map((v) => v.toFixed(1)).join(" ")).join(" L")}Z`} fill={`url(#${g})`} />
        <circle cx={x1} cy={y1} r={r} fill={`url(#${g})`} />
        <circle cx={x2} cy={y2} r={r} fill={`url(#${g})`} />
      </g>
    );
  };

  const cup = (key: string, x: number, y: number, w = 11) => (
    <g key={key}>
      <rect x={x - w} y={y} width={w * 2} height={12} fill={`url(#${id("cyl")})`} />
      <ellipse cx={x} cy={y + 12} rx={w} ry={3.2} fill={`url(#${id("cyl")})`} />
      <ellipse cx={x} cy={y} rx={w} ry={3.6} fill={`url(#${id("cuptop")})`} />
    </g>
  );

  const candle = (key: string, x: number, top: number, bottom: number, on: boolean, n: number) => (
    <g key={key}>
      <rect x={x - 4.2} y={top} width={8.4} height={bottom - top} fill={`url(#${id("wax")})`} />
      <ellipse cx={x} cy={top} rx={4.2} ry={1.6} fill="#fffaf0" />
      <path d={`M${x} ${top} v-4`} stroke="#3a2a1a" strokeWidth={1.2} strokeLinecap="round" />
      {on && (
        <>
          <circle className="flame-glow" style={{ animationDelay: `${-n * 0.37}s` }} cx={x} cy={top - 12} r={26} fill={`url(#${id("glow")})`} />
          <g className="flame" style={{ animationDelay: `${-n * 0.29}s`, animationDuration: `${1.4 + (n % 3) * 0.25}s` }}>
            <path d={`M${x} ${top - 25} C${x + 7.5} ${top - 15} ${x + 6} ${top - 5} ${x} ${top - 3} C${x - 6} ${top - 5} ${x - 7.5} ${top - 15} ${x} ${top - 25}Z`} fill={`url(#${id("flame")})`} />
            <ellipse cx={x} cy={top - 8} rx={2} ry={4} fill="#fff" opacity={0.85} />
          </g>
        </>
      )}
    </g>
  );

  const arms = [1, 2, 3, 4].flatMap((k) => {
    const dx = 28 + (k - 1) * gap;
    const dy = dx * 1.05;
    return [tube(`l${k}`, cx0 - dx, cupY + 10, cx0, cupY + 10 + dy), tube(`r${k}`, cx0, cupY + 10 + dy, cx0 + dx, cupY + 10)];
  });

  return (
    <svg viewBox="0 -24 340 312" className={cx("mx-auto block w-full max-w-[340px]", className)} role="img" aria-label={lit ? t("A menorah with {n} candles lit", { n: lit }) : t("A menorah, not lit yet")}>
      <defs>
        <linearGradient id={id("cyl")} x1="0" x2="1">
          <stop offset="0" stopColor="#6b3f10" />
          <stop offset=".3" stopColor="#ffe3a1" />
          <stop offset=".5" stopColor="#e9b14f" />
          <stop offset=".85" stopColor="#a5661f" />
          <stop offset="1" stopColor="#5e370d" />
        </linearGradient>
        <radialGradient id={id("cuptop")} cx=".45" cy=".35">
          <stop offset="0" stopColor="#fff2c8" />
          <stop offset="1" stopColor="#c8862c" />
        </radialGradient>
        <linearGradient id={id("wax")} x1="0" x2="1">
          <stop offset="0" stopColor="#cfc3b0" />
          <stop offset=".35" stopColor="#fffaf0" />
          <stop offset=".7" stopColor="#efe5d4" />
          <stop offset="1" stopColor="#b9ad99" />
        </linearGradient>
        <linearGradient id={id("plate")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#b87a2a" />
          <stop offset=".55" stopColor="#e2a646" />
          <stop offset="1" stopColor="#f6cf78" />
        </linearGradient>
        <radialGradient id={id("sheen")} cx=".32" cy=".55" r=".45">
          <stop offset="0" stopColor="#fff4cf" stopOpacity=".75" />
          <stop offset="1" stopColor="#fff4cf" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={id("shadow")}>
          <stop offset="0" stopColor="#000" stopOpacity=".55" />
          <stop offset="1" stopColor="#000" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={id("glow")}>
          <stop offset="0" stopColor="#ffcf73" stopOpacity=".8" />
          <stop offset=".45" stopColor="#ff8a3d" stopOpacity=".22" />
          <stop offset="1" stopColor="#ff5a2a" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={id("flame")} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#fff6d8" />
          <stop offset=".55" stopColor="#ffc34d" />
          <stop offset="1" stopColor="#ff6a2b" />
        </linearGradient>
      </defs>
      <ellipse cx={cx0} cy={274} rx={96} ry={10} fill={`url(#${id("shadow")})`} />
      {/* The flat round base: a solid disc seen from slightly above. */}
      <path d={`M${cx0 - 72} 260 L${cx0 - 72} 271 A72 13 0 0 0 ${cx0 + 72} 271 L${cx0 + 72} 260 Z`} fill={`url(#${id("cyl")})`} />
      <path d={`M${cx0 - 72} 271 A72 13 0 0 0 ${cx0 + 72} 271`} fill="none" stroke="#4a2a08" strokeOpacity={0.6} strokeWidth={1.2} />
      <ellipse cx={cx0} cy={260} rx={72} ry={13} fill={`url(#${id("plate")})`} />
      <ellipse cx={cx0} cy={260} rx={72} ry={13} fill={`url(#${id("sheen")})`} />
      <path d={`M${cx0 - 71} 260.5 A71 12.5 0 0 0 ${cx0 + 71} 260.5`} fill="none" stroke="#ffeab0" strokeOpacity={0.8} strokeWidth={1.6} />
      <path d={`M${cx0 - 71} 259.5 A71 12.5 0 0 1 ${cx0 + 71} 259.5`} fill="none" stroke="#7a4a14" strokeOpacity={0.5} strokeWidth={1.2} />
      <ellipse cx={cx0 + 14} cy={262} rx={20} ry={4.5} fill="#5a340c" opacity={0.35} />
      <path d={`M${cx0 - 12} 254 L${cx0 - 12} 260 A12 3.6 0 0 0 ${cx0 + 12} 260 L${cx0 + 12} 254 Z`} fill={`url(#${id("cyl")})`} />
      <ellipse cx={cx0} cy={254} rx={12} ry={3.6} fill={`url(#${id("cuptop")})`} />
      {arms}
      {/* One even stem from the base up to the shamash. */}
      {tube("stem", cx0, cupY - 23, cx0, 253, 5.5)}
      {xs.map((x, i) => cup(`c${i}`, x, cupY - 4))}
      {xs.map((x, i) => candle(`k${i}`, x, 38, cupY - 3, isLit(i), i))}
      {cup("shamash", cx0, cupY - 34, 12)}
      {candle("shamash-candle", cx0, 4, cupY - 33, lit > 0, 9)}
    </svg>
  );
}

// Times are shown in the time zone of the place the zmanim are for.
const zone = () => zmanimPlace().getTimeZone();
const fmtTime = (d: Date) => new Intl.DateTimeFormat(locale(), { hour: "numeric", minute: "2-digit", timeZone: zone() }).format(d);
const fmtDay = (d: Date) => new Intl.DateTimeFormat(locale(), { weekday: "long", month: "long", day: "numeric", timeZone: zone() }).format(d);
const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();

/** The shiur's totals so far, side by side (with this account's test entries while testing). */
function useTotals(state: ChanukahState) {
  const { chanukah, chanukahTotals, me } = useData();
  return useMemo(() => {
    if (!state.testing || !chanukah || !me) return chanukahTotals;
    const tests = sumChanukah(chanukah.filter((e) => e.is_test && e.user_id === me.id));
    return { lit: chanukahTotals.lit + tests.lit, people: chanukahTotals.people + tests.people, given: chanukahTotals.given + tests.given };
  }, [state.testing, chanukah, chanukahTotals, me]);
}

/**
 * The top of Home during Chanukah: the countdown the week before (all the candles burning), then
 * each night's menorah, the shiur's totals, and the button to log a stop.
 */
export function ChanukahHero() {
  const state = useChanukahNow();
  const { me, guest, notify, chanukah, isOwner } = useData();
  const { go, Link } = useNav();
  const totals = useTotals(state);
  if (!isChanukahOn(state)) return null;
  const n = state.night;
  const first = state.lightings[0];
  const next = n > 0 && n < 8 ? state.lightings[n] : null;
  const last = n > 0 ? state.lightings[n - 1] : null;

  const left = Math.max(0, first.getTime() - state.now.getTime());
  const days = Math.floor(left / 86_400_000);
  const hours = Math.floor((left % 86_400_000) / 3_600_000);
  const minutes = Math.floor((left % 3_600_000) / 60_000);

  const logOpen = () => {
    if (guest || !me) return notify(t("Create an account to log Chanukah."));
    go("/chanukah");
  };

  return (
    <section className="-mx-4 px-4 pt-2 pb-4 text-center sm:-mx-6 sm:px-6">
      {state.testing && (
        <Link href="/admin#chanukah-test" className="mx-auto mb-3 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-1.5 text-xs font-medium text-ink">
          <FlaskConical size={14} aria-hidden />
          {state.phase === "night" ? t("Test mode · Night {n}", { n }) : state.phase === "eve" ? t("Test mode · The day of the first candle") : t("Test mode · The countdown week")}
        </Link>
      )}

      {state.phase === "night" ? (
        <>
          <p className="text-[1.65rem]" dir="rtl" lang="he">
            <span className="chanukah-gold" style={{ fontFamily: '"David Libre", "David", "Times New Roman", serif' }}>
              חנוכה · {NIGHTS_HE[n - 1]}
            </span>
          </p>
          <h2 className="mt-1 text-[2rem] leading-tight sm:text-[2.5rem]">
            <span className="chanukah-gold">{t(NIGHTS[n - 1])}</span>
          </h2>
          <p className="mt-2 text-sm text-muted">
            {next && sameDay(next, state.now) && state.now < next
              ? t("Tonight's candles go on at {time}", { time: fmtTime(next) })
              : last
                ? t("Tonight's candles went on at {time}", { time: fmtTime(last) })
                : null}
          </p>
        </>
      ) : (
        <>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-accent">{t("Chanukah Is Coming")}</p>
          <h2 className="mt-2 text-[2rem] leading-tight sm:text-[2.5rem]">
            <span className="chanukah-gold">{t("Get Ready to Light Up the City")}</span>
          </h2>
          <p className="mt-2 text-sm text-muted">{t("The first candle is {day} at {time}", { day: fmtDay(first), time: fmtTime(first) })}</p>
          <div className="mt-4 flex justify-center gap-2.5" role="timer" aria-label={t("{d} days, {h} hours and {m} minutes to go", { d: days, h: hours, m: minutes })}>
            {[
              [days, t("Days")],
              [hours, t("Hours")],
              [minutes, t("Minutes")],
            ].map(([v, label], i) => (
              <div key={i} className="min-w-[4.6rem] rounded-[18px] border border-white/15 bg-gradient-to-b from-white/15 to-white/5 px-2 pt-2.5 pb-2 shadow-[inset_0_1px_0_rgba(255,255,255,.25)] backdrop-blur">
                <b className="tabular block text-[2rem] font-semibold leading-none text-[#fff3d6]">{i === 0 ? v : String(v).padStart(2, "0")}</b>
                <span className="mt-1 block text-[0.7rem] uppercase tracking-[0.08em] text-muted">{label}</span>
              </div>
            ))}
          </div>
        </>
      )}

      {/* The week before, every candle burns; on the day of the first candle they wait for the lighting. */}
      <Menorah3D lit={state.phase === "countdown" ? 8 : n} className="mt-3" fallback={<Menorah lit={state.phase === "countdown" ? 8 : n} className="mt-3" />} />

      <p className="mt-2 text-xs font-semibold uppercase tracking-[0.14em] text-accent">{t("The Shiur So Far")}</p>
      <div className="mx-auto mt-2 grid max-w-md grid-cols-3">
        {[
          [totals.lit, t("Menorahs lit")],
          [totals.people, t("People lit")],
          [totals.given, t("Menorahs given out")],
        ].map(([v, label], i) => (
          <div key={i} className="px-1 py-1.5">
            <b className="chanukah-gold tabular block text-[1.9rem]">{Number(v).toLocaleString(locale())}</b>
            <span className="block text-xs leading-snug text-muted">{label}</span>
          </div>
        ))}
      </div>

      {chanukah === null && me && !guest ? (
        isOwner && <p className="mx-auto mt-4 max-w-md text-sm text-muted">{t("To log Chanukah, run database update 019 in Supabase first.")}</p>
      ) : (
        <button
          type="button"
          onClick={logOpen}
          className="relative mx-auto mt-5 flex h-14 w-full max-w-md items-center justify-center gap-2 overflow-hidden rounded-[20px] bg-gradient-to-b from-[#ffe29a] via-[#ffbd52] to-[#f28a2e] text-[1.05rem] font-semibold text-[#2a1300] shadow-[0_10px_30px_rgba(255,140,50,.35),inset_0_1px_0_rgba(255,255,255,.75),inset_0_-2px_0_rgba(150,60,0,.25)] transition active:scale-[0.98] before:absolute before:inset-x-0 before:top-0 before:h-1/2 before:rounded-t-[20px] before:bg-gradient-to-b before:from-white/45 before:to-transparent"
        >
          <MenorahIcon size={30} className="relative" />
          <span className="relative">{t("Log Chanukah")}</span>
        </button>
      )}
    </section>
  );
}

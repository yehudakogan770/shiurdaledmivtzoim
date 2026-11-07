"use client";

import { useEffect, useMemo } from "react";
import { FlaskConical } from "lucide-react";
import { useData, sumChanukah } from "@/lib/data";
import { useNav } from "@/lib/nav";
import { isChanukahOn, useChanukah, type ChanukahState } from "@/lib/chanukah";
import { zmanimPlace } from "@/lib/shkiah";
import { locale, t } from "@/lib/i18n";
import { MenorahIcon } from "./icons";
import { Menorah3D, MenorahStill } from "./menorah-3d";
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
      <Menorah3D lit={state.phase === "countdown" ? 8 : n} className="mt-3" fallback={<MenorahStill />} />

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

"use client";

import { useEffect, useState } from "react";
import { LETTERS, parseDesign, randomLetter, saveDesign, savedDesign, type DreidelDesign } from "@/lib/dreidel";
import { isChanukahOn } from "@/lib/chanukah";
import { t } from "@/lib/i18n";
import { useChanukahNow } from "../chanukah";
import { DreidelView, type Spin } from "../dreidel/dreidel-view";
import { DreidelGlobe } from "../dreidel/globe";
import { GeltShower } from "../gelt-shower";
import { DreidelIcon } from "../icons";
import { Empty } from "../ui";

/**
 * The Dreidel section, open during Chanukah (from the countdown week). Spin a dreidel just for fun
 * any time: swipe it on a phone or tablet, click it on a computer. During the countdown week it
 * also says to come back on Chanukah to play with friends. (Playing together comes next.)
 */
export function DreidelView_() {
  const state = useChanukahNow();
  const [design, setDesign] = useState<DreidelDesign>("gold");
  const [spin, setSpin] = useState<Spin | null>(null);
  const [spinning, setSpinning] = useState(false);
  const [shown, setShown] = useState<number | null>(null);
  const [gelt, setGelt] = useState(0);
  const [touch, setTouch] = useState(true);
  const [choosing, setChoosing] = useState(false);

  useEffect(() => {
    setDesign(savedDesign());
    setTouch(!window.matchMedia?.("(hover: hover) and (pointer: fine)").matches);
  }, []);

  if (!isChanukahOn(state)) {
    return <Empty title={t("The dreidel opens for Chanukah")} icon={DreidelIcon}>{t("Come back the week before Chanukah to spin the dreidel.")}</Empty>;
  }

  const go = (direction: 1 | -1 = 1) => {
    if (spinning) return;
    setSpinning(true);
    setShown(null);
    setSpin({ id: Date.now(), result: randomLetter(), direction });
  };
  const letter = shown != null ? LETTERS[shown] : null;
  const current = parseDesign(design);
  const choose = (d: DreidelDesign) => {
    setDesign(d);
    saveDesign(d);
    setShown(null);
  };

  return (
    <div className="mx-auto max-w-xl text-center">
      {gelt > 0 && <GeltShower key={gelt} />}
      <h1 className="pt-2 text-[2.2rem] leading-tight">
        <span className="chanukah-gold">{t("Dreidel")}</span>
      </h1>
      {state.phase !== "night" && (
        <p className="mx-auto mt-2 max-w-sm rounded-2xl bg-white/10 px-4 py-2 text-sm">{t("Come back on Chanukah to play dreidel with your friends.")}</p>
      )}

      <DreidelView
        design={design}
        spin={spin}
        onSpinRequest={go}
        onLanded={(r) => {
          setSpinning(false);
          setShown(r);
          if (r === 1) setGelt((n) => n + 1);
        }}
        className="mt-1"
      />

      {/* The letter it landed on, and what it means. */}
      <div className="flex min-h-[7.5rem] flex-col items-center justify-start" aria-live="polite">
        {letter ? (
          <>
            <span className="chanukah-gold text-[3.6rem] leading-none" lang="he" style={{ fontFamily: '"David Libre", "David", "Times New Roman", serif' }}>
              {letter.he}
            </span>
            <span className="mt-1 text-lg font-semibold">{t(letter.name)}</span>
            <span className="text-sm text-muted">{t(letter.meaning)}</span>
          </>
        ) : (
          <span className="pt-6 text-sm text-muted">{spinning ? t("Spinning…") : touch ? t("Swipe the dreidel to spin it") : t("Click the dreidel to spin it")}</span>
        )}
      </div>

      <button
        type="button"
        disabled={spinning}
        onClick={() => go(1)}
        className="relative mx-auto flex h-14 w-full max-w-md items-center justify-center overflow-hidden rounded-[20px] bg-gradient-to-b from-[#ffe29a] via-[#ffbd52] to-[#f28a2e] text-[1.05rem] font-semibold text-[#2a1300] shadow-[0_10px_30px_rgba(255,140,50,.3),inset_0_1px_0_rgba(255,255,255,.75)] transition active:scale-[0.98] disabled:opacity-50 before:absolute before:inset-x-0 before:top-0 before:h-1/2 before:bg-gradient-to-b before:from-white/40 before:to-transparent"
      >
        <span className="relative">{t("Spin")}</span>
      </button>

      {/* Your dreidel: its name, and the globe to choose another. */}
      <p className="mt-7 text-xs font-semibold uppercase tracking-[0.14em] text-accent">{t("Your Dreidel")}</p>
      <p className="mt-1 text-lg font-medium">
        {t(current.base.name)}
        {current.color && <span className="text-muted"> · {t(current.color.name)}</span>}
      </p>
      <button
        type="button"
        disabled={spinning}
        onClick={() => setChoosing(true)}
        className="mx-auto mt-3 flex h-12 w-full max-w-md items-center justify-center rounded-[18px] border border-white/15 bg-gradient-to-b from-white/15 to-white/5 font-medium shadow-[inset_0_1px_0_rgba(255,255,255,.25)] disabled:opacity-50"
      >
        {t("Choose a Different Dreidel")}
      </button>
      {choosing && (
        <DreidelGlobe
          value={design}
          onClose={() => setChoosing(false)}
          onChoose={(d) => {
            choose(d);
            setChoosing(false);
          }}
        />
      )}
    </div>
  );
}

export { DreidelView_ as DreidelPage };

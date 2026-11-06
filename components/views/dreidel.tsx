"use client";

import { useEffect, useState } from "react";
import { BASES, LETTERS, parseDesign, randomLetter, saveDesign, savedDesign, type DreidelDesign } from "@/lib/dreidel";
import { isChanukahOn } from "@/lib/chanukah";
import { t } from "@/lib/i18n";
import { useChanukahNow } from "../chanukah";
import { DreidelView, type Spin } from "../dreidel/dreidel-view";
import { GeltShower } from "../gelt-shower";
import { DreidelIcon } from "../icons";
import { Empty, cx } from "../ui";

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

      {/* Choosing a design (the 3D globe of dreidels comes next). */}
      <p className="mt-7 text-xs font-semibold uppercase tracking-[0.14em] text-accent">{t("Your Dreidel")}</p>
      <div className="-mx-4 mt-2 flex gap-2 overflow-x-auto px-4 pb-2">
        {BASES.map((b) => (
          <button
            key={b.id}
            type="button"
            disabled={spinning}
            aria-pressed={current.base.id === b.id}
            onClick={() => choose(b.colors ? `${b.id}-${b.colors[0].id}` : b.id)}
            className={cx(
              "h-10 shrink-0 rounded-full px-4 text-sm whitespace-nowrap transition disabled:opacity-50",
              current.base.id === b.id ? "bg-gradient-to-b from-[#ffe29a] to-[#f28a2e] font-semibold text-[#2a1300]" : "border border-white/15 bg-white/5",
            )}
          >
            {t(b.name)}
          </button>
        ))}
      </div>
      {/* Five colors for the materials that come in colors. */}
      {current.base.colors && (
        <div className="mt-2 flex justify-center gap-3" role="radiogroup" aria-label={t("Color")}>
          {current.base.colors.map((c) => (
            <button
              key={c.id}
              type="button"
              role="radio"
              aria-checked={current.color?.id === c.id}
              aria-label={t(c.name)}
              title={t(c.name)}
              disabled={spinning}
              onClick={() => choose(`${current.base.id}-${c.id}`)}
              className={cx("h-9 w-9 rounded-full border-2 transition disabled:opacity-50", current.color?.id === c.id ? "scale-110 border-white" : "border-white/20")}
              style={{ background: c.hex }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export { DreidelView_ as DreidelPage };

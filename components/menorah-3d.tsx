"use client";

import { useEffect, useRef, useState, type PointerEvent } from "react";
import { MENORAH_FRAMES, MENORAH_MAX_ANGLE, MENORAH_WICKS } from "@/lib/menorah-frames";
import { t } from "@/lib/i18n";
import { cx } from "./ui";

const BASE = process.env.NEXT_PUBLIC_BASE_PATH || "";
const src = (i: number) => `${BASE}/menorah/f-${String(i).padStart(2, "0")}.webp`;
const MID = (MENORAH_FRAMES - 1) / 2;

/** Loads all 49 pictures once (shared by every menorah on the page); false if any fails. */
let loading: Promise<boolean> | null = null;
function loadFrames() {
  loading ??= Promise.all(
    Array.from({ length: MENORAH_FRAMES }, (_, i) => {
      const img = new Image();
      img.src = src(i);
      return img.decode().then(() => true);
    }),
  ).then(
    () => true,
    () => false,
  );
  return loading;
}

const reducedMotion = () => typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/**
 * The 3D menorah that turns side to side, up to 40° each way: drag it with a finger, or scroll the
 * page. When you let go or stop scrolling it slowly turns back to straight. It flips through 49
 * pictures of a 3D model, so it looks solid from every angle, and draws that night's flames on top
 * (lit from the right as you face it; the shamash whenever any candle burns), flickering.
 * Until the pictures load (or if they can't), the flat drawing shows instead.
 */
export function Menorah3D({ lit, fallback, className }: { lit: number; fallback: React.ReactNode; className?: string }) {
  const [ready, setReady] = useState(false);
  const [frame, setFrame] = useState(Math.round(MID));
  const box = useRef<HTMLDivElement>(null);
  const motion = useRef({ angle: 0, target: 0, lastInput: 0, dragging: false, startX: 0, startAngle: 0, raf: 0 });

  useEffect(() => {
    let alive = true;
    loadFrames().then((ok) => alive && setReady(ok));
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!ready || reducedMotion()) return;
    const m = motion.current;
    const clamp = (a: number) => Math.max(-MENORAH_MAX_ANGLE, Math.min(MENORAH_MAX_ANGLE, a));
    const tick = () => {
      // A moment after the last touch or scroll, ease back to straight, slowly.
      if (!m.dragging && performance.now() - m.lastInput > 220) m.target *= 0.965;
      m.angle += (m.target - m.angle) * 0.12;
      setFrame(Math.round(MID + (m.angle / MENORAH_MAX_ANGLE) * MID));
      if (Math.abs(m.angle) < 0.05 && Math.abs(m.target) < 0.05 && !m.dragging) {
        m.angle = m.target = 0;
        setFrame(Math.round(MID));
        m.raf = 0;
        return;
      }
      m.raf = requestAnimationFrame(tick);
    };
    const wake = () => {
      m.lastInput = performance.now();
      if (!m.raf) m.raf = requestAnimationFrame(tick);
    };
    let lastY = window.scrollY;
    const onScroll = () => {
      const dy = window.scrollY - lastY;
      lastY = window.scrollY;
      // Only while the menorah is on screen.
      const r = box.current?.getBoundingClientRect();
      if (!r || r.bottom < 0 || r.top > window.innerHeight) return;
      m.target = clamp(m.target + dy * 0.12);
      wake();
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    (box.current as HTMLDivElement & { wake?: () => void }).wake = wake;
    return () => {
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(m.raf);
      m.raf = 0;
    };
  }, [ready]);

  if (!ready) return <>{fallback}</>;

  const drag = {
    onPointerDown: (e: PointerEvent<HTMLDivElement>) => {
      const m = motion.current;
      m.dragging = true;
      m.startX = e.clientX;
      m.startAngle = m.target;
      e.currentTarget.setPointerCapture(e.pointerId);
      (box.current as HTMLDivElement & { wake?: () => void }).wake?.();
    },
    onPointerMove: (e: PointerEvent<HTMLDivElement>) => {
      const m = motion.current;
      if (!m.dragging) return;
      const width = box.current?.clientWidth || 300;
      m.target = Math.max(-MENORAH_MAX_ANGLE, Math.min(MENORAH_MAX_ANGLE, m.startAngle + ((e.clientX - m.startX) / width) * 90));
      (box.current as HTMLDivElement & { wake?: () => void }).wake?.();
    },
    onPointerUp: () => {
      motion.current.dragging = false;
      motion.current.lastInput = performance.now();
    },
  };

  const wicks = MENORAH_WICKS[frame] ?? MENORAH_WICKS[Math.round(MID)];
  return (
    <div
      ref={box}
      {...drag}
      onPointerCancel={drag.onPointerUp}
      role="img"
      aria-label={lit ? t("A menorah with {n} candles lit", { n: lit }) : t("A menorah, not lit yet")}
      className={cx("relative mx-auto aspect-square w-full max-w-[340px] cursor-grab touch-pan-y select-none active:cursor-grabbing", className)}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src(frame)} alt="" draggable={false} className="pointer-events-none h-full w-full" />
      {wicks.map(([x, y, s], i) => {
        const on = i === 8 ? lit > 0 : i >= 8 - lit;
        if (!on) return null;
        // A flame is about 2.4 units tall where 1 unit is `s` of the picture.
        const h = s * 2.6 * 100;
        return (
          <span key={i} className="pointer-events-none absolute" style={{ left: `${x * 100}%`, top: `${y * 100}%`, height: `${h}%`, width: `${h * 0.5}%`, transform: "translate(-50%, -96%)" }}>
            <svg viewBox="0 0 20 40" className="absolute inset-0 h-full w-full overflow-visible">
              <defs>
                <radialGradient id={`mg-${i}`}>
                  <stop offset="0" stopColor="#ffcf73" stopOpacity=".75" />
                  <stop offset=".45" stopColor="#ff8a3d" stopOpacity=".2" />
                  <stop offset="1" stopColor="#ff5a2a" stopOpacity="0" />
                </radialGradient>
                <linearGradient id={`mf-${i}`} x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0" stopColor="#fff6d8" />
                  <stop offset=".55" stopColor="#ffc34d" />
                  <stop offset="1" stopColor="#ff6a2b" />
                </linearGradient>
              </defs>
              <circle className="flame-glow" style={{ animationDelay: `${-i * 0.37}s` }} cx="10" cy="24" r="26" fill={`url(#mg-${i})`} />
              <g className="flame" style={{ animationDelay: `${-i * 0.29}s`, animationDuration: `${1.4 + (i % 3) * 0.25}s` }}>
                <path d="M10 1 C17 13 16 31 10 39 C4 31 3 13 10 1Z" fill={`url(#mf-${i})`} />
                <ellipse cx="10" cy="28" rx="2.6" ry="6" fill="#fff" opacity=".85" />
              </g>
            </svg>
          </span>
        );
      })}
    </div>
  );
}

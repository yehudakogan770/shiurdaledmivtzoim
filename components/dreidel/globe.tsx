"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import type * as T from "three";
import { BASES, parseDesign, type DreidelDesign } from "@/lib/dreidel";
import { lockPage } from "@/lib/page-lock";
import { t } from "@/lib/i18n";
import { cx } from "../ui";
import { buildDreidel, type DreidelModel } from "./model";
import { createStage } from "./stage";

/**
 * Choosing a dreidel: every material floats around an invisible ball (no ball is drawn). Drag or
 * swipe to turn it gently; let go and it drifts a little, slows, and settles with the nearest
 * dreidel in front. The one in front is larger and brighter, the ones behind smaller and dimmer.
 * Under it: its name, its five colors if it has them, back and next arrows, and Choose This Dreidel.
 */
export function DreidelGlobe({ value, onChoose, onClose }: { value: DreidelDesign; onChoose(d: DreidelDesign): void; onClose(): void }) {
  const box = useRef<HTMLDivElement>(null);
  const start = parseDesign(value);
  const startIndex = BASES.findIndex((b) => b.id === start.base.id);
  // The color picked for each material that has colors.
  const [colors, setColors] = useState<Record<string, string>>(() =>
    Object.fromEntries(BASES.filter((b) => b.colors).map((b) => [b.id, b.id === start.base.id && start.color ? start.color.id : b.colors![0].id])),
  );
  const [front, setFront] = useState(startIndex);
  const [ready, setReady] = useState(false);
  const api = useRef<ReturnType<typeof run> | null>(null);
  const designOf = (i: number, cols = colors) => {
    const b = BASES[i];
    return b.colors ? `${b.id}-${cols[b.id]}` : b.id;
  };

  useEffect(() => lockPage(), []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") api.current?.step(1);
      if (e.key === "ArrowLeft") api.current?.step(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    let cancelled = false;
    (async () => {
      try {
        const THREE = await import("three");
        const { RoomEnvironment } = await import("three/examples/jsm/environments/RoomEnvironment.js");
        if (cancelled) return;
        api.current = run(THREE, RoomEnvironment, el, BASES.map((_, i) => designOf(i)), startIndex, setFront, () => !cancelled && setReady(true));
      } catch (e) {
        console.warn("The dreidel globe could not start:", (e as Error).message);
      }
    })();
    return () => {
      cancelled = true;
      api.current?.stop();
      api.current = null;
    };
    // Built once; colors change one dreidel at a time below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const base = BASES[front];
  const pickColor = (c: string) => {
    const next = { ...colors, [base.id]: c };
    setColors(next);
    api.current?.setDesign(front, designOf(front, next));
  };

  return createPortal(
    <div role="dialog" aria-modal="true" aria-label={t("Choose Your Dreidel")} className="fixed inset-0 z-[55] flex flex-col bg-[#0d0a1f]/95 text-ink backdrop-blur-md">
      <div className="flex items-center justify-between px-4 pt-[max(env(safe-area-inset-top),12px)] pb-1">
        <h2 className="text-lg font-semibold">{t("Choose Your Dreidel")}</h2>
        <button type="button" onClick={onClose} aria-label={t("Close")} className="grid h-11 w-11 place-items-center rounded-full bg-white/10">
          <X size={20} />
        </button>
      </div>
      <p className="px-4 text-sm text-muted">{t("Swipe to turn the dreidels, then choose the one in front.")}</p>

      <div className="relative min-h-0 flex-1">
        <div ref={box} className="absolute inset-0 cursor-grab touch-none select-none active:cursor-grabbing" />
        {!ready && <p className="absolute inset-x-0 top-1/2 text-center text-sm text-muted">{t("Loading the dreidels…")}</p>}
      </div>

      <div className="mx-auto w-full max-w-md px-4 pb-[max(env(safe-area-inset-bottom),16px)] text-center">
        <div className="flex items-center justify-between gap-2">
          <button type="button" onClick={() => api.current?.step(-1)} aria-label={t("Previous")} className="grid h-12 w-12 place-items-center rounded-full border border-white/15 bg-white/5">
            <ChevronLeft size={22} className="rtl:rotate-180" />
          </button>
          <p className="chanukah-gold text-[1.6rem]">{t(base.name)}</p>
          <button type="button" onClick={() => api.current?.step(1)} aria-label={t("Next")} className="grid h-12 w-12 place-items-center rounded-full border border-white/15 bg-white/5">
            <ChevronRight size={22} className="rtl:rotate-180" />
          </button>
        </div>
        <div className="mt-2 flex min-h-[2.5rem] items-center justify-center gap-3" role={base.colors ? "radiogroup" : undefined} aria-label={base.colors ? t("Color") : undefined}>
          {base.colors?.map((c) => (
            <button
              key={c.id}
              type="button"
              role="radio"
              aria-checked={colors[base.id] === c.id}
              aria-label={t(c.name)}
              title={t(c.name)}
              onClick={() => pickColor(c.id)}
              className={cx("h-9 w-9 rounded-full border-2 transition", colors[base.id] === c.id ? "scale-110 border-white" : "border-white/20")}
              style={{ background: c.hex }}
            />
          ))}
        </div>
        <button
          type="button"
          onClick={() => onChoose(designOf(front))}
          className="relative mt-3 flex h-14 w-full items-center justify-center overflow-hidden rounded-[20px] bg-gradient-to-b from-[#ffe29a] via-[#ffbd52] to-[#f28a2e] text-[1.05rem] font-semibold text-[#2a1300] shadow-[0_10px_30px_rgba(255,140,50,.3),inset_0_1px_0_rgba(255,255,255,.75)] active:scale-[0.98] before:absolute before:inset-x-0 before:top-0 before:h-1/2 before:bg-gradient-to-b before:from-white/40 before:to-transparent"
        >
          <span className="relative">{t("Choose This Dreidel")}</span>
        </button>
      </div>
    </div>,
    document.body,
  );
}

type Three = typeof import("three");

function run(
  THREE: Three,
  RoomEnvironment: new () => T.Scene,
  el: HTMLDivElement,
  designs: DreidelDesign[],
  startIndex: number,
  onFront: (i: number) => void,
  onReady: () => void,
) {
  const { renderer, scene, dispose: disposeStage } = createStage(THREE, RoomEnvironment, el, { fade: false });
  // The ones behind fade into the night.
  scene.fog = new THREE.Fog(0x130f2c, 6.2, 10.5);
  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 50);
  camera.position.set(0, 0, 7.5);
  camera.lookAt(0, 0, 0);

  // Spots on an invisible ball (a little flattened top and bottom, so turning sideways shows them all).
  const N = designs.length;
  const golden = Math.PI * (3 - Math.sqrt(5));
  const spots = designs.map((_, i) => {
    const y = (1 - ((i + 0.5) / N) * 2) * 0.82;
    const r = Math.sqrt(1 - y * y);
    const a = i * golden;
    return new THREE.Vector3(Math.cos(a) * r, y, Math.sin(a) * r);
  });
  // Back and next go around in order of where they sit.
  const order = spots.map((p, i) => ({ i, a: Math.atan2(p.x, p.z) })).sort((x, y) => x.a - y.a).map((x) => x.i);

  let R = 1.7;
  let RY = 1.7;
  const resize = () => {
    const w = el.clientWidth || 300;
    const h = el.clientHeight || 400;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    // Keep the ball inside the screen's width on phones.
    const halfW = Math.tan(THREE.MathUtils.degToRad(16)) * 6 * camera.aspect;
    R = Math.max(1.05, Math.min(1.75, halfW * 0.85));
    // Use the screen's height too: tall phones get a taller ball.
    const halfH = Math.tan(THREE.MathUtils.degToRad(16)) * 6;
    RY = Math.max(R, Math.min(2.0, halfH * 0.95));
  };
  resize();
  const ro = new ResizeObserver(resize);
  ro.observe(el);

  // ---- Turning ----
  const target = (i: number, fromYaw: number) => {
    const p = spots[i];
    let yaw = -Math.atan2(p.x, p.z);
    yaw += Math.round((fromYaw - yaw) / (Math.PI * 2)) * Math.PI * 2;
    const pitch = Math.atan2(p.y, Math.hypot(p.x, p.z));
    return { yaw, pitch };
  };
  const first = target(startIndex, 0);
  const m = { yaw: first.yaw, pitch: first.pitch, vYaw: 0, vPitch: 0, dragging: false, x: 0, y: 0, t: 0, snap: null as null | { yaw: number; pitch: number } };
  let frontIdx = startIndex;
  onFront(startIndex);

  const down = (e: PointerEvent) => {
    m.dragging = true;
    m.snap = null;
    locked = false;
    m.x = e.clientX;
    m.y = e.clientY;
    m.t = performance.now();
    m.vYaw = m.vPitch = 0;
    try {
      el.setPointerCapture(e.pointerId);
    } catch {
      // Dragging still works.
    }
  };
  const move = (e: PointerEvent) => {
    if (!m.dragging) return;
    const now = performance.now();
    const dt = Math.max(1, now - m.t);
    const dy = (e.clientX - m.x) * 0.0055;
    const dp = (e.clientY - m.y) * 0.0035;
    m.yaw += dy;
    m.pitch = Math.max(-1.05, Math.min(1.05, m.pitch + dp));
    m.vYaw = m.vYaw * 0.5 + (dy / dt) * 16 * 0.5;
    m.vPitch = m.vPitch * 0.5 + (dp / dt) * 16 * 0.5;
    m.x = e.clientX;
    m.y = e.clientY;
    m.t = now;
  };
  const up = () => {
    m.dragging = false;
    if (performance.now() - m.t > 90) m.vYaw = m.vPitch = 0;
    // Gentle: never flies off.
    m.vYaw = Math.max(-0.06, Math.min(0.06, m.vYaw));
  };
  el.addEventListener("pointerdown", down);
  el.addEventListener("pointermove", move);
  el.addEventListener("pointerup", up);
  el.addEventListener("pointercancel", up);

  // ---- The dreidels ----
  let stopped = false;
  const models: (DreidelModel | null)[] = designs.map(() => null);
  const builds: number[] = designs.map(() => 0);
  const place = async (i: number, d: DreidelDesign) => {
    const n = ++builds[i];
    const model = await buildDreidel(THREE, d);
    if (n !== builds[i] || stopped) return model.dispose();
    const old = models[i];
    if (old) {
      model.spinner.rotation.y = old.spinner.rotation.y;
      scene.remove(old.root);
      old.dispose();
    } else model.spinner.rotation.y = Math.random() * Math.PI * 2;
    models[i] = model;
    scene.add(model.root);
  };
  // The one in front first, then the rest.
  (async () => {
    await place(startIndex, designs[startIndex]);
    onReady();
    for (let i = 0; i < N; i++) if (i !== startIndex && !stopped) await place(i, designs[i]);
  })();

  // ---- Each frame ----
  let raf = 0;
  const euler = new THREE.Euler();
  const q = new THREE.Vector3();
  let last = performance.now();
  // While gliding to a chosen dreidel (arrows), that one stays the front one.
  let locked = false;
  const frame = (now: number) => {
    raf = requestAnimationFrame(frame);
    // Timed by the clock, so it moves the same on fast and slow phones.
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    const f = dt * 60;
    if (!m.dragging) {
      if (m.snap) {
        const k = 1 - Math.exp(-dt * 7);
        m.yaw += (m.snap.yaw - m.yaw) * k;
        m.pitch += (m.snap.pitch - m.pitch) * k;
        if (Math.abs(m.snap.yaw - m.yaw) < 0.002 && Math.abs(m.snap.pitch - m.pitch) < 0.002) locked = false;
      } else {
        m.yaw += m.vYaw * f;
        m.pitch = Math.max(-1.05, Math.min(1.05, m.pitch + m.vPitch * f));
        m.vYaw *= Math.pow(0.93, f);
        m.vPitch *= Math.pow(0.85, f);
        // Slow enough: settle the nearest one in front.
        if (Math.abs(m.vYaw) < 0.003 && Math.abs(m.vPitch) < 0.003) m.snap = target(frontIdx, m.yaw);
      }
    }
    euler.set(m.pitch, m.yaw, 0, "XYZ");
    let best = -Infinity;
    let bestI = frontIdx;
    spots.forEach((p, i) => {
      q.copy(p).applyEuler(euler);
      q.set(q.x * R, q.y * RY, q.z * R);
      if (q.z > best) {
        best = q.z;
        bestI = i;
      }
      const model = models[i];
      if (!model) return;
      const depth = (q.z / R + 1) / 2; // 1 in front, 0 at the back
      const s = 0.28 + 0.42 * Math.pow(depth, 3);
      model.root.scale.setScalar(s);
      model.root.position.set(q.x, q.y - 0.98 * s, q.z);
      model.spinner.rotation.y += (i === frontIdx ? 0.006 : 0.004) * f;
    });
    if (!locked && bestI !== frontIdx) {
      frontIdx = bestI;
      onFront(bestI);
    }
    renderer.render(scene, camera);
  };
  raf = requestAnimationFrame(frame);

  return {
    setDesign(i: number, d: DreidelDesign) {
      place(i, d);
    },
    step(dir: 1 | -1) {
      const k = order.indexOf(frontIdx);
      const next = order[(k - dir + order.length) % order.length];
      m.vYaw = m.vPitch = 0;
      m.snap = target(next, m.yaw);
      frontIdx = next;
      locked = true;
      onFront(next);
    },
    stop() {
      stopped = true;
      cancelAnimationFrame(raf);
      ro.disconnect();
      el.removeEventListener("pointerdown", down);
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", up);
      el.removeEventListener("pointercancel", up);
      models.forEach((x) => x?.dispose());
      disposeStage();
    },
  };
}

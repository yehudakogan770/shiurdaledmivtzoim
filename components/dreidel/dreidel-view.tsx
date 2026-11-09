"use client";

import { useEffect, useRef, useState } from "react";
import type * as T from "three";
import type { DreidelDesign } from "@/lib/dreidel";
import { t } from "@/lib/i18n";
import { cx } from "../ui";
import { buildDreidel, FACE_ANGLES, type DreidelModel } from "./model";
import { createStage } from "./stage";

/** A spin to play: which side it lands on (0–3, in the order of LETTERS) and which way it turns. */
export interface Spin {
  id: string | number;
  result: number;
  direction?: 1 | -1;
}

/**
 * One dreidel on screen, in 3D. Before any spin it turns slowly. Given a `spin`, it lifts a
 * little, spins fast on its point, slows, wobbles as it loses speed, and settles with that side
 * facing you; then `onLanded` is called. The result always comes from outside (a random pick, or
 * later the game's server), never from the animation.
 *
 * Like the menorah, drag it (finger or mouse) to turn it around and tilt it up or down; let go and
 * it turns back by itself. A quick swipe, or a tap or click, spins it (calls `onSpinRequest`).
 */
export function DreidelView({
  design,
  spin,
  onLanded,
  onSpinRequest,
  className,
}: {
  design: DreidelDesign;
  spin?: Spin | null;
  onLanded?(result: number): void;
  onSpinRequest?(direction: 1 | -1): void;
  className?: string;
}) {
  const box = useRef<HTMLDivElement>(null);
  const api = useRef<{ setDesign(d: DreidelDesign): void; play(s: Spin): void } | null>(null);
  const landed = useRef(onLanded);
  landed.current = onLanded;
  const askSpin = useRef(onSpinRequest);
  askSpin.current = onSpinRequest;
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const pending = useRef<{ design: DreidelDesign; spin?: Spin | null }>({ design, spin });
  pending.current = { design, spin };

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    let stop = () => {};
    let cancelled = false;
    (async () => {
      try {
        const THREE = await import("three");
        const { RoomEnvironment } = await import("three/examples/jsm/environments/RoomEnvironment.js");
        if (cancelled) return;
        const s = start(THREE, RoomEnvironment, el, (r) => landed.current?.(r), () => !cancelled && setReady(true), (d) => askSpin.current?.(d));
        api.current = s;
        stop = s.stop;
        s.setDesign(pending.current.design);
      } catch (e) {
        console.warn("The dreidel could not start:", (e as Error).message);
        if (!cancelled) setFailed(true);
      }
    })();
    return () => {
      cancelled = true;
      api.current = null;
      stop();
    };
  }, []);

  useEffect(() => {
    api.current?.setDesign(design);
  }, [design]);

  const lastSpin = useRef<Spin["id"] | null>(null);
  useEffect(() => {
    if (!spin || !ready || spin.id === lastSpin.current) return;
    lastSpin.current = spin.id;
    api.current?.play(spin);
  }, [spin, ready]);

  return (
    <div className={cx("relative mx-auto aspect-square w-full max-w-[420px] select-none", className)}>
      <div ref={box} role="img" aria-label={t("A dreidel")} className={cx("absolute inset-0 touch-none", onSpinRequest ? "cursor-pointer" : "cursor-grab active:cursor-grabbing")} />
      {failed && <p className="absolute inset-x-0 top-1/2 text-center text-sm text-muted">{t("This phone can't show the 3D dreidel.")}</p>}
    </div>
  );
}

type Three = typeof import("three");

function start(THREE: Three, RoomEnvironment: new () => T.Scene, el: HTMLDivElement, onLanded: (r: number) => void, onReady: () => void, askSpin: (direction: 1 | -1) => void) {
  const { renderer, scene, dispose: disposeStage } = createStage(THREE, RoomEnvironment, el);

  // A soft shadow on the "floor" under the tip.
  const sh = document.createElement("canvas");
  sh.width = sh.height = 128;
  const sg = sh.getContext("2d")!;
  const grd = sg.createRadialGradient(64, 64, 0, 64, 64, 64);
  grd.addColorStop(0, "rgba(0,0,0,0.55)");
  grd.addColorStop(1, "rgba(0,0,0,0)");
  sg.fillStyle = grd;
  sg.fillRect(0, 0, 128, 128);
  const shadowTex = new THREE.CanvasTexture(sh);
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.6), new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false }));
  shadow.rotation.x = -Math.PI / 2;
  scene.add(shadow);

  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
  const LOOK = new THREE.Vector3(0, 0.98, 0);
  const DIST = Math.hypot(5.6, 1.5 - 0.98);
  const BASE_PITCH = Math.atan2(1.5 - 0.98, 5.6);
  const place = (pitch: number) => {
    const e = BASE_PITCH + pitch;
    camera.position.set(0, LOOK.y + Math.sin(e) * DIST, Math.cos(e) * DIST);
    camera.lookAt(LOOK);
  };
  place(0);
  const resize = () => {
    const w = el.clientWidth || 300;
    const h = el.clientHeight || 300;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  resize();
  const ro = new ResizeObserver(resize);
  ro.observe(el);

  const still = !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  // A gentle lean back at rest, so the letter faces you a little more.
  const REST_TILT = -0.1;
  let model: DreidelModel | null = null;
  let building = 0;
  let yaw = 0;
  let idle = true;
  let anim: { t0: number; dur: number; from: number; to: number; dir: number; result: number } | null = null;
  let raf = 0;
  let onScreen = true;
  let first = true;

  const wake = () => {
    if (!raf && onScreen && document.visibilityState === "visible") raf = requestAnimationFrame(frame);
  };

  // ---- Dragging, like the menorah: turn it around and tilt it, with a little momentum; let go
  // and it turns back to where it was. A quick swipe, or a tap or click, spins it instead. ----
  const TILT = THREE.MathUtils.degToRad(35);
  const SENSE = 0.009; // radians per pixel dragged
  const m = { yaw: 0, pitch: 0, vYaw: 0, vPitch: 0, dragging: false, id: -1, x: 0, y: 0, t: 0, x0: 0, y0: 0, t0: 0, vx: 0 };
  const settled = () => !m.dragging && m.vYaw === 0 && m.vPitch === 0 && Math.abs(m.yaw) < 0.002 && Math.abs(m.pitch) < 0.002;
  const onDown = (e: PointerEvent) => {
    if (m.dragging) return;
    Object.assign(m, { dragging: true, id: e.pointerId, x: e.clientX, y: e.clientY, t: performance.now(), x0: e.clientX, y0: e.clientY, t0: performance.now(), vx: 0, vYaw: 0, vPitch: 0 });
    try {
      el.setPointerCapture(e.pointerId);
    } catch {
      // Not every browser allows it; dragging still works.
    }
    wake();
  };
  const onMove = (e: PointerEvent) => {
    if (!m.dragging || e.pointerId !== m.id) return;
    const now = performance.now();
    const dt = Math.max(1, now - m.t);
    const dx = e.clientX - m.x;
    // While it's spinning, only tilting; turning would fight the spin.
    const dYaw = anim ? 0 : dx * SENSE;
    // Dragging up looks down from above; dragging down looks up from below.
    const dPitch = -(e.clientY - m.y) * SENSE * 0.8;
    m.yaw += dYaw;
    m.pitch = Math.max(-TILT, Math.min(TILT, m.pitch + dPitch));
    m.vYaw = m.vYaw * 0.5 + (dYaw / dt) * 16 * 0.5;
    m.vPitch = m.vPitch * 0.5 + (dPitch / dt) * 16 * 0.5;
    m.vx = m.vx * 0.5 + (dx / dt) * 0.5;
    m.x = e.clientX;
    m.y = e.clientY;
    m.t = now;
    wake();
  };
  const onUp = (e: PointerEvent) => {
    if (!m.dragging || e.pointerId !== m.id) return;
    m.dragging = false;
    const now = performance.now();
    const dx = e.clientX - m.x0;
    const dy = e.clientY - m.y0;
    const paused = now - m.t > 90;
    if (paused) m.vYaw = m.vPitch = m.vx = 0;
    const tap = Math.hypot(dx, dy) < 10 && now - m.t0 < 400;
    // A fast sideways flick (not a slow drag) is a spin.
    // (Measured over the whole swipe, which works even when a busy phone skips some movements.)
    const fast = Math.abs(dx) / Math.max(1, now - m.t0) > 0.45 || Math.abs(m.vx) > 0.9;
    const flick = !paused && fast && Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy) * 1.2;
    if (e.type === "pointerup" && !anim && (tap || flick)) {
      m.vYaw = 0;
      askSpin(tap ? 1 : dx < 0 ? -1 : 1);
    }
    wake();
  };
  el.addEventListener("pointerdown", onDown);
  el.addEventListener("pointermove", onMove);
  el.addEventListener("pointerup", onUp);
  el.addEventListener("pointercancel", onUp);

  function frame(now: number) {
    raf = 0;
    let tilt = REST_TILT;
    let lean = 0;
    let lift = 0;
    if (anim) {
      const u = Math.min(1, (now - anim.t0) / anim.dur);
      // Fast at first, slowing down smoothly to a stop.
      yaw = anim.to - (anim.to - anim.from) * Math.pow(1 - u, 2.4);
      // A little lift at the start.
      lift = still ? 0 : 0.22 * Math.sin(Math.PI * Math.min(1, u / 0.18)) * (u < 0.18 ? 1 : 0);
      // Wobbling grows as it slows, then fades as it settles.
      const wob = still ? 0 : (0.025 + 0.3 * smooth(0.45, 0.82, u)) * (1 - smooth(0.86, 1, u));
      const phi = anim.dir * Math.PI * 2 * 3.2 * Math.pow(u, 0.75);
      tilt = REST_TILT * smooth(0.8, 1, u) + wob * Math.cos(phi);
      lean = wob * Math.sin(phi);
      if (u >= 1) {
        const r = anim.result;
        anim = null;
        onLanded(r);
      }
    } else if (idle && !still && !m.dragging) {
      yaw += 0.006;
    }
    if (!m.dragging) {
      // Momentum that slows down, then it turns back and levels out by itself.
      m.yaw += m.vYaw;
      m.pitch = Math.max(-TILT, Math.min(TILT, m.pitch + m.vPitch));
      m.vYaw *= 0.92;
      m.vPitch *= 0.85;
      if (Math.abs(m.vYaw) < 0.0004) m.vYaw = 0;
      if (Math.abs(m.vPitch) < 0.0004) m.vPitch = 0;
      // Back to where it was, the shortest way round (never a whole extra circle).
      const home = Math.round(m.yaw / (Math.PI * 2)) * Math.PI * 2;
      m.yaw += (home - m.yaw) * 0.045;
      m.pitch += (0 - m.pitch) * 0.045;
      if (m.vYaw === 0 && Math.abs(home - m.yaw) < 0.0015) m.yaw = 0;
      if (m.vPitch === 0 && Math.abs(m.pitch) < 0.0015) m.pitch = 0;
    }
    place(m.pitch);
    if (model) {
      model.spinner.rotation.y = yaw + m.yaw;
      model.root.rotation.set(tilt, 0, lean);
      model.root.position.y = lift;
    }
    shadow.scale.setScalar(1 - lift * 1.2);
    (shadow.material as T.MeshBasicMaterial).opacity = 1 - lift * 2;
    renderer.render(scene, camera);
    if (first && model) {
      first = false;
      onReady();
    }
    if (anim || (idle && !still) || !settled()) wake();
  }

  const io = new IntersectionObserver(([e]) => {
    onScreen = e.isIntersecting;
    wake();
  });
  io.observe(el);
  document.addEventListener("visibilitychange", wake);

  return {
    async setDesign(d: DreidelDesign) {
      const n = ++building;
      const next = await buildDreidel(THREE, d);
      if (n !== building) return next.dispose();
      if (model) {
        scene.remove(model.root);
        model.dispose();
      }
      model = next;
      scene.add(model.root);
      wake();
    },
    play(s: Spin) {
      idle = false;
      const dir = s.direction ?? 1;
      // Land with that side facing you: the spinner's angle ends at minus the side's angle.
      const target = -FACE_ANGLES[s.result];
      const turns = still ? 1 : 9 + Math.random() * 2;
      let to = yaw + dir * turns * Math.PI * 2;
      const off = (((target - to) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
      to += dir > 0 ? off : off - Math.PI * 2;
      anim = { t0: performance.now(), dur: still ? 900 : 4200 + Math.random() * 600, from: yaw, to, dir, result: s.result };
      wake();
    },
    stop() {
      cancelAnimationFrame(raf);
      raf = -1;
      io.disconnect();
      ro.disconnect();
      el.removeEventListener("pointerdown", onDown);
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerup", onUp);
      el.removeEventListener("pointercancel", onUp);
      document.removeEventListener("visibilitychange", wake);
      model?.dispose();
      shadowTex.dispose();
      disposeStage();
    },
  };
}

function smooth(a: number, b: number, x: number) {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

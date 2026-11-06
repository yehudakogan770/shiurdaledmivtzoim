"use client";

import { useEffect, useRef, useState } from "react";
import type * as T from "three";
import type { DreidelDesign } from "@/lib/dreidel";
import { t } from "@/lib/i18n";
import { cx } from "../ui";
import { buildDreidel, FACE_ANGLES, type DreidelModel } from "./model";

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
 * later the game's server), never from the animation. Swiping sideways (phone) or clicking
 * (computer) on it calls `onSpinRequest`.
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
        const s = start(THREE, RoomEnvironment, el, (r) => landed.current?.(r), () => !cancelled && setReady(true));
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

  // Swipe sideways on a phone or tablet, click on a computer.
  const down = useRef<{ x: number; y: number; type: string } | null>(null);
  return (
    <div
      className={cx("relative mx-auto aspect-square w-full max-w-[420px] touch-pan-y select-none", onSpinRequest && "cursor-pointer", className)}
      onPointerDown={(e) => (down.current = { x: e.clientX, y: e.clientY, type: e.pointerType })}
      onPointerUp={(e) => {
        const d = down.current;
        down.current = null;
        if (!d || !onSpinRequest) return;
        const dx = e.clientX - d.x;
        const dy = e.clientY - d.y;
        if (d.type === "mouse" ? Math.hypot(dx, dy) < 12 || Math.abs(dx) > 30 : Math.abs(dx) > 28 && Math.abs(dx) > Math.abs(dy)) onSpinRequest(dx < 0 ? -1 : 1);
      }}
    >
      <div ref={box} role="img" aria-label={t("A dreidel")} className="absolute inset-0" />
      {failed && <p className="absolute inset-x-0 top-1/2 text-center text-sm text-muted">{t("This phone can't show the 3D dreidel.")}</p>}
    </div>
  );
}

type Three = typeof import("three");

function start(THREE: Three, RoomEnvironment: new () => T.Scene, el: HTMLDivElement, onLanded: (r: number) => void, onReady: () => void) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setClearColor(0x000000, 0);
  const canvas = renderer.domElement;
  canvas.style.width = "100%";
  canvas.style.height = "100%";
  canvas.style.display = "block";
  const fade = "radial-gradient(closest-side, #000 72%, transparent 100%)";
  canvas.style.setProperty("mask-image", fade);
  canvas.style.setProperty("-webkit-mask-image", fade);
  el.appendChild(canvas);

  const scene = new THREE.Scene();
  // A soft night backdrop (matching the page), so glass has something to show through. The canvas
  // edges fade out (see the mask below), so it blends into the page with no box.
  const bg = document.createElement("canvas");
  bg.width = bg.height = 256;
  const bctx = bg.getContext("2d")!;
  const bgr = bctx.createRadialGradient(128, 110, 10, 128, 128, 180);
  bgr.addColorStop(0, "#2a1d52");
  bgr.addColorStop(0.5, "#17123a");
  bgr.addColorStop(1, "#0d0a1f");
  bctx.fillStyle = bgr;
  bctx.fillRect(0, 0, 256, 256);
  // A few warm and cool lights in the backdrop, for the glass to bend.
  for (const [x, y, r, c] of [[70, 80, 40, "rgba(255,170,80,0.35)"], [190, 70, 34, "rgba(120,140,255,0.35)"], [150, 190, 46, "rgba(255,120,90,0.18)"]] as const) {
    const g2 = bctx.createRadialGradient(x, y, 0, x, y, r);
    g2.addColorStop(0, c);
    g2.addColorStop(1, "rgba(0,0,0,0)");
    bctx.fillStyle = g2;
    bctx.fillRect(0, 0, 256, 256);
  }
  const bgTex = new THREE.CanvasTexture(bg);
  bgTex.colorSpace = THREE.SRGBColorSpace;
  scene.background = bgTex;
  const pmrem = new THREE.PMREMGenerator(renderer);
  const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environment = env;
  scene.add(new THREE.AmbientLight(0xffffff, 0.15));
  const key = new THREE.DirectionalLight(0xfff1dc, 2.2);
  key.position.set(-3, 5, 4);
  scene.add(key);
  const fill = new THREE.DirectionalLight(0xbfcfff, 0.6);
  fill.position.set(4, 1, 3);
  scene.add(fill);
  const rim = new THREE.DirectionalLight(0xffffff, 1.2);
  rim.position.set(1, 4, -5);
  scene.add(rim);

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
  camera.position.set(0, 1.5, 5.6);
  camera.lookAt(0, 0.98, 0);
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
    } else if (idle && !still) {
      yaw += 0.006;
    }
    if (model) {
      model.spinner.rotation.y = yaw;
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
    if (anim || (idle && !still)) wake();
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
      document.removeEventListener("visibilitychange", wake);
      model?.dispose();
      shadowTex.dispose();
      bgTex.dispose();
      env.dispose();
      pmrem.dispose();
      renderer.dispose();
      canvas.remove();
    },
  };
}

function smooth(a: number, b: number, x: number) {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

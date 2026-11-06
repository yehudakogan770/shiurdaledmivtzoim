"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { t } from "@/lib/i18n";
import { cx } from "./ui";

/**
 * The 770 menorah in real 3D (three.js, drawn on the phone's graphics chip), built from a photo of
 * the one in 770: straight branches at 45° with small balls under each tulip cup, a stem with
 * decorative balls and rings, a dome base on feet, polished brass with real reflections, nine tall
 * yellow candles, and nine live flames, each with its own seed, speed, size and
 * brightness so they never move together, each giving its own small flickering light onto the
 * gold and wax. Drag it (finger or mouse) to spin it all the way around and tilt it up to 35° up or
 * down; let go and it keeps turning a little, then slows to a stop. Touches on it turn it and never
 * scroll the page; the rest of the page scrolls as usual.
 *
 * `lit` is how many candles burn (from the right as you face it); the shamash burns whenever any
 * candle does. While it loads, or on a phone without 3D, `fallback` shows instead.
 */

// ---- The flame: one program, nine flames, each with its own numbers ----
const FLAME_VERT = `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`;
const FLAME_FRAG = `
precision highp float;
varying vec2 vUv;
uniform float uTime;
uniform float uSeed;
uniform float uSpeed;
uniform float uH;
uniform float uW;
uniform float uBright;
uniform float uSway;
uniform float uOn;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}
float fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int k = 0; k < 4; k++) { v += a * noise(p); p = p * 2.03 + vec2(17.1, 9.2); a *= 0.5; }
  return v;
}

void main() {
  if (uOn < 0.5) discard;
  // The plane is 3 wide and 5 tall (candle widths); the wick top sits low in the middle.
  vec2 p = (vUv - vec2(0.5, 0.2)) * vec2(3.0, 5.0);
  float t = uTime * uSpeed + uSeed * 37.0;
  float flick = fbm(vec2(t * 2.7, uSeed * 7.3));
  float H = uH;
  float W = uW;

  // Warm light around the flame.
  vec2 gc = p - vec2(uSway * 0.3, H * 0.42);
  float glowD = length(gc * vec2(1.0, 0.8));
  vec3 col = vec3(1.0, 0.6, 0.25) * exp(-glowD * 1.4) * 0.16 * uBright;
  col += vec3(1.0, 0.78, 0.45) * exp(-glowD * 3.6) * 0.18 * uBright;

  // The tip sways more than the base; ragged, rising detail along the edges.
  float v = clamp((p.y + 0.12) / (H + 0.12), 0.0, 1.0);
  float x = p.x - uSway * pow(v, 1.8) * W * 1.6 - (flick - 0.5) * 0.08 * v;
  float edge = fbm(vec2(x * 3.1 + uSeed, v * 3.4 - t * 3.6));
  float prof = W * 2.25 * pow(v, 0.48) * pow(1.0 - v, 0.95);
  prof *= 0.86 + 0.32 * edge;
  float d = abs(x) / max(prof, 0.0001);
  float inside = (p.y + 0.12 > 0.0 && v < 1.0) ? 1.0 : 0.0;
  float body = smoothstep(1.05, 0.5, d) * inside;
  body *= smoothstep(1.0, 0.72, v + 0.12 * (edge - 0.5));

  // White-hot low in the middle, then yellow, gold, orange, deep orange at the soft edge.
  float heat = (1.0 - smoothstep(0.0, 0.95, d)) * (1.0 - smoothstep(0.25, 0.9, v)) * smoothstep(0.0, 0.14, v);
  vec3 c = mix(vec3(1.0, 0.42, 0.08), vec3(1.0, 0.74, 0.28), smoothstep(0.0, 0.55, body));
  c = mix(c, vec3(1.0, 0.9, 0.55), smoothstep(0.15, 0.55, heat));
  c = mix(c, vec3(1.0, 0.98, 0.92), smoothstep(0.45, 0.85, heat));
  float blue = (1.0 - smoothstep(0.0, 0.2, v)) * smoothstep(0.25, 0.9, d) * body;
  c = mix(c, vec3(0.25, 0.4, 1.0), blue * 0.55);
  col += c * body * (1.05 + 0.6 * heat) * uBright;

  // Fade out toward the edges of the flame's plane, so no square edge ever shows.
  float fade = smoothstep(0.0, 0.22, vUv.x) * smoothstep(1.0, 0.78, vUv.x) * smoothstep(0.0, 0.12, vUv.y) * smoothstep(1.0, 0.75, vUv.y);
  col *= fade;
  col = 1.0 - exp(-col * 1.6);
  float a = clamp(max(col.r, max(col.g, col.b)), 0.0, 1.0);
  gl_FragColor = vec4(col, a);
}
`;

/** Smooth random wandering, for each flame's sway, height and brightness (never lines up with the others). */
function wander(seed: number) {
  const pts = Array.from({ length: 64 }, (_, i) => Math.abs(Math.sin(seed * 9.13 + i * 12.9898) * 43758.5453) % 1);
  return (x: number) => {
    const i = Math.floor(x);
    const f = x - i;
    const a = pts[((i % 64) + 64) % 64];
    const b = pts[(((i + 1) % 64) + 64) % 64];
    const u = f * f * (3 - 2 * f);
    return a + (b - a) * u;
  };
}

export function Menorah3D({ lit, fallback, className }: { lit: number; fallback: ReactNode; className?: string }) {
  const box = useRef<HTMLDivElement>(null);
  const litRef = useRef(lit);
  litRef.current = lit;
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);

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
        stop = build(THREE, RoomEnvironment, el, litRef, () => !cancelled && setReady(true));
      } catch (e) {
        console.warn("The 3D menorah could not start:", (e as Error).message);
        if (!cancelled) setFailed(true);
      }
    })();
    return () => {
      cancelled = true;
      stop();
    };
  }, []);

  return (
    <div className={cx("relative mx-auto w-full max-w-[340px]", className)}>
      {(!ready || failed) && fallback}
      <div
        ref={box}
        role="img"
        aria-label={lit ? t("A menorah with {n} candles lit", { n: lit }) : t("A menorah, not lit yet")}
        className={cx("aspect-square w-full cursor-grab touch-none select-none active:cursor-grabbing", !ready && "absolute inset-0 opacity-0", failed && "hidden")}
      />
    </div>
  );
}

type Three = typeof import("three");
type V3 = import("three").Vector3;

function build(THREE: Three, RoomEnvironment: new () => import("three").Scene, el: HTMLDivElement, litRef: { current: number }, onReady: () => void) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, premultipliedAlpha: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setClearColor(0x000000, 0);
  const canvas = renderer.domElement;
  canvas.style.width = "100%";
  canvas.style.height = "100%";
  canvas.style.display = "block";
  el.appendChild(canvas);

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environment = env;

  // ---- Materials ----
  // A little unevenness in the polish, so the gold reads as real metal.
  const grain = document.createElement("canvas");
  grain.width = grain.height = 128;
  const gctx = grain.getContext("2d")!;
  const img = gctx.createImageData(128, 128);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = 150 + Math.random() * 60;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
    img.data[i + 3] = 255;
  }
  gctx.putImageData(img, 0, 0);
  const grainTex = new THREE.CanvasTexture(grain);
  grainTex.wrapS = grainTex.wrapT = THREE.RepeatWrapping;
  grainTex.repeat.set(3, 3);
  const gold = new THREE.MeshPhysicalMaterial({ color: 0xe2b453, metalness: 1, roughness: 0.18, roughnessMap: grainTex, clearcoat: 0.35, clearcoatRoughness: 0.15, envMapIntensity: 1.35 });
  const darkGold = gold.clone();
  darkGold.color = new THREE.Color(0xb8862f);

  const group = new THREE.Group();
  scene.add(group);
  const add = (geo: import("three").BufferGeometry, mat: import("three").Material, x = 0, y = 0, z = 0) => {
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, y, z);
    group.add(mesh);
    return mesh;
  };
  const lathe = (profile: [number, number][], segments = 64) => new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(r, y)), segments);
  // A straight round rod between two points, with round joints.
  const rod = (a: V3, b: V3, r: number) => {
    const dir = new THREE.Vector3().subVectors(b, a);
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(r, r, dir.length(), 32), gold);
    mesh.position.copy(a).addScaledVector(dir, 0.5);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
    group.add(mesh);
    add(new THREE.SphereGeometry(r * 1.02, 24, 16), gold, a.x, a.y, a.z);
    add(new THREE.SphereGeometry(r * 1.02, 24, 16), gold, b.x, b.y, b.z);
  };
  const V = (x: number, y: number) => new THREE.Vector3(x, y, 0);

  // ---- The 770 menorah, built from the photo (sizes measured from it; the back is a best guess) ----
  // Each branch, from the top: a goblet cup, a large ball (knop), three stacked flowers (bells), then
  // a long thin rod to a ball on the stem. The innermost branch joins highest, the outermost lowest.
  const ROW = 25.1; // bottom of the eight cups, in one level row
  const SPREAD = [4.58, 7.49, 10.24, 13.15]; // each cup's distance from the middle
  const JOINT = [21.5, 19.15, 16.8, 14.42]; // where each pair of branches meets the stem
  const SHAMASH_CUP = 27.55;
  const xs = [-SPREAD[3], -SPREAD[2], -SPREAD[1], -SPREAD[0], SPREAD[0], SPREAD[1], SPREAD[2], SPREAD[3]];
  const up = new THREE.Vector3(0, 1, 0);
  // Place a shape so its own up points along `dir`.
  const along = (geo: import("three").BufferGeometry, at: V3, dir: V3, mat: import("three").Material = gold) => {
    const mesh = add(geo, mat, at.x, at.y, at.z);
    mesh.quaternion.setFromUnitVectors(up, dir.clone().normalize());
    return mesh;
  };
  // Shared shapes (made once, used many times).
  const ball = (r: number) => new THREE.SphereGeometry(r, 32, 20);
  // A flower: a short bell, narrow at the bottom, flaring to a rolled lip at the top.
  const bell = lathe([[0, 0], [0.3, 0], [0.34, 0.08], [0.4, 0.28], [0.5, 0.48], [0.55, 0.58], [0.5, 0.66], [0.3, 0.64], [0, 0.63]], 48);
  // A wide collar with eight petals, like an open flower around the stem.
  const petalCollar = (r: number) => {
    const geo = lathe([[0, 0], [0.4, 0], [0.55, 0.05], [r * 0.85, 0.12], [r, 0.2], [r * 0.95, 0.27], [0.55, 0.3], [0.4, 0.38], [0, 0.38]], 64);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const px = pos.getX(i);
      const pz = pos.getZ(i);
      const rr = Math.hypot(px, pz);
      if (rr < 0.6) continue;
      const k = 1 + 0.12 * Math.cos(Math.atan2(pz, px) * 8) * ((rr - 0.6) / (r - 0.6));
      pos.setXYZ(i, px * k, pos.getY(i) + 0.05 * Math.cos(Math.atan2(pz, px) * 8), pz * k);
    }
    geo.computeVertexNormals();
    return geo;
  };
  const ringGeo = (r: number, tube = 0.1) => new THREE.TorusGeometry(r, tube, 12, 40).rotateX(Math.PI / 2);

  // The base: a polished dome, a little taller than half a ball, with a decorated band at its rim.
  add(lathe([[0, 1.3], [4.22, 1.3], [4.3, 1.42], [4.3, 2.3], [4.18, 2.42], [4.05, 2.55], [3.95, 3.1], [3.7, 3.85], [3.25, 4.6], [2.6, 5.25], [1.8, 5.75], [1.0, 6.05], [0.55, 6.15], [0, 6.18]], 96), gold);
  // The rim band: a row of small raised beads all the way around, between two rings.
  add(ringGeo(4.32, 0.07), darkGold, 0, 1.42);
  add(ringGeo(4.32, 0.07), darkGold, 0, 2.28);
  {
    const bead = new THREE.SphereGeometry(0.15, 12, 8);
    const beads = new THREE.InstancedMesh(bead, darkGold, 72);
    const mtx = new THREE.Matrix4();
    for (let i = 0; i < 72; i++) {
      const a = (i / 72) * Math.PI * 2;
      mtx.makeTranslation(Math.cos(a) * 4.31, 1.85, Math.sin(a) * 4.31);
      beads.setMatrixAt(i, mtx);
    }
    group.add(beads);
  }
  // Four cast feet (two show from the front, three from the side): a flared pad, a waist, a bulb.
  const footGeo = lathe([[0, 0], [0.62, 0], [0.66, 0.12], [0.48, 0.3], [0.26, 0.55], [0.22, 0.8], [0.36, 1.05], [0.42, 1.3], [0.34, 1.55], [0.24, 1.7], [0.3, 1.85], [0, 1.9]], 6 * 6);
  {
    // Six-sided pads, like the cast feet in the photo.
    const pos = footGeo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const py = pos.getY(i);
      if (py > 0.35) continue;
      const px = pos.getX(i);
      const pz = pos.getZ(i);
      const k = 1 + 0.1 * Math.cos(Math.atan2(pz, px) * 6);
      pos.setXYZ(i, px * k, py, pz * k);
    }
    footGeo.computeVertexNormals();
  }
  for (let i = 0; i < 4; i++) {
    const a = Math.PI / 4 + (i * Math.PI) / 2;
    add(footGeo, gold, Math.cos(a) * 3.45, 0, Math.sin(a) * 3.45);
  }

  // The stem, from the dome to the shamash: thin sections between balls, collars and rings.
  rod(V(0, 6.1), V(0, SHAMASH_CUP - 0.2), 0.33);
  add(lathe([[0, 0], [0.7, 0], [0.62, 0.18], [0.45, 0.3], [0.42, 0.55], [0.5, 0.65], [0, 0.66]], 40), darkGold, 0, 6.05); // where the stem meets the dome
  add(petalCollar(1.15), gold, 0, 6.6);
  along(bell, V(0, 9.95), new THREE.Vector3(0, -1, 0)); // a hanging bud
  add(ball(0.72), gold, 0, 10.7);
  add(ringGeo(0.42), darkGold, 0, 11.45);
  add(petalCollar(1.15), gold, 0, 11.8);
  add(ringGeo(0.4), darkGold, 0, 12.4);
  JOINT.forEach((y, i) => {
    add(ball(0.72), gold, 0, y);
    // Rings above and below each joint ball.
    add(ringGeo(0.4), darkGold, 0, y + 0.82);
    add(ringGeo(0.4), darkGold, 0, y - 0.82);
    if (i > 0) add(ringGeo(0.38, 0.08), darkGold, 0, (y + JOINT[i - 1]) / 2);
  });
  // Under the shamash: three stacked flowers and a ball, the same as under each branch's cup.
  for (let k = 0; k < 3; k++) add(bell, gold, 0, 23.25 + k * 0.72);
  add(ball(0.72), gold, 0, 26.8);

  // The eight branches.
  for (const x of xs) {
    const sgn = Math.sign(x);
    const dx = Math.abs(x);
    const joint = V(0, JOINT[SPREAD.indexOf(dx)]);
    const knop = V(x - sgn * 0.62, ROW - 0.5);
    const dir = new THREE.Vector3().subVectors(joint, knop).normalize(); // down and in, toward the stem
    add(ball(0.72), gold, knop.x, knop.y);
    // Three flowers stacked down the branch, their open ends toward the cup.
    for (let k = 0; k < 3; k++) {
      const at = knop.clone().addScaledVector(dir, 0.95 + k * 0.66 + 0.6);
      along(bell, at, dir.clone().negate());
    }
    const rodStart = knop.clone().addScaledVector(dir, 0.95 + 3 * 0.66 + 0.4);
    rod(rodStart, joint, 0.17);
    // A small collar where the rod leaves the flowers, and where it meets the joint ball.
    along(new THREE.TorusGeometry(0.24, 0.07, 10, 28).rotateX(Math.PI / 2), rodStart, dir);
    along(new THREE.TorusGeometry(0.22, 0.07, 10, 28).rotateX(Math.PI / 2), joint.clone().addScaledVector(dir, -0.72), dir);
  }

  // The goblet cups: a small foot and neck, a ball, a waist, then a body with raised lobes that
  // flares to a scalloped, petal-shaped rim. Open on top, where the candle sits.
  const cupGeo = (hole: number) => {
    const geo = lathe(
      [
        [0, 0],
        [0.36, 0],
        [0.4, 0.1],
        [0.24, 0.26],
        [0.22, 0.4],
        [0.42, 0.58],
        [0.44, 0.72],
        [0.3, 0.9],
        [0.32, 1.05],
        [0.55, 1.35],
        [0.75, 1.7],
        [0.88, 2.05],
        [0.95, 2.35],
        [0.86, 2.45],
        [hole + 0.04, 2.38],
        [hole, 2.25],
        [hole, 1.35],
        [0, 1.35],
      ],
      96,
    );
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const px = pos.getX(i);
      const py = pos.getY(i);
      const pz = pos.getZ(i);
      const rr = Math.hypot(px, pz);
      if (rr < hole + 0.05) continue;
      const a = Math.atan2(pz, px);
      let k = 1;
      let lift = 0;
      // Raised lobes around the body.
      if (py > 1.05 && py < 2.2) k += 0.07 * Math.max(0, Math.cos(a * 8)) * Math.sin(((py - 1.05) / 1.15) * Math.PI);
      // Eight petals around the rim.
      if (py > 2.0) {
        const w = (py - 2.0) / 0.45;
        k += 0.06 * Math.cos(a * 8) * w;
        lift = 0.18 * Math.cos(a * 8) * w;
      }
      // Small bumps on the ball under the cup.
      if (py > 0.45 && py < 0.85) k += 0.05 * Math.cos(a * 12);
      pos.setXYZ(i, px * k, py + lift, pz * k);
    }
    geo.computeVertexNormals();
    return geo;
  };
  const cup = cupGeo(0.33);
  for (const x of xs) add(cup, gold, x, ROW);
  add(cupGeo(0.35), gold, 0, SHAMASH_CUP);

  // ---- Candles: tall, thin yellow candles, a little uneven, with a melted dip and a wick ----
  const candles: { wax: import("three").MeshStandardMaterial; top: V3 }[] = [];
  const candle = (x: number, base: number, height: number, r: number, seed: number) => {
    const prof: [number, number][] = [
      [0, 0],
      [r, 0],
      [r, height - 0.16],
      [r * 0.95, height - 0.04],
      [r * 0.8, height],
      [r * 0.45, height - 0.05],
      [r * 0.18, height - 0.1],
      [0, height - 0.11],
    ];
    const geo = lathe(prof, 36);
    // Slightly imperfect: a gentle wobble around and along the candle.
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const px = pos.getX(i);
      const py = pos.getY(i);
      const pz = pos.getZ(i);
      const a = Math.atan2(pz, px);
      const k = 1 + 0.03 * Math.sin(a * 3 + seed) * Math.sin(py * 1.1 + seed * 2) + 0.012 * Math.sin(a * 7 + py * 3 + seed);
      pos.setXYZ(i, px * k, py, pz * k);
    }
    geo.computeVertexNormals();
    const wax = new THREE.MeshStandardMaterial({
      // Yellow beeswax, each a slightly different shade.
      color: new THREE.Color().setHSL(0.118 + Math.random() * 0.01, 0.88 + Math.random() * 0.08, 0.47 + Math.random() * 0.04),
      roughness: 0.42,
      metalness: 0,
      emissive: new THREE.Color(0xffa040),
      emissiveIntensity: 0,
    });
    add(geo, wax, x, base);
    // The wick: thin, dark, a slight bend.
    const wick = add(new THREE.CylinderGeometry(0.03, 0.04, 0.45, 8), new THREE.MeshStandardMaterial({ color: 0x1d140c, roughness: 0.9 }), x, base + height + 0.08);
    wick.rotation.z = (Math.random() - 0.5) * 0.25;
    candles.push({ wax, top: new THREE.Vector3(x, base + height + 0.28, 0) });
  };
  xs.forEach((x, i) => candle(x, ROW + 1.4, 5.2, 0.3, i * 1.7));
  candle(0, SHAMASH_CUP + 1.4, 5.6, 0.32, 20);

  // A soft shadow under the base.
  const sh = document.createElement("canvas");
  sh.width = sh.height = 128;
  const sg = sh.getContext("2d")!;
  const grd = sg.createRadialGradient(64, 64, 0, 64, 64, 64);
  grd.addColorStop(0, "rgba(0,0,0,0.6)");
  grd.addColorStop(0.6, "rgba(0,0,0,0.25)");
  grd.addColorStop(1, "rgba(0,0,0,0)");
  sg.fillStyle = grd;
  sg.fillRect(0, 0, 128, 128);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(13, 13), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(sh), transparent: true, depthWrite: false }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = 0.01;
  scene.add(floor);

  // ---- Lights: a soft key light, a cool rim, and one small light per flame ----
  scene.add(new THREE.AmbientLight(0x6a5aa0, 0.25));
  const key = new THREE.DirectionalLight(0xfff0d8, 1.3);
  key.position.set(-12, 30, 22);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0x8a7cff, 0.6);
  rim.position.set(14, 18, -20);
  scene.add(rim);

  // ---- The nine flames ----
  const PLANE = 0.84; // world size of one flame unit (one candle width)
  const flamePlane = new THREE.PlaneGeometry(3 * PLANE, 5 * PLANE);
  const flames = candles.map((c, i) => {
    const mat = new THREE.ShaderMaterial({
      vertexShader: FLAME_VERT,
      fragmentShader: FLAME_FRAG,
      transparent: true,
      depthWrite: false,
      blending: THREE.CustomBlending,
      blendSrc: THREE.OneFactor,
      blendDst: THREE.OneMinusSrcAlphaFactor,
      uniforms: {
        uTime: { value: 0 },
        uSeed: { value: Math.random() * 100 },
        uSpeed: { value: 0.8 + Math.random() * 0.42 },
        uH: { value: 2.0 },
        uW: { value: 0.34 },
        uBright: { value: 1 },
        uSway: { value: 0 },
        uOn: { value: 0 },
      },
    });
    const mesh = new THREE.Mesh(flamePlane, mat);
    mesh.renderOrder = 10;
    scene.add(mesh);
    const light = new THREE.PointLight(0xffa64d, 0, 7, 2);
    scene.add(light);
    const seed = Math.random() * 1000;
    return { mat, mesh, light, wick: c.top, wax: c.wax, index: i, sway: wander(seed), height: wander(seed + 1), bright: wander(seed + 2), look: { h: 0.9 + Math.random() * 0.2, w: 0.9 + Math.random() * 0.2, b: 0.85 + Math.random() * 0.23 } };
  });

  // ---- Camera: same framing as the drawing ----
  const camera = new THREE.PerspectiveCamera(32, 1, 1, 400);
  camera.position.set(0, 21.3, 73);
  camera.lookAt(0, 18.3, 0);

  const resize = () => {
    const w = el.clientWidth || 300;
    renderer.setSize(w, w, false);
  };
  resize();
  const ro = new ResizeObserver(resize);
  ro.observe(el);

  // ---- Turning: drag to spin all the way around and tilt up or down, with a little momentum ----
  const still = !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  const TILT = THREE.MathUtils.degToRad(35);
  const SENSE = 0.009; // radians per pixel dragged
  const m = { yaw: 0, pitch: 0, vYaw: 0, vPitch: 0, dragging: false, x: 0, y: 0, t: 0, wind: 0, id: -1 };
  let raf = 0;
  let onScreen = true;
  const wake = () => {
    if (!raf && onScreen && document.visibilityState === "visible") raf = requestAnimationFrame(frame);
  };
  const onDown = (e: PointerEvent) => {
    if (m.dragging) return;
    m.dragging = true;
    m.id = e.pointerId;
    m.x = e.clientX;
    m.y = e.clientY;
    m.t = performance.now();
    m.vYaw = m.vPitch = 0;
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
    const dYaw = (e.clientX - m.x) * SENSE;
    // Dragging up looks down from above; dragging down looks up from below.
    const dPitch = -(e.clientY - m.y) * SENSE * 0.8;
    m.yaw += dYaw;
    m.pitch = Math.max(-TILT, Math.min(TILT, m.pitch + dPitch));
    // Speed per frame (16ms), smoothed, for the momentum after letting go.
    m.vYaw = m.vYaw * 0.5 + (dYaw / dt) * 16 * 0.5;
    m.vPitch = m.vPitch * 0.5 + (dPitch / dt) * 16 * 0.5;
    m.x = e.clientX;
    m.y = e.clientY;
    m.t = now;
    wake();
  };
  const onUp = (e: PointerEvent) => {
    if (e.pointerId !== m.id) return;
    m.dragging = false;
    // A pause before letting go means no momentum.
    if (performance.now() - m.t > 90) m.vYaw = m.vPitch = 0;
    wake();
  };
  el.addEventListener("pointerdown", onDown);
  el.addEventListener("pointermove", onMove);
  el.addEventListener("pointerup", onUp);
  el.addEventListener("pointercancel", onUp);
  const target = new THREE.Vector3(0, 18.3, 0);
  const DIST = Math.hypot(73, 3);
  const BASE_PITCH = Math.atan2(3, 73);

  // ---- The loop: runs only while the menorah is on screen and the page is in view ----
  const start = performance.now();
  const at = new THREE.Vector3();
  const lift = new THREE.Vector3(0, 0.9, 0.4);
  let first = true;
  function frame() {
    raf = 0;
    const now = performance.now();
    const time = still ? 4 : (now - start) / 1000;
    if (!m.dragging) {
      // Momentum that slows down naturally, without spinning on and on.
      m.yaw += m.vYaw;
      m.pitch = Math.max(-TILT, Math.min(TILT, m.pitch + m.vPitch));
      m.vYaw *= 0.92;
      m.vPitch *= 0.85;
      if (Math.abs(m.vYaw) < 0.0004) m.vYaw = 0;
      if (Math.abs(m.vPitch) < 0.0004) m.vPitch = 0;
    }
    // Turning pushes the flames the other way a little, like carrying a real candle.
    const spin = m.dragging ? m.vYaw : m.vYaw;
    m.wind += (Math.max(-0.6, Math.min(0.6, -spin * 6)) - m.wind) * 0.1;
    group.rotation.y = m.yaw;
    // Tilting moves the camera up or down around the menorah, keeping it centered.
    const el2 = BASE_PITCH + m.pitch;
    camera.position.set(0, target.y + Math.sin(el2) * DIST, Math.cos(el2) * DIST);
    camera.lookAt(target);
    group.updateMatrixWorld(true);

    const lit = litRef.current;
    for (const f of flames) {
      const on = f.index === 8 ? lit > 0 : f.index >= 8 - lit;
      const u = f.mat.uniforms;
      u.uOn.value = on ? 1 : 0;
      at.copy(f.wick).applyMatrix4(group.matrixWorld);
      // The flame plane hangs from the wick, which sits 20% up the plane.
      f.mesh.position.set(at.x, at.y + 5 * PLANE * 0.3, at.z);
      f.mesh.quaternion.copy(camera.quaternion);
      const tt = time * u.uSpeed.value;
      const breathe = f.height(tt * 0.6);
      const bright = f.look.b * (0.82 + 0.3 * f.bright(tt * 1.7));
      u.uTime.value = time;
      u.uH.value = 2.35 * f.look.h * (0.86 + 0.28 * breathe);
      u.uW.value = 0.46 * f.look.w * (1.08 - 0.18 * breathe);
      u.uBright.value = bright;
      u.uSway.value = (f.sway(tt * 0.8) - 0.5) * 0.8 + m.wind;
      f.light.position.copy(at).add(lift);
      f.light.intensity = on ? 9 * bright : 0;
      // The wax glows a little from inside near its own flame.
      f.wax.emissiveIntensity = on ? 0.1 * bright : 0;
    }
    renderer.render(scene, camera);
    if (first) {
      first = false;
      onReady();
    }
    // Keep going while flames burn or it's still turning.
    const moving = m.dragging || m.vYaw !== 0 || m.vPitch !== 0 || Math.abs(m.wind) > 0.01;
    if ((lit > 0 && !still) || moving) wake();
  }
  const io = new IntersectionObserver(([e]) => {
    onScreen = e.isIntersecting;
    wake();
  });
  io.observe(el);
  document.addEventListener("visibilitychange", wake);
  // The night can change while the page is open.
  const nightCheck = setInterval(wake, 5000);
  wake();

  return () => {
    cancelAnimationFrame(raf);
    raf = -1; // never wake again
    clearInterval(nightCheck);
    io.disconnect();
    ro.disconnect();
    document.removeEventListener("visibilitychange", wake);
    el.removeEventListener("pointerdown", onDown);
    el.removeEventListener("pointermove", onMove);
    el.removeEventListener("pointerup", onUp);
    el.removeEventListener("pointercancel", onUp);
    scene.traverse((o) => {
      const mesh = o as import("three").Mesh;
      mesh.geometry?.dispose?.();
      (mesh.material as import("three").Material | undefined)?.dispose?.();
    });
    grainTex.dispose();
    env.dispose();
    pmrem.dispose();
    renderer.dispose();
    canvas.remove();
  };
}

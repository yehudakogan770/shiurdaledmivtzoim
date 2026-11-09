"use client";

import { useEffect, useRef, useState } from "react";

/**
 * A shower of 15 gold Chanukah gelt coins, after a stop is logged. Real 3D coins (three.js): a
 * beveled rim with a ridged edge, a menorah on the front (straight branches, nine candles, laurel
 * branches, a beaded border) and a dreidel with נ and ג on the back. The engraving is a bump map,
 * so the lights pick out the raised parts as each coin turns. Polished gold that catches a key
 * light, a fill light, a rim light and soft reflections, so the shine changes as the coins spin
 * and flip. Five large coins close by, five medium, five small and far away, each with its own
 * start, speed, drift and spin. It sits over the page without blocking taps, plays once, then
 * removes itself. Nothing shows for people who turned motion off on their phone.
 */
export function GeltShower() {
  const box = useRef<HTMLDivElement>(null);
  const [gone, setGone] = useState(false);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return setGone(true);
    let stop = () => {};
    let cancelled = false;
    (async () => {
      try {
        const THREE = await import("three");
        const { RoomEnvironment } = await import("three/examples/jsm/environments/RoomEnvironment.js");
        // The Hebrew letters on the dreidel use the site's Hebrew font.
        await document.fonts?.load('700 120px "David Libre"').catch(() => {});
        if (cancelled) return;
        stop = run(THREE, RoomEnvironment, el, () => !cancelled && setGone(true));
      } catch (e) {
        console.warn("The gelt shower could not start:", (e as Error).message);
        if (!cancelled) setGone(true);
      }
    })();
    return () => {
      cancelled = true;
      stop();
    };
  }, []);

  if (gone) return null;
  return <div ref={box} aria-hidden className="pointer-events-none fixed inset-0 z-[60]" />;
}

type Three = typeof import("three");

// ---- The coin faces: drawn once, used as the engraving (bump) and a subtle shading map ----
const S = 512;
const C = S / 2;

function beadBorder(g: CanvasRenderingContext2D) {
  for (let i = 0; i < 64; i++) {
    const a = (i / 64) * Math.PI * 2;
    const x = C + Math.cos(a) * 230;
    const y = C + Math.sin(a) * 230;
    const r = g.createRadialGradient(x - 1.5, y - 1.5, 0, x, y, 7);
    r.addColorStop(0, "#fff");
    r.addColorStop(1, "#777");
    g.fillStyle = r;
    g.beginPath();
    g.arc(x, y, 6.5, 0, Math.PI * 2);
    g.fill();
  }
  g.strokeStyle = "#c4c4c4";
  g.lineWidth = 3;
  g.beginPath();
  g.arc(C, C, 214, 0, Math.PI * 2);
  g.stroke();
}

/** A laurel branch: small leaves along a gentle curve, from the bottom up one side. */
function laurel(g: CanvasRenderingContext2D, side: 1 | -1) {
  const p = (t: number) => ({ x: C + side * (120 + 46 * Math.sin(t * Math.PI * 0.9)), y: 410 - t * 205 });
  g.strokeStyle = "#cfcfcf";
  g.lineWidth = 4;
  g.beginPath();
  for (let t = 0; t <= 1; t += 0.05) {
    const q = p(t);
    if (t === 0) g.moveTo(q.x, q.y);
    else g.lineTo(q.x, q.y);
  }
  g.stroke();
  for (let i = 0; i < 8; i++) {
    const t = 0.08 + i * 0.12;
    const q = p(t);
    const n = p(t + 0.02);
    const ang = Math.atan2(n.y - q.y, n.x - q.x);
    for (const out of [-1, 1]) {
      g.save();
      g.translate(q.x, q.y);
      g.rotate(ang + out * 0.65);
      const r = g.createLinearGradient(0, -6, 0, 6);
      r.addColorStop(0, "#f2f2f2");
      r.addColorStop(1, "#9a9a9a");
      g.fillStyle = r;
      g.beginPath();
      g.ellipse(13, 0, 15, 5.5, 0, 0, Math.PI * 2);
      g.fill();
      g.restore();
    }
  }
}

/** A raised line with a rounded top (a darker, wider edge under a bright middle). */
function raised(g: CanvasRenderingContext2D, draw: () => void, w: number) {
  g.lineCap = "round";
  g.strokeStyle = "#a8a8a8";
  g.lineWidth = w + 4;
  g.beginPath();
  draw();
  g.stroke();
  g.strokeStyle = "#ffffff";
  g.lineWidth = w;
  g.beginPath();
  draw();
  g.stroke();
}

function menorahFace(g: CanvasRenderingContext2D) {
  laurel(g, -1);
  laurel(g, 1);
  const row = 182;
  const spread = [24, 48, 72, 96];
  // Straight branches, a straight stem and a flat base (as on the site's menorah).
  for (const dx of spread) {
    raised(g, () => {
      g.moveTo(C - dx, row);
      g.lineTo(C, row + dx * 1.05);
      g.lineTo(C + dx, row);
    }, 6);
  }
  raised(g, () => {
    g.moveTo(C, 150);
    g.lineTo(C, 352);
  }, 9);
  // Base.
  const b = g.createLinearGradient(0, 345, 0, 380);
  b.addColorStop(0, "#ffffff");
  b.addColorStop(1, "#9a9a9a");
  g.fillStyle = b;
  g.beginPath();
  g.moveTo(C - 14, 348);
  g.quadraticCurveTo(C - 50, 362, C - 58, 378);
  g.lineTo(C + 58, 378);
  g.quadraticCurveTo(C + 50, 362, C + 14, 348);
  g.closePath();
  g.fill();
  // Cups, candles and flames.
  const candle = (x: number, cupY: number, h: number) => {
    const cg = g.createLinearGradient(x - 9, 0, x + 9, 0);
    cg.addColorStop(0, "#9a9a9a");
    cg.addColorStop(0.45, "#ffffff");
    cg.addColorStop(1, "#8a8a8a");
    g.fillStyle = cg;
    g.fillRect(x - 9, cupY - 8, 18, 10);
    g.fillRect(x - 5, cupY - 8 - h, 10, h);
    g.beginPath();
    const ty = cupY - 8 - h - 3;
    g.moveTo(x, ty - 18);
    g.quadraticCurveTo(x + 7, ty - 6, x, ty);
    g.quadraticCurveTo(x - 7, ty - 6, x, ty - 18);
    g.fill();
  };
  for (const dx of spread) {
    candle(C - dx, row, 34);
    candle(C + dx, row, 34);
  }
  candle(C, 152, 40);
}

function dreidelFace(g: CanvasRenderingContext2D) {
  laurel(g, -1);
  laurel(g, 1);
  // A dreidel seen from a little above and to the side: two faces, the top, a handle and the point.
  const L = { x: C - 70, y: 180 };
  const M = { x: C - 6, y: 205 };
  const R = { x: C + 72, y: 172 };
  const H = 120;
  const face = (a: { x: number; y: number }, b: { x: number; y: number }, light: string, dark: string) => {
    const gr = g.createLinearGradient(a.x, a.y, b.x, b.y);
    gr.addColorStop(0, light);
    gr.addColorStop(1, dark);
    g.fillStyle = gr;
    g.beginPath();
    g.moveTo(a.x, a.y);
    g.lineTo(b.x, b.y);
    g.lineTo(b.x, b.y + H);
    g.lineTo(a.x, a.y + H);
    g.closePath();
    g.fill();
  };
  face(L, M, "#e8e8e8", "#c2c2c2");
  face(M, R, "#b8b8b8", "#9a9a9a");
  // Top.
  g.fillStyle = "#f4f4f4";
  g.beginPath();
  g.moveTo(L.x, L.y);
  g.lineTo(M.x, M.y);
  g.lineTo(R.x, R.y);
  g.lineTo(C + 6, 150);
  g.closePath();
  g.fill();
  // Handle.
  const hg = g.createLinearGradient(C - 12, 0, C + 12, 0);
  hg.addColorStop(0, "#a0a0a0");
  hg.addColorStop(0.45, "#ffffff");
  hg.addColorStop(1, "#909090");
  g.fillStyle = hg;
  g.fillRect(C - 9, 98, 18, 82);
  // Point.
  g.fillStyle = "#b0b0b0";
  g.beginPath();
  g.moveTo(L.x, L.y + H);
  g.lineTo(M.x, M.y + H);
  g.lineTo(R.x, R.y + H);
  g.lineTo(C + 4, 390);
  g.closePath();
  g.fill();
  // The letters, raised: נ on the left face and ג on the right.
  g.fillStyle = "#ffffff";
  g.font = '700 82px "David Libre", "David", "Times New Roman", serif';
  g.textAlign = "center";
  g.textBaseline = "middle";
  const letter = (ch: string, a: { x: number; y: number }, b: { x: number; y: number }) => {
    g.save();
    g.translate((a.x + b.x) / 2, (a.y + b.y) / 2 + H / 2);
    g.transform(1, (b.y - a.y) / (b.x - a.x), 0, 1, 0, 0);
    g.fillText(ch, 0, 4);
    g.restore();
  };
  letter("נ", L, M);
  letter("ג", M, R);
}

function faceTextures(THREE: Three, draw: (g: CanvasRenderingContext2D) => void) {
  const raw = document.createElement("canvas");
  raw.width = raw.height = S;
  const g = raw.getContext("2d")!;
  g.fillStyle = "#606060";
  g.fillRect(0, 0, S, S);
  beadBorder(g);
  draw(g);
  // Softened, so the raised parts have rounded edges.
  const bump = document.createElement("canvas");
  bump.width = bump.height = S;
  const bg = bump.getContext("2d")!;
  bg.filter = "blur(1.2px)";
  bg.drawImage(raw, 0, 0);
  // A shading map: recesses a little darker than the raised parts.
  const shade = document.createElement("canvas");
  shade.width = shade.height = S;
  const sg = shade.getContext("2d")!;
  sg.drawImage(bump, 0, 0);
  const img = sg.getImageData(0, 0, S, S);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = 190 + (img.data[i] / 255) * 65;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
  }
  sg.putImageData(img, 0, 0);
  const bumpTex = new THREE.CanvasTexture(bump);
  const mapTex = new THREE.CanvasTexture(shade);
  mapTex.colorSpace = THREE.SRGBColorSpace;
  for (const t of [bumpTex, mapTex]) t.anisotropy = 4;
  return { bumpTex, mapTex };
}

function run(THREE: Three, RoomEnvironment: new () => import("three").Scene, el: HTMLDivElement, onDone: () => void) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setClearColor(0x000000, 0);
  const canvas = renderer.domElement;
  canvas.style.width = "100%";
  canvas.style.height = "100%";
  el.appendChild(canvas);

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environment = env;
  // A large soft key light, a fill light, and a rim light from behind.
  const key = new THREE.DirectionalLight(0xfff2d6, 2.4);
  key.position.set(-6, 8, 10);
  scene.add(key);
  const fill = new THREE.DirectionalLight(0xffe0b0, 0.7);
  fill.position.set(8, -2, 6);
  scene.add(fill);
  const rim = new THREE.DirectionalLight(0xffffff, 1.4);
  rim.position.set(2, 6, -10);
  scene.add(rim);

  // ---- One coin, shared by all fifteen ----
  // About 30mm across and 3mm thick: radius 1, thickness 0.2, a raised rim and a beveled edge.
  const profile: [number, number][] = [
    [0, -0.085],
    [0.88, -0.085],
    [0.9, -0.1],
    [0.955, -0.1],
    [0.99, -0.085],
    [1, -0.065],
    [1, 0.065],
    [0.99, 0.085],
    [0.955, 0.1],
    [0.9, 0.1],
    [0.88, 0.085],
    [0, 0.085],
  ];
  const body = new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(r, y)), 240);
  {
    // Fine ridges all the way around the edge.
    const pos = body.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      const y = pos.getY(i);
      if (Math.hypot(x, z) < 0.995 || Math.abs(y) > 0.07) continue;
      const k = 1 + 0.012 * Math.cos(Math.atan2(z, x) * 120);
      pos.setXYZ(i, x * k, y, z * k);
    }
    body.computeVertexNormals();
  }
  const faceGeo = new THREE.CircleGeometry(0.885, 96);
  const front = faceTextures(THREE, menorahFace);
  const back = faceTextures(THREE, dreidelFace);
  const goldBase = { color: new THREE.Color("#D4AF37"), metalness: 1, roughness: 0.22, envMapIntensity: 1.3 };
  const edgeMat = new THREE.MeshPhysicalMaterial({ ...goldBase, roughness: 0.25, clearcoat: 0.3 });
  const frontMat = new THREE.MeshPhysicalMaterial({ ...goldBase, map: front.mapTex, bumpMap: front.bumpTex, bumpScale: 5, clearcoat: 0.25 });
  const backMat = new THREE.MeshPhysicalMaterial({ ...goldBase, map: back.mapTex, bumpMap: back.bumpTex, bumpScale: 5, clearcoat: 0.25 });

  const makeCoin = () => {
    const coin = new THREE.Group();
    coin.add(new THREE.Mesh(body, edgeMat));
    const f = new THREE.Mesh(faceGeo, frontMat);
    f.rotation.x = -Math.PI / 2;
    f.position.y = 0.086;
    coin.add(f);
    const b = new THREE.Mesh(faceGeo, backMat);
    b.rotation.x = Math.PI / 2;
    b.position.y = -0.086;
    coin.add(b);
    scene.add(coin);
    return coin;
  };

  // ---- The camera, and the size of things on screen at each depth ----
  const FOV = 40;
  const CAM_Z = 14;
  const camera = new THREE.PerspectiveCamera(FOV, window.innerWidth / window.innerHeight, 0.5, 100);
  camera.position.set(0, 0, CAM_Z);
  const halfH = (z: number) => Math.tan(THREE.MathUtils.degToRad(FOV / 2)) * (CAM_Z - z);
  const halfW = (z: number) => halfH(z) * camera.aspect;
  const perPx = (z: number) => (2 * halfH(z)) / window.innerHeight;

  // ---- Fifteen coins: 5 large and close, 5 medium, 5 small and far ----
  const rand = (a: number, b: number) => a + Math.random() * (b - a);
  const big = Math.max(56, Math.min(130, Math.min(window.innerWidth, window.innerHeight) * 0.19));
  const tiers = [
    { scale: 1, z: 3, fall: [3.6, 4.6] },
    { scale: 0.75, z: 0, fall: [4.2, 5.2] },
    { scale: 0.55, z: -4, fall: [4.8, 6.0] },
  ];
  // Spread across the width: fifteen slots, shuffled, with a little jitter, so no rows or columns.
  const slots = Array.from({ length: 15 }, (_, i) => -0.92 + (i / 14) * 1.84).sort(() => Math.random() - 0.5);
  const coins = Array.from({ length: 15 }, (_, i) => {
    const tier = tiers[Math.floor(i / 5)];
    let nx = slots[i] + rand(-0.05, 0.05);
    // The big, close coins keep to the sides so the message stays readable.
    if (tier.scale === 1 && Math.abs(nx) < 0.38) nx = Math.sign(nx || 1) * rand(0.42, 0.9);
    const z = tier.z + rand(-0.8, 0.8);
    const radius = (big * tier.scale * 0.5) * perPx(z);
    const obj = makeCoin();
    obj.scale.setScalar(radius);
    obj.rotation.set(rand(0, Math.PI * 2), rand(0, Math.PI * 2), rand(0, Math.PI * 2));
    return {
      obj,
      x: nx * halfW(z),
      z,
      top: halfH(z) + radius * 1.6,
      bottom: -halfH(z) - radius * 1.6,
      delay: rand(0, 1.9),
      fall: rand(tier.fall[0], tier.fall[1]),
      drift: rand(0.05, 0.14) * halfW(z) * (Math.random() < 0.5 ? -1 : 1),
      driftHz: rand(0.35, 0.8),
      phase: rand(0, Math.PI * 2),
      spin: new THREE.Vector3(rand(1.4, 3.6) * (Math.random() < 0.5 ? -1 : 1), rand(0.4, 1.8) * (Math.random() < 0.5 ? -1 : 1), rand(0.2, 0.9) * (Math.random() < 0.5 ? -1 : 1)),
    };
  });
  const end = Math.max(...coins.map((c) => c.delay + c.fall)) + 0.2;

  const onResize = () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight, false);
  };
  window.addEventListener("resize", onResize);

  // ---- Falling: a gentle ease in, a side-to-side drift, and each coin's own tumble ----
  const start = performance.now();
  let last = start;
  let raf = 0;
  let finished = false;
  const frame = (now: number) => {
    const t = (now - start) / 1000;
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    for (const c of coins) {
      const p = (t - c.delay) / c.fall;
      c.obj.visible = p > 0 && p < 1;
      if (!c.obj.visible) continue;
      // Starts gently, then falls steadily.
      const eased = p < 0.15 ? (p * p) / 0.3 : p - 0.075;
      const y = c.top + (c.bottom - c.top) * (eased / 0.925);
      c.obj.position.set(c.x + c.drift * Math.sin(t * c.driftHz * Math.PI * 2 + c.phase), y, c.z);
      c.obj.rotation.x += c.spin.x * dt;
      c.obj.rotation.y += c.spin.y * dt;
      c.obj.rotation.z += c.spin.z * dt;
    }
    renderer.render(scene, camera);
    if (t < end) raf = requestAnimationFrame(frame);
    else if (!finished) {
      finished = true;
      onDone();
    }
  };
  raf = requestAnimationFrame(frame);

  return () => {
    cancelAnimationFrame(raf);
    window.removeEventListener("resize", onResize);
    for (const m of [edgeMat, frontMat, backMat]) m.dispose();
    for (const t of [front.bumpTex, front.mapTex, back.bumpTex, back.mapTex]) t.dispose();
    body.dispose();
    faceGeo.dispose();
    env.dispose();
    pmrem.dispose();
    renderer.dispose();
    canvas.remove();
  };
}

import type * as T from "three";
import { LETTERS, type DreidelDesign } from "@/lib/dreidel";

/**
 * The 3D dreidel. One shape for every design: a square body with rounded edges, a four-sided point
 * underneath and a straight round handle (the same width all the way up, no knob). Its tip sits at
 * the origin, so it leans and spins around the tip. Each design gets its own materials, made on the
 * phone from drawn textures: grain, veins, pores and so on, plus bump maps so the light catches
 * the surface. Sides, in order: נ front, ג right, ה back, ש left.
 */
type Three = typeof import("three");

// Sizes, with the body 1 wide (about 38mm), 1.7 tall overall (about 65mm).
export const POINT_H = 0.52;
export const BODY_H = 0.98;
export const HANDLE_H = 0.42;
export const HANDLE_R = 0.085;
export const TOP = POINT_H + BODY_H + HANDLE_H;
/** Each side's direction around the dreidel (radians), in the order of LETTERS. */
export const FACE_ANGLES = [0, Math.PI / 2, Math.PI, -Math.PI / 2];

const rnd = (a: number, b: number) => a + Math.random() * (b - a);

function canvas(size = 512) {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  return [c, c.getContext("2d")!] as const;
}

function tex(THREE: Three, c: HTMLCanvasElement, color = true, repeat = 1) {
  const t = new THREE.CanvasTexture(c);
  if (color) t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat, repeat);
  t.anisotropy = 4;
  return t;
}

/** Fine random speckle, softened, for bump maps (frosting, stone, sugar). */
function noiseCanvas(size: number, dots: number, min: number, max: number, blur: number) {
  const [c, g] = canvas(size);
  g.fillStyle = "#808080";
  g.fillRect(0, 0, size, size);
  for (let i = 0; i < dots; i++) {
    const v = Math.round(rnd(min, max));
    g.fillStyle = `rgb(${v},${v},${v})`;
    const r = rnd(0.6, 2.6);
    g.beginPath();
    g.arc(rnd(0, size), rnd(0, size), r, 0, Math.PI * 2);
    g.fill();
  }
  if (!blur) return c;
  const [c2, g2] = canvas(size);
  g2.filter = `blur(${blur}px)`;
  g2.drawImage(c, 0, 0);
  return c2;
}

function woodCanvas() {
  const [c, g] = canvas(512);
  g.fillStyle = "#b8773d";
  g.fillRect(0, 0, 512, 512);
  // Long grain running up the dreidel, gently wavy, darker and lighter streaks.
  for (let i = 0; i < 90; i++) {
    const x0 = rnd(0, 512);
    const amp = rnd(4, 16);
    const freq = rnd(0.006, 0.02);
    const dark = Math.random() < 0.7;
    g.strokeStyle = dark ? `rgba(92,48,18,${rnd(0.15, 0.45)})` : `rgba(230,170,105,${rnd(0.12, 0.3)})`;
    g.lineWidth = rnd(0.8, 3.5);
    g.beginPath();
    for (let y = 0; y <= 512; y += 8) {
      const x = x0 + Math.sin(y * freq + i) * amp;
      if (y === 0) g.moveTo(x, y);
      else g.lineTo(x, y);
    }
    g.stroke();
  }
  // A couple of knots.
  for (let k = 0; k < 2; k++) {
    const x = rnd(80, 430);
    const y = rnd(80, 430);
    for (let r = 26; r > 2; r -= 4) {
      g.strokeStyle = `rgba(80,40,14,${0.18 + (26 - r) / 80})`;
      g.lineWidth = 1.6;
      g.beginPath();
      g.ellipse(x, y, r * 0.6, r, 0, 0, Math.PI * 2);
      g.stroke();
    }
  }
  return c;
}

function marbleCanvas() {
  const [c, g] = canvas(512);
  g.fillStyle = "#f4f5f8";
  g.fillRect(0, 0, 512, 512);
  // Soft cloudy patches, then branching veins of blue and gray.
  for (let i = 0; i < 40; i++) {
    g.fillStyle = `rgba(200,210,230,${rnd(0.05, 0.14)})`;
    g.beginPath();
    g.ellipse(rnd(0, 512), rnd(0, 512), rnd(30, 110), rnd(20, 70), rnd(0, 3), 0, Math.PI * 2);
    g.fill();
  }
  const vein = (x: number, y: number, w: number, depth: number) => {
    let a = rnd(-0.6, 0.6) + Math.PI / 2;
    g.strokeStyle = `rgba(${Math.round(rnd(20, 60))},${Math.round(rnd(70, 110))},${Math.round(rnd(170, 220))},${rnd(0.55, 0.95)})`;
    g.lineWidth = w;
    g.beginPath();
    g.moveTo(x, y);
    for (let s = 0; s < 70; s++) {
      a += rnd(-0.35, 0.35);
      x += Math.cos(a) * 7;
      y += Math.sin(a) * 7;
      g.lineTo(x, y);
      if (depth > 0 && Math.random() < 0.04) {
        g.stroke();
        vein(x, y, w * 0.55, depth - 1);
        g.beginPath();
        g.moveTo(x, y);
      }
    }
    g.stroke();
  };
  g.filter = "blur(0.6px)";
  for (let i = 0; i < 10; i++) vein(rnd(0, 512), rnd(-60, 200), rnd(3, 9), 2);
  return c;
}

function stoneCanvas() {
  const [c, g] = canvas(512);
  g.fillStyle = "#8a8580";
  g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 9000; i++) {
    const v = Math.round(rnd(70, 175));
    g.fillStyle = `rgba(${v},${v - 4},${v - 9},${rnd(0.3, 0.9)})`;
    g.fillRect(rnd(0, 512), rnd(0, 512), rnd(1, 4), rnd(1, 4));
  }
  // A few darker pits.
  for (let i = 0; i < 140; i++) {
    g.fillStyle = `rgba(40,38,36,${rnd(0.2, 0.55)})`;
    g.beginPath();
    g.arc(rnd(0, 512), rnd(0, 512), rnd(1, 4.5), 0, Math.PI * 2);
    g.fill();
  }
  return c;
}

function spongeCanvas() {
  const [c, g] = canvas(512);
  g.fillStyle = "#f2d39a";
  g.fillRect(0, 0, 512, 512);
  // Baked crumb: soft lighter and darker patches, then little air pockets.
  for (let i = 0; i < 400; i++) {
    g.fillStyle = Math.random() < 0.5 ? `rgba(255,236,190,${rnd(0.15, 0.4)})` : `rgba(214,160,90,${rnd(0.1, 0.3)})`;
    g.beginPath();
    g.arc(rnd(0, 512), rnd(0, 512), rnd(4, 18), 0, Math.PI * 2);
    g.fill();
  }
  for (let i = 0; i < 1500; i++) {
    g.fillStyle = `rgba(170,115,55,${rnd(0.25, 0.6)})`;
    g.beginPath();
    g.ellipse(rnd(0, 512), rnd(0, 512), rnd(1, 3.2), rnd(0.8, 2.2), rnd(0, 3), 0, Math.PI * 2);
    g.fill();
  }
  return c;
}

/** Bump from a color canvas: darker spots become hollows. */
function grayOf(src: HTMLCanvasElement, blur = 1) {
  const [c, g] = canvas(src.width);
  g.filter = `grayscale(1) blur(${blur}px)`;
  g.drawImage(src, 0, 0);
  return c;
}

// ---- The letters on each side ----
interface LetterStyle {
  /** The letter's color. */
  ink: string;
  /** An enamel panel behind the letter (the letter is then gold metal). */
  panel?: string;
  /** Letters cut into the surface instead of raised. */
  carved?: boolean;
  metal?: boolean;
  rough: number;
}

const STYLES: Record<DreidelDesign, LetterStyle> = {
  gold: { ink: "#1c3aa8", rough: 0.15 },
  wood: { ink: "#1f3d9c", rough: 0.55 },
  plastic: { ink: "#ffffff", rough: 0.3 },
  glass: { ink: "#f4f8ff", rough: 0.25 },
  frosted: { ink: "#1f3fb0", rough: 0.35 },
  food: { ink: "#4a2410", rough: 0.35 },
  candy: { ink: "#1d3fc4", rough: 0.4 },
  marble: { ink: "#d4a640", metal: true, rough: 0.2 },
  stone: { ink: "#3a3734", carved: true, rough: 0.9 },
  silver: { ink: "#1c3aa8", rough: 0.15 },
  "gold-blue": { ink: "#e2b04a", panel: "#1d3fb0", metal: true, rough: 0.15 },
  "gold-red": { ink: "#e2b04a", panel: "#b3161c", metal: true, rough: 0.15 },
  "gold-green": { ink: "#e2b04a", panel: "#11804a", metal: true, rough: 0.15 },
};

const FONT = '700 380px "David Libre", "David", "Frank Ruhl Libre", "Times New Roman", serif';

/** A shield-shaped panel, like the inset on the reference dreidels. */
function panelPath(g: CanvasRenderingContext2D) {
  g.beginPath();
  g.moveTo(70, 52);
  g.lineTo(442, 52);
  g.quadraticCurveTo(462, 52, 462, 72);
  g.lineTo(462, 380);
  g.quadraticCurveTo(462, 412, 430, 432);
  g.lineTo(276, 470);
  g.quadraticCurveTo(256, 476, 236, 470);
  g.lineTo(82, 432);
  g.quadraticCurveTo(50, 412, 50, 380);
  g.lineTo(50, 72);
  g.quadraticCurveTo(50, 52, 70, 52);
  g.closePath();
}

function letterMaps(letter: string, style: LetterStyle) {
  const [col, g] = canvas(512);
  const [bump, b] = canvas(512);
  const [metal, m] = canvas(512);
  b.fillStyle = "#808080";
  b.fillRect(0, 0, 512, 512);
  m.fillStyle = style.metal && !style.panel ? "#ffffff" : "#000000";
  m.fillRect(0, 0, 512, 512);
  if (style.panel) {
    panelPath(g);
    g.fillStyle = style.panel;
    g.fill();
    // The panel is set slightly into the surface, with a gold rim.
    g.lineWidth = 14;
    g.strokeStyle = "#e2b04a";
    g.stroke();
    panelPath(b);
    b.fillStyle = "#6a6a6a";
    b.fill();
    panelPath(m);
    m.lineWidth = 14;
    m.strokeStyle = "#ffffff";
    m.stroke();
  }
  const draw = (ctx: CanvasRenderingContext2D, fill: string, dx = 0, dy = 0) => {
    ctx.font = FONT;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = fill;
    ctx.fillText(letter, 256 + dx, 250 + dy);
  };
  if (style.carved) {
    // Cut in: a darker letter with a lighter lower edge.
    draw(g, "rgba(255,255,255,0.18)", 0, 4);
    draw(g, style.ink);
    b.filter = "blur(2px)";
    draw(b, "#202020");
  } else {
    // Raised: a soft shadow under the letter, the letter, and a light top edge.
    g.filter = "blur(5px)";
    draw(g, "rgba(0,0,0,0.35)", 3, 6);
    g.filter = "none";
    draw(g, style.ink);
    b.filter = "blur(3px)";
    draw(b, "#ffffff");
    if (style.metal) draw(m, "#ffffff");
  }
  return { col, bump, metal };
}

// ---- Shared shapes ----
interface Shapes {
  body: T.BufferGeometry;
  point: T.BufferGeometry;
  handle: T.BufferGeometry;
  face: T.BufferGeometry;
}
let shapes: Shapes | null = null;
async function getShapes(THREE: Three): Promise<Shapes> {
  if (shapes) return shapes;
  const { RoundedBoxGeometry } = await import("three/examples/jsm/geometries/RoundedBoxGeometry.js");
  const body = new RoundedBoxGeometry(1, BODY_H, 1, 4, 0.075);
  body.translate(0, POINT_H + BODY_H / 2, 0);
  // Four flat sides to a slightly rounded tip, lined up with the body's sides.
  const cone = new THREE.ConeGeometry(0.5 * Math.SQRT2 * 0.97, POINT_H, 4, 1);
  cone.rotateY(Math.PI / 4);
  cone.rotateX(Math.PI);
  cone.translate(0, POINT_H / 2 + 0.01, 0);
  const point = cone.toNonIndexed();
  point.computeVertexNormals();
  cone.dispose();
  // The handle: the same width from bottom to top, with a gently rounded end.
  const prof: [number, number][] = [[0, 0]];
  prof.push([HANDLE_R, 0], [HANDLE_R, HANDLE_H - HANDLE_R * 0.5]);
  for (let i = 1; i <= 6; i++) {
    const a = (i / 6) * (Math.PI / 2);
    prof.push([HANDLE_R * Math.cos(a), HANDLE_H - HANDLE_R * 0.5 + HANDLE_R * 0.5 * Math.sin(a)]);
  }
  const handle = new THREE.LatheGeometry(prof.map(([r, y]) => new THREE.Vector2(r, y)), 32);
  handle.translate(0, POINT_H + BODY_H - 0.01, 0);
  const face = new THREE.PlaneGeometry(0.86, 0.86);
  shapes = { body, point, handle, face };
  return shapes;
}

export interface DreidelModel {
  /** Leans around the tip. */
  root: T.Group;
  /** Spins around the dreidel's own axis. */
  spinner: T.Group;
  dispose(): void;
}

/** Build one dreidel in a design. */
export async function buildDreidel(THREE: Three, design: DreidelDesign): Promise<DreidelModel> {
  const { body, point, handle, face } = await getShapes(THREE);
  await document.fonts?.load(FONT).catch(() => {});
  const root = new THREE.Group();
  const spinner = new THREE.Group();
  root.add(spinner);
  const own: { dispose(): void }[] = [];
  const keep = <X extends { dispose(): void }>(x: X) => (own.push(x), x);
  const mesh = (geo: T.BufferGeometry, mat: T.Material) => {
    const m = new THREE.Mesh(geo, mat);
    spinner.add(m);
    return m;
  };

  // ---- The body's material for each design ----
  let main: T.Material;
  let handleMat: T.Material | null = null;
  let offset = 0.004;
  const phys = (p: T.MeshPhysicalMaterialParameters) => keep(new THREE.MeshPhysicalMaterial(p));
  const gold = { color: new THREE.Color("#e6b24a"), metalness: 1, roughness: 0.2, envMapIntensity: 1.3, clearcoat: 0.3 };
  switch (design) {
    case "gold":
    case "gold-blue":
    case "gold-red":
    case "gold-green":
      main = phys({ ...gold, bumpMap: keep(tex(THREE, noiseCanvas(256, 1800, 110, 150, 1), false, 2)), bumpScale: 0.3 });
      break;
    case "silver":
      main = phys({ color: new THREE.Color("#e4e6ea"), metalness: 1, roughness: 0.17, envMapIntensity: 1.3, clearcoat: 0.3 });
      break;
    case "wood": {
      const c = woodCanvas();
      main = phys({ map: keep(tex(THREE, c)), bumpMap: keep(tex(THREE, grayOf(c), false)), bumpScale: 1.4, roughness: 0.72, metalness: 0 });
      break;
    }
    case "plastic":
      main = phys({ color: new THREE.Color("#1d5be6"), roughness: 0.28, metalness: 0, clearcoat: 0.9, clearcoatRoughness: 0.12 });
      break;
    case "glass":
      main = phys({ color: new THREE.Color("#cfe6ff"), roughness: 0.02, metalness: 0.1, transparent: true, opacity: 0.22, clearcoat: 1, clearcoatRoughness: 0, envMapIntensity: 3, side: THREE.DoubleSide, depthWrite: false, specularIntensity: 1, iridescence: 0.15 });
      break;
    case "frosted":
      main = phys({
        color: new THREE.Color("#eef2fb"),
        roughness: 0.6,
        metalness: 0,
        transparent: true,
        opacity: 0.62,
        side: THREE.DoubleSide,
        envMapIntensity: 1.2,
        bumpMap: keep(tex(THREE, noiseCanvas(256, 4000, 90, 170, 0.8), false, 3)),
        bumpScale: 0.6,
      });
      break;
    case "marble": {
      const c = marbleCanvas();
      main = phys({ map: keep(tex(THREE, c)), roughness: 0.12, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.08 });
      break;
    }
    case "stone": {
      const c = stoneCanvas();
      main = phys({ map: keep(tex(THREE, c)), bumpMap: keep(tex(THREE, grayOf(c, 0.8), false)), bumpScale: 3, roughness: 0.95, metalness: 0 });
      break;
    }
    case "food": {
      const c = spongeCanvas();
      main = phys({ map: keep(tex(THREE, c)), bumpMap: keep(tex(THREE, grayOf(c, 0.6), false)), bumpScale: 2.2, roughness: 0.85, metalness: 0, sheen: 0.4, sheenColor: new THREE.Color("#fff1c8") });
      break;
    }
    case "candy":
      main = phys({ color: new THREE.Color("#f3d27a"), roughness: 0.7, metalness: 0 });
      offset = 0.07;
      break;
  }
  const bodyMesh = mesh(body, main);
  // The point faces down, toward the bright floor of the light setup; tone its reflections down so it
  // matches the body.
  const pointMat = keep(main.clone()) as T.MeshPhysicalMaterial;
  pointMat.envMapIntensity = (pointMat.envMapIntensity ?? 1) * 0.5;
  if (pointMat.metalness > 0.5) pointMat.color.multiplyScalar(0.85);
  const pointMesh = mesh(point, pointMat);
  mesh(handle, handleMat ?? main);
  if (design === "glass") {
    // Glass shows its back faces through the front; draw them first.
    bodyMesh.renderOrder = pointMesh.renderOrder = 1;
  }

  // ---- Extra pieces for the food and candy designs ----
  if (design === "food") {
    const choc = phys({ color: new THREE.Color("#4a2410"), roughness: 0.28, metalness: 0, clearcoat: 0.7, clearcoatRoughness: 0.2 });
    const { RoundedBoxGeometry } = await import("three/examples/jsm/geometries/RoundedBoxGeometry.js");
    // A chocolate glaze over the top, with drips running down each side.
    const cap = keep(new RoundedBoxGeometry(1.04, 0.13, 1.04, 4, 0.05));
    cap.translate(0, POINT_H + BODY_H - 0.04, 0);
    mesh(cap, choc);
    const drip = keep(new THREE.CapsuleGeometry(0.035, 1, 4, 10));
    for (let s = 0; s < 4; s++) {
      for (let k = 0; k < 4; k++) {
        const len = rnd(0.06, 0.2);
        const along = -0.38 + k * 0.25 + rnd(-0.05, 0.05);
        const d = new THREE.Mesh(drip, choc);
        d.scale.set(1, len, 0.8);
        const y = POINT_H + BODY_H - 0.08 - len / 2;
        const a = FACE_ANGLES[s];
        d.position.set(Math.sin(a) * 0.512 + Math.cos(a) * along, y, Math.cos(a) * 0.512 - Math.sin(a) * along);
        spinner.add(d);
      }
    }
    handleMat = choc;
    (spinner.children[2] as T.Mesh).material = choc;
    // Sprinkles on the glaze and the handle.
    const sprinkle = keep(new THREE.CapsuleGeometry(0.012, 0.045, 2, 6));
    const n = 140;
    const sprinkles = new THREE.InstancedMesh(sprinkle, phys({ roughness: 0.4, metalness: 0 }), n);
    const colors = ["#ff4d6d", "#ffd23f", "#3bceac", "#4d8bff", "#ffffff", "#ff8c42", "#b46cff"];
    const mtx = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    for (let i = 0; i < n; i++) {
      let p: T.Vector3;
      if (i < 100) {
        // On top, around the handle.
        let x = 0;
        let z = 0;
        do {
          x = rnd(-0.48, 0.48);
          z = rnd(-0.48, 0.48);
        } while (Math.hypot(x, z) < HANDLE_R + 0.03);
        p = new THREE.Vector3(x, POINT_H + BODY_H + 0.03, z);
        q.setFromEuler(new THREE.Euler(Math.PI / 2, 0, rnd(0, Math.PI * 2)));
      } else {
        const a = rnd(0, Math.PI * 2);
        p = new THREE.Vector3(Math.cos(a) * (HANDLE_R + 0.008), POINT_H + BODY_H + rnd(0.04, HANDLE_H - 0.06), Math.sin(a) * (HANDLE_R + 0.008));
        q.setFromEuler(new THREE.Euler(rnd(0, 3), a, rnd(0, 3)));
      }
      mtx.compose(p, q, new THREE.Vector3(1, 1, 1));
      sprinkles.setMatrixAt(i, mtx);
      sprinkles.setColorAt(i, new THREE.Color(colors[i % colors.length]));
    }
    spinner.add(sprinkles);
  }
  if (design === "candy") {
    // Hundreds of little sugar-coated pieces in bright fruit colors, packed over the whole dreidel.
    const piece = keep(new THREE.IcosahedronGeometry(0.036, 0));
    const sugar = keep(tex(THREE, noiseCanvas(128, 900, 60, 200, 0.4), false, 2));
    const mat = phys({ roughness: 0.45, metalness: 0, bumpMap: sugar, bumpScale: 1.2, clearcoat: 0.5, clearcoatRoughness: 0.5 });
    const colors = ["#e8120c", "#ff6a00", "#ffc400", "#2fb50f", "#0a7bff", "#6a1fe0", "#ff1f8f", "#ff3d00"];
    const spots: { p: T.Vector3; n: T.Vector3 }[] = [];
    const add = (p: T.Vector3, n: T.Vector3) => spots.push({ p, n });
    const step = 0.06;
    // Four sides.
    for (let s = 0; s < 4; s++) {
      const a = FACE_ANGLES[s];
      const n = new THREE.Vector3(Math.sin(a), 0, Math.cos(a));
      const side = new THREE.Vector3(Math.cos(a), 0, -Math.sin(a));
      for (let u = -0.47; u <= 0.47; u += step)
        for (let v = POINT_H + 0.03; v <= POINT_H + BODY_H - 0.03; v += step) add(n.clone().multiplyScalar(0.5).addScaledVector(side, u + rnd(-0.015, 0.015)).setY(v + rnd(-0.015, 0.015)), n);
    }
    // Top, around the handle.
    for (let x = -0.47; x <= 0.47; x += step)
      for (let z = -0.47; z <= 0.47; z += step) if (Math.hypot(x, z) > HANDLE_R + 0.04) add(new THREE.Vector3(x + rnd(-0.015, 0.015), POINT_H + BODY_H, z + rnd(-0.015, 0.015)), new THREE.Vector3(0, 1, 0));
    // The point's four sides.
    for (let s = 0; s < 4; s++) {
      const a = FACE_ANGLES[s];
      const out = new THREE.Vector3(Math.sin(a), 0, Math.cos(a));
      const side = new THREE.Vector3(Math.cos(a), 0, -Math.sin(a));
      const n = out.clone().multiplyScalar(POINT_H).setY(-0.5).normalize();
      for (let h = 0.05; h <= POINT_H; h += step * 0.85) {
        const half = 0.5 * (h / POINT_H);
        for (let u = -half; u <= half; u += step) add(out.clone().multiplyScalar(half).addScaledVector(side, u).setY(h), n);
      }
    }
    // The handle.
    for (let y = 0.03; y < HANDLE_H; y += step * 0.8)
      for (let a = 0; a < Math.PI * 2; a += step / HANDLE_R) {
        const n = new THREE.Vector3(Math.cos(a), 0, Math.sin(a));
        add(n.clone().multiplyScalar(HANDLE_R).setY(POINT_H + BODY_H + y), n);
      }
    const pieces = new THREE.InstancedMesh(piece, mat, spots.length);
    const mtx = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    spots.forEach(({ p, n }, i) => {
      q.setFromEuler(new THREE.Euler(rnd(0, 6.3), rnd(0, 6.3), rnd(0, 6.3)));
      const s = rnd(0.75, 1.25);
      mtx.compose(p.clone().addScaledVector(n, 0.015), q, new THREE.Vector3(s, s * rnd(0.7, 1), s));
      pieces.setMatrixAt(i, mtx);
      pieces.setColorAt(i, new THREE.Color(colors[Math.floor(Math.random() * colors.length)]));
    });
    spinner.add(pieces);
  }

  // ---- The four letters ----
  const style = STYLES[design];
  LETTERS.forEach((l, i) => {
    const maps = letterMaps(l.he, style);
    const mat = phys({
      map: keep(tex(THREE, maps.col)),
      bumpMap: keep(tex(THREE, maps.bump, false)),
      bumpScale: style.carved ? 4 : 3,
      metalness: 1,
      metalnessMap: keep(tex(THREE, maps.metal, false)),
      roughness: style.rough,
      transparent: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      clearcoat: style.panel ? 1 : 0.4,
    });
    const a = FACE_ANGLES[i];
    const plane = new THREE.Mesh(face, mat);
    const r = 0.5 + offset;
    plane.position.set(Math.sin(a) * r, POINT_H + BODY_H / 2 + 0.02, Math.cos(a) * r);
    plane.rotation.y = a;
    plane.renderOrder = 2;
    spinner.add(plane);
  });

  return {
    root,
    spinner,
    dispose() {
      own.forEach((x) => x.dispose());
    },
  };
}

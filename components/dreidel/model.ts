import type * as T from "three";
import { LETTERS, parseDesign, type DreidelBase, type DreidelDesign } from "@/lib/dreidel";

/**
 * The 3D dreidel. One master shape for every design, built as a single solid piece: a square body
 * with softly rounded corners whose lower part narrows smoothly into a four-sided point (no
 * separate cone, no seam), and a straight round handle the same width all the way up (no knob).
 * The tip sits at the origin, so it leans and spins around the tip. Sides, in order: נ front,
 * ג right, ה back, ש left.
 *
 * Materials are built on the phone. Wood, marble, stone, crumb and metal patterns are worked out
 * in 3D from each point's position, so the grain and veins run continuously around the corners,
 * down the point and up the handle, with matching surface relief. Glass lets the light through and
 * bends it. The candy and food dreidels are covered in thousands of separate little pieces, and
 * their letters are made of contrasting pieces.
 */
type Three = typeof import("three");

// Sizes, with the body 1 wide (about 38mm).
export const POINT_H = 0.56;
export const BODY_H = 0.96;
export const HANDLE_H = 0.44;
export const HANDLE_R = 0.085;
const TOPB = POINT_H + BODY_H;
export const TOP = TOPB + HANDLE_H;
/** Each side's direction around the dreidel (radians), in the order of LETTERS. */
export const FACE_ANGLES = [0, Math.PI / 2, Math.PI, -Math.PI / 2];
/** Where the letters sit on each side. */
const LETTER_Y = POINT_H + BODY_H / 2 + 0.02;
const LETTER_SIZE = 0.86;

const rnd = (a: number, b: number) => a + Math.random() * (b - a);

// ---- The master shape ----
const TOP_ROUND = 0.07; // rounding of the top edge
const SHOULDER = 0.07; // how softly the sides turn into the point

function smin(a: number, b: number, k: number) {
  const h = Math.max(0, Math.min(1, 0.5 + (0.5 * (b - a)) / k));
  return b + (a - b) * h - k * h * (1 - h);
}
/** Half the width of the dreidel at height y (from the tip up to the top edge). */
function halfAt(y: number) {
  if (y > TOPB - TOP_ROUND) {
    const d = y - (TOPB - TOP_ROUND);
    return 0.5 - TOP_ROUND + Math.sqrt(Math.max(0, TOP_ROUND * TOP_ROUND - d * d));
  }
  return smin(0.5, (0.5 * y) / POINT_H, SHOULDER);
}
const cornerAt = (h: number) => Math.min(0.07, h * 0.35);

/** A point on a rounded square (half-size h, corner radius c), `t` from 0 to 1 around it. */
function onRoundedSquare(h: number, c: number, t: number) {
  const s = 2 * (h - c);
  const arc = (Math.PI / 2) * c;
  const quarter = s + arc;
  let d = (((t % 1) + 1) % 1) * quarter * 4;
  const q = Math.min(3, Math.floor(d / quarter));
  d -= q * quarter;
  const phi = (q * Math.PI) / 2;
  const n = [Math.cos(phi), Math.sin(phi)];
  const tg = [-Math.sin(phi), Math.cos(phi)];
  if (d < s) {
    const k = -(h - c) + d;
    return { x: n[0] * h + tg[0] * k, z: n[1] * h + tg[1] * k, nx: n[0], nz: n[1] };
  }
  const a = phi + (d - s) / c;
  const cx = n[0] * (h - c) + tg[0] * (h - c);
  const cz = n[1] * (h - c) + tg[1] * (h - c);
  return { x: cx + Math.cos(a) * c, z: cz + Math.sin(a) * c, nx: Math.cos(a), nz: Math.sin(a) };
}

function bodyGeometry(THREE: Three) {
  const M = 4 * (8 + 8); // points around each ring
  const ys = new Set<number>();
  for (let i = 0; i <= 70; i++) ys.add(+(0.006 + ((TOPB - TOP_ROUND - 0.006) * i) / 70).toFixed(5));
  for (let y = POINT_H - 0.16; y <= POINT_H + 0.06; y += 0.008) ys.add(+y.toFixed(5));
  for (let i = 1; i <= 10; i++) ys.add(+(TOPB - TOP_ROUND + TOP_ROUND * Math.sin((i / 10) * (Math.PI / 2))).toFixed(5));
  const rings = [...ys].sort((a, b) => a - b);
  const pos: number[] = [];
  const uv: number[] = [];
  // The tip.
  pos.push(0, 0, 0);
  uv.push(0.5, 0);
  for (const y of rings) {
    const h = halfAt(y);
    const c = cornerAt(h);
    const s = 2 * (h - c);
    const arc = (Math.PI / 2) * c;
    // Points around the ring: 8 along each straight side, then 8 around each corner.
    for (let j = 0; j < M; j++) {
      // Within each quarter: straight part first (8 points), then the corner (8 points).
      const q = Math.floor(j / 16);
      const k = j % 16;
      const frac = k < 8 ? ((k / 8) * s) / (s + arc) : (s + ((k - 8) / 8) * arc) / (s + arc);
      const p = onRoundedSquare(h, c, (q + frac) / 4);
      pos.push(p.x, y, p.z);
      uv.push(j / M, y / TOP);
    }
  }
  // The middle of the top.
  pos.push(0, TOPB, 0);
  uv.push(0.5, TOPB / TOP);
  const R = rings.length;
  const ring = (r: number, j: number) => 1 + r * M + (((j % M) + M) % M);
  const idx: number[] = [];
  const tri = (a: number, b: number, c: number) => idx.push(a, b, c);
  for (let j = 0; j < M; j++) tri(0, ring(0, j + 1), ring(0, j));
  for (let r = 0; r < R - 1; r++)
    for (let j = 0; j < M; j++) {
      tri(ring(r, j), ring(r, j + 1), ring(r + 1, j));
      tri(ring(r + 1, j), ring(r, j + 1), ring(r + 1, j + 1));
    }
  const top = 1 + R * M;
  for (let j = 0; j < M; j++) tri(top, ring(R - 1, j), ring(R - 1, j + 1));
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  // Make sure the faces point outward (check a point on the front side).
  const nrm = geo.attributes.normal;
  const test = ring(Math.floor(R * 0.75), 4);
  if (nrm.getX(test) * pos[test * 3] + nrm.getZ(test) * pos[test * 3 + 2] < 0) {
    for (let i = 0; i < idx.length; i += 3) [idx[i + 1], idx[i + 2]] = [idx[i + 2], idx[i + 1]];
    geo.setIndex(idx);
    geo.computeVertexNormals();
  }
  return geo;
}

function handleGeometry(THREE: Three) {
  // Straight, the same width all the way, a tiny fillet where it meets the top, a softly rounded end.
  const r = HANDLE_R;
  const prof: [number, number][] = [
    [0, -0.02],
    [r + 0.035, -0.02],
    [r + 0.02, 0.004],
    [r + 0.008, 0.016],
    [r, 0.032],
    [r, HANDLE_H - r * 0.45],
  ];
  for (let i = 1; i <= 8; i++) {
    const a = (i / 8) * (Math.PI / 2);
    prof.push([r * Math.cos(a), HANDLE_H - r * 0.45 + r * 0.45 * Math.sin(a)]);
  }
  const geo = new THREE.LatheGeometry(prof.map(([x, y]) => new THREE.Vector2(x, y)), 40);
  geo.translate(0, TOPB, 0);
  return geo;
}

interface Shapes {
  body: T.BufferGeometry;
  handle: T.BufferGeometry;
  face: T.BufferGeometry;
}
let shapes: Shapes | null = null;
function getShapes(THREE: Three): Shapes {
  shapes ??= { body: bodyGeometry(THREE), handle: handleGeometry(THREE), face: new THREE.PlaneGeometry(LETTER_SIZE, LETTER_SIZE) };
  return shapes;
}

// ---- Materials worked out in 3D (the pattern follows the shape everywhere) ----
type Pattern = "wood" | "marble" | "stone" | "metal" | "crumb" | "frost";

const NOISE = /* glsl */ `
varying vec3 vObj;
float dh3(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float dn3(vec3 x) {
  vec3 i = floor(x); vec3 f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(dh3(i), dh3(i + vec3(1,0,0)), f.x), mix(dh3(i + vec3(0,1,0)), dh3(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(dh3(i + vec3(0,0,1)), dh3(i + vec3(1,0,1)), f.x), mix(dh3(i + vec3(0,1,1)), dh3(i + vec3(1,1,1)), f.x), f.y), f.z);
}
float dfbm(vec3 p) { float v = 0.0, a = 0.5; for (int k = 0; k < 5; k++) { v += a * dn3(p); p = p * 2.03 + vec3(3.1, 1.7, 5.3); a *= 0.5; } return v; }
vec3 dPerturb(vec3 surf_pos, vec3 surf_norm, vec2 dHdxy, float faceDir) {
  vec3 sx = dFdx(surf_pos); vec3 sy = dFdy(surf_pos);
  vec3 r1 = cross(sy, surf_norm); vec3 r2 = cross(surf_norm, sx);
  float det = dot(sx, r1) * faceDir;
  vec3 grad = sign(det) * (dHdxy.x * r1 + dHdxy.y * r2);
  return normalize(abs(det) * surf_norm - grad);
}
`;

const PATTERNS: Record<Pattern, { color?: string; height: string; rough?: string }> = {
  // Plain-sawn wood: growth rings from a log far off to one side, so the grain runs up the sides and
  // shows end-grain rings on top; fine fibers and pores along the grain.
  wood: {
    color: `
      vec2 c = vec2(1.9, -2.6);
      float r = length(p.xz - c) * 8.5 + dfbm(p * vec3(2.5, 0.5, 2.5)) * 2.6;
      float ring = fract(r);
      float late = smoothstep(0.55, 0.95, ring);
      float fib = dn3(p * vec3(70.0, 5.0, 70.0));
      vec3 early = vec3(0.79, 0.52, 0.29);
      vec3 lateC = vec3(0.47, 0.25, 0.10);
      vec3 col = mix(early, lateC, late * 0.85);
      col *= 0.86 + 0.24 * fib;
      col *= 0.9 + 0.2 * dfbm(p * 4.0);
      return col;`,
    height: `
      vec2 c = vec2(1.9, -2.6);
      float r = length(p.xz - c) * 8.5 + dfbm(p * vec3(2.5, 0.5, 2.5)) * 2.6;
      return smoothstep(0.55, 0.95, fract(r)) * 0.5 + dn3(p * vec3(70.0, 5.0, 70.0)) * 0.6;`,
    rough: `return 0.06 * (dn3(p * vec3(70.0, 5.0, 70.0)) - 0.5);`,
  },
  // Polished white marble with branching blue-gray veins and faint cloudy patches.
  marble: {
    color: `
      float t = p.x * 2.1 + p.y * 2.9 + p.z * 1.6 + dfbm(p * 2.2) * 5.5;
      float v1 = 1.0 - smoothstep(0.0, 0.07, abs(sin(t * 1.5)));
      float t2 = -p.x * 3.2 + p.y * 1.2 + p.z * 3.9 + dfbm(p * 3.6 + 7.0) * 4.5;
      float v2 = 1.0 - smoothstep(0.0, 0.035, abs(sin(t2 * 2.1)));
      vec3 base = mix(vec3(0.95, 0.955, 0.97), vec3(0.84, 0.86, 0.91), dfbm(p * 3.0));
      vec3 col = mix(base, vec3(0.22, 0.33, 0.60), v1 * 0.85);
      col = mix(col, vec3(0.52, 0.57, 0.68), v2 * 0.55);
      return col;`,
    height: `return dn3(p * 40.0) * 0.08;`,
  },
  // Natural stone: mottled gray with dark and light mineral grains and little pores.
  stone: {
    color: `
      float b = dfbm(p * 5.0);
      vec3 col = mix(vec3(0.40, 0.385, 0.37), vec3(0.68, 0.66, 0.62), b);
      col = mix(col, vec3(0.20, 0.19, 0.18), smoothstep(0.80, 0.95, dn3(p * 75.0)));
      col = mix(col, vec3(0.86, 0.84, 0.80), smoothstep(0.82, 0.97, dn3(p * 48.0 + 3.0)) * 0.7);
      return col;`,
    height: `return dfbm(p * 5.0) * 0.7 + dn3(p * 75.0) * 0.35 - smoothstep(0.74, 0.9, dn3(p * 26.0)) * 0.9;`,
    rough: `return 0.05 * (dn3(p * 30.0) - 0.5);`,
  },
  // Polished metal: a faint unevenness in the polish and the finest surface texture.
  metal: {
    height: `return dfbm(p * 7.0) * 0.5;`,
    rough: `return 0.06 * (dfbm(p * 12.0) - 0.5);`,
  },
  // The food dreidel underneath its pieces: toasted crumb.
  crumb: {
    color: `
      vec3 col = mix(vec3(0.58, 0.37, 0.18), vec3(0.86, 0.66, 0.40), dfbm(p * 14.0));
      return col;`,
    height: `return dfbm(p * 22.0);`,
  },
  // Frosted glass: a fine sandblasted surface.
  frost: {
    height: `return dn3(p * 160.0) * 0.5 + dn3(p * 60.0) * 0.3;`,
  },
};

function withPattern(mat: T.MeshPhysicalMaterial, kind: Pattern, bump: number) {
  const P = PATTERNS[kind];
  mat.customProgramCacheKey = () => `dreidel-${kind}-${bump}`;
  mat.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader.replace("#include <common>", "#include <common>\nvarying vec3 vObj;").replace("#include <begin_vertex>", "#include <begin_vertex>\nvObj = position;");
    let frag = sh.fragmentShader.replace(
      "#include <common>",
      `#include <common>
${NOISE}
${P.color ? `vec3 patC(vec3 p) { ${P.color} }` : ""}
float patH(vec3 p) { ${P.height} }
${P.rough ? `float patR(vec3 p) { ${P.rough} }` : ""}`,
    );
    if (P.color) frag = frag.replace("#include <color_fragment>", "#include <color_fragment>\ndiffuseColor.rgb = pow(patC(vObj), vec3(2.2));");
    if (P.rough) frag = frag.replace("#include <roughnessmap_fragment>", "#include <roughnessmap_fragment>\nroughnessFactor = clamp(roughnessFactor + patR(vObj), 0.02, 1.0);");
    frag = frag.replace(
      "#include <normal_fragment_maps>",
      `#include <normal_fragment_maps>
{ float hh = patH(vObj) * ${bump.toFixed(4)}; normal = dPerturb(-vViewPosition, normal, vec2(dFdx(hh), dFdy(hh)), faceDirection); }`,
    );
    sh.fragmentShader = frag;
  };
  return mat;
}

// ---- Letters ----
interface LetterStyle {
  /** The letter's color. */
  ink: string;
  /** An enamel panel behind the letter (the letter is then gold metal). */
  panel?: string;
  /** Cut into the surface instead of raised. */
  carved?: boolean;
  metal?: boolean;
  rough: number;
  opacity?: number;
}

const STYLES: Partial<Record<DreidelBase, LetterStyle>> = {
  // Blue enamel set into the gold, as on the reference dreidels.
  gold: { ink: "#1c3aa8", carved: true, rough: 0.12 },
  silver: { ink: "#1c3aa8", carved: true, rough: 0.12 },
  // Carved and darkened into the wood.
  wood: { ink: "#3a1d0a", carved: true, rough: 0.75, opacity: 0.88 },
  // Molded into the plastic, raised.
  plastic: { ink: "#ffffff", rough: 0.3 },
  // Etched into the glass: frosty white.
  glass: { ink: "#ffffff", carved: true, rough: 0.85, opacity: 0.7 },
  // On frosted glass, the letters are clear and polished, tinted blue.
  frosted: { ink: "#3b6fe0", carved: true, rough: 0.08, opacity: 0.8 },
  // Gold inlaid into the marble.
  marble: { ink: "#d4a640", metal: true, carved: true, rough: 0.2 },
  // Cut into the stone.
  stone: { ink: "#2f2c29", carved: true, rough: 0.95, opacity: 0.9 },
  // Gold letters on glossy enamel in a recessed panel (the panel color is the chosen color).
  enamel: { ink: "#e2b04a", panel: "#1d3fb0", metal: true, rough: 0.15 },
};

const FONT = '700 380px "David Libre", "David", "Frank Ruhl Libre", "Times New Roman", serif';

function canvas(size = 512) {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  return [c, c.getContext("2d")!] as const;
}

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

function drawLetter(ctx: CanvasRenderingContext2D, letter: string, fill: string, scale = 1, dx = 0, dy = 0) {
  ctx.font = FONT.replace("380px", `${Math.round(380 * scale)}px`);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = fill;
  ctx.fillText(letter, 256 * scale + dx, 250 * scale + dy);
}

function letterMaps(letter: string, style: LetterStyle) {
  const [col, g] = canvas();
  const [bump, b] = canvas();
  const [metal, m] = canvas();
  b.fillStyle = "#808080";
  b.fillRect(0, 0, 512, 512);
  m.fillStyle = style.metal && !style.panel ? "#ffffff" : "#000000";
  m.fillRect(0, 0, 512, 512);
  if (style.panel) {
    // Glossy enamel in a recessed panel, with a raised gold border.
    panelPath(g);
    g.fillStyle = style.panel;
    g.fill();
    g.lineWidth = 16;
    g.strokeStyle = "#e6b24a";
    g.stroke();
    panelPath(b);
    b.fillStyle = "#5a5a5a";
    b.fill();
    b.lineWidth = 16;
    b.strokeStyle = "#ffffff";
    b.stroke();
    panelPath(m);
    m.lineWidth = 16;
    m.strokeStyle = "#ffffff";
    m.stroke();
  }
  if (style.carved) {
    // Cut in: a light lower lip and a shadowed upper edge, then the letter.
    g.filter = "blur(2px)";
    drawLetter(g, letter, "rgba(0,0,0,0.45)", 1, 0, -3);
    drawLetter(g, letter, "rgba(255,255,255,0.22)", 1, 0, 3);
    g.filter = "none";
    drawLetter(g, letter, style.ink);
    b.filter = "blur(2.5px)";
    drawLetter(b, letter, "#1a1a1a");
    if (style.metal) drawLetter(m, letter, "#ffffff");
  } else {
    // Raised: a soft shadow under the letter, the letter, and its rounded relief.
    g.filter = "blur(5px)";
    drawLetter(g, letter, "rgba(0,0,0,0.35)", 1, 3, 6);
    g.filter = "none";
    drawLetter(g, letter, style.ink);
    b.filter = "blur(3px)";
    drawLetter(b, letter, "#ffffff");
    if (style.metal) drawLetter(m, letter, "#ffffff");
  }
  return { col, bump, metal };
}

/** Where each letter is, as a yes/no grid, for the dreidels whose letters are made of pieces. */
function glyphMasks() {
  return LETTERS.map((l) => {
    const [, g] = canvas(256);
    drawLetter(g, l.he, "#fff", 0.5);
    const data = g.getImageData(0, 0, 256, 256).data;
    return (u: number, v: number) => {
      const x = Math.round((u / LETTER_SIZE + 0.5) * 255);
      const y = Math.round((0.5 - (v - LETTER_Y) / LETTER_SIZE) * 255);
      if (x < 0 || y < 0 || x > 255 || y > 255) return false;
      return data[(y * 256 + x) * 4 + 3] > 110;
    };
  });
}

// ---- Points spread evenly over the whole surface, for the candy and food pieces ----
interface Spot {
  p: T.Vector3;
  n: T.Vector3;
  /** On one of the four sides, inside its letter. */
  letter: boolean;
}

function surfaceSpots(THREE: Three, step: number): Spot[] {
  const masks = glyphMasks();
  const spots: Spot[] = [];
  const j = () => rnd(-step * 0.3, step * 0.3);
  // Around the body and down the point, ring by ring.
  for (let y = 0.012; y < TOPB - 0.01; y += step * 0.86) {
    const yy = y + j() * 0.5;
    const h = halfAt(yy);
    if (h < 0.01) continue;
    const c = cornerAt(h);
    const per = 8 * (h - c) + 2 * Math.PI * c;
    const n = Math.max(4, Math.round(per / step));
    const dh = (halfAt(yy + 0.002) - halfAt(yy - 0.002)) / 0.004;
    const shift = Math.random();
    for (let k = 0; k < n; k++) {
      const t = (k + shift + rnd(-0.3, 0.3)) / n;
      const q = onRoundedSquare(h, c, t);
      const p = new THREE.Vector3(q.x, yy, q.z);
      const nrm = new THREE.Vector3(q.nx, -dh, q.nz).normalize();
      // Which side it's on (if on a flat side), and whether it's inside that side's letter.
      let letter = false;
      if (Math.abs(yy - LETTER_Y) < LETTER_SIZE / 2) {
        for (let f = 0; f < 4; f++) {
          const a = FACE_ANGLES[f];
          const out = Math.sin(a) * q.nx + Math.cos(a) * q.nz;
          if (out > 0.98) {
            const u = Math.cos(a) * q.x - Math.sin(a) * q.z;
            letter = masks[f](u, yy);
          }
        }
      }
      spots.push({ p, n: nrm, letter });
    }
  }
  // The top, around the handle.
  const inner = 0.5 - TOP_ROUND;
  for (let x = -inner; x <= inner; x += step)
    for (let z = -inner; z <= inner; z += step) {
      const px = x + j();
      const pz = z + j();
      if (Math.hypot(px, pz) < HANDLE_R + 0.03 || Math.abs(px) > inner || Math.abs(pz) > inner) continue;
      spots.push({ p: new THREE.Vector3(px, TOPB, pz), n: new THREE.Vector3(0, 1, 0), letter: false });
    }
  // The handle.
  for (let y = 0.02; y < HANDLE_H - 0.02; y += step * 0.8) {
    const n = Math.round((2 * Math.PI * HANDLE_R) / (step * 0.85));
    const shift = Math.random();
    for (let k = 0; k < n; k++) {
      const a = ((k + shift) / n) * Math.PI * 2;
      const nrm = new THREE.Vector3(Math.cos(a), 0, Math.sin(a));
      spots.push({ p: nrm.clone().multiplyScalar(HANDLE_R).setY(TOPB + y), n: nrm, letter: false });
    }
  }
  // The very top of the handle.
  spots.push({ p: new THREE.Vector3(0, TOP - 0.01, 0), n: new THREE.Vector3(0, 1, 0), letter: false });
  return spots;
}

/** An irregular little lump: a low-poly ball with its corners pushed in and out. */
function lumpGeometry(THREE: Three, detail: number, amount: number) {
  const g = new THREE.IcosahedronGeometry(1, detail);
  const pos = g.attributes.position;
  const seen = new Map<string, number>();
  for (let i = 0; i < pos.count; i++) {
    const key = `${pos.getX(i).toFixed(3)},${pos.getY(i).toFixed(3)},${pos.getZ(i).toFixed(3)}`;
    if (!seen.has(key)) seen.set(key, 1 + rnd(-amount, amount));
    const k = seen.get(key)!;
    pos.setXYZ(i, pos.getX(i) * k, pos.getY(i) * k, pos.getZ(i) * k);
  }
  g.computeVertexNormals();
  return g;
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
  const { body, handle, face } = getShapes(THREE);
  const { base, color } = parseDesign(design);
  await document.fonts?.load(FONT).catch(() => {});
  const root = new THREE.Group();
  const spinner = new THREE.Group();
  root.add(spinner);
  const own: { dispose(): void }[] = [];
  const keep = <X extends { dispose(): void }>(x: X) => (own.push(x), x);
  const phys = (p: T.MeshPhysicalMaterialParameters) => keep(new THREE.MeshPhysicalMaterial(p));
  const add = (o: T.Object3D) => (spinner.add(o), o);

  // ---- The material of the dreidel itself ----
  let main: T.MeshPhysicalMaterial;
  switch (base.id) {
    case "gold":
    case "enamel":
      main = withPattern(phys({ color: new THREE.Color("#e7b44c"), metalness: 1, roughness: 0.17, envMapIntensity: 1.35, clearcoat: 0.25 }), "metal", 0.004);
      break;
    case "silver":
      main = withPattern(phys({ color: new THREE.Color("#eef0f3"), metalness: 1, roughness: 0.14, envMapIntensity: 1.5, clearcoat: 0.25 }), "metal", 0.004);
      break;
    case "wood":
      main = withPattern(phys({ roughness: 0.62, metalness: 0, clearcoat: 0.15, clearcoatRoughness: 0.5 }), "wood", 0.012);
      break;
    case "plastic":
      main = phys({ color: new THREE.Color(color?.hex ?? "#1a58e6"), roughness: 0.24, metalness: 0, clearcoat: 0.8, clearcoatRoughness: 0.1, specularIntensity: 0.8 });
      break;
    case "glass":
      main = phys({
        color: new THREE.Color("#ffffff"),
        metalness: 0,
        roughness: 0.02,
        transmission: 1,
        thickness: 0.9,
        ior: 1.5,
        attenuationColor: new THREE.Color("#d8ecff"),
        attenuationDistance: 3,
        specularIntensity: 1,
        specularColor: new THREE.Color("#ffffff"),
        clearcoat: 1,
        clearcoatRoughness: 0,
        envMapIntensity: 2.6,
        iridescence: 0.1,
      });
      break;
    case "frosted":
      main = withPattern(
        phys({ color: new THREE.Color("#e9edf8"), metalness: 0, roughness: 0.5, transmission: 0.55, thickness: 0.9, ior: 1.5, attenuationColor: new THREE.Color("#f0f4ff"), attenuationDistance: 1.2, envMapIntensity: 1.3, sheen: 0.5, sheenColor: new THREE.Color("#ffffff"), sheenRoughness: 0.6 }),
        "frost",
        0.004,
      );
      break;
    case "marble":
      main = withPattern(phys({ roughness: 0.09, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.05 }), "marble", 0.004);
      break;
    case "stone":
      main = withPattern(phys({ roughness: 0.92, metalness: 0 }), "stone", 0.02);
      break;
    case "food":
      main = withPattern(phys({ roughness: 0.85, metalness: 0 }), "crumb", 0.012);
      break;
    case "candy":
      main = phys({ color: new THREE.Color("#b07a3a"), roughness: 0.8, metalness: 0 });
      break;
  }
  add(new THREE.Mesh(body, main));
  add(new THREE.Mesh(handle, main));

  // ---- Candy: thousands of little sugar-coated pieces; the letters in contrasting blue pieces ----
  if (base.id === "candy") {
    const spots = surfaceSpots(THREE, 0.036);
    const piece = keep(lumpGeometry(THREE, 1, 0.22));
    const mat = withPattern(phys({ roughness: 0.5, metalness: 0, clearcoat: 0.6, clearcoatRoughness: 0.35 }), "frost", 0.0025);
    const pieces = new THREE.InstancedMesh(piece, mat, spots.length);
    const colors = ["#e8120c", "#ff6a00", "#ffc400", "#2fb50f", "#0aa7ff", "#6a1fe0", "#ff1f8f", "#ff3d00", "#9be000"];
    const letterCols = ["#0b2fb8", "#0a3ad6", "#1424a0"];
    const mtx = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    spots.forEach((s, i) => {
      q.setFromEuler(new THREE.Euler(rnd(0, 6.3), rnd(0, 6.3), rnd(0, 6.3)));
      const r = rnd(0.022, 0.03) * (s.letter ? 1.05 : 1);
      mtx.compose(s.p.clone().addScaledVector(s.n, s.letter ? 0.016 : 0.008), q, new THREE.Vector3(r, r * rnd(0.65, 0.9), r * rnd(0.85, 1.1)));
      pieces.setMatrixAt(i, mtx);
      const pick = s.letter ? letterCols : colors;
      pieces.setColorAt(i, new THREE.Color(pick[Math.floor(Math.random() * pick.length)]));
    });
    add(pieces);
  }

  // ---- Food: crumbs, sugar crystals, sprinkles and candy bits bonded together; chocolate letters ----
  if (base.id === "food") {
    const spots = surfaceSpots(THREE, 0.034);
    const kinds = [
      { geo: keep(lumpGeometry(THREE, 0, 0.35)), mat: phys({ roughness: 0.85, metalness: 0 }), share: 0.52 }, // cookie crumbs
      { geo: keep(new THREE.BoxGeometry(1, 1, 1)), mat: phys({ color: new THREE.Color("#fffaf0"), roughness: 0.15, metalness: 0, transmission: 0.4, thickness: 0.2, clearcoat: 1 }), share: 0.22 }, // sugar crystals
      { geo: keep(new THREE.CapsuleGeometry(0.35, 1.6, 2, 6)), mat: phys({ roughness: 0.4, metalness: 0, clearcoat: 0.6 }), share: 0.16 }, // sprinkles
      { geo: keep(new THREE.TetrahedronGeometry(1, 0)), mat: phys({ roughness: 0.3, metalness: 0, clearcoat: 0.8 }), share: 0.1 }, // candy bits
    ];
    const buckets: Spot[][] = kinds.map(() => []);
    const choc: Spot[] = [];
    for (const s of spots) {
      if (s.letter) {
        choc.push(s);
        continue;
      }
      let r = Math.random();
      let k = 0;
      while (k < kinds.length - 1 && r > kinds[k].share) r -= kinds[k++].share;
      buckets[k].push(s);
    }
    const mtx = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const crumbCols = ["#a8692e", "#c98c45", "#8a5220", "#d9a35e", "#b8783a"];
    const sprinkleCols = ["#ff4d6d", "#ffd23f", "#3bceac", "#4d8bff", "#ffffff", "#ff8c42", "#b46cff"];
    const bitCols = ["#e8120c", "#ffc400", "#2fb50f", "#0a7bff", "#ff1f8f"];
    kinds.forEach((kind, k) => {
      const list = buckets[k];
      if (!list.length) return;
      const inst = new THREE.InstancedMesh(kind.geo, kind.mat, list.length);
      list.forEach((s, i) => {
        q.setFromEuler(new THREE.Euler(rnd(0, 6.3), rnd(0, 6.3), rnd(0, 6.3)));
        const r = k === 0 ? rnd(0.02, 0.032) : k === 1 ? rnd(0.016, 0.024) : k === 2 ? rnd(0.012, 0.016) : rnd(0.018, 0.026);
        const scale = k === 2 ? new THREE.Vector3(r, r * 1.2, r) : new THREE.Vector3(r, r * rnd(0.6, 1), r * rnd(0.8, 1.1));
        mtx.compose(s.p.clone().addScaledVector(s.n, 0.008), q, scale);
        inst.setMatrixAt(i, mtx);
        const cols = k === 0 ? crumbCols : k === 1 ? ["#ffffff"] : k === 2 ? sprinkleCols : bitCols;
        inst.setColorAt(i, new THREE.Color(cols[Math.floor(Math.random() * cols.length)]));
      });
      add(inst);
    });
    // The letters: glossy chocolate pieces, a little raised.
    const chocInst = new THREE.InstancedMesh(keep(lumpGeometry(THREE, 1, 0.18)), phys({ color: new THREE.Color("#3d1d0b"), roughness: 0.25, metalness: 0, clearcoat: 0.8 }), choc.length);
    choc.forEach((s, i) => {
      q.setFromEuler(new THREE.Euler(rnd(0, 6.3), rnd(0, 6.3), rnd(0, 6.3)));
      const r = rnd(0.024, 0.03);
      mtx.compose(s.p.clone().addScaledVector(s.n, 0.016), q, new THREE.Vector3(r, r * 0.8, r));
      chocInst.setMatrixAt(i, mtx);
    });
    add(chocInst);
  }

  // ---- The four letters, in each material's own way ----
  const preset = STYLES[base.id];
  // Plastic letters are white, except on yellow plastic, where they're blue.
  const style = preset && base.id === "enamel" ? { ...preset, panel: color?.hex } : preset && base.id === "plastic" && color?.id === "yellow" ? { ...preset, ink: "#1d3fb0" } : preset;
  if (style) {
    LETTERS.forEach((l, i) => {
      const maps = letterMaps(l.he, style);
      const t = (c: HTMLCanvasElement, color: boolean) => {
        const x = keep(new THREE.CanvasTexture(c));
        if (color) x.colorSpace = THREE.SRGBColorSpace;
        x.anisotropy = 4;
        return x;
      };
      const mat = phys({
        map: t(maps.col, true),
        bumpMap: t(maps.bump, false),
        bumpScale: style.carved ? 4 : 3,
        metalness: 1,
        metalnessMap: t(maps.metal, false),
        roughness: style.rough,
        transparent: true,
        opacity: style.opacity ?? 1,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -2,
        clearcoat: style.panel ? 1 : 0.3,
      });
      const a = FACE_ANGLES[i];
      const plane = new THREE.Mesh(face, mat);
      plane.position.set(Math.sin(a) * 0.5015, LETTER_Y, Math.cos(a) * 0.5015);
      plane.rotation.y = a;
      plane.renderOrder = 2;
      add(plane);
    });
  }

  return {
    root,
    spinner,
    dispose() {
      own.forEach((x) => x.dispose());
    },
  };
}

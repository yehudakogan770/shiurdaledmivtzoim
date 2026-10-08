/**
 * Photos are made smaller on the phone before they're uploaded: about 1280 pixels on the long
 * side for the full photo and 480 for the preview on the scrolling wall. A 4 MB phone photo
 * becomes roughly 100 KB and still looks sharp on screen.
 */
import { t } from "@/lib/i18n";

const FULL = 1280;
const THUMB = 480;

export interface ShrunkPhoto {
  full: Blob;
  thumb: Blob;
  width: number;
  height: number;
  /** Its overall colour, "#rrggbb". */
  color: string;
  /** A preview to show before sending. */
  preview: string;
}

function loadImage(file: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => resolve(img); // browsers turn photos upright from their EXIF data
    img.onerror = () => reject(new Error(t("That file isn't a photo this phone can open.")));
    img.src = url;
  });
}

/** WebP where the browser can make it (smaller); otherwise JPEG. */
function encode(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (webp) => {
        if (webp && webp.type === "image/webp") return resolve(webp);
        canvas.toBlob((jpeg) => (jpeg ? resolve(jpeg) : reject(new Error(t("Couldn't prepare the photo.")))), "image/jpeg", quality + 0.04);
      },
      "image/webp",
      quality,
    );
  });
}

function draw(img: HTMLImageElement, max: number) {
  const scale = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas;
}

export async function shrinkPhoto(file: File): Promise<ShrunkPhoto> {
  const img = await loadImage(file);
  try {
    const big = draw(img, FULL);
    const small = draw(img, THUMB);
    const [full, thumb] = await Promise.all([encode(big, 0.8), encode(small, 0.74)]);
    return { full, thumb, width: big.width, height: big.height, color: colorOf(small), preview: URL.createObjectURL(thumb) };
  } finally {
    URL.revokeObjectURL(img.src);
  }
}

/**
 * A photo's overall colour: its average brightness, and the hue of its most colourful parts (so
 * a blue sky with grey pavement reads as blue, not grey).
 */
function colorOf(canvas: HTMLCanvasElement) {
  const tiny = document.createElement("canvas");
  tiny.width = tiny.height = 32;
  const ctx = tiny.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(canvas, 0, 0, 32, 32);
  const px = ctx.getImageData(0, 0, 32, 32).data;
  let light = 0, chroma = 0, x = 0, y = 0;
  const n = px.length / 4;
  for (let i = 0; i < px.length; i += 4) {
    const r = px[i] / 255, g = px[i + 1] / 255, b = px[i + 2] / 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b), c = max - min;
    light += 0.2126 * r + 0.7152 * g + 0.0722 * b;
    chroma += c;
    if (c > 0) {
      const h = max === r ? ((g - b) / c) % 6 : max === g ? (b - r) / c + 2 : (r - g) / c + 4;
      x += Math.cos((h * Math.PI) / 3) * c;
      y += Math.sin((h * Math.PI) / 3) * c;
    }
  }
  const hue = ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
  return hslToHex(hue, Math.min(1, (chroma / n) * 1.6), light / n);
}

function hslToHex(h: number, s: number, l: number) {
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => Math.round(255 * (l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1))));
  return "#" + [f(0), f(8), f(4)].map((v) => v.toString(16).padStart(2, "0")).join("");
}

function hexToHsl(hex: string) {
  const v = parseInt(hex.slice(1), 16);
  const r = (v >> 16) / 255, g = ((v >> 8) & 255) / 255, b = (v & 255) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), c = max - min, l = (max + min) / 2;
  const h = c === 0 ? 0 : max === r ? 60 * (((g - b) / c + 6) % 6) : max === g ? 60 * ((b - r) / c + 2) : 60 * ((r - g) / c + 4);
  return { h, s: c === 0 ? 0 : c / (1 - Math.abs(2 * l - 1)), l };
}

/** A number from a photo's id: sorting by it mixes everyone's photos in a fixed order. */
export function mix(id: string) {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619);
  return h >>> 0;
}

/**
 * Puts photos in a mixed-up but fixed order where neighbours set each other off: darker and
 * lighter photos take turns, and photos next to each other (and above and below, on the wall)
 * have different colours. Photos without a measured colour just go in their random spot.
 */
export function arrange<T extends { id: string; color?: string | null }>(list: T[]): T[] {
  const items = list.map((p) => ({ p, c: p.color && /^#[0-9a-f]{6}$/i.test(p.color) ? hexToHsl(p.color) : null, r: mix(p.id) })).sort((a, b) => a.r - b.r);
  type Item = (typeof items)[number];
  const measured = items.filter((i) => i.c).sort((a, b) => a.c!.l - b.c!.l);
  const middle = measured.length ? measured[Math.floor(measured.length / 2)].c!.l : 0.5;
  const dark = items.filter((i) => !i.c || i.c.l < middle);
  const light = items.filter((i) => i.c && i.c.l >= middle);
  // How well two photos set each other off: different brightness, and different colour (when both have colour).
  const apart = (a: Item, b: Item) => {
    if (!a.c || !b.c) return 0.5;
    const dh = Math.abs(a.c.h - b.c.h);
    return Math.abs(a.c.l - b.c.l) * 1.5 + (Math.min(dh, 360 - dh) / 180) * Math.min(a.c.s, b.c.s);
  };
  const out: Item[] = [];
  const startDark = (items[0]?.r ?? 0) % 2 === 0;
  while (dark.length || light.length) {
    const wantDark = (out.length % 2 === 0) === startDark;
    const group = (wantDark ? dark : light).length ? (wantDark ? dark : light) : wantDark ? light : dark;
    // Of the next few (still in random order), take the one that best stands apart from its neighbours.
    let best = 0, bestScore = -1;
    for (let i = 0; i < Math.min(6, group.length); i++) {
      const score = [1, 0.4, 0.8].reduce((s, w, back) => {
        const n = out[out.length - 1 - back];
        return n ? s + w * apart(group[i], n) : s;
      }, 0);
      if (score > bestScore + 0.02) [best, bestScore] = [i, score];
    }
    out.push(group.splice(best, 1)[0]);
  }
  return out.map((i) => i.p);
}

/**
 * Fits photos to the wall's pattern of big, tall and small spots: the most eye-catching photo
 * nearby goes in each big spot, and a photo taller than it is wide goes in each tall spot, so
 * nothing important is cut off. Only nearby photos swap, so the colour mix stays.
 */
export function fitToSpots<T extends { width: number; height: number; color?: string | null }>(list: T[], spots: string[]): T[] {
  const out = [...list];
  const shape = (p: T) => (p.width > 0 && p.height > 0 ? p.width / p.height : 1);
  const striking = (p: T) => {
    if (!p.color || !/^#[0-9a-f]{6}$/i.test(p.color)) return 0;
    const { s, l } = hexToHsl(p.color);
    return s * (1 - Math.abs(2 * l - 1)) + Math.abs(l - 0.5) * 0.5 + (shape(p) >= 1 ? 0.15 : 0);
  };
  for (let i = 0; i < out.length; i++) {
    const spot = spots[i % spots.length];
    if (!spot) continue;
    let best = i;
    for (let j = i + 1; j < Math.min(out.length, i + 4); j++) {
      // Don't take a photo another big or tall spot right after this one needs more.
      if (spot === "h2" ? shape(out[j]) < shape(out[best]) - 0.05 : striking(out[j]) > striking(out[best]) + 0.05) best = j;
    }
    if (best !== i) [out[i], out[best]] = [out[best], out[i]];
  }
  return out;
}

/** Photos picked from the pop-up on another page, waiting for the Photos page to open them. */
export const pendingPhotos: { files: File[] | null } = { files: null };

export const extensionOf = (blob: Blob) => (blob.type === "image/webp" ? "webp" : "jpg");

/** "120 KB", "3.4 MB". */
export function formatBytes(n: number) {
  if (n < 1024 * 1024) return `${Math.max(1, Math.round(n / 1024))} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

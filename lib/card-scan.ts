/**
 * Business cards: find the card in a photo, straighten it, read its text on the phone, and pick
 * out the business name, address, phone, email, contact person and website.
 *
 * The reading runs on the phone itself (Tesseract): the first scan downloads the reader, about
 * 4 MB, and the phone keeps it after that. Nothing is sent anywhere to be read.
 */

import { t } from "@/lib/i18n";

export type Point = { x: number; y: number };
/** The card's four corners, from 0 to 1 across and down the photo: top-left, top-right, bottom-right, bottom-left. */
export type Corners = [Point, Point, Point, Point];

export interface CardDetails {
  name: string;
  address: string;
  type: string;
  contact: string;
  phone: string;
  email: string;
  website: string;
}

/** The photo, no bigger than 1800 pixels on the long side. */
export async function loadPhoto(file: Blob): Promise<HTMLCanvasElement> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode().catch(() => {
      throw new Error(t("That file isn't a photo this phone can open."));
    });
    const scale = Math.min(1, 1800 / Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement("canvas");
    c.width = Math.round(img.naturalWidth * scale);
    c.height = Math.round(img.naturalHeight * scale);
    c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
    return c;
  } finally {
    URL.revokeObjectURL(url);
  }
}

const INSET: Corners = [
  { x: 0.06, y: 0.2 },
  { x: 0.94, y: 0.2 },
  { x: 0.94, y: 0.8 },
  { x: 0.06, y: 0.8 },
];

/**
 * Where the card probably is: the biggest patch that stands out from what's around it (usually
 * a light card on a darker table or hand). If nothing clear stands out, a frame in the middle
 * that the person drags onto the card's corners.
 */
export function findCard(photo: HTMLCanvasElement): Corners {
  return detectCard(photo) ?? INSET;
}

/** The card's corners when something card-like clearly stands out, otherwise null. */
export function detectCard(photo: HTMLCanvasElement): Corners | null {
  const scale = 240 / Math.max(photo.width, photo.height);
  const w = Math.max(8, Math.round(photo.width * scale)), h = Math.max(8, Math.round(photo.height * scale));
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d", { willReadFrequently: true })!;
  ctx.filter = "blur(1px)";
  ctx.drawImage(photo, 0, 0, w, h);
  const px = ctx.getImageData(0, 0, w, h).data;
  const grey = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) grey[i] = (px[i * 4] * 299 + px[i * 4 + 1] * 587 + px[i * 4 + 2] * 114) / 1000;

  // Split light from dark where they separate best (Otsu).
  const hist = new Array(256).fill(0);
  grey.forEach((g) => hist[g]++);
  let sum = 0;
  for (let i = 0; i < 256; i++) sum += i * hist[i];
  let sumB = 0, wB = 0, best = 0, cut = 128;
  for (let t = 0; t < 256; t++) {
    wB += hist[t];
    if (!wB || wB === w * h) continue;
    sumB += t * hist[t];
    const wF = w * h - wB, mB = sumB / wB, mF = (sum - sumB) / wF;
    const between = wB * wF * (mB - mF) ** 2;
    if (between > best) [best, cut] = [between, t];
  }

  const tryPatch = (light: boolean): Corners | null => {
    const seen = new Uint8Array(w * h);
    let biggest: number[] = [];
    for (let start = 0; start < w * h; start++) {
      if (seen[start] || (grey[start] > cut) !== light) continue;
      const patch: number[] = [];
      const stack = [start];
      seen[start] = 1;
      let touchesEdge = 0;
      while (stack.length) {
        const i = stack.pop()!;
        patch.push(i);
        const x = i % w, y = (i / w) | 0;
        if (x === 0 || y === 0 || x === w - 1 || y === h - 1) touchesEdge++;
        for (const n of [i - 1, i + 1, i - w, i + w]) {
          if (n < 0 || n >= w * h || seen[n] || (grey[n] > cut) !== light) continue;
          if ((n === i - 1 && x === 0) || (n === i + 1 && x === w - 1)) continue;
          seen[n] = 1;
          stack.push(n);
        }
      }
      // A card touching the photo's edge all the way round is the background, not the card.
      if (touchesEdge < (w + h) * 0.6 && patch.length > biggest.length) biggest = patch;
    }
    const share = biggest.length / (w * h);
    if (share < 0.08 || share > 0.92) return null;
    let tl = biggest[0], tr = tl, br = tl, bl = tl;
    const xy = (i: number) => [i % w, (i / w) | 0];
    for (const i of biggest) {
      const [x, y] = xy(i);
      const [tlx, tly] = xy(tl), [trx, try_] = xy(tr), [brx, bry] = xy(br), [blx, bly] = xy(bl);
      if (x + y < tlx + tly) tl = i;
      if (x - y > trx - try_) tr = i;
      if (x + y > brx + bry) br = i;
      if (x - y < blx - bly) bl = i;
    }
    const corners = [tl, tr, br, bl].map((i) => ({ x: xy(i)[0] / (w - 1), y: xy(i)[1] / (h - 1) })) as Corners;
    // It should look like a card: four corners that make a decent-sized shape.
    return area(corners) > 0.06 ? corners : null;
  };
  return tryPatch(true) ?? tryPatch(false);
}

function area(q: Corners) {
  let a = 0;
  for (let i = 0; i < 4; i++) a += q[i].x * q[(i + 1) % 4].y - q[(i + 1) % 4].x * q[i].y;
  return Math.abs(a) / 2;
}

/** The card cut out and straightened, as if scanned flat; the long side at most `max` pixels. */
export function straighten(photo: HTMLCanvasElement, corners: Corners, max: number): HTMLCanvasElement {
  const P = corners.map((p) => ({ x: p.x * photo.width, y: p.y * photo.height }));
  const dist = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
  let W = (dist(P[0], P[1]) + dist(P[3], P[2])) / 2;
  let H = (dist(P[0], P[3]) + dist(P[1], P[2])) / 2;
  const scale = Math.min(1.6, max / Math.max(W, H));
  W = Math.max(1, Math.round(W * scale));
  H = Math.max(1, Math.round(H * scale));
  const m = homography(W, H, P);
  const src = photo.getContext("2d", { willReadFrequently: true })!.getImageData(0, 0, photo.width, photo.height);
  const out = document.createElement("canvas");
  out.width = W;
  out.height = H;
  const octx = out.getContext("2d")!;
  const img = octx.createImageData(W, H);
  const sw = photo.width, sh = photo.height, s = src.data, d = img.data;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const z = m[6] * x + m[7] * y + 1;
      const fx = Math.min(sw - 1.001, Math.max(0, (m[0] * x + m[1] * y + m[2]) / z));
      const fy = Math.min(sh - 1.001, Math.max(0, (m[3] * x + m[4] * y + m[5]) / z));
      const x0 = fx | 0, y0 = fy | 0, ax = fx - x0, ay = fy - y0;
      const i00 = (y0 * sw + x0) * 4, i10 = i00 + 4, i01 = i00 + sw * 4, i11 = i01 + 4;
      const o = (y * W + x) * 4;
      for (let k = 0; k < 3; k++) {
        d[o + k] = (s[i00 + k] * (1 - ax) + s[i10 + k] * ax) * (1 - ay) + (s[i01 + k] * (1 - ax) + s[i11 + k] * ax) * ay;
      }
      d[o + 3] = 255;
    }
  }
  octx.putImageData(img, 0, 0);
  return out;
}

/** Maps the flat card (0..W, 0..H) onto the four corners in the photo. */
function homography(W: number, H: number, P: Point[]) {
  const from = [
    [0, 0],
    [W, 0],
    [W, H],
    [0, H],
  ];
  const A: number[][] = [];
  const b: number[] = [];
  for (let i = 0; i < 4; i++) {
    const [x, y] = from[i], { x: u, y: v } = P[i];
    A.push([x, y, 1, 0, 0, 0, -u * x, -u * y]);
    b.push(u);
    A.push([0, 0, 0, x, y, 1, -v * x, -v * y]);
    b.push(v);
  }
  // Gaussian elimination on the 8×8 system.
  for (let c = 0; c < 8; c++) {
    let p = c;
    for (let r = c + 1; r < 8; r++) if (Math.abs(A[r][c]) > Math.abs(A[p][c])) p = r;
    [A[c], A[p]] = [A[p], A[c]];
    [b[c], b[p]] = [b[p], b[c]];
    for (let r = 0; r < 8; r++) {
      if (r === c || !A[c][c]) continue;
      const f = A[r][c] / A[c][c];
      for (let k = c; k < 8; k++) A[r][k] -= f * A[c][k];
      b[r] -= f * b[c];
    }
  }
  return b.map((v, i) => v / A[i][i]);
}

export type ReadProgress = (step: "download" | "read", share: number) => void;

/** The card's text, line by line, with how tall each line's letters are. */
export async function readText(card: HTMLCanvasElement, onProgress?: ReadProgress) {
  const { createWorker } = await import("tesseract.js");
  const worker = await createWorker("eng", 1, {
    logger: (m) => {
      if (!onProgress) return;
      if (m.status === "recognizing text") onProgress("read", m.progress);
      else if (/loading|initializ/i.test(m.status)) onProgress("download", m.progress);
    },
  });
  try {
    const { data } = await worker.recognize(card, {}, { blocks: true, text: true });
    const lines: { text: string; height: number }[] = [];
    for (const block of data.blocks ?? [])
      for (const para of block.paragraphs)
        for (const line of para.lines) {
          const words = line.words.filter((w) => w.confidence > 30);
          if (!words.length) continue;
          const heights = words.map((w) => w.bbox.y1 - w.bbox.y0).sort((a, b) => a - b);
          lines.push({ text: words.map((w) => w.text).join(" "), height: heights[Math.floor(heights.length / 2)] });
        }
    return lines;
  } finally {
    await worker.terminate();
  }
}

const STREET =
  /\b(st|street|ave|avenue|rd|road|blvd|boulevard|dr|drive|ln|lane|way|pkwy|parkway|pl|place|ct|court|hwy|highway|ter|terrace|plaza|sq|square|broadway|tpke|turnpike|suite|ste|fl|floor)\b\.?/i;
const CITY_LINE = /\b[A-Za-z][A-Za-z .'-]+,?\s+[A-Z]{2}\.?\s+\d{5}(?:-\d{4})?\b/;
const PHONE = /(?:\+?1[\s.-]?)?\(?(\d{3})\)?[\s.-]*(\d{3})[\s.-]*(\d{4})\b/;
const EMAIL = /[A-Z0-9._%+-]+\s?@\s?[A-Z0-9.-]+\.[A-Z]{2,}/i;
const WEB = /\b((?:https?:\/\/)?(?:www\.)?[a-z0-9-]+(?:\.[a-z0-9-]+)*\.(?:com|org|net|biz|info|us|co|edu|gov|nyc|shop|store|io|law|health)(?:\/\S*)?)\b/i;
const TITLE =
  /\b(owner|manager|president|ceo|cfo|coo|cto|director|founder|partner|agent|broker|realtor|pharmacist|doctor|dr|md|dds|dmd|esq|attorney|lawyer|associate|consultant|sales|representative|rep|vp|vice|principal|proprietor|chef|rabbi|cpa|accountant|specialist|advisor|officer|supervisor|coordinator|administrator)\b/i;
const BUSINESS =
  /\b(inc|llc|corp|co|company|group|store|shop|market|pharmacy|deli|bakery|restaurant|cafe|grill|pizza|dental|medical|clinic|center|centre|law|insurance|realty|services|associates|studio|salon|auto|supply|wholesale|bank|hotel|office|firm|agency|foods|kosher|judaica|jewelers|cleaners|hardware|furniture|electronics)\b/i;

const TYPE_HINTS: [RegExp, string][] = [
  [/\b(hospital|medical center|clinic|urgent care|health)\b/i, "Hospital"],
  [/\b(university|college|campus|school|academy)\b/i, "Campus"],
  [/\b(law|attorney|esq|insurance|accounting|cpa|realty|real estate|consulting|associates|office|agency|firm|financial|bank|dental|dds|md)\b/i, "Office"],
  [/\b(store|shop|market|pharmacy|deli|bakery|restaurant|cafe|grill|pizza|salon|cleaners|hardware|jewelers|judaica|supermarket|grocery|wholesale|supply|furniture|electronics|auto)\b/i, "Store"],
];

/** Picks the details out of the card's text. Anything it isn't sure of stays empty to fill in. */
export function parseCard(lines: { text: string; height: number }[]): CardDetails {
  // Cards often put several things on one line ("Tel 718… | Fax 718…"): split those up.
  const parts = lines
    .flatMap((l, line) =>
      l.text
        .split(/\s+[|•·◆▪]\s+|\s{3,}/)
        .map((t) => ({ text: t.replace(/\s+/g, " ").replace(/^[^A-Za-z0-9(+]+|[^A-Za-z0-9).]+$/g, "").trim(), height: l.height, line })),
    )
    .filter((p) => p.text.length >= 2);
  const used = new Set<number>();
  const take = (i: number) => (used.add(i), parts[i].text);

  let email = "", website = "", phone = "", contact = "", name = "";
  parts.forEach((p, i) => {
    const m = p.text.match(EMAIL);
    if (m && !email) {
      email = m[0].replace(/\s/g, "").toLowerCase();
      if (p.text.replace(m[0], "").replace(/^(e-?mail|e)\s*[:.]?\s*/i, "").trim().length < 3) used.add(i);
    }
  });
  parts.forEach((p, i) => {
    if (used.has(i)) return;
    // Skip the email's own domain, but not a website on the same line as the email.
    const m = p.text.replace(new RegExp(EMAIL.source, "gi"), " ").match(WEB);
    if (m && !website && !PHONE.test(p.text)) {
      website = m[1].replace(/^https?:\/\//i, "").replace(/\/$/, "").toLowerCase();
      used.add(i);
    }
  });
  // Phone: the first one that isn't the fax, with any labelled cell/office number first.
  const phones = parts
    .map((p, i) => ({ i, m: p.text.match(PHONE), fax: /\bfax\b|\bf\s*[:.]/i.test(p.text), main: /\b(tel|phone|office|cell|mobile|ph|t|p|c|m)\b\s*[:.]?/i.test(p.text) }))
    .filter((x) => x.m && !x.fax);
  phones.sort((a, b) => Number(b.main) - Number(a.main));
  if (phones[0]?.m) {
    const [, a, b, c] = phones[0].m;
    phone = `(${a}) ${b}-${c}`;
  }
  parts.forEach((p, i) => PHONE.test(p.text) && p.text.replace(PHONE, "").replace(/\b(tel|phone|fax|office|cell|mobile|ph|t|p|c|m|f)\b\s*[:.]?/gi, "").trim().length < 3 && used.add(i));

  // Address: a street line ("412 Kingston Ave") and the city line after it ("Brooklyn, NY 11213").
  let address = "";
  const streetAt = parts.findIndex((p, i) => !used.has(i) && /^\d{1,6}[A-Za-z]?\s+\S/.test(p.text) && (STREET.test(p.text) || CITY_LINE.test(p.text)));
  const cityAt = parts.findIndex((p, i) => !used.has(i) && CITY_LINE.test(p.text));
  if (streetAt >= 0) {
    address = take(streetAt);
    if (cityAt >= 0 && cityAt !== streetAt && !CITY_LINE.test(address)) address += ", " + take(cityAt);
  } else if (cityAt >= 0) {
    address = take(cityAt);
  }
  address = address.replace(PHONE, "").replace(/\s{2,}/g, " ").replace(/[,\s]+$/, "");

  // Contact person: two to four capitalised words, no numbers, often next to a title.
  const person = (t: string) => {
    const bare = t.split(/,|\s[-–]\s/)[0].trim();
    const words = bare.split(" ");
    return words.length >= 2 && words.length <= 4 && words.every((w) => /^[A-Z][A-Za-z.'-]*$/.test(w)) && !BUSINESS.test(bare) && !TITLE.test(bare.replace(/\b(dr)\b\.?/i, "")) ? bare : "";
  };
  const people = parts.map((p, i) => ({ i, who: used.has(i) ? "" : person(p.text) })).filter((x) => x.who);
  const titled = people.find(({ i }) => TITLE.test(parts[i].text) || (parts[i + 1] && TITLE.test(parts[i + 1].text) && parts[i + 1].text.split(" ").length <= 5));
  const pick = titled ?? (people.length > 1 ? people.slice().sort((a, b) => parts[a.i].height - parts[b.i].height)[0] : undefined);
  if (pick) {
    contact = pick.who;
    used.add(pick.i);
  }
  parts.forEach((p, i) => !used.has(i) && TITLE.test(p.text) && p.text.split(" ").length <= 5 && !BUSINESS.test(p.text) && used.add(i));

  // Business name: whatever's left in the biggest letters.
  const left = parts.map((p, i) => ({ p, i })).filter(({ p, i }) => !used.has(i) && /[A-Za-z]{2}/.test(p.text) && !/^(tel|fax|phone|email|www)\b/i.test(p.text));
  left.sort((a, b) => b.p.height - a.p.height || a.i - b.i);
  if (left[0]) {
    // A name in big letters can wrap onto two lines.
    const next = left.find((x) => x.p.line === left[0].p.line + 1 && Math.abs(x.p.height - left[0].p.height) < left[0].p.height * 0.15);
    name = next ? `${left[0].p.text} ${next.p.text}` : left[0].p.text;
  } else if (website) {
    name = website.replace(/^www\./, "").split(".")[0];
  }
  name = name.replace(/\s{2,}/g, " ").trim();
  if (name && name === name.toUpperCase() && name.length > 3) name = name.toLowerCase().replace(/(^|[\s-])[a-z]/g, (c) => c.toUpperCase()).replace(/\b(Llc|Inc)\b/g, (s) => s.toUpperCase());

  const all = lines.map((l) => l.text).join(" ");
  const type = TYPE_HINTS.find(([re]) => re.test(all))?.[1] ?? "";
  return { name, address, type, contact, phone, email, website };
}

/** The card picture to keep: small (about 30 KB), still easy to read. */
export function cardPicture(card: HTMLCanvasElement): Promise<Blob> {
  const scale = Math.min(1, 760 / Math.max(card.width, card.height));
  const c = document.createElement("canvas");
  c.width = Math.round(card.width * scale);
  c.height = Math.round(card.height * scale);
  const ctx = c.getContext("2d")!;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(card, 0, 0, c.width, c.height);
  return new Promise((resolve, reject) =>
    c.toBlob(
      (webp) => {
        if (webp && webp.type === "image/webp") return resolve(webp);
        c.toBlob((jpeg) => (jpeg ? resolve(jpeg) : reject(new Error(t("Couldn't save the card picture.")))), "image/jpeg", 0.72);
      },
      "image/webp",
      0.68,
    ),
  );
}

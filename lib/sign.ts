import { BW_LOGO, BW_LOGO_BOX } from "./sign-logo";

/**
 * Draws a sign (8.5x11, black and white) from what was typed in the Sign Creator, and turns it
 * into a picture or a PDF. Everything is drawn by hand so the download looks exactly like the preview.
 */
export interface SignText {
  sticker: { on: boolean; text: string };
  /** The three lines of the big headline; the middle one is gray. Empty lines are left out. */
  headline: [string, string, string];
  body: { on: boolean; text: string };
  details: { on: boolean; lines: string[] };
  footer: { on: boolean; text: string };
}

export const BLANK_SIGN: SignText = {
  sticker: { on: true, text: "This Friday!" },
  headline: ["Mivtza", "Chanukah", "Kickoff"],
  body: { on: true, text: "Come get your menorahs, candles and route before you head out." },
  details: { on: true, lines: ["Friday, 12:30 PM", "770 Eastern Parkway, Downstairs", "Bring your Chavrusa"] },
  footer: { on: true, text: "If you have any money in your Pushka, please help out Mivtzoim · Cash App $sdmivtzoim87 · Zelle sdmivtzoim87@gmail.com" },
};

/** The page, measured in its own units; the canvas is these times `scale`. */
const W = 850;
const H = 1100;
const M = 50;
const SANS = `"Google Sans Flex", system-ui, sans-serif`;
// Anton has no Hebrew letters; Secular One draws those, just as heavy.
const BIG = `Anton, "Secular One", Impact, "Arial Narrow", sans-serif`;
// The top and bottom bars are dark gray, not solid black.
const BAR = "#4d4d4d";
const STRIPE = "#ababab";
const HEBREW = /[֐-׿]/;

/** The fonts the sign needs. Anton is only used here, so it is fetched when this page opens. */
export async function loadSignFonts() {
  if (!document.getElementById("sign-fonts")) {
    const link = document.createElement("link");
    link.id = "sign-fonts";
    link.rel = "stylesheet";
    link.href = "https://fonts.googleapis.com/css2?family=Anton&family=Secular+One&display=swap";
    document.head.appendChild(link);
    await new Promise((done) => {
      link.onload = done;
      link.onerror = done;
    });
  }
  // A font that can't be fetched (no internet) just falls back to a plain one.
  await Promise.all([`400 100px Anton`, `400 100px "Secular One"`, `600 27px "Google Sans Flex"`, `700 25px "Google Sans Flex"`, `700 22px "David Libre"`].map((f) => document.fonts.load(f, "Aבס").catch(() => null)));
}

let logo: Promise<HTMLImageElement> | null = null;
/** The logo in white (with light gray where the black-and-white logo is gray), for the gray bar. */
function whiteLogo() {
  logo ??= new Promise((done, fail) => {
    const [x, y, w, h] = BW_LOGO_BOX;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${x} ${y} ${w} ${h}" width="${w * 2}" height="${h * 2}" fill="#fff">${BW_LOGO.replaceAll(`fill="#666"`, `fill="#d6d6d6"`)}</svg>`;
    const img = new Image();
    img.onload = () => done(img);
    img.onerror = fail;
    img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
  });
  return logo;
}

type Ctx = CanvasRenderingContext2D;

/** Breaks text into lines that fit `max`. `tooWide` says a single word didn't fit. */
function wrap(ctx: Ctx, text: string, max: number) {
  const lines: string[] = [];
  let tooWide = false;
  for (const para of text.split("\n")) {
    let line = "";
    for (const word of para.split(/\s+/).filter(Boolean)) {
      const next = line ? line + " " + word : word;
      if (line && ctx.measureText(next).width > max) {
        lines.push(line);
        line = word;
      } else line = next;
      if (ctx.measureText(line).width > max) tooWide = true;
    }
    if (line) lines.push(line);
  }
  return { lines, tooWide };
}

/** Like wrap, but a new line starts at a "·" where it can, so "Zelle" stays with its address. */
function wrapParts(ctx: Ctx, text: string, max: number) {
  const lines: string[] = [];
  for (const para of text.split("\n")) {
    let line = "";
    for (const part of para.split("·").map((x) => x.trim()).filter(Boolean)) {
      const next = line ? line + " · " + part : part;
      if (ctx.measureText(next).width <= max) line = next;
      else {
        if (line) lines.push(line);
        const pieces = wrap(ctx, part, max).lines;
        line = pieces.pop() ?? "";
        lines.push(...pieces);
      }
    }
    if (line) lines.push(line);
  }
  return lines;
}

/** One line of text starting at the left edge; Hebrew starts at the right edge instead. */
function put(ctx: Ctx, text: string, x: number, y: number, width: number) {
  const rtl = HEBREW.test(text);
  ctx.direction = rtl ? "rtl" : "ltr";
  ctx.textAlign = rtl ? "right" : "left";
  ctx.fillText(text, rtl ? x + width : x, y);
  ctx.direction = "ltr";
  ctx.textAlign = "left";
}

function box(ctx: Ctx, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** A white piece with a black outline and a solid black shadow: prints cleanly on any printer. */
function piece(ctx: Ctx, x: number, y: number, w: number, h: number, r: number, drop = 7) {
  ctx.fillStyle = "#000";
  box(ctx, x + drop, y + drop, w, h, r);
  ctx.fill();
  ctx.fillStyle = "#fff";
  box(ctx, x, y, w, h, r);
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = "#000";
  ctx.stroke();
}

/** Turns around the middle of a piece, draws it, and turns back. */
function tilted(ctx: Ctx, cx: number, cy: number, degrees: number, draw: () => void) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate((degrees * Math.PI) / 180);
  ctx.translate(-cx, -cy);
  draw();
  ctx.restore();
}

export type SignPhoto = HTMLCanvasElement | HTMLImageElement;
const sizeOf = (p: SignPhoto) => (p instanceof HTMLImageElement ? [p.naturalWidth, p.naturalHeight] : [p.width, p.height]);

/** A gray copy of a photo (made once, when it is picked), no bigger than the print needs. */
export function grayCopy(img: HTMLImageElement): HTMLCanvasElement {
  const k = Math.min(1, 1800 / Math.max(img.naturalWidth, img.naturalHeight));
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(img.naturalWidth * k));
  c.height = Math.max(1, Math.round(img.naturalHeight * k));
  const ctx = c.getContext("2d")!;
  ctx.drawImage(img, 0, 0, c.width, c.height);
  const data = ctx.getImageData(0, 0, c.width, c.height);
  const d = data.data;
  for (let i = 0; i < d.length; i += 4) d[i] = d[i + 1] = d[i + 2] = Math.round(0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]);
  ctx.putImageData(data, 0, 0);
  return c;
}

/** A photo in a white frame, filling the frame (the edges that don't fit are trimmed evenly). */
function framed(ctx: Ctx, photo: SignPhoto, x: number, y: number, w: number, h: number) {
  piece(ctx, x, y, w, h, 8);
  const pad = 12;
  const [iw, ih] = sizeOf(photo);
  const [bw, bh] = [w - pad * 2, h - pad * 2];
  const k = Math.max(bw / iw, bh / ih);
  const [sw, sh] = [bw / k, bh / k];
  ctx.drawImage(photo, (iw - sw) / 2, (ih - sh) / 2, sw, sh, x + pad, y + pad, bw, bh);
}

/** Draws the whole sign. `scale` 3 gives a print-quality page (2550 x 3300). */
export async function drawSign(canvas: HTMLCanvasElement, sign: SignText, photos: SignPhoto[], scale: number) {
  const mark = await whiteLogo().catch(() => null);
  canvas.width = W * scale;
  canvas.height = H * scale;
  const ctx = canvas.getContext("2d")!;
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, W, H);

  // The top bar: logo on the left, בס״ד on the right, and a gray stripe under it.
  const TOP = 128;
  ctx.fillStyle = BAR;
  ctx.fillRect(0, 0, W, TOP);
  ctx.fillStyle = STRIPE;
  ctx.fillRect(0, TOP, W, 10);
  if (mark) ctx.drawImage(mark, M, 28, (72 * BW_LOGO_BOX[2]) / BW_LOGO_BOX[3], 72);
  ctx.fillStyle = "#fff";
  ctx.font = `700 22px "David Libre", serif`;
  ctx.direction = "rtl";
  ctx.textAlign = "right";
  ctx.fillText("בס״ד", W - 36, 46);
  ctx.direction = "ltr";
  ctx.textAlign = "left";

  // The bottom bar matches the top one; the bottom text sits inside it, in white.
  ctx.font = `600 15px ${SANS}`;
  const footLines = sign.footer.on ? wrapParts(ctx, sign.footer.text.trim(), W - M * 2) : [];
  const footH = footLines.length ? Math.max(84, footLines.length * 23 + 46) : 30;
  ctx.fillStyle = STRIPE;
  ctx.fillRect(0, H - footH - 10, W, 10);
  ctx.fillStyle = BAR;
  ctx.fillRect(0, H - footH, W, footH);
  ctx.fillStyle = "#fff";
  ctx.textAlign = "center";
  footLines.forEach((line, i) => {
    ctx.direction = HEBREW.test(line) ? "rtl" : "ltr";
    ctx.fillText(line, W / 2, H - footH / 2 - ((footLines.length - 1) * 23) / 2 + i * 23 + 5);
  });
  ctx.direction = "ltr";
  ctx.textAlign = "left";

  // Everything between the two bars. First measure it, so it can be sized to fill the page.
  const top = TOP + 10 + 38;
  const bottom = H - footH - 10 - 34;
  const wide = W - M * 2;
  const stickerText = sign.sticker.on ? sign.sticker.text.trim().toUpperCase() : "";
  const bodyText = sign.body.on ? sign.body.text.trim() : "";
  const detailLines = sign.details.on ? sign.details.lines.map((l) => l.trim()).filter(Boolean) : [];
  const heads = sign.headline.map((l, i) => ({ text: l.trim().toUpperCase(), gray: i === 1 })).filter((l) => l.text);
  // One photo sits beside the details; more than one get a row of their own.
  const beside = detailLines.length > 0 && photos.length === 1;
  const photoRow = photos.length > 0 && !beside;

  ctx.font = `600 27px ${SANS}`;
  const body = wrap(ctx, bodyText, wide).lines;
  const cardW = beside ? wide - 300 - 26 : wide;
  ctx.font = `700 25px ${SANS}`;
  const details = detailLines.map((l) => wrap(ctx, l, cardW - 52).lines);
  const cardH = details.length ? details.reduce((n, d) => n + d.length * 32 + 26, 0) + 16 : 0;

  // The headline starts big and shrinks until every word fits across and the page fits down.
  const measure = (size: number) => {
    ctx.font = `400 ${size}px ${BIG}`;
    const cap = ctx.measureText("H").actualBoundingBoxAscent || size * 0.72;
    let tooWide = false;
    const lines = heads.flatMap((h) => {
      const w = wrap(ctx, h.text, wide);
      tooWide ||= w.tooWide;
      return w.lines.map((text) => ({ text, gray: h.gray }));
    });
    const lineH = cap + size * 0.15;
    let need = 0;
    if (stickerText) need += 56 + (lines.length ? 30 : 0);
    need += lines.length * lineH - (lines.length ? size * 0.15 : 0);
    if (body.length) need += (need ? 26 : 0) + body.length * 35 - 8;
    if (cardH) need += (need ? 34 : 0) + (beside ? Math.max(cardH, 250) : cardH);
    if (photoRow) need += (need ? 34 : 0) + 230;
    return { size, cap, lineH, lines, need, fits: !tooWide && need <= bottom - top };
  };
  const biggest = photos.length ? 190 : 236;
  let head = measure(heads.length ? biggest : 0);
  for (let size = biggest - 6; heads.length && !head.fits && size >= 44; size -= 6) head = measure(size);

  // Space left over makes the photos bigger; the rest is shared above and below.
  let spare = Math.max(0, bottom - top - head.need);
  const grow = photos.length ? Math.min(spare, photoRow ? (photos.length === 1 ? 300 : 190) : 130) : 0;
  spare -= grow;
  let y = top + spare * 0.4;

  if (stickerText) {
    ctx.font = `400 28px ${BIG}`;
    const w = Math.min(wide, ctx.measureText(stickerText).width + 48);
    tilted(ctx, M + w / 2, y + 28, -3.5, () => {
      piece(ctx, M, y, w, 56, 12, 6);
      ctx.fillStyle = "#000";
      ctx.textAlign = "center";
      ctx.fillText(stickerText, M + w / 2, y + 39, w - 30);
      ctx.textAlign = "left";
    });
    y += 56 + (head.lines.length ? 30 : 0);
  }

  ctx.font = `400 ${head.size}px ${BIG}`;
  for (const line of head.lines) {
    ctx.fillStyle = line.gray ? "#7a7a7a" : "#000";
    put(ctx, line.text, M, y + head.cap, wide);
    y += head.lineH;
  }
  if (head.lines.length) y -= head.size * 0.15;

  if (body.length) {
    if (y > top + spare * 0.4) y += 26;
    ctx.font = `600 27px ${SANS}`;
    ctx.fillStyle = "#222";
    body.forEach((line, i) => put(ctx, line, M, y + 25 + i * 35, wide));
    y += body.length * 35 - 8;
  }

  if (cardH) {
    if (y > top + spare * 0.4) y += 34;
    const rowH = beside ? Math.max(cardH, 250) + grow : cardH;
    const cardY = y + (beside ? (rowH - cardH) / 2 : 0);
    tilted(ctx, M + cardW / 2, cardY + cardH / 2, beside ? -1.5 : -0.8, () => {
      piece(ctx, M, cardY, cardW, cardH, 20);
      let at = cardY + 8;
      details.forEach((lines, i) => {
        if (i) {
          ctx.setLineDash([8, 7]);
          ctx.lineWidth = 2;
          ctx.strokeStyle = "#9a9a9a";
          ctx.beginPath();
          ctx.moveTo(M + 26, at);
          ctx.lineTo(M + cardW - 26, at);
          ctx.stroke();
          ctx.setLineDash([]);
        }
        ctx.font = `700 25px ${SANS}`;
        ctx.fillStyle = "#000";
        lines.forEach((line, j) => put(ctx, line, M + 26, at + 13 + 24 + j * 32, cardW - 52));
        at += lines.length * 32 + 26;
      });
    });
    if (beside) tilted(ctx, W - M - 150, y + rowH / 2, 3.5, () => framed(ctx, photos[0], W - M - 300, y, 300, rowH));
    y += rowH;
  }

  if (photoRow) {
    if (y > top + spare * 0.4) y += 34;
    const gap = 26;
    const h = 230 + grow;
    const each = (wide - gap * (photos.length - 1)) / photos.length;
    // A single photo keeps a friendly shape rather than stretching across the whole page.
    const w = photos.length === 1 ? Math.min(wide, h * 1.45) : each;
    photos.forEach((photo, i) => {
      const x = photos.length === 1 ? (W - w) / 2 : M + i * (each + gap);
      tilted(ctx, x + w / 2, y + h / 2, photos.length === 1 ? 2 : [-2.5, 2, -1.5][i % 3], () => framed(ctx, photo, x, y, w, h));
    });
  }
}

/** A one-page, letter-size PDF with the sign filling the page. */
export async function signPdf(canvas: HTMLCanvasElement): Promise<Blob> {
  const jpeg = new Uint8Array(await (await new Promise<Blob>((done, fail) => canvas.toBlob((b) => (b ? done(b) : fail(new Error("no picture"))), "image/jpeg", 0.93))).arrayBuffer());
  const enc = new TextEncoder();
  const parts: Uint8Array[] = [];
  const starts: number[] = [];
  let length = 0;
  const add = (piece: string | Uint8Array) => {
    const bytes = typeof piece === "string" ? enc.encode(piece) : piece;
    parts.push(bytes);
    length += bytes.length;
  };
  const object = (body: string, stream?: Uint8Array) => {
    starts.push(length);
    add(`${starts.length} 0 obj\n${body}\n`);
    if (stream) {
      add("stream\n");
      add(stream);
      add("\nendstream\n");
    }
    add("endobj\n");
  };
  const draw = enc.encode("q 612 0 0 792 0 0 cm /Im0 Do Q");
  add("%PDF-1.4\n");
  object("<< /Type /Catalog /Pages 2 0 R >>");
  object("<< /Type /Pages /Kids [3 0 R] /Count 1 >>");
  object("<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>");
  object(`<< /Type /XObject /Subtype /Image /Width ${canvas.width} /Height ${canvas.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>`, jpeg);
  object(`<< /Length ${draw.length} >>`, draw);
  const xref = length;
  add(`xref\n0 ${starts.length + 1}\n0000000000 65535 f \n${starts.map((s) => String(s).padStart(10, "0") + " 00000 n \n").join("")}trailer\n<< /Size ${starts.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
  return new Blob(parts as BlobPart[], { type: "application/pdf" });
}

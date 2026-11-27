import { BW_LOGO, BW_LOGO_BOX } from "./sign-logo";

/**
 * Draws a sign (8.5x11, black and white) from what was typed in the Sign Creator, and turns it
 * into a picture or a PDF. Everything is drawn by hand so the download looks exactly like the preview.
 */
export interface SignText {
  /** The big header. A new line in the box is a new line on the sign. */
  header: string;
  /** The regular text under it. */
  text: string;
  /** Which side each one leans to. Left out means left for English and right for Hebrew. */
  headerAlign?: SignAlign;
  textAlign?: SignAlign;
}

/** "full" stretches every line edge to edge; its second word says where the last line finishes. */
export type SignAlign = "left" | "center" | "right" | "full-left" | "full-center" | "full-right";
export const SIGN_ALIGNS: SignAlign[] = ["left", "center", "right", "full-left", "full-center", "full-right"];
/** The side a sign leans to when none was chosen. */
export const naturalAlign = (text: string): SignAlign => (startsHebrew(text) ? "right" : "left");

export const BLANK_SIGN: SignText = {
  header: "Mivtza Chanukah Kickoff",
  text: "Come get your menorahs, candles and route before you head out.\n\nThis Friday, 12:30 PM\n770 Eastern Parkway, Downstairs",
};

/** The bottom bar's words are the same on every sign. */
const FOOT = "If you have any money in your Pushka, please help out Mivtzoim · Cash App $sdmivtzoim87 · Zelle sdmivtzoim87@gmail.com";

/** The page, measured in its own units; the canvas is these times `scale`. */
const W = 850;
const H = 1100;
const M = 50;
// Hebrew is always drawn in David Libre, the same font as the בס״ד (the other fonts have no Hebrew letters).
const SANS = `"Google Sans Flex", "David Libre", system-ui, sans-serif`;
const BIG = `Anton, "David Libre", Impact, "Arial Narrow", sans-serif`;
/** A headline line: Hebrew letters are drawn a little larger, to stand as tall as the English capitals. */
const bigFont = (size: number, text: string) => `${HEBREW.test(text) ? `700 ${size * 1.22}` : `400 ${size}`}px ${BIG}`;
/** The regular text: Hebrew is drawn bold and a little larger, to match the English beside it. */
const smallFont = (size: number, text: string) => `${HEBREW.test(text) ? `700 ${size * 1.12}` : `600 ${size}`}px ${SANS}`;
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
    link.href = "https://fonts.googleapis.com/css2?family=Anton&display=swap";
    document.head.appendChild(link);
    await new Promise((done) => {
      link.onload = done;
      link.onerror = done;
    });
  }
  // A font that can't be fetched (no internet) just falls back to a plain one.
  await Promise.all([`400 100px Anton`, `600 27px "Google Sans Flex"`, `700 25px "Google Sans Flex"`, `700 22px "David Libre"`].map((f) => document.fonts.load(f, "Aבס").catch(() => null)));
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

/** Text that starts with a Hebrew letter reads from the right; all its lines then start at the right edge. */
const startsHebrew = (text: string) => HEBREW.test(text.match(/[A-Za-z\u0590-\u05FF]/)?.[0] ?? "");

/** One line of text, leaning to the chosen side. `last` is the final line of its paragraph. */
function put(ctx: Ctx, text: string, x: number, y: number, width: number, rtl: boolean, align: SignAlign, last: boolean) {
  const full = align.startsWith("full");
  const side = (full ? align.slice(5) : align) as "left" | "center" | "right";
  if (full && !last && stretched(ctx, text, x, y, width, rtl)) return;
  ctx.direction = rtl ? "rtl" : "ltr";
  ctx.textAlign = side;
  ctx.fillText(text, side === "left" ? x : side === "right" ? x + width : x + width / 2, y);
  ctx.direction = "ltr";
  ctx.textAlign = "left";
}

/** Draws a line edge to edge, with the extra room shared between its words. False if it can't be. */
function stretched(ctx: Ctx, text: string, x: number, y: number, width: number, rtl: boolean) {
  const words = text.split(" ").filter(Boolean);
  const sizes = words.map((w) => ctx.measureText(w).width);
  const used = sizes.reduce((a, b) => a + b, 0);
  // A short line pulled across the whole page would be mostly gaps.
  if (words.length < 2 || used < width * 0.6) return false;
  // The order the words appear in from left to right: Hebrew runs right to left, and English
  // or numbers inside it still read left to right (and the other way around).
  const order = words.map((_, i) => i);
  if (rtl) order.reverse();
  const foreign = (i: number) => HEBREW.test(words[i]) !== rtl;
  for (let i = 0; i < order.length; i++) {
    let j = i;
    while (j < order.length && foreign(order[j])) j++;
    if (j - i > 1) order.splice(i, j - i, ...order.slice(i, j).reverse());
    i = Math.max(i, j - 1);
  }
  const gap = (width - used) / (words.length - 1);
  let at = x;
  ctx.textAlign = "left";
  for (const i of order) {
    ctx.direction = HEBREW.test(words[i]) ? "rtl" : "ltr";
    ctx.fillText(words[i], at, y);
    at += sizes[i] + gap;
  }
  ctx.direction = "ltr";
  return true;
}

/** Draws the whole sign. `scale` 3 gives a print-quality page (2550 x 3300). */
export async function drawSign(canvas: HTMLCanvasElement, sign: SignText, scale: number) {
  const mark = await whiteLogo().catch(() => null);
  canvas.width = W * scale;
  canvas.height = H * scale;
  const ctx = canvas.getContext("2d")!;
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, W, H);

  // The top bar: logo on the left, בס״ד on the right, and a lighter stripe under it.
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

  // The bottom bar matches the top one, with the same words on every sign.
  ctx.font = `600 15px ${SANS}`;
  const footLines = wrapParts(ctx, FOOT, W - M * 2);
  const footH = Math.max(84, footLines.length * 23 + 46);
  ctx.fillStyle = STRIPE;
  ctx.fillRect(0, H - footH - 10, W, 10);
  ctx.fillStyle = BAR;
  ctx.fillRect(0, H - footH, W, footH);
  ctx.fillStyle = "#fff";
  ctx.textAlign = "center";
  footLines.forEach((line, i) => ctx.fillText(line, W / 2, H - footH / 2 - ((footLines.length - 1) * 23) / 2 + i * 23 + 5));
  ctx.textAlign = "left";

  // Between the bars: the header, then the text. Both are measured first, then sized to fill the page.
  const top = TOP + 10 + 44;
  const bottom = H - footH - 10 - 44;
  const wide = W - M * 2;
  const header = sign.header.trim().toUpperCase();
  const paragraphs = sign.text.trim() ? sign.text.trim().split("\n").map((x) => x.trim()) : [];

  const ownLines = header.includes("\n");
  // Hebrew text keeps every line on the right, even a line that starts with a number.
  const textRtl = startsHebrew(sign.text);
  const measure = (big: number, small: number) => {
    let tooWide = false;
    const cap = ((ctx.font = `400 ${big}px ${BIG}`), ctx.measureText("H").actualBoundingBoxAscent || big * 0.72);
    const gap = big * 0.15;
    const lines = header.split("\n").flatMap((part) => {
      // Every Hebrew line gets the same room (measured on a plain letter), so the lines are evenly
      // spaced whether or not they have a tall ל or a hanging ך.
      const hebrew = HEBREW.test(part);
      ctx.font = bigFont(big, part);
      const w = wrap(ctx, part, wide);
      // Lines the person chose themselves are kept whole: the words get smaller rather than split.
      tooWide ||= w.tooWide || (ownLines && w.lines.length > 1);
      const up = hebrew ? ctx.measureText("ה").actualBoundingBoxAscent : cap;
      return w.lines.map((text) => ({ text, up, down: hebrew ? big * 0.12 : 0 }));
    });
    const hangs = lines.length && /[ךןףץק]/.test(lines[lines.length - 1].text) ? big * 0.14 : 0;
    const lineH = small * 1.4;
    const body = paragraphs.flatMap((para) => {
      // An empty line in the box leaves a little space between paragraphs.
      if (!para) return [{ text: "", h: lineH * 0.55, rtl: false, last: true }];
      ctx.font = smallFont(small, para);
      const w = wrap(ctx, para, wide);
      tooWide ||= w.tooWide;
      return w.lines.map((text, i) => ({ text, h: lineH, rtl: textRtl, last: i === w.lines.length - 1 }));
    });
    const headH = lines.reduce((n, l) => n + l.up + l.down + gap, 0) - (lines.length ? gap - hangs : 0);
    const between = lines.length && body.length ? Math.max(42, big * 0.3) : 0;
    const bodyH = body.reduce((n, l) => n + l.h, 0) - (body.length ? lineH - small : 0);
    const need = headH + between + bodyH;
    return { big, small, gap, lines, body, lineH, between, hangs, need, fits: !tooWide && need <= bottom - top };
  };
  // Start big and step down together until every word fits across and the page fits down.
  // The text only gets smaller when there is a lot of it, never just because the header had to.
  let fit = measure(220, 46);
  for (let k = 1; !fit.fits && k > 0.2; k -= 0.04) {
    for (let small = 46; !fit.fits && small >= Math.max(18, 46 * Math.sqrt(k)); small -= 3) fit = measure(Math.max(40, 220 * k), small);
  }

  // What's left over is shared above and below, a little more below.
  let y = top + Math.max(0, bottom - top - fit.need) * 0.42;
  const rtl = startsHebrew(header);
  ctx.fillStyle = "#000";
  const headerAlign = sign.headerAlign ?? naturalAlign(header);
  const textAlign = sign.textAlign ?? naturalAlign(sign.text);
  // The header is one block: only its very last line counts as the finishing line.
  fit.lines.forEach((line, i) => {
    ctx.font = bigFont(fit.big, line.text);
    put(ctx, line.text, M, y + line.up, wide, rtl, headerAlign, i === fit.lines.length - 1);
    y += line.up + line.down + fit.gap;
  });
  if (fit.lines.length) y += fit.hangs - fit.gap + fit.between;

  ctx.fillStyle = "#222";
  for (const line of fit.body) {
    if (line.text) {
      ctx.font = smallFont(fit.small, line.text);
      put(ctx, line.text, M, y + fit.small * 0.92, wide, line.rtl, textAlign, line.last);
    }
    y += line.h;
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

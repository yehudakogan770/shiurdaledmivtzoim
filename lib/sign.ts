import { BW_LOGO, BW_LOGO_BOX } from "./sign-logo";

/**
 * Draws a sign (8.5x11, black and white) from what was typed in the Sign Creator, and turns it
 * into a picture or a PDF. Everything is drawn by hand so the download looks exactly like the preview.
 */

/** A stretch of words that share a look: bold, italic, underlined, with a line through. */
export interface SignRun {
  t: string;
  b?: boolean;
  i?: boolean;
  u?: boolean;
  s?: boolean;
}
export type SignLine = SignRun[];
export type SignStyle = "b" | "i" | "u" | "s";

export interface SignText {
  /** The big header and the regular text under it, as typed: one entry for each line. */
  header: SignLine[];
  text: SignLine[];
  /** Which side each one leans to. Left out means left for English and right for Hebrew. */
  headerAlign?: SignAlign;
  textAlign?: SignAlign;
  /** The id of a font from HEADER_FONTS and TEXT_FONTS. Left out means the first one. */
  headerFont?: string;
  textFont?: string;
  /** Letter sizes in points, as in Word. Left out means the sign picks a size that fills the page. */
  headerSize?: number;
  textSize?: number;
  /** The header in capital letters (the usual way) or just as typed. */
  caps?: boolean;
  /** Where the words sit between the two bars. Left out means the sign decides (the middle). */
  place?: "top" | "middle" | "bottom";
}

/** Plain words as lines, and lines back into plain words. */
export const linesOf = (text: string): SignLine[] => text.split("\n").map((t) => (t ? [{ t }] : []));
export const plainOf = (lines: SignLine[]) => lines.map((l) => l.map((r) => r.t).join("")).join("\n");

/** "full" stretches every line edge to edge; its second word says where the last line finishes. */
export type SignAlign = "left" | "center" | "right" | "full-left" | "full-center" | "full-right";
export const SIGN_ALIGNS: SignAlign[] = ["left", "center", "right", "full-left", "full-center", "full-right"];
/** The side a sign leans to when none was chosen. */
export const naturalAlign = (lines: SignLine[]): SignAlign => (startsHebrew(plainOf(lines)) ? "right" : "left");

export const BLANK_SIGN: SignText = {
  header: linesOf("Mivtza Chanukah Kickoff"),
  text: linesOf("Come get your menorahs, candles and route before you head out.\n\nThis Friday, 12:30 PM\n770 Eastern Parkway, Downstairs"),
};

/** Points (as in Word) for a size on the page, and back. The page is 850 units across 8.5 inches. */
const PT = 0.72;
/** The bottom bar's words are the same on every sign. */
const FOOT = "If you have any money in your Pushka, please help out Mivtzoim · Cash App $sdmivtzoim87 · Zelle sdmivtzoim87@gmail.com";

/** The page, measured in its own units; the canvas is these times `scale`. */
const W = 850;
const H = 1100;
const M = 50;
/**
 * A font choice. Each one says how its English and its Hebrew are drawn: some fonts have both,
 * and the ones without Hebrew letters borrow David Libre (the font of the בס״ד).
 */
export interface SignFont {
  id: string;
  name: string;
  /** For the page's own buttons. */
  css: string;
  families: string;
  /** How heavy the letters are: [regular, bold], for English and for Hebrew. */
  english: [number, number];
  hebrew: [number, number];
  /** Hebrew letters are drawn this much larger, to stand as tall as the English beside them. */
  grow: number;
}
const face = (id: string, name: string, family: string, english: [number, number], hebrew = english, grow = 1.1, hebrewFamily = family): SignFont => ({
  id,
  name,
  css: `"${family}", "David Libre", sans-serif`,
  families: `"${family}", "${hebrewFamily}", sans-serif`,
  english,
  hebrew,
  grow,
});
// A font with only one weight is thickened by the browser when bold is chosen.
export const HEADER_FONTS: SignFont[] = [
  face("anton", "Anton", "Anton", [400, 700], [700, 700], 1.22, "David Libre"),
  face("rubik", "Rubik", "Rubik", [800, 900]),
  face("secular", "Secular One", "Secular One", [400, 700]),
  face("suez", "Suez One", "Suez One", [400, 700]),
  face("frank", "Frank Ruhl Libre", "Frank Ruhl Libre", [700, 900]),
];
export const TEXT_FONTS: SignFont[] = [
  face("sans", "Google Sans", "Google Sans Flex", [500, 700], [500, 700], 1.12, "David Libre"),
  face("rubik", "Rubik", "Rubik", [500, 800]),
  face("heebo", "Heebo", "Heebo", [500, 800]),
  face("assistant", "Assistant", "Assistant", [500, 800]),
  face("frank", "Frank Ruhl Libre", "Frank Ruhl Libre", [500, 800]),
];
const fontOf = (list: SignFont[], id?: string) => list.find((f) => f.id === id) ?? list[0];
/** The font for some words at a size. `hebrew` is for anything inside Hebrew text, numbers included. */
const fontAt = (font: SignFont, size: number, hebrew: boolean, style: { b?: boolean; i?: boolean } = {}) =>
  `${style.i ? "italic " : ""}${(hebrew ? font.hebrew : font.english)[style.b ? 1 : 0]} ${hebrew ? size * font.grow : size}px ${font.families}`;
const SANS = `"Google Sans Flex", "David Libre", system-ui, sans-serif`;
// The top and bottom bars are dark gray, not solid black.
const BAR = "#4d4d4d";
const STRIPE = "#ababab";
const HEBREW = /[֐-׿]/;

/** The fonts the signs can use. Most are only used here, so they are fetched when this page opens. */
export async function loadSignFonts() {
  if (!document.getElementById("sign-fonts")) {
    const link = document.createElement("link");
    link.id = "sign-fonts";
    link.rel = "stylesheet";
    link.href = "https://fonts.googleapis.com/css2?family=Anton&family=Assistant:wght@500;800&family=David+Libre:wght@500;700&family=Frank+Ruhl+Libre:wght@500;700;800;900&family=Heebo:wght@500;800&family=Rubik:wght@500;800;900&family=Secular+One&family=Suez+One&display=swap";
    document.head.appendChild(link);
    await new Promise((done) => {
      link.onload = done;
      link.onerror = done;
    });
  }
  // A font that can't be fetched (no internet) just falls back to a plain one.
  const all = [...HEADER_FONTS, ...TEXT_FONTS].flatMap((f) => [false, true].flatMap((bold) => [fontAt(f, 40, false, { b: bold }), fontAt(f, 40, true, { b: bold })]));
  await Promise.all([...new Set(all), `700 22px "David Libre"`].map((f) => document.fonts.load(f, "Aבס").catch(() => null)));
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

/** A word (or a piece of punctuation split off it) ready to draw. */
interface Token {
  parts: { t: string; font: string; w: number; rtl: boolean; u?: boolean; s?: boolean }[];
  w: number;
  /** Sits right against the word before it, with no space. */
  glue: boolean;
  /** Punctuation split off a word of the other language. */
  punct?: boolean;
  /** Hebrew, English, or neither (numbers and punctuation). */
  kind: "R" | "L" | "N";
}
const kindOf = (t: string): Token["kind"] => (HEBREW.test(t) ? "R" : /[A-Za-z]/.test(t) ? "L" : "N");

/** Turns one typed line into words, each measured in its own font and look. */
function tokens(ctx: Ctx, line: SignLine, font: SignFont, size: number, rtl: boolean, caps: boolean) {
  const hebrew = line.some((r) => HEBREW.test(r.t));
  const out: Token[] = [];
  let open: Token | null = null;
  const add = (t: string, r: SignRun, glue: boolean) => {
    ctx.font = fontAt(font, size, hebrew, r);
    const part = { t, font: ctx.font, w: ctx.measureText(t).width, rtl: HEBREW.test(t), u: r.u, s: r.s };
    if (open && !glue) open = null;
    if (!open) out.push((open = { parts: [], w: 0, glue, kind: "N" }));
    open.parts.push(part);
    open.w += part.w;
    open.kind = open.kind === "R" || part.rtl ? "R" : open.kind === "L" || /[A-Za-z]/.test(t) ? "L" : "N";
  };
  for (const run of line) {
    const pieces = (caps ? run.t.toUpperCase() : run.t).replace(/\u00a0/g, " ").split(/( +)/);
    pieces.forEach((piece, i) => {
      if (i % 2) open = null;
      else if (piece) add(piece, run, !!open);
    });
  }
  // English inside Hebrew (and Hebrew inside English) keeps its own direction, but the punctuation
  // touching it belongs to the sentence around it, so that is split off to be placed on its own.
  return out.flatMap((tok) => {
    const foreign = tok.kind !== "N" && (tok.kind === "R") !== rtl;
    const m = foreign && tok.parts.length === 1 ? tok.parts[0].t.match(/^([^\p{L}\p{N}]*)(.*?)([^\p{L}\p{N}]*)$/u) : null;
    if (!m || (!m[1] && !m[3]) || !m[2]) return [tok];
    const base = tok.parts[0];
    const made = [m[1], m[2], m[3]].map((t, i) => {
      ctx.font = base.font;
      const w = ctx.measureText(t).width;
      return { parts: [{ ...base, t, w, rtl: HEBREW.test(t) }], w, glue: true, punct: i !== 1, kind: kindOf(t) } as Token;
    });
    const kept = made.filter((x) => x.parts[0].t);
    kept[0].glue = tok.glue;
    return kept;
  });
}

/** Breaks words into lines that fit `max`. `tooWide` says a single word didn't fit. */
function wrapTokens(list: Token[], space: number, max: number) {
  const lines: Token[][] = [];
  let line: Token[] = [];
  let width = 0;
  let tooWide = false;
  for (const tok of list) {
    const gap = line.length && !tok.glue ? space : 0;
    if (line.length && !tok.glue && width + gap + tok.w > max) {
      lines.push(line);
      line = [];
      width = 0;
    }
    width += (line.length && !tok.glue ? space : 0) + tok.w;
    line.push(tok);
    if (width > max) tooWide = true;
  }
  if (line.length) lines.push(line);
  return { lines, tooWide };
}

/**
 * One line of words, leaning to the chosen side. `last` is the final line of its paragraph, which
 * a "full" side doesn't stretch. Words are placed one by one so each can have its own look.
 */
function put(ctx: Ctx, line: Token[], x: number, y: number, width: number, rtl: boolean, align: SignAlign, last: boolean, space: number, size: number) {
  // The order the words appear in from left to right: Hebrew runs right to left, and a run of
  // English inside it still reads left to right (and the other way around).
  const order = line.map((_, i) => i);
  if (rtl) order.reverse();
  const foreign = rtl ? "L" : "R";
  for (let i = 0; i < order.length; i++) {
    if (line[order[i]].kind !== foreign) continue;
    let j = i;
    for (let k = i + 1; k < order.length && line[order[k]].kind !== (rtl ? "R" : "L"); k++) if (line[order[k]].kind === foreign) j = k;
    if (j > i) order.splice(i, j - i + 1, ...order.slice(i, j + 1).reverse());
    i = j;
  }
  // Two words keep a space between them, unless one is punctuation stuck to the edge of a run
  // of the other language (the comma after "770 Eastern Parkway," inside Hebrew).
  const gapAfter = order.map((a, i) => {
    const b = order[i + 1];
    if (b === undefined) return 0;
    const stuck = (p: Token, word: Token) => p.punct && word.kind === foreign;
    return stuck(line[a], line[b]) || stuck(line[b], line[a]) ? 0 : space;
  });
  const natural = line.reduce((n, tok) => n + tok.w, 0) + gapAfter.reduce((a, b) => a + b, 0);
  const full = align.startsWith("full");
  const side = (full ? align.slice(5) : align) as "left" | "center" | "right";
  const gaps = gapAfter.filter(Boolean).length;
  // A short line pulled across the whole page would be mostly gaps.
  const stretch = full && !last && gaps > 0 && natural > width * 0.6 ? (width - natural) / gaps : 0;
  let at = stretch ? x : side === "left" ? x : side === "right" ? x + width - natural : x + (width - natural) / 2;
  // Underline and line-through are drawn by hand, as thick as suits the size of the letters.
  const thick = Math.max(1.5, size * (size > 60 ? 0.045 : 0.065));
  ctx.textAlign = "left";
  order.forEach((index, i) => {
    const tok = line[index];
    const next = line[order[i + 1]];
    const gap = gapAfter[i] ? gapAfter[i] + stretch : 0;
    const parts = tok.kind === "R" ? [...tok.parts].reverse() : tok.parts;
    parts.forEach((part, k) => {
      ctx.font = part.font;
      ctx.direction = part.rtl ? "rtl" : "ltr";
      ctx.fillText(part.t, at, y);
      // The line carries on across the space when the next word has it too.
      const on = (key: "u" | "s") => (k === parts.length - 1 && next?.parts.every((p) => p[key]) ? gap : 0);
      if (part.u) ctx.fillRect(at, y + size * 0.1, part.w + on("u"), thick);
      if (part.s) ctx.fillRect(at, y - size * 0.3, part.w + on("s"), thick);
      at += part.w;
    });
    at += gap;
  });
  ctx.direction = "ltr";
}

/** What the sign ended up with, for the page to show. */
export interface SignFit {
  headerSize: number;
  textSize: number;
  /** A chosen size was too big for the page and was made smaller. */
  shrunk: boolean;
}

/** Draws the whole sign. `scale` 3 gives a print-quality page (2550 x 3300). */
export async function drawSign(canvas: HTMLCanvasElement, sign: SignText, scale: number): Promise<SignFit> {
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
  const headFont = fontOf(HEADER_FONTS, sign.headerFont);
  const textFont = fontOf(TEXT_FONTS, sign.textFont);
  const trim = (lines: SignLine[]) => {
    const filled = lines.map((l) => l.filter((r) => r.t)).map((l) => (l.some((r) => r.t.trim()) ? l : []));
    while (filled.length && !filled[0].length) filled.shift();
    while (filled.length && !filled[filled.length - 1].length) filled.pop();
    return filled;
  };
  const headLines = trim(sign.header).filter((l) => l.length);
  const textLines = trim(sign.text);
  const caps = sign.caps ?? true;
  // Lines the person chose themselves are kept whole: the words get smaller rather than split.
  const ownLines = headLines.length > 1;
  const headRtl = startsHebrew(plainOf(headLines));
  // Hebrew text keeps every line on the right, even a line that starts with a number.
  const textRtl = startsHebrew(plainOf(textLines));
  const underlined = headLines.some((l) => l.some((r) => r.u));

  const measure = (big: number, small: number) => {
    let tooWide = false;
    const cap = ((ctx.font = fontAt(headFont, big, false)), ctx.measureText("H").actualBoundingBoxAscent || big * 0.72);
    // Anton is tall and narrow and can sit tight; the wider fonts need a little more air between lines.
    const gap = big * (headFont.id === "anton" ? 0.15 : 0.21);
    const bigSpace = ((ctx.font = fontAt(headFont, big, false)), ctx.measureText(" ").width);
    const lines = headLines.flatMap((part) => {
      // Every Hebrew line gets the same room (measured on a plain letter), so the lines are evenly
      // spaced whether or not they have a tall ל or a hanging ך.
      const hebrew = part.some((r) => HEBREW.test(r.t));
      const w = wrapTokens(tokens(ctx, part, headFont, big, headRtl, caps), bigSpace, wide);
      tooWide ||= w.tooWide || (ownLines && w.lines.length > 1);
      const up = hebrew ? ((ctx.font = fontAt(headFont, big, true)), ctx.measureText("ה").actualBoundingBoxAscent) : cap;
      const lowercase = !caps && !hebrew ? big * 0.2 : 0;
      return w.lines.map((words) => ({ words, up, down: (hebrew ? big * 0.12 : lowercase) + (underlined ? big * 0.12 : 0) }));
    });
    const hangs = lines.length && lines[lines.length - 1].words.some((t) => t.parts.some((p) => /[ךןףץק]/.test(p.t))) ? big * 0.14 : 0;
    const lineH = small * 1.4;
    const smallSpace = ((ctx.font = fontAt(textFont, small, false)), ctx.measureText(" ").width);
    const body = textLines.flatMap((para) => {
      // An empty line in the box leaves a little space between paragraphs.
      if (!para.length) return [{ words: [] as Token[], h: lineH * 0.55, last: true }];
      const w = wrapTokens(tokens(ctx, para, textFont, small, textRtl, false), smallSpace, wide);
      tooWide ||= w.tooWide;
      return w.lines.map((words, i) => ({ words, h: lineH, last: i === w.lines.length - 1 }));
    });
    const headH = lines.reduce((n, l) => n + l.up + l.down + gap, 0) - (lines.length ? gap - hangs : 0);
    const between = lines.length && body.length ? Math.max(42, big * 0.3) : 0;
    const bodyH = body.reduce((n, l) => n + l.h, 0) - (body.length ? lineH - small : 0);
    const need = headH + between + bodyH;
    return { big, small, gap, lines, body, bigSpace, smallSpace, between, hangs, need, fits: !tooWide && need <= bottom - top };
  };
  // Start big and step down until every word fits across and the page fits down. A size the
  // person chose is kept as it is; the text only gets smaller when there is a lot of it.
  const ownBig = sign.headerSize ? sign.headerSize / PT : 0;
  const ownSmall = sign.textSize ? sign.textSize / PT : 0;
  let fit = measure(ownBig || 220, ownSmall || 46);
  for (let k = 1; !fit.fits && k > 0.2; k -= 0.04) {
    const big = ownBig || Math.max(40, 220 * k);
    if (ownSmall) fit = measure(big, ownSmall);
    else for (let small = 46; !fit.fits && small >= Math.max(18, 46 * Math.sqrt(k)); small -= 3) fit = measure(big, small);
  }
  // A chosen size that can't fit the page is the one case where it is made smaller anyway.
  const shrunk = !fit.fits;
  const { big: bigAsked, small: smallAsked } = fit;
  for (let k = 0.96; !fit.fits && k > 0.08; k -= 0.04) fit = measure(bigAsked * k, smallAsked * k);

  const spare = Math.max(0, bottom - top - fit.need);
  let y = top + spare * (sign.place === "top" ? 0 : sign.place === "bottom" ? 1 : 0.5);
  const headerAlign = sign.headerAlign ?? naturalAlign(headLines);
  const textAlign = sign.textAlign ?? naturalAlign(textLines);
  ctx.fillStyle = "#000";
  // The header is one block: only its very last line counts as the finishing line.
  fit.lines.forEach((line, i) => {
    put(ctx, line.words, M, y + line.up, wide, headRtl, headerAlign, i === fit.lines.length - 1, fit.bigSpace, fit.big);
    y += line.up + line.down + fit.gap;
  });
  if (fit.lines.length) y += fit.hangs - fit.gap + fit.between;

  ctx.fillStyle = "#222";
  for (const line of fit.body) {
    if (line.words.length) put(ctx, line.words, M, y + fit.small * 0.92, wide, textRtl, textAlign, line.last, fit.smallSpace, fit.small);
    y += line.h;
  }
  return { headerSize: Math.round(fit.big * PT), textSize: Math.round(fit.small * PT), shrunk };
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

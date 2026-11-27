"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { Download, FileText, FolderOpen, Minus, Plus, RotateCcw, Save, Signpost, Trash2 } from "lucide-react";
import { useData } from "@/lib/data";
import { t } from "@/lib/i18n";
import type { SavedSign } from "@/lib/types";
import { BLANK_SIGN, HEADER_FONTS, SIGN_ALIGNS, TEXT_FONTS, drawSign, linesOf, loadSignFonts, naturalAlign, plainOf, signPdf, type SignAlign, type SignFit, type SignFont, type SignLine, type SignRun, type SignStyle, type SignText } from "@/lib/sign";
import { Button, Card, CardTitle, Empty, IconButton, Input, PageHeader, cx } from "../ui";

/**
 * The Sign Creator, for admins: type a header and some text, and download the sign as a picture
 * or a PDF. Every sign has the same look, with the same gray bars at the top and bottom.
 */
const DRAFT = "sdm-sign-draft";

export function SignsView() {
  const { isAdmin, isOwner } = useData();
  if (!isAdmin && !isOwner) return <Empty title={t("Admins only")} icon={Signpost} />;
  return <Creator />;
}

/** Whatever was kept (a draft, a saved sign, an older version of either) as a sign that can be drawn. */
function readSign(d: unknown): SignText | null {
  if (!d || typeof d !== "object") return null;
  const v = d as Record<string, unknown>;
  const lines = (x: unknown): SignLine[] | null => (typeof x === "string" ? linesOf(x) : Array.isArray(x) ? (x as SignLine[]).map((l) => (Array.isArray(l) ? l.filter((r) => typeof r?.t === "string") : [])) : null);
  const header = lines(v.header);
  const text = lines(v.text);
  if (!header || !text) return null;
  const side = (x: unknown) => (SIGN_ALIGNS.includes(x as SignAlign) ? (x as SignAlign) : undefined);
  const size = (x: unknown) => (typeof x === "number" && x > 4 && x < 400 ? x : undefined);
  return {
    header,
    text,
    headerAlign: side(v.headerAlign),
    textAlign: side(v.textAlign),
    headerFont: typeof v.headerFont === "string" ? v.headerFont : undefined,
    textFont: typeof v.textFont === "string" ? v.textFont : undefined,
    headerSize: size(v.headerSize),
    textSize: size(v.textSize),
    caps: typeof v.caps === "boolean" ? v.caps : undefined,
    place: v.place === "top" || v.place === "middle" || v.place === "bottom" ? v.place : undefined,
  };
}

function Creator() {
  const { notify } = useData();
  const [sign, setSign] = useState<SignText>(BLANK_SIGN);
  // Goes up when a different sign is put in (opened, or started over), so the boxes show its words.
  const [version, setVersion] = useState(0);
  const [fonts, setFonts] = useState(false);
  const [fit, setFit] = useState<SignFit | null>(null);
  // Goes up on "Start over", so the new sign isn't saved over the one that was open.
  const [fresh, setFresh] = useState(0);
  const [busy, setBusy] = useState<"png" | "pdf" | null>(null);
  const preview = useRef<HTMLCanvasElement>(null);
  const loaded = useRef(false);
  const headerBox = useRef<RichHandle>(null);
  const textBox = useRef<RichHandle>(null);

  const put = (next: SignText) => {
    setSign(next);
    setVersion((v) => v + 1);
  };

  useEffect(() => {
    // What was typed stays on this device, so a sign can be finished later.
    try {
      const d = readSign(JSON.parse(localStorage.getItem(DRAFT) || "null"));
      if (d) put(d);
    } catch {
      // No draft.
    }
    loaded.current = true;
    loadSignFonts().then(() => setFonts(true));
  }, []);

  useEffect(() => {
    if (loaded.current) localStorage.setItem(DRAFT, JSON.stringify(sign));
    if (preview.current) drawSign(preview.current, sign, 2).then(setFit);
  }, [sign, fonts]);

  const set = (change: Partial<SignText>) => setSign((s) => ({ ...s, ...change }));

  async function download(kind: "png" | "pdf") {
    setBusy(kind);
    try {
      const page = document.createElement("canvas");
      await drawSign(page, sign, 3);
      const blob = kind === "pdf" ? await signPdf(page) : await new Promise<Blob>((done, fail) => page.toBlob((b) => (b ? done(b) : fail(new Error())), "image/png"));
      // English letters only: some browsers drop a file name that has Hebrew in it.
      const name = (plainOf(sign.header).trim().replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "") || "sign") + "." + kind;
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = name;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 30_000);
    } catch {
      notify(t("The sign couldn't be downloaded. Please try again."));
    }
    setBusy(null);
  }

  return (
    <div className="grid grid-cols-1 gap-3">
      <PageHeader title={t("Sign Creator")} subtitle={t("Type a header and your text, then download the sign ready to print.")} back={{ href: "/admin", label: t("Admin") }} />
      {/* Upright screens stack the boxes over the sign; sideways screens (of any size) put them side by side. */}
      <div className="grid grid-cols-1 items-start gap-3 landscape:grid-cols-[minmax(0,1fr)_min(30rem,42%)]">
        <div className="grid grid-cols-1 gap-3">
          <Card>
            <CardTitle sub={t("The big words at the top. Press Enter to start a new line.")}>{t("Header")}</CardTitle>
            <div className="px-6 pb-5">
              <RichBox ref={headerBox} label={t("Header")} rows={2} value={sign.header} version={version} onChange={(header) => set({ header })} />
              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
                <Sides label={t("Header")} value={sign.headerAlign ?? naturalAlign(sign.header)} onChange={(headerAlign) => set({ headerAlign })} />
                <Styles label={t("Header")} lines={sign.header} onPick={(style) => headerBox.current?.style(style)}>
                  <Toggle name={t("Capital letters")} on={sign.caps ?? true} onClick={() => set({ caps: !(sign.caps ?? true) })} className="text-sm font-medium">
                    AA
                  </Toggle>
                </Styles>
              </div>
              <Fonts label={t("Header")} fonts={HEADER_FONTS} value={sign.headerFont} onChange={(headerFont) => set({ headerFont })} />
              <Size label={t("Header")} chosen={sign.headerSize} shown={fit?.headerSize} step={6} onChange={(headerSize) => set({ headerSize })} />
            </div>
          </Card>
          <Card>
            <CardTitle sub={t("The regular text under the header. Leave an empty line for a space between parts.")}>{t("Text")}</CardTitle>
            <div className="px-6 pb-5">
              <RichBox ref={textBox} label={t("Text")} rows={7} value={sign.text} version={version} onChange={(text) => set({ text })} />
              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
                <Sides label={t("Text")} value={sign.textAlign ?? naturalAlign(sign.text)} onChange={(textAlign) => set({ textAlign })} />
                <Styles label={t("Text")} lines={sign.text} onPick={(style) => textBox.current?.style(style)} />
              </div>
              <Fonts label={t("Text")} fonts={TEXT_FONTS} value={sign.textFont} onChange={(textFont) => set({ textFont })} />
              <Size label={t("Text")} chosen={sign.textSize} shown={fit?.textSize} step={2} onChange={(textSize) => set({ textSize })} />
            </div>
          </Card>
          <Card>
            <CardTitle sub={t("Where the words sit between the top and bottom bars.")}>{t("Place on the page")}</CardTitle>
            <div role="group" aria-label={t("Place on the page")} className="flex flex-wrap gap-1.5 px-6 pb-5">
              {([undefined, "top", "middle", "bottom"] as const).map((place) => (
                <Toggle key={place ?? "auto"} name={place === "top" ? t("Top") : place === "middle" ? t("Middle") : place === "bottom" ? t("Bottom") : t("Automatic")} on={sign.place === place} onClick={() => set({ place })} wide>
                  {place === "top" ? t("Top") : place === "middle" ? t("Middle") : place === "bottom" ? t("Bottom") : t("Automatic")}
                </Toggle>
              ))}
            </div>
          </Card>
          <SavedSigns sign={sign} onOpen={put} fresh={fresh} />
        </div>

        <div className="grid gap-3 landscape:sticky landscape:top-20 lg:landscape:top-4">
          <canvas ref={preview} aria-label={t("How the sign looks")} className="mx-auto h-auto w-full rounded-xl shadow-[0_10px_40px_rgba(0,0,0,.18)] landscape:max-h-[calc(100dvh-12rem)] landscape:w-auto landscape:max-w-full" />
          {fit?.shrunk && <p className="text-sm text-muted">{t("The size you chose doesn't fit on the page, so the sign made it smaller.")}</p>}
          <div className="flex flex-wrap gap-2">
            <Button type="button" disabled={!!busy} onClick={() => download("pdf")}>
              <FileText size={18} aria-hidden /> {busy === "pdf" ? t("Making it…") : t("Download PDF")}
            </Button>
            <Button type="button" variant="tonal" disabled={!!busy} onClick={() => download("png")}>
              <Download size={18} aria-hidden /> {busy === "png" ? t("Making it…") : t("Download Picture")}
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                put(BLANK_SIGN);
                setFresh((n) => n + 1);
              }}
            >
              <RotateCcw size={18} aria-hidden /> {t("Start over")}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

/** One small square button that is either on or off. */
function Toggle({ name, on, onClick, className, wide, children }: { name: string; on: boolean; onClick(): void; className?: string; wide?: boolean; children: React.ReactNode }) {
  return (
    <button
      type="button"
      title={name}
      aria-label={name}
      aria-pressed={on}
      // Keeps the words selected in the box while the button is pressed.
      onPointerDown={(e) => e.preventDefault()}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={cx("grid h-10 place-items-center rounded-lg transition-colors", wide ? "px-3.5 text-sm" : "w-11", className, on ? "bg-accent text-accent-ink" : "bg-sunken text-muted hover:bg-ink/8 hover:text-ink")}
    >
      {children}
    </button>
  );
}

/**
 * Which side the words lean to, shown the way writing programs do: little lines. In the "full"
 * ones every line reaches both edges, and the short last line shows where the text finishes.
 */
const LINES: Record<SignAlign, [number, number][]> = {
  left: [[3, 21], [3, 14], [3, 21], [3, 11]],
  center: [[3, 21], [7, 17], [3, 21], [8.5, 15.5]],
  right: [[3, 21], [10, 21], [3, 21], [13, 21]],
  "full-left": [[3, 21], [3, 21], [3, 21], [3, 12]],
  "full-center": [[3, 21], [3, 21], [3, 21], [7.5, 16.5]],
  "full-right": [[3, 21], [3, 21], [3, 21], [12, 21]],
};

function Sides({ label, value, onChange }: { label: string; value: SignAlign; onChange(v: SignAlign): void }) {
  const names: Record<SignAlign, string> = {
    left: t("Left"),
    center: t("Center"),
    right: t("Right"),
    "full-left": t("Full, ends left"),
    "full-center": t("Full, ends center"),
    "full-right": t("Full, ends right"),
  };
  return (
    // Always left to right, so "left" is on the left in Hebrew too.
    <div role="group" dir="ltr" aria-label={t("{what}: which side it leans to", { what: label })} className="flex flex-wrap gap-1.5">
      {SIGN_ALIGNS.map((a) => (
        <Toggle key={a} name={names[a]} on={a === value} onClick={() => onChange(a)} className={a === "full-left" ? "ms-2" : undefined}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
            {LINES[a].map(([from, to], i) => (
              <path key={i} d={`M${from} ${5 + i * 4.7}H${to}`} />
            ))}
          </svg>
        </Toggle>
      ))}
    </div>
  );
}

/**
 * Bold, italic, underline and line-through. They change the words that are selected in the box;
 * with nothing selected they change everything. A button is lit when all the words have its look.
 */
function Styles({ label, lines, onPick, children }: { label: string; lines: SignLine[]; onPick(style: SignStyle): void; children?: React.ReactNode }) {
  const kinds: [SignStyle, string, string, string][] = [
    ["b", "B", t("Bold"), "text-lg font-bold"],
    ["i", "I", t("Italic"), "font-serif text-lg italic"],
    ["u", "U", t("Underline"), "text-lg underline underline-offset-2"],
    ["s", "S", t("Line through"), "text-lg line-through"],
  ];
  const runs = lines.flat().filter((r) => r.t.trim());
  return (
    <div role="group" dir="ltr" aria-label={t("{what}: style", { what: label })} className="flex flex-wrap gap-1.5">
      {kinds.map(([key, letter, name, look]) => (
        <Toggle key={key} name={name} on={runs.length > 0 && runs.every((r) => r[key])} onClick={() => onPick(key)} className={look}>
          {letter}
        </Toggle>
      ))}
      {children}
    </div>
  );
}

/** The fonts to choose from, each button written in its own font. */
function Fonts({ label, fonts, value, onChange }: { label: string; fonts: SignFont[]; value?: string; onChange(id: string): void }) {
  const chosen = fonts.find((f) => f.id === value) ?? fonts[0];
  return (
    <div role="group" dir="ltr" aria-label={t("{what}: font", { what: label })} className="mt-2 flex flex-wrap gap-1.5">
      {fonts.map((f) => (
        <button
          key={f.id}
          type="button"
          aria-pressed={f === chosen}
          onClick={() => onChange(f.id)}
          style={{ fontFamily: f.css }}
          className={cx("h-10 rounded-lg px-3.5 text-base transition-colors", f === chosen ? "bg-accent text-accent-ink" : "bg-sunken text-muted hover:bg-ink/8 hover:text-ink")}
        >
          {f.name}
        </button>
      ))}
    </div>
  );
}

/** The letter size: left to the sign ("Automatic"), or chosen with − and +, in points as in Word. */
function Size({ label, chosen, shown, step, onChange }: { label: string; chosen?: number; shown?: number; step: number; onChange(size: number | undefined): void }) {
  const now = chosen ?? shown ?? 0;
  const move = (by: number) => onChange(Math.min(300, Math.max(8, now + by)));
  return (
    <div role="group" dir="ltr" aria-label={t("{what}: size", { what: label })} className="mt-2 flex flex-wrap items-center gap-1.5">
      <Toggle name={t("Automatic size")} on={chosen === undefined} onClick={() => onChange(chosen === undefined ? now || undefined : undefined)} wide>
        {t("Automatic size")}
      </Toggle>
      <Toggle name={t("Smaller")} on={false} onClick={() => move(-step)}>
        <Minus size={18} aria-hidden />
      </Toggle>
      <span aria-live="polite" className="min-w-14 text-center text-sm tabular-nums text-ink">
        {now ? t("{n} pt", { n: now }) : ""}
      </span>
      <Toggle name={t("Bigger")} on={false} onClick={() => move(step)}>
        <Plus size={18} aria-hidden />
      </Toggle>
    </div>
  );
}

/** Signs kept in the database: only their words and choices, so they take almost no room. */
function SavedSigns({ sign, onOpen, fresh }: { sign: SignText; onOpen(sign: SignText): void; fresh: number }) {
  const { backend, notify } = useData();
  const [list, setList] = useState<SavedSign[] | null>(null);
  const [missing, setMissing] = useState(false);
  const [name, setName] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // The table comes with database update 024; until it is run, saving just isn't offered.
  const fail = (e: Error) => (/signs|relation|schema cache/i.test(e.message) ? setMissing(true) : notify(e.message));

  useEffect(() => {
    backend?.list("signs").then((rows) => setList([...rows].sort((a, b) => b.created_at.localeCompare(a.created_at))), fail);
    // Loaded once, when the page opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [backend]);

  useEffect(() => {
    setOpenId(null);
    setName("");
  }, [fresh]);

  const current = list?.find((s) => s.id === openId && s.name === name.trim());
  async function save() {
    const title = name.trim() || plainOf(sign.header).replace(/\s+/g, " ").trim().slice(0, 60);
    if (!backend || !title) return notify(t("Give the sign a name first."));
    setBusy(true);
    try {
      if (current) {
        await backend.update("signs", current.id, { data: sign });
        setList((l) => (l ?? []).map((s) => (s.id === current.id ? { ...s, data: sign } : s)));
      } else {
        const row = await backend.insert("signs", { name: title, data: sign });
        setList((l) => [row, ...(l ?? [])]);
        setOpenId(row.id);
        setName(row.name);
      }
      notify(t("Sign saved."));
    } catch (e) {
      fail(e as Error);
    }
    setBusy(false);
  }
  async function remove(s: SavedSign) {
    if (!confirm(t("Delete the saved sign \"{name}\"?", { name: s.name }))) return;
    try {
      await backend!.remove("signs", s.id);
      setList((l) => (l ?? []).filter((x) => x.id !== s.id));
    } catch (e) {
      fail(e as Error);
    }
  }

  return (
    <Card>
      <CardTitle sub={t("Keep a sign to open again later and change. Only the words are kept, not a picture.")}>{t("Saved signs")}</CardTitle>
      <div className="px-6 pb-5">
        {missing ? (
          <p className="text-sm text-muted">{t("Saving signs needs database update 024. Everything else works without it.")}</p>
        ) : (
          <>
            <div className="flex flex-wrap gap-2">
              <Input aria-label={t("Name of this sign")} placeholder={t("Name of this sign")} value={name} onChange={(e) => setName(e.target.value)} className="min-w-0 flex-1 basis-48" />
              <Button type="button" disabled={busy} onClick={save}>
                <Save size={18} aria-hidden /> {current ? t("Save changes") : t("Save")}
              </Button>
            </div>
            {list && list.length > 0 && (
              <ul className="mt-3 divide-y divide-line/60">
                {list.map((s) => (
                  <li key={s.id} className="flex items-center gap-2 py-1.5">
                    <button
                      type="button"
                      className="flex min-w-0 flex-1 items-center gap-3 rounded-lg px-2 py-2 text-start hover:bg-ink/8"
                      onClick={() => {
                        const d = readSign(s.data);
                        if (!d) return notify(t("That sign couldn't be opened."));
                        onOpen(d);
                        setOpenId(s.id);
                        setName(s.name);
                      }}
                    >
                      <FolderOpen size={18} aria-hidden className="shrink-0 text-muted" />
                      <span className="min-w-0 flex-1 truncate" dir="auto">
                        {s.name}
                      </span>
                      <span className="shrink-0 text-sm text-muted">{new Date(s.created_at).toLocaleDateString()}</span>
                    </button>
                    <IconButton type="button" aria-label={t("Delete {name}", { name: s.name })} onClick={() => remove(s)}>
                      <Trash2 size={18} />
                    </IconButton>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>
    </Card>
  );
}

/* ---------- The boxes to type in ---------- */

const escape = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
/** The words as the box shows them: plain tags for each look, and a line break between lines. */
const toHtml = (lines: SignLine[]) =>
  lines
    .map((line) =>
      line
        .map((r) => {
          let html = escape(r.t);
          if (r.b) html = `<b>${html}</b>`;
          if (r.i) html = `<i>${html}</i>`;
          if (r.u) html = `<u>${html}</u>`;
          if (r.s) html = `<s>${html}</s>`;
          return html;
        })
        .join(""),
    )
    .join("<br>");

/** Reads the box back into lines of words and their looks, whatever tags the browser used. */
function fromBox(box: HTMLElement): SignLine[] {
  const lines: SignLine[] = [[]];
  const add = (text: string, st: Omit<SignRun, "t">) => {
    text.split("\n").forEach((piece, i) => {
      if (i) lines.push([]);
      if (!piece) return;
      const line = lines[lines.length - 1];
      const last = line[line.length - 1];
      if (last && !last.b === !st.b && !last.i === !st.i && !last.u === !st.u && !last.s === !st.s) last.t += piece;
      else line.push({ t: piece, ...(st.b && { b: true }), ...(st.i && { i: true }), ...(st.u && { u: true }), ...(st.s && { s: true }) });
    });
  };
  const walk = (node: Node, st: Omit<SignRun, "t">) => {
    if (node.nodeType === Node.TEXT_NODE) return add((node.textContent ?? "").replace(/ /g, " "), st);
    if (!(node instanceof HTMLElement)) return;
    const tag = node.tagName;
    if (tag === "BR") return void lines.push([]);
    const block = tag === "DIV" || tag === "P" || tag === "LI";
    if (block && lines[lines.length - 1].length) lines.push([]);
    const css = node.style;
    const deco = css.textDecorationLine || css.textDecoration || "";
    const next = {
      b: css.fontWeight ? css.fontWeight === "bold" || Number(css.fontWeight) >= 600 : st.b || tag === "B" || tag === "STRONG",
      i: css.fontStyle ? css.fontStyle === "italic" : st.i || tag === "I" || tag === "EM",
      u: st.u || tag === "U" || deco.includes("underline"),
      s: st.s || tag === "S" || tag === "STRIKE" || tag === "DEL" || deco.includes("line-through"),
    };
    node.childNodes.forEach((child) => walk(child, next));
    if (block && lines[lines.length - 1].length) lines.push([]);
  };
  box.childNodes.forEach((child) => walk(child, {}));
  // The browser keeps an empty line at the end to put the cursor on; it isn't part of the words.
  while (lines.length > 1 && !lines[lines.length - 1].length) lines.pop();
  return lines;
}

interface RichHandle {
  style(kind: SignStyle): void;
}
const COMMAND: Record<SignStyle, string> = { b: "bold", i: "italic", u: "underline", s: "strikeThrough" };

/** A box to type in where single words can be bold, italic, underlined or crossed out. */
const RichBox = forwardRef<RichHandle, { label: string; rows: number; value: SignLine[]; version: number; onChange(lines: SignLine[]): void }>(function RichBox({ label, rows, value, version, onChange }, ref) {
  const box = useRef<HTMLDivElement>(null);
  const changed = useRef(onChange);
  useEffect(() => {
    changed.current = onChange;
  });

  // The box keeps its own words while typing; they are only put in from outside when a different sign is opened.
  useEffect(() => {
    if (box.current) box.current.innerHTML = toHtml(value);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version]);

  useEffect(() => {
    const el = box.current!;
    // Enter always makes a plain line break, so every browser keeps the words the same way.
    const before = (e: InputEvent) => {
      if (e.inputType !== "insertParagraph") return;
      e.preventDefault();
      document.execCommand("insertLineBreak");
    };
    el.addEventListener("beforeinput", before);
    return () => el.removeEventListener("beforeinput", before);
  }, []);

  useImperativeHandle(ref, () => ({
    style(kind) {
      const el = box.current!;
      el.focus();
      const sel = window.getSelection()!;
      const inside = sel.rangeCount > 0 && el.contains(sel.anchorNode) && el.contains(sel.focusNode);
      // Nothing selected: the look goes on all the words.
      const all = !inside || sel.isCollapsed;
      if (all) sel.selectAllChildren(el);
      document.execCommand("styleWithCSS", false, "false");
      document.execCommand(COMMAND[kind]);
      if (all) sel.collapseToEnd();
      changed.current(fromBox(el));
    },
  }));

  return (
    <div
      ref={box}
      role="textbox"
      aria-multiline
      aria-label={label}
      dir="auto"
      contentEditable
      suppressContentEditableWarning
      spellCheck
      onInput={(e) => onChange(fromBox(e.currentTarget))}
      onPaste={(e) => {
        // Pasted words come in plain, without the look they had somewhere else.
        e.preventDefault();
        e.clipboardData
          .getData("text/plain")
          .replace(/\r/g, "")
          .split("\n")
          .forEach((line, i) => {
            if (i) document.execCommand("insertLineBreak");
            if (line) document.execCommand("insertText", false, line);
          });
      }}
      style={{ minHeight: `${rows * 1.5 + 1.5}rem` }}
      className="w-full whitespace-pre-wrap break-words rounded-2xl border-2 border-transparent bg-sunken px-4 py-3 text-base text-ink transition-colors focus:border-accent focus:bg-surface focus:outline-none"
    />
  );
});

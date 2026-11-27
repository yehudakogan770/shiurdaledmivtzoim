"use client";

import { useEffect, useRef, useState } from "react";
import { Download, FileText, RotateCcw, Signpost } from "lucide-react";
import { useData } from "@/lib/data";
import { t } from "@/lib/i18n";
import { BLANK_SIGN, HEADER_FONTS, SIGN_ALIGNS, TEXT_FONTS, drawSign, loadSignFonts, naturalAlign, signPdf, type SignAlign, type SignFont, type SignStyle, type SignText } from "@/lib/sign";
import { Button, Card, CardTitle, Empty, PageHeader, Textarea, cx } from "../ui";

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

function Creator() {
  const { notify } = useData();
  const [sign, setSign] = useState<SignText>(BLANK_SIGN);
  const [fonts, setFonts] = useState(false);
  const [busy, setBusy] = useState<"png" | "pdf" | null>(null);
  const preview = useRef<HTMLCanvasElement>(null);
  const loaded = useRef(false);

  useEffect(() => {
    // What was typed stays on this device, so a sign can be finished later.
    try {
      const d = JSON.parse(localStorage.getItem(DRAFT) || "null");
      const side = (v: unknown) => (SIGN_ALIGNS.includes(v as SignAlign) ? (v as SignAlign) : undefined);
      if (typeof d?.header === "string" && typeof d?.text === "string") setSign({ header: d.header, text: d.text, headerAlign: side(d.headerAlign), textAlign: side(d.textAlign), headerFont: d.headerFont, textFont: d.textFont, headerStyle: d.headerStyle ?? undefined, textStyle: d.textStyle ?? undefined });
    } catch {
      // No draft.
    }
    loaded.current = true;
    loadSignFonts().then(() => setFonts(true));
  }, []);

  useEffect(() => {
    if (loaded.current) localStorage.setItem(DRAFT, JSON.stringify(sign));
    if (preview.current) drawSign(preview.current, sign, 2);
  }, [sign, fonts]);

  async function download(kind: "png" | "pdf") {
    setBusy(kind);
    try {
      const page = document.createElement("canvas");
      await drawSign(page, sign, 3);
      const blob = kind === "pdf" ? await signPdf(page) : await new Promise<Blob>((done, fail) => page.toBlob((b) => (b ? done(b) : fail(new Error())), "image/png"));
      // English letters only: some browsers drop a file name that has Hebrew in it.
      const name = (sign.header.trim().replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "") || "sign") + "." + kind;
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
              <Textarea aria-label={t("Header")} dir="auto" rows={2} value={sign.header} onChange={(e) => setSign({ ...sign, header: e.target.value })} />
              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
                <Sides label={t("Header")} value={sign.headerAlign ?? naturalAlign(sign.header)} onChange={(headerAlign) => setSign({ ...sign, headerAlign })} />
                <Styles label={t("Header")} value={sign.headerStyle ?? {}} onChange={(headerStyle) => setSign({ ...sign, headerStyle })} />
              </div>
              <Fonts label={t("Header")} fonts={HEADER_FONTS} value={sign.headerFont} onChange={(headerFont) => setSign({ ...sign, headerFont })} />
            </div>
          </Card>
          <Card>
            <CardTitle sub={t("The regular text under the header. Leave an empty line for a space between parts.")}>{t("Text")}</CardTitle>
            <div className="px-6 pb-5">
              <Textarea aria-label={t("Text")} dir="auto" rows={7} value={sign.text} onChange={(e) => setSign({ ...sign, text: e.target.value })} />
              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
                <Sides label={t("Text")} value={sign.textAlign ?? naturalAlign(sign.text)} onChange={(textAlign) => setSign({ ...sign, textAlign })} />
                <Styles label={t("Text")} value={sign.textStyle ?? {}} onChange={(textStyle) => setSign({ ...sign, textStyle })} />
              </div>
              <Fonts label={t("Text")} fonts={TEXT_FONTS} value={sign.textFont} onChange={(textFont) => setSign({ ...sign, textFont })} />
            </div>
          </Card>
        </div>

        <div className="grid gap-3 landscape:sticky landscape:top-20 lg:landscape:top-4">
          <canvas ref={preview} aria-label={t("How the sign looks")} className="mx-auto h-auto w-full rounded-xl shadow-[0_10px_40px_rgba(0,0,0,.18)] landscape:max-h-[calc(100dvh-12rem)] landscape:w-auto landscape:max-w-full" />
          <div className="flex flex-wrap gap-2">
            <Button type="button" disabled={!!busy} onClick={() => download("pdf")}>
              <FileText size={18} aria-hidden /> {busy === "pdf" ? t("Making it…") : t("Download PDF")}
            </Button>
            <Button type="button" variant="tonal" disabled={!!busy} onClick={() => download("png")}>
              <Download size={18} aria-hidden /> {busy === "png" ? t("Making it…") : t("Download Picture")}
            </Button>
            <Button type="button" variant="ghost" onClick={() => setSign(BLANK_SIGN)}>
              <RotateCcw size={18} aria-hidden /> {t("Start over")}
            </Button>
          </div>
        </div>
      </div>
    </div>
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
        <button
          key={a}
          type="button"
          title={names[a]}
          aria-label={names[a]}
          aria-pressed={a === value}
          onClick={() => onChange(a)}
          className={cx("grid h-10 w-11 place-items-center rounded-lg transition-colors", a === value ? "bg-accent text-accent-ink" : "bg-sunken text-muted hover:bg-ink/8 hover:text-ink", a === "full-left" && "ms-2")}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
            {LINES[a].map(([from, to], i) => (
              <path key={i} d={`M${from} ${5 + i * 4.7}H${to}`} />
            ))}
          </svg>
        </button>
      ))}
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

/** Bold, italic, underline and line-through: each one switches on and off. */
function Styles({ label, value, onChange }: { label: string; value: SignStyle; onChange(v: SignStyle): void }) {
  const kinds: [keyof SignStyle, string, string, string][] = [
    ["bold", "B", t("Bold"), "font-bold"],
    ["italic", "I", t("Italic"), "font-serif italic"],
    ["underline", "U", t("Underline"), "underline underline-offset-2"],
    ["strike", "S", t("Line through"), "line-through"],
  ];
  return (
    <div role="group" dir="ltr" aria-label={t("{what}: style", { what: label })} className="flex flex-wrap gap-1.5">
      {kinds.map(([key, letter, name, look]) => (
        <button
          key={key}
          type="button"
          title={name}
          aria-label={name}
          aria-pressed={!!value[key]}
          onClick={() => onChange({ ...value, [key]: !value[key] })}
          className={cx("grid h-10 w-11 place-items-center rounded-lg text-lg transition-colors", look, value[key] ? "bg-accent text-accent-ink" : "bg-sunken text-muted hover:bg-ink/8 hover:text-ink")}
        >
          {letter}
        </button>
      ))}
    </div>
  );
}

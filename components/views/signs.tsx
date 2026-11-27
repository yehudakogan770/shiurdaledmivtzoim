"use client";

import { useEffect, useRef, useState } from "react";
import { Download, FileText, RotateCcw, Signpost } from "lucide-react";
import { useData } from "@/lib/data";
import { t } from "@/lib/i18n";
import { BLANK_SIGN, SIGN_ALIGNS, drawSign, loadSignFonts, naturalAlign, signPdf, type SignAlign, type SignText } from "@/lib/sign";
import { Button, Card, CardTitle, Chip, Empty, PageHeader, Textarea } from "../ui";

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
      if (typeof d?.header === "string" && typeof d?.text === "string") setSign({ header: d.header, text: d.text, headerAlign: side(d.headerAlign), textAlign: side(d.textAlign) });
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
              <Sides label={t("Header")} value={sign.headerAlign ?? naturalAlign(sign.header)} onChange={(headerAlign) => setSign({ ...sign, headerAlign })} />
            </div>
          </Card>
          <Card>
            <CardTitle sub={t("The regular text under the header. Leave an empty line for a space between parts.")}>{t("Text")}</CardTitle>
            <div className="px-6 pb-5">
              <Textarea aria-label={t("Text")} dir="auto" rows={7} value={sign.text} onChange={(e) => setSign({ ...sign, text: e.target.value })} />
              <Sides label={t("Text")} value={sign.textAlign ?? naturalAlign(sign.text)} onChange={(textAlign) => setSign({ ...sign, textAlign })} />
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

/** Which side the words lean to. "Full" stretches each line across; the last line finishes on the side named. */
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
    <div role="group" aria-label={t("{what}: which side it leans to", { what: label })} className="mt-3 flex flex-wrap gap-2">
      {SIGN_ALIGNS.map((a) => (
        <Chip key={a} selected={a === value} onClick={() => onChange(a)}>
          {names[a]}
        </Chip>
      ))}
    </div>
  );
}

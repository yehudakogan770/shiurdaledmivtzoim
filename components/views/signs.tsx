"use client";

import { useEffect, useRef, useState, type ChangeEvent, type ReactNode } from "react";
import { Download, FileText, ImagePlus, Images, Plus, RotateCcw, Signpost, X } from "lucide-react";
import { useData } from "@/lib/data";
import { t } from "@/lib/i18n";
import { BLANK_SIGN, drawSign, grayCopy, loadSignFonts, signPdf, type SignPhoto, type SignText } from "@/lib/sign";
import { Button, Card, Empty, IconButton, Input, Modal, PageHeader, Textarea, cx } from "../ui";

/**
 * The Sign Creator, for admins: type the words, choose which parts the sign has, add photos,
 * and download it as a picture or a PDF. Every sign has the same black-and-white look.
 */
const DRAFT = "sdm-sign-draft";
const MOST_PHOTOS = 3;
type Pic = { id: string; show: string; color: HTMLImageElement; gray: HTMLCanvasElement };

export function SignsView() {
  const { isAdmin, isOwner } = useData();
  if (!isAdmin && !isOwner) return <Empty title={t("Admins only")} icon={Signpost} />;
  return <Creator />;
}

function Creator() {
  const { notify } = useData();
  const [sign, setSign] = useState<SignText>(BLANK_SIGN);
  const [pics, setPics] = useState<Pic[]>([]);
  const [grayPhotos, setGrayPhotos] = useState(true);
  const [picking, setPicking] = useState(false);
  const [fonts, setFonts] = useState(false);
  const [busy, setBusy] = useState<"png" | "pdf" | null>(null);
  const preview = useRef<HTMLCanvasElement>(null);
  const loaded = useRef(false);

  useEffect(() => {
    // What was typed stays on this device, so a sign can be finished later. Photos are picked again.
    try {
      const d = JSON.parse(localStorage.getItem(DRAFT) || "null");
      if (d?.headline) setSign({ ...BLANK_SIGN, ...d });
    } catch {
      // No draft.
    }
    loaded.current = true;
    loadSignFonts().then(() => setFonts(true));
  }, []);

  const photos: SignPhoto[] = pics.map((p) => (grayPhotos ? p.gray : p.color));
  useEffect(() => {
    if (loaded.current) localStorage.setItem(DRAFT, JSON.stringify(sign));
    if (preview.current) drawSign(preview.current, sign, photos, 2);
    // `photos` is made from pics and grayPhotos.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sign, pics, grayPhotos, fonts]);

  const set = (change: Partial<SignText>) => setSign((s) => ({ ...s, ...change }));
  const setHead = (i: number, text: string) => set({ headline: sign.headline.map((l, j) => (j === i ? text : l)) as SignText["headline"] });
  const setLine = (i: number, text: string) => set({ details: { ...sign.details, lines: sign.details.lines.map((l, j) => (j === i ? text : l)) } });

  async function addPicture(source: Blob | string) {
    try {
      // Fetched as a file first, so a photo from the site can be drawn and downloaded.
      const blob = typeof source === "string" ? await (await fetch(source)).blob() : source;
      const show = URL.createObjectURL(blob);
      const color = new Image();
      await new Promise((done, fail) => {
        color.onload = done;
        color.onerror = fail;
        color.src = show;
      });
      setPics((list) => (list.length >= MOST_PHOTOS ? list : [...list, { id: show, show, color, gray: grayCopy(color) }]));
    } catch {
      notify(t("That photo couldn't be opened. Try another one."));
    }
  }

  async function download(kind: "png" | "pdf") {
    setBusy(kind);
    try {
      const page = document.createElement("canvas");
      await drawSign(page, sign, photos, 3);
      const blob = kind === "pdf" ? await signPdf(page) : await new Promise<Blob>((done, fail) => page.toBlob((b) => (b ? done(b) : fail(new Error())), "image/png"));
      const name = (sign.headline.join(" ").trim().replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-|-$/g, "") || "sign") + "." + kind;
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

  function startOver() {
    setSign(BLANK_SIGN);
    setPics([]);
    setGrayPhotos(true);
  }

  return (
    <div className="grid grid-cols-1 gap-3">
      <PageHeader title={t("Sign Creator")} subtitle={t("Type your words, choose what the sign has, and download it ready to print.")} back={{ href: "/admin", label: t("Admin") }} />
      <div className="grid grid-cols-1 items-start gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)] xl:grid-cols-[minmax(0,1fr)_minmax(0,30rem)]">
        <div className="grid grid-cols-1 gap-3">
          <Part title={t("Sticker")} hint={t("The small tilted label at the top, like \"This Friday!\".")} on={sign.sticker.on} onToggle={(on) => set({ sticker: { ...sign.sticker, on } })}>
            <Input aria-label={t("Sticker")} value={sign.sticker.text} placeholder={t("This Sunday!")} onChange={(e) => set({ sticker: { ...sign.sticker, text: e.target.value } })} />
          </Part>

          <Part title={t("Headline")} hint={t("Up to three big lines. The middle one is gray. Leave a line empty to skip it.")}>
            <div className="grid gap-2">
              {sign.headline.map((line, i) => (
                <Input key={i} aria-label={t("Headline line {n}", { n: i + 1 })} value={line} placeholder={i === 1 ? t("Middle line (gray)") : t("Line {n}", { n: i + 1 })} onChange={(e) => setHead(i, e.target.value)} />
              ))}
            </div>
          </Part>

          <Part title={t("Text")} hint={t("A sentence or two under the headline.")} on={sign.body.on} onToggle={(on) => set({ body: { ...sign.body, on } })}>
            <Textarea aria-label={t("Text")} rows={3} value={sign.body.text} onChange={(e) => set({ body: { ...sign.body, text: e.target.value } })} />
          </Part>

          <Part title={t("Details box")} hint={t("A list, one detail on each line: when, where, what to bring.")} on={sign.details.on} onToggle={(on) => set({ details: { ...sign.details, on } })}>
            <div className="grid gap-2">
              {sign.details.lines.map((line, i) => (
                <div key={i} className="flex items-center gap-1">
                  <Input aria-label={t("Detail {n}", { n: i + 1 })} value={line} onChange={(e) => setLine(i, e.target.value)} />
                  <IconButton type="button" aria-label={t("Remove this line")} onClick={() => set({ details: { ...sign.details, lines: sign.details.lines.filter((_, j) => j !== i) } })}>
                    <X size={18} />
                  </IconButton>
                </div>
              ))}
              {sign.details.lines.length < 6 && (
                <Button type="button" variant="tonal" className="justify-self-start" onClick={() => set({ details: { ...sign.details, lines: [...sign.details.lines, ""] } })}>
                  <Plus size={18} aria-hidden /> {t("Add a line")}
                </Button>
              )}
            </div>
          </Part>

          <Part title={t("Photos")} hint={t("Up to {n} photos, from the site's photo wall or from this device.", { n: MOST_PHOTOS })}>
            <div className="flex flex-wrap items-center gap-3">
              {pics.map((p) => (
                <div key={p.id} className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.show} alt="" className={cx("h-20 w-20 rounded-2xl object-cover", grayPhotos && "grayscale")} />
                  <button type="button" aria-label={t("Remove this photo")} onClick={() => setPics((list) => list.filter((x) => x.id !== p.id))} className="absolute -end-2 -top-2 grid h-7 w-7 place-items-center rounded-full bg-black text-white">
                    <X size={14} />
                  </button>
                </div>
              ))}
              {pics.length < MOST_PHOTOS && (
                <Button type="button" variant="tonal" onClick={() => setPicking(true)}>
                  <ImagePlus size={18} aria-hidden /> {t("Add a photo")}
                </Button>
              )}
            </div>
            {pics.length > 0 && (
              <label className="mt-3 flex cursor-pointer items-center gap-3 text-sm">
                <Switch on={grayPhotos} onToggle={setGrayPhotos} label={t("Black and white photos")} />
                {t("Black and white photos")}
              </label>
            )}
          </Part>

          <Part title={t("Bottom line")} hint={t("The text inside the bar at the bottom.")} on={sign.footer.on} onToggle={(on) => set({ footer: { ...sign.footer, on } })}>
            <Textarea aria-label={t("Bottom line")} rows={2} value={sign.footer.text} onChange={(e) => set({ footer: { ...sign.footer, text: e.target.value } })} />
          </Part>
        </div>

        <div className="grid gap-3 lg:sticky lg:top-4">
          <canvas ref={preview} aria-label={t("How the sign looks")} className="h-auto w-full rounded-xl shadow-[0_10px_40px_rgba(0,0,0,.18)]" />
          <div className="flex flex-wrap gap-2">
            <Button type="button" disabled={!!busy} onClick={() => download("pdf")}>
              <FileText size={18} aria-hidden /> {busy === "pdf" ? t("Making it…") : t("Download PDF")}
            </Button>
            <Button type="button" variant="tonal" disabled={!!busy} onClick={() => download("png")}>
              <Download size={18} aria-hidden /> {busy === "png" ? t("Making it…") : t("Download Picture")}
            </Button>
            <Button type="button" variant="ghost" onClick={startOver}>
              <RotateCcw size={18} aria-hidden /> {t("Start over")}
            </Button>
          </div>
        </div>
      </div>
      {picking && <PhotoPicker onClose={() => setPicking(false)} onPick={(source) => (setPicking(false), addPicture(source))} />}
    </div>
  );
}

/** One part of the sign: its name, a switch when it can be left off, and its boxes to type in. */
function Part({ title, hint, on, onToggle, children }: { title: string; hint: string; on?: boolean; onToggle?(on: boolean): void; children: ReactNode }) {
  const shown = on ?? true;
  return (
    <Card>
      <div className="flex items-center justify-between gap-4 px-6 pt-4 pb-2.5">
        <div className="min-w-0">
          <h2 className="text-lg font-medium">{title}</h2>
          <p className="text-sm text-muted">{hint}</p>
        </div>
        {onToggle && <Switch on={shown} onToggle={onToggle} label={title} />}
      </div>
      {shown ? <div className="px-6 pb-5">{children}</div> : <div className="pb-2" />}
    </Card>
  );
}

function Switch({ on, onToggle, label }: { on: boolean; onToggle(on: boolean): void; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} onClick={() => onToggle(!on)} className={cx("relative h-8 w-14 shrink-0 rounded-full transition-colors", on ? "bg-accent" : "bg-ink/20")}>
      <span className={cx("absolute top-1 h-6 w-6 rounded-full bg-white shadow transition-all", on ? "start-7" : "start-1")} />
    </button>
  );
}

/** Choose a photo from the site's photo wall, or one from this device. */
function PhotoPicker({ onClose, onPick }: { onClose(): void; onPick(source: Blob | string): void }) {
  const { photos } = useData();
  const file = useRef<HTMLInputElement>(null);
  const fromDevice = (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) onPick(f);
  };
  return (
    <Modal onClose={onClose} blur>
      <div className="grid w-[min(92vw,40rem)] gap-4 p-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-xl font-medium">{t("Choose a photo")}</h2>
          <IconButton type="button" aria-label={t("Close")} onClick={onClose}>
            <X size={20} />
          </IconButton>
        </div>
        <Button type="button" variant="tonal" className="justify-self-start" onClick={() => file.current?.click()}>
          <ImagePlus size={18} aria-hidden /> {t("From this device")}
        </Button>
        <input ref={file} type="file" accept="image/*" hidden onChange={fromDevice} />
        {photos.length === 0 ? (
          <Empty title={t("No photos on the site yet")} icon={Images} />
        ) : (
          <div className="grid max-h-[55dvh] grid-cols-3 gap-2 overflow-y-auto sm:grid-cols-4">
            {photos.map((p) => (
              <button key={p.id} type="button" onClick={() => p.url && onPick(p.url)} className="aspect-square overflow-hidden rounded-xl transition hover:brightness-90">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.thumbUrl ?? p.url} alt="" loading="lazy" className="h-full w-full object-cover" />
              </button>
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
}

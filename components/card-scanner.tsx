"use client";

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { Camera, ImageUp, ScanLine, X } from "lucide-react";
import { cardPicture, detectCard, findCard, loadPhoto, parseCard, readText, straighten, type CardDetails, type Corners } from "@/lib/card-scan";
import { Button, IconButton, Modal, cx } from "./ui";

export interface ScannedCard {
  details: CardDetails;
  /** The cropped, straightened card, small enough to keep. */
  picture: Blob;
  preview: string;
}

/** "Scan a business card": the camera opens with a card-shaped frame and takes the picture by itself. */
export function ScanCardButton({ onScanned, className }: { onScanned(card: ScannedCard): void; className?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)} className={className}>
        <ScanLine size={18} aria-hidden /> Scan a business card
      </Button>
      {open && (
        <CardScanner
          onClose={() => setOpen(false)}
          onDone={(card) => {
            setOpen(false);
            onScanned(card);
          }}
        />
      )}
    </>
  );
}

type Stage = { kind: "camera" } | { kind: "adjust"; photo: HTMLCanvasElement; corners: Corners } | { kind: "reading"; preview: string };

function CardScanner({ onClose, onDone }: { onClose(): void; onDone(card: ScannedCard): void }) {
  const [stage, setStage] = useState<Stage>({ kind: "camera" });
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  async function read(photo: HTMLCanvasElement, corners: Corners) {
    setError(null);
    try {
      const flat = straighten(photo, corners, 1600);
      const picture = await cardPicture(flat);
      const preview = URL.createObjectURL(picture);
      setStage({ kind: "reading", preview });
      setStatus("Getting the reader ready…");
      const lines = await readText(flat, (step, share) =>
        setStatus(step === "download" ? `Getting the reader ready… ${Math.round(share * 100)}%` : `Reading the card… ${Math.round(share * 100)}%`),
      );
      onDone({ details: parseCard(lines), picture, preview });
    } catch (e) {
      setStatus(null);
      setStage({ kind: "adjust", photo, corners });
      setError(navigator.onLine ? `Couldn't read the card: ${(e as Error).message}` : "The first scan needs internet to get the reader. Try again when you're online.");
    }
  }

  async function pickFile(file: File) {
    setError(null);
    try {
      const photo = await loadPhoto(file);
      setStage({ kind: "adjust", photo, corners: findCard(photo) });
    } catch (e) {
      setError((e as Error).message);
    }
  }

  const busy = stage.kind === "reading";
  const subtitle =
    stage.kind === "camera"
      ? "Place the card inside the frame. It takes the picture by itself."
      : stage.kind === "adjust"
        ? "Drag the four dots onto the card's corners, then tap Read card."
        : "Reading the details off the card…";

  return (
    <Modal onClose={() => !busy && onClose()} blur>
      <div role="dialog" aria-modal="true" aria-labelledby="scan-title" className="grid w-full max-w-lg gap-4 rounded-[28px] bg-card p-5 shadow-pop sm:p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <h2 id="scan-title" className="text-xl font-medium">
              Scan a business card
            </h2>
            <p className="text-sm text-muted">{subtitle}</p>
          </div>
          <IconButton aria-label="Cancel" onClick={onClose} disabled={busy}>
            <X size={20} />
          </IconButton>
        </div>

        {stage.kind === "camera" && (
          <CameraFrame
            onCapture={(photo, corners, sure) => (sure ? read(photo, corners) : setStage({ kind: "adjust", photo, corners }))}
            onUnavailable={(message) => {
              setError(message);
              fileInput.current?.click();
            }}
          />
        )}
        {stage.kind === "adjust" && <CornerEditor photo={stage.photo} corners={stage.corners} onChange={(corners) => setStage({ ...stage, corners })} />}
        {stage.kind === "reading" && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={stage.preview} alt="The card" className="w-full rounded-2xl bg-white shadow-card" />
        )}

        {status && <p className="text-sm text-muted">{status}</p>}
        {error && <p className="text-sm text-danger">{error}</p>}

        <div className="flex flex-wrap items-center justify-between gap-2">
          {stage.kind !== "reading" ? (
            <Button variant="ghost" className="h-10 px-3" onClick={() => fileInput.current?.click()}>
              <ImageUp size={18} aria-hidden /> Choose a photo instead
            </Button>
          ) : (
            <span />
          )}
          {stage.kind === "adjust" && (
            <span className="flex gap-2">
              <Button variant="ghost" onClick={() => setStage({ kind: "camera" })}>
                <Camera size={18} aria-hidden /> Retake
              </Button>
              <Button onClick={() => read(stage.photo, stage.corners)}>Read card</Button>
            </span>
          )}
        </div>
        <input
          ref={fileInput}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (f) pickFile(f);
          }}
        />
      </div>
    </Modal>
  );
}

/** How long the card has to sit still in the frame before the picture is taken (checks, 150 ms apart). */
const STEADY = 4;

/**
 * The camera with a card-shaped frame over it. When a card fills the frame and holds still, the
 * frame turns green and the picture is taken by itself; the round button takes it by hand.
 */
function CameraFrame({ onCapture, onUnavailable }: { onCapture(photo: HTMLCanvasElement, corners: Corners, sure: boolean): void; onUnavailable(message: string): void }) {
  const video = useRef<HTMLVideoElement>(null);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const [steady, setSteady] = useState(0);
  const [flash, setFlash] = useState(false);
  const last = useRef<Corners | null>(null);
  const done = useRef(false);

  // The frame: a business card's shape (3.5 × 2), as big as fits with some room around it.
  const guide = (() => {
    if (!size) return null;
    let w = 0.84;
    let h = (w * size.w * (2 / 3.5)) / size.h;
    if (h > 0.78) {
      h = 0.78;
      w = (h * size.h * (3.5 / 2)) / size.w;
    }
    return { x: (1 - w) / 2, y: (1 - h) / 2, w, h };
  })();

  useEffect(() => {
    let stream: MediaStream | null = null;
    let cancelled = false;
    (async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error("no camera");
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false });
        if (cancelled) return stream.getTracks().forEach((t) => t.stop());
        const v = video.current!;
        v.srcObject = stream;
        v.onloadedmetadata = () => setSize({ w: v.videoWidth, h: v.videoHeight });
        await v.play().catch(() => {});
      } catch {
        if (!cancelled) onUnavailable("The camera isn't available here, so pick a photo of the card instead.");
      }
    })();
    return () => {
      cancelled = true;
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [onUnavailable]);

  function frame() {
    const v = video.current!;
    const c = document.createElement("canvas");
    c.width = v.videoWidth;
    c.height = v.videoHeight;
    c.getContext("2d")!.drawImage(v, 0, 0);
    return c;
  }

  function take(corners: Corners, sure: boolean) {
    if (done.current) return;
    done.current = true;
    setFlash(true);
    const photo = frame();
    setTimeout(() => onCapture(photo, corners, sure), 180);
  }

  const guideCorners = (): Corners | null =>
    guide && [
      { x: guide.x, y: guide.y },
      { x: guide.x + guide.w, y: guide.y },
      { x: guide.x + guide.w, y: guide.y + guide.h },
      { x: guide.x, y: guide.y + guide.h },
    ];

  // Look at the frame a few times a second: is there a card filling it?
  useEffect(() => {
    if (!size || !guide) return;
    const pad = 0.12;
    const rx = Math.max(0, guide.x - guide.w * pad), ry = Math.max(0, guide.y - guide.h * pad);
    const rw = Math.min(1 - rx, guide.w * (1 + 2 * pad)), rh = Math.min(1 - ry, guide.h * (1 + 2 * pad));
    const small = document.createElement("canvas");
    const scale = 320 / (rw * size.w);
    small.width = 320;
    small.height = Math.round(rh * size.h * scale);
    const ctx = small.getContext("2d", { willReadFrequently: true })!;
    const want = guideCorners()!.map((p) => ({ x: (p.x - rx) / rw, y: (p.y - ry) / rh }));
    let count = 0;
    const timer = setInterval(() => {
      const v = video.current;
      if (!v || v.readyState < 2 || done.current) return;
      ctx.drawImage(v, rx * size.w, ry * size.h, rw * size.w, rh * size.h, 0, 0, small.width, small.height);
      const found = detectCard(small);
      const fits = found?.every((p, i) => Math.abs(p.x - want[i].x) < 0.09 && Math.abs(p.y - want[i].y) < 0.12);
      const moved = found && last.current ? Math.max(...found.map((p, i) => Math.hypot(p.x - last.current![i].x, p.y - last.current![i].y))) : 1;
      if (found && fits) {
        count = moved < 0.025 || count === 0 ? count + 1 : 1;
        last.current = found;
      } else {
        count = 0;
        last.current = found ?? null;
      }
      setSteady(count);
      if (count >= STEADY) {
        // Where the card's corners are in the whole picture.
        take(found!.map((p) => ({ x: rx + p.x * rw, y: ry + p.y * rh })) as Corners, true);
      }
    }, 150);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [size]);

  const ok = steady > 0;
  return (
    <div className="grid gap-3">
      <div
        className="relative mx-auto w-full overflow-hidden rounded-2xl bg-black"
        style={size ? { aspectRatio: size.w / size.h, maxHeight: "58dvh", maxWidth: `calc(58dvh * ${size.w / size.h})` } : { aspectRatio: 4 / 3 }}
      >
        <video ref={video} playsInline muted className="absolute inset-0 h-full w-full object-cover" />
        {guide && (
          <div
            className={cx("absolute rounded-xl border-[3px] transition-colors duration-200", ok ? "border-sage" : "border-white/90")}
            style={{ left: `${guide.x * 100}%`, top: `${guide.y * 100}%`, width: `${guide.w * 100}%`, height: `${guide.h * 100}%`, boxShadow: "0 0 0 9999px rgba(0,0,0,.5)" }}
          >
            <span className={cx("absolute inset-x-0 -top-9 text-center text-sm font-medium text-white drop-shadow", ok && "text-sage")}>
              {ok ? "Hold still…" : "Place the card here"}
            </span>
            {ok && <span className="absolute inset-x-0 bottom-0 h-1 origin-left bg-sage transition-transform duration-150" style={{ transform: `scaleX(${Math.min(1, steady / STEADY)})` }} />}
          </div>
        )}
        <div className={cx("pointer-events-none absolute inset-0 bg-white transition-opacity duration-200", flash ? "opacity-80" : "opacity-0")} />
        {!size && <p className="absolute inset-0 grid place-items-center text-sm text-white/80">Opening the camera…</p>}
      </div>
      <button
        type="button"
        aria-label="Take the picture"
        disabled={!size}
        onClick={() => take((last.current && guideCornersFromLast(last.current, guide)) || guideCorners()!, false)}
        className="mx-auto grid h-16 w-16 place-items-center rounded-full border-4 border-ink/15 bg-card shadow-card disabled:opacity-40"
      >
        <span className="h-11 w-11 rounded-full bg-accent" />
      </button>
    </div>
  );
}

/** A card found (but not quite lined up) near the frame, in whole-picture terms; else nothing. */
function guideCornersFromLast(found: Corners, guide: { x: number; y: number; w: number; h: number } | null): Corners | null {
  if (!guide) return null;
  const pad = 0.12;
  const rx = Math.max(0, guide.x - guide.w * pad), ry = Math.max(0, guide.y - guide.h * pad);
  const rw = Math.min(1 - rx, guide.w * (1 + 2 * pad)), rh = Math.min(1 - ry, guide.h * (1 + 2 * pad));
  return found.map((p) => ({ x: rx + p.x * rw, y: ry + p.y * rh })) as Corners;
}

/** The photo with four dots to drag onto the card's corners. */
function CornerEditor({ photo, corners, onChange }: { photo: HTMLCanvasElement; corners: Corners; onChange(c: Corners): void }) {
  const [src] = useState(() => photo.toDataURL("image/jpeg", 0.85));
  const box = useRef<HTMLDivElement>(null);
  const dragging = useRef<number | null>(null);
  const latest = useRef(corners);
  latest.current = corners;
  const change = useRef(onChange);
  change.current = onChange;

  // Dragging a dot follows the finger anywhere on the screen until it lets go.
  useEffect(() => {
    const move = (e: PointerEvent) => {
      const i = dragging.current;
      if (i === null || !box.current) return;
      e.preventDefault();
      const r = box.current.getBoundingClientRect();
      const next = [...latest.current] as Corners;
      next[i] = { x: Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), y: Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)) };
      change.current(next);
    };
    const up = () => (dragging.current = null);
    addEventListener("pointermove", move, { passive: false });
    addEventListener("pointerup", up);
    addEventListener("pointercancel", up);
    return () => {
      removeEventListener("pointermove", move);
      removeEventListener("pointerup", up);
      removeEventListener("pointercancel", up);
    };
  }, []);

  const ratio = photo.width / photo.height;
  return (
    <div ref={box} className="relative mx-auto w-full overflow-hidden rounded-2xl bg-black" style={{ aspectRatio: ratio, maxHeight: "55dvh", maxWidth: `calc(55dvh * ${ratio})` }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="The photo of the card" className="absolute inset-0 h-full w-full" />
      <svg viewBox="0 0 1 1" preserveAspectRatio="none" className="pointer-events-none absolute inset-0 h-full w-full">
        <path fillRule="evenodd" fill="rgba(0,0,0,.55)" d={`M0 0H1V1H0Z M${corners.map((p) => `${p.x} ${p.y}`).join(" L")} Z`} />
        <polygon points={corners.map((p) => `${p.x},${p.y}`).join(" ")} fill="none" stroke="white" strokeWidth={2} vectorEffect="non-scaling-stroke" />
      </svg>
      {corners.map((p, i) => (
        <button
          key={i}
          type="button"
          aria-label={["Top-left corner", "Top-right corner", "Bottom-right corner", "Bottom-left corner"][i]}
          onPointerDown={(e: ReactPointerEvent) => {
            e.preventDefault();
            dragging.current = i;
          }}
          className="absolute h-11 w-11 -translate-x-1/2 -translate-y-1/2 touch-none rounded-full"
          style={{ left: `${p.x * 100}%`, top: `${p.y * 100}%` }}
        >
          <span className="m-auto block h-5 w-5 rounded-full border-2 border-white bg-accent shadow-pop" />
        </button>
      ))}
    </div>
  );
}

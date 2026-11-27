"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { codeFrom } from "@/lib/dreidel-net";
import { t } from "@/lib/i18n";
import { lockPage } from "@/lib/page-lock";

type Detector = { detect(src: HTMLVideoElement): Promise<{ rawValue: string }[]> };

/**
 * Scan a game's QR code with the phone's camera (the back camera). Uses the phone's own QR reader
 * when it has one, and a small built-in reader otherwise.
 */
export function QrScan({ onCode, onClose }: { onCode(code: string): void; onClose(): void }) {
  const video = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);
  const done = useRef(onCode);
  done.current = onCode;

  useEffect(() => lockPage(), []);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let stop = false;
    let frame = 0;
    (async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error("none");
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
        if (stop) return stream.getTracks().forEach((x) => x.stop());
        const v = video.current!;
        v.srcObject = stream;
        await v.play();
      } catch {
        setError(t("The camera couldn't open. Allow the camera for this site, or type the code instead."));
        return;
      }
      const Native = (window as unknown as { BarcodeDetector?: new (o: { formats: string[] }) => Detector }).BarcodeDetector;
      let detector: Detector | null = null;
      try {
        detector = Native ? new Native({ formats: ["qr_code"] }) : null;
      } catch {
        detector = null;
      }
      const jsQR = detector ? null : (await import("jsqr")).default;
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      const look = async () => {
        if (stop) return;
        const v = video.current;
        if (v && v.readyState >= 2) {
          let text: string | null = null;
          if (detector) {
            try {
              text = (await detector.detect(v))[0]?.rawValue ?? null;
            } catch {
              text = null;
            }
          } else if (jsQR && ctx) {
            // A smaller picture is plenty for a QR code and much faster to read.
            const scale = Math.min(1, 480 / Math.max(v.videoWidth, v.videoHeight));
            canvas.width = Math.round(v.videoWidth * scale);
            canvas.height = Math.round(v.videoHeight * scale);
            ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
            const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
            text = jsQR(img.data, img.width, img.height)?.data ?? null;
          }
          const code = text ? codeFrom(text) : null;
          if (code) return done.current(code);
        }
        frame = window.setTimeout(look, 180);
      };
      look();
    })();
    return () => {
      stop = true;
      clearTimeout(frame);
      stream?.getTracks().forEach((x) => x.stop());
    };
  }, []);

  return createPortal(
    <div role="dialog" aria-modal="true" aria-label={t("Scan the QR Code")} className="fixed inset-0 z-[55] flex flex-col bg-[#0d0a1f]/95 text-ink backdrop-blur-md">
      <div className="flex items-center justify-between px-4 pt-[max(env(safe-area-inset-top),12px)] pb-1">
        <h2 className="text-lg font-semibold">{t("Scan the QR Code")}</h2>
        <button type="button" onClick={onClose} aria-label={t("Close")} className="grid h-11 w-11 place-items-center rounded-full bg-white/10">
          <X size={20} />
        </button>
      </div>
      <p className="px-4 text-sm text-muted">{t("Point the camera at the QR code on the host's phone.")}</p>
      <div className="relative mx-auto mt-4 aspect-square w-[min(88vw,26rem)] overflow-hidden rounded-[28px] border border-white/15 bg-black/40">
        <video ref={video} playsInline muted className="h-full w-full object-cover" />
        {/* The square to aim at. */}
        <div className="pointer-events-none absolute inset-[14%] rounded-[22px] border-2 border-[#ffbd52]/80 shadow-[0_0_0_200vmax_rgba(13,10,31,.35)]" />
        {error && <p className="absolute inset-0 grid place-items-center p-6 text-center text-sm">{error}</p>}
      </div>
    </div>,
    document.body,
  );
}

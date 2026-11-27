"use client";

import { useMemo, useRef, type ChangeEvent } from "react";
import { ImagePlus, X } from "lucide-react";
import { useData } from "@/lib/data";
import { useNav } from "@/lib/nav";
import { pendingPhotos } from "@/lib/photos";
import { t } from "@/lib/i18n";
import { Modal } from "./ui";

/** A poster whose picture is this built-in "Add photos" card instead of an uploaded image. */
export const PHOTOS_PROMO = "builtin:photos-promo";

/**
 * "Bring the week to life": tells people they can add their Mivtzoim photos. It no longer shows by
 * itself; the Owner puts it up as a poster (Admin → Poster). "Add photos" opens the photo picker
 * right away; the photos chosen are waiting on the Photos page, ready to send.
 */
export function PhotosPromoCard({ onClose }: { onClose(): void }) {
  const { photos } = useData();
  const { go } = useNav();
  const input = useRef<HTMLInputElement>(null);
  const setOpen = (open: boolean) => !open && onClose();

  // A strip of the site's newest photos gliding past (twice over, so it loops without a jump).
  const strip = useMemo(() => photos.slice(0, 8), [photos]);


  function pick(e: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    setOpen(false);
    if (!files.length) return;
    pendingPhotos.files = files;
    go("/photos");
  }

  return (
    <Modal onClose={() => setOpen(false)} blur>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="promo-title"
        className="relative grid w-[min(21rem,88vw)] gap-4 overflow-hidden rounded-[28px] pt-6 pb-4 text-center text-[#0b3f48] shadow-pop"
        style={{ background: "linear-gradient(135deg, #106a7a 0%, #f6f5f8 78%)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          aria-label={t("Close")}
          onClick={() => setOpen(false)}
          className="absolute end-3 top-3 grid h-8 w-8 place-items-center rounded-full bg-[#0b3f48]/12 text-[#0b3f48]"
        >
          <X size={18} />
        </button>
        <div className="grid gap-2.5 px-6">
          <span className="justify-self-center rounded-full bg-white/55 px-3 py-1 text-[11px] font-bold tracking-[0.08em] text-[#0b4f5c] uppercase">
            {t("New on the site")}
          </span>
          <h2 id="promo-title" className="text-2xl leading-tight font-semibold text-balance">
            {t("Bring the week to life.")}
          </h2>
        </div>
        {strip.length > 0 ? (
          <div
            dir="ltr"
            className="h-32 overflow-hidden"
            style={{ maskImage: "linear-gradient(90deg,transparent,#000 12%,#000 88%,transparent)", WebkitMaskImage: "linear-gradient(90deg,transparent,#000 12%,#000 88%,transparent)" }}
          >
            <div className="promo-slide flex w-max gap-2">
              {[...strip, ...strip].map((p, i) => (
                <img key={i} src={p.thumbUrl} alt="" className={i % 2 ? "mt-2 h-28 w-24 rounded-2xl object-cover" : "h-32 w-24 rounded-2xl object-cover"} />
              ))}
            </div>
          </div>
        ) : (
          <div className="mx-auto grid h-28 w-28 place-items-center rounded-[28px] bg-white/60 text-[#106a7a]">
            <ImagePlus size={48} aria-hidden />
          </div>
        )}
        <div className="grid gap-3 px-6">
          <p className="text-sm leading-relaxed text-[#2e4a50]">{t("Share your photos from Mivtzoim. Upload as many as you want, all at once.")}</p>
          <button
            type="button"
            onClick={() => input.current?.click()}
            className="flex h-12 items-center justify-center gap-2 rounded-full bg-[#106a7a] text-[15px] font-semibold text-white shadow-card"
          >
            <ImagePlus size={18} aria-hidden /> {t("Add photos")}
          </button>
          <button type="button" onClick={() => setOpen(false)} className="p-1.5 text-sm font-medium text-[#106a7a]">
            {t("Maybe later")}
          </button>
        </div>
        <input ref={input} type="file" accept="image/*" multiple hidden onChange={pick} />
      </div>
    </Modal>
  );
}

"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { useData } from "@/lib/data";
import { today } from "@/lib/dates";
import { t } from "@/lib/i18n";
import type { Poster } from "@/lib/types";
import { Modal } from "./ui";
import { PHOTOS_PROMO, PhotosPromoCard } from "./photos-promo";

const seenKey = (userId: string, posterId: string) => `sdm-poster:${userId}:${posterId}`;
const VISIT_KEY = "sdm-poster-visit";

function read(key: string, session = false) {
  try {
    return (session ? sessionStorage : localStorage).getItem(key);
  } catch {
    return null;
  }
}
function write(key: string, value: string, session = false) {
  try {
    (session ? sessionStorage : localStorage).setItem(key, value);
  } catch {
    // Not remembered on this phone; it may show once more.
  }
}

/** The posters this account still has to see: on, not past their end date, under their count. */
export function postersToShow(posters: Poster[], userId: string) {
  return posters
    .filter((p) => p.active && (!p.starts || p.starts <= today()) && (!p.ends || p.ends >= today()))
    .filter((p) => p.times == null || Number(read(seenKey(userId, p.id)) || 0) < p.times)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
}

/**
 * The Owner's poster, popping up when someone opens the site: once per visit, as many visits as
 * the Owner chose (counted on each phone). It waits until no other pop-up is open, so it never
 * covers the "Who went?" question or a message.
 */
export function PosterPrompt() {
  const { me, posters } = useData();
  const [shown, setShown] = useState<Poster | null>(null);

  useEffect(() => {
    if (!me || shown || read(VISIT_KEY, true)) return;
    const next = postersToShow(posters, me.id)[0];
    if (!next) return;
    let stop = false;
    const tryShow = () => {
      if (stop) return;
      if (document.querySelector('[aria-modal="true"]')) return void setTimeout(tryShow, 800);
      write(VISIT_KEY, "1", true);
      write(seenKey(me.id, next.id), String(Number(read(seenKey(me.id, next.id)) || 0) + 1));
      setShown(next);
    };
    const timer = setTimeout(tryShow, 600);
    return () => {
      stop = true;
      clearTimeout(timer);
    };
  }, [me, posters, shown]);

  if (!shown) return null;
  const close = () => setShown(null);
  if (shown.image_url === PHOTOS_PROMO) return <PhotosPromoCard onClose={close} />;
  return (
    <Modal onClose={close} blur>
      <div role="dialog" aria-modal="true" aria-label={t("Poster")} onClick={(e) => e.stopPropagation()} className="relative w-full max-w-md">
        <img src={shown.image_url} alt="" className="max-h-[80dvh] w-full rounded-[28px] object-contain shadow-pop" />
        <button type="button" onClick={close} aria-label={t("Close")} className="absolute top-3 end-3 grid h-10 w-10 place-items-center rounded-full bg-black/55 text-white backdrop-blur-sm">
          <X size={22} />
        </button>
      </div>
    </Modal>
  );
}

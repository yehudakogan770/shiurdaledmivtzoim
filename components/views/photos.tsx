"use client";

import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { ChevronDown, ImagePlus, Images, Trash2, X } from "lucide-react";
import { useData, GUEST_MESSAGE } from "@/lib/data";
import { formatShort, weekOf } from "@/lib/dates";
import { parshaOfWeek } from "@/lib/parsha";
import { arrange, fitToSpots, shrinkPhoto, type ShrunkPhoto } from "@/lib/photos";
import type { Photo } from "@/lib/types";
import { Button, Card, Empty, IconButton, Modal, PageHeader, cx } from "../ui";
import { useEditMode } from "@/lib/edit-mode";
import { EditSwitch } from "./dashboard";

/** How fast the wall scrolls on its own, in pixels per second. */
const SPEED = 28;
/** Up to this many photos at once. */
const MAX_PICK = 30;
/** Big and small tiles, repeating down the wall. */
const SIZES = ["w2", "", "", "h2", "", "", "", "w2", "", "h2", "", ""];
/** The wall fades out at the top and bottom edges. */
const FADE = "linear-gradient(to bottom, transparent 0, #000 3rem, #000 calc(100% - 6rem), transparent 100%)";

/**
 * Everyone's photos as a wall of big and small tiles that scrolls on its own. Touch or scroll it
 * to take over; let go and it carries on from there. Anyone with an account can add photos.
 */
export function PhotosView() {
  const { photos, me, guest, notify, isAdmin } = useData();
  const { editing } = useEditMode();
  const [picked, setPicked] = useState<File[] | null>(null);
  const [open, setOpen] = useState<Photo | null>(null);
  const input = useRef<HTMLInputElement>(null);

  // Grouped by week, newest week first. Within a week everyone's photos are mixed together so
  // neighbours set each other off (darker and lighter, different colours), in a fixed order so
  // the wall doesn't jump around from one visit to the next.
  const weeks = useMemo(() => {
    const map = new Map<string, Photo[]>();
    for (const p of photos) {
      const w = weekOf(new Date(p.created_at));
      map.set(w, [...(map.get(w) ?? []), p]);
    }
    return [...map.entries()].map(([w, list]) => [w, fitToSpots(arrange(list), SIZES)] as [string, Photo[]]);
  }, [photos]);

  function choose() {
    if (guest || !me) return notify(GUEST_MESSAGE);
    input.current?.click();
  }

  function onFiles(e: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []).filter((f) => f.type.startsWith("image/") || /\.(heic|heif|jpe?g|png|webp)$/i.test(f.name));
    e.target.value = "";
    if (!files.length) return;
    if (files.length > MAX_PICK) notify(`Up to ${MAX_PICK} photos at a time: the first ${MAX_PICK} are ready to send.`);
    setPicked(files.slice(0, MAX_PICK));
  }

  const editView = isAdmin && editing;
  return (
    <div className="grid grid-cols-1 gap-6">
      {editView && <PageHeader title="Photos" subtitle="Edit mode: each week's photos by who shared them. Delete any that shouldn't be here." />}
      <input ref={input} type="file" accept="image/*" multiple hidden onChange={onFiles} />
      {photos.length === 0 ? (
        <div className="grid min-h-[calc(100dvh-10rem)] content-center">
          <Empty title="No photos yet" icon={Images}>
            Photos people share from Mivtzoim show up here for everyone. Tap Add photos to share the first ones.
          </Empty>
        </div>
      ) : editView ? (
        <div className="pb-20">
          <PhotosByAccount onOpen={setOpen} />
        </div>
      ) : (
        <PhotoWall weeks={weeks} onOpen={setOpen} />
      )}

      {/* A small frosted bar floating just above the bottom of the screen: the photos show through it. */}
      <div className="pointer-events-none fixed inset-x-0 bottom-[calc(1.25rem+env(safe-area-inset-bottom,0px))] z-30 flex justify-center px-4 lg:left-20">
        <div className="pointer-events-auto flex items-center gap-1.5 rounded-full bg-card/55 p-1.5 shadow-pop ring-1 ring-white/30 backdrop-blur-xl backdrop-saturate-150 dark:ring-white/10">
          {isAdmin && <EditSwitch />}
          <Button onClick={choose} className="h-11">
            <ImagePlus size={18} aria-hidden /> Add photos
          </Button>
        </div>
      </div>
      {picked && <SendPhotos files={picked} onDone={() => setPicked(null)} />}
      {open && <PhotoViewer photo={open} onClose={() => setOpen(null)} />}
    </div>
  );
}

function PhotoWall({ weeks, onOpen }: { weeks: [string, Photo[]][]; onOpen(p: Photo): void }) {
  const box = useRef<HTMLDivElement>(null);
  const first = useRef<HTMLDivElement>(null);
  const [loops, setLoops] = useState(false);

  // Only repeat the photos (to loop forever) when there are enough to fill the wall.
  useEffect(() => {
    const el = box.current, one = first.current;
    if (!el || !one) return;
    const check = () => setLoops(one.offsetHeight > el.clientHeight + 40);
    check();
    const ro = new ResizeObserver(check);
    ro.observe(one);
    ro.observe(el);
    return () => ro.disconnect();
  }, [weeks]);

  useEffect(() => {
    const el = box.current;
    if (!el || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let pos = el.scrollTop, touching = false, lastUser = -1e9, last = performance.now(), ours = false, raf = 0;
    const down = () => {
      touching = true;
      lastUser = performance.now();
    };
    const up = () => {
      touching = false;
    };
    const userMoved = () => {
      lastUser = performance.now();
    };
    const onScroll = () => {
      if (ours) {
        ours = false;
        return;
      }
      lastUser = performance.now(); // the person moved it, or it's still gliding from their swipe
      pos = el.scrollTop;
    };
    el.addEventListener("pointerdown", down);
    el.addEventListener("touchstart", down, { passive: true });
    addEventListener("pointerup", up);
    addEventListener("pointercancel", up);
    addEventListener("touchend", up);
    el.addEventListener("wheel", userMoved, { passive: true });
    el.addEventListener("scroll", onScroll, { passive: true });
    const frame = (now: number) => {
      const dt = Math.min(64, now - last);
      last = now;
      const half = loops ? first.current?.offsetHeight ?? 0 : 0;
      const end = el.scrollHeight - el.clientHeight;
      if (!touching && now - lastUser > 250 && end > 0) {
        pos += (SPEED * dt) / 1000;
        if (half && pos >= half) pos -= half;
        else if (!half && pos >= end) pos = 0;
        ours = true;
        el.scrollTop = pos;
      } else {
        pos = el.scrollTop;
        if (half && pos >= half) {
          pos -= half;
          ours = true;
          el.scrollTop = pos;
        }
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      el.removeEventListener("pointerdown", down);
      el.removeEventListener("touchstart", down);
      removeEventListener("pointerup", up);
      removeEventListener("pointercancel", up);
      removeEventListener("touchend", up);
      el.removeEventListener("wheel", userMoved);
      el.removeEventListener("scroll", onScroll);
    };
  }, [loops]);

  const wall = (ref?: React.Ref<HTMLDivElement>, copy?: boolean) => (
    <div ref={ref} aria-hidden={copy || undefined} className="grid gap-3 pb-3">
      {weeks.map(([week, list]) => (
        <section key={week} className="grid gap-2">
          <h2 className="flex items-baseline justify-between px-1 pt-3 text-sm font-medium">
            <span>{parshaOfWeek(week).english}</span>
            <span className="text-xs text-muted">
              {list.length} {list.length === 1 ? "photo" : "photos"} · {formatShort(week)}
            </span>
          </h2>
          <div className="grid grid-flow-dense auto-rows-[96px] grid-cols-3 gap-1.5 sm:auto-rows-[150px] sm:grid-cols-4 lg:grid-cols-5">
            {list.map((p, i) => {
              const size = SIZES[i % SIZES.length];
              return (
                <button
                  key={p.id}
                  type="button"
                  tabIndex={copy ? -1 : 0}
                  onClick={() => onOpen(p)}
                  aria-label="Open photo"
                  className={cx("overflow-hidden rounded-2xl bg-sunken", size === "w2" && "col-span-2 row-span-2", size === "h2" && "row-span-2")}
                >
                  <img src={size === "w2" ? p.url : p.thumbUrl} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover transition duration-300 hover:scale-[1.03]" />
                </button>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );

  return (
    <div
      ref={box}
      className="h-[calc(100dvh-4.5rem)] min-h-[24rem] overflow-y-auto pt-4 pb-28 overscroll-contain [scrollbar-width:none] lg:h-[calc(100dvh-6.5rem)] [&::-webkit-scrollbar]:hidden"
      style={{ maskImage: FADE, WebkitMaskImage: FADE }}
    >
      {wall(first)}
      {loops && wall(undefined, true)}
    </div>
  );
}

/**
 * Admins in Edit mode: each week, split into groups by the account that shared them, with a
 * delete button on every photo.
 */
function PhotosByAccount({ onOpen }: { onOpen(p: Photo): void }) {
  const { photos, data, people, actions, notify } = useData();
  const [asking, setAsking] = useState<string | null>(null);
  const nameOf = (id: string) => data.names[id] || people.find((p) => p.id === id)?.name || "Someone";

  const weeks = useMemo(() => {
    const byWeek = new Map<string, Map<string, Photo[]>>();
    for (const p of photos) {
      const w = weekOf(new Date(p.created_at));
      const accounts = byWeek.get(w) ?? new Map<string, Photo[]>();
      accounts.set(p.user_id, [...(accounts.get(p.user_id) ?? []), p]);
      byWeek.set(w, accounts);
    }
    return [...byWeek.entries()];
  }, [photos]);

  async function remove(id: string) {
    setAsking(null);
    try {
      await actions.deletePhoto(id);
      notify("Photo deleted.");
    } catch (err) {
      notify((err as Error).message);
    }
  }

  return (
    <div className="grid gap-6">
      {weeks.map(([week, accounts]) => (
        <section key={week} className="grid gap-3">
          <h2 className="px-1 text-lg font-medium">
            {parshaOfWeek(week).english} <span className="text-sm font-normal text-muted">· {formatShort(week)}</span>
          </h2>
          {[...accounts.entries()]
            .sort((a, b) => nameOf(a[0]).localeCompare(nameOf(b[0])))
            .map(([userId, list]) => (
              <Card key={userId} className="grid gap-3 p-4">
                <p className="flex items-baseline justify-between gap-2 px-1">
                  <span className="font-medium">{nameOf(userId)}</span>
                  <span className="text-sm text-muted">
                    {list.length} {list.length === 1 ? "photo" : "photos"}
                  </span>
                </p>
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-6">
                  {list.map((p) => (
                    <div key={p.id} className="relative aspect-square overflow-hidden rounded-xl bg-sunken">
                      <button type="button" className="h-full w-full" aria-label={`Open ${nameOf(userId)}'s photo`} onClick={() => onOpen(p)}>
                        <img src={p.thumbUrl} alt="" loading="lazy" className="h-full w-full object-cover" />
                      </button>
                      {asking === p.id ? (
                        <span className="absolute inset-x-1 bottom-1 flex gap-1">
                          <button type="button" onClick={() => remove(p.id)} className="flex-1 rounded-lg bg-danger py-1.5 text-xs font-medium text-white">
                            Delete
                          </button>
                          <button type="button" onClick={() => setAsking(null)} className="flex-1 rounded-lg bg-black/60 py-1.5 text-xs font-medium text-white">
                            Keep
                          </button>
                        </span>
                      ) : (
                        <button
                          type="button"
                          aria-label={`Delete ${nameOf(userId)}'s photo`}
                          onClick={() => setAsking(p.id)}
                          className="absolute top-1 right-1 grid h-8 w-8 place-items-center rounded-full bg-black/60 text-white"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </Card>
            ))}
        </section>
      ))}
    </div>
  );
}

/** Preview what was picked, take any out, then send them all. */
function SendPhotos({ files, onDone }: { files: File[]; onDone(): void }) {
  const { actions, notify } = useData();
  const [ready, setReady] = useState<ShrunkPhoto[]>([]);
  const [failed, setFailed] = useState(0);
  const [removed, setRemoved] = useState(0);
  const [sending, setSending] = useState<number | null>(null);
  const preparing = ready.length + failed + removed < files.length;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      for (const f of files) {
        try {
          const shrunk = await shrinkPhoto(f);
          if (!cancelled) setReady((r) => [...r, shrunk]);
        } catch {
          if (!cancelled) setFailed((n) => n + 1);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [files]);

  const latest = useRef(ready);
  latest.current = ready;
  useEffect(() => () => latest.current.forEach((r) => URL.revokeObjectURL(r.preview)), []);

  async function send() {
    setSending(0);
    try {
      await actions.uploadPhotos(ready, setSending);
      notify(ready.length === 1 ? "Your photo is shared." : `Your ${ready.length} photos are shared.`);
      onDone();
    } catch (err) {
      notify((err as Error).message);
      setSending(null);
    }
  }

  const close = () => sending === null && onDone();
  return (
    <Modal onClose={close} blur>
      <div role="dialog" aria-modal="true" aria-labelledby="send-title" className="grid w-full max-w-lg gap-4 rounded-[28px] bg-card p-6 shadow-pop" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <h2 id="send-title" className="text-xl font-medium">
              {preparing ? `Preparing ${ready.length + failed + removed + 1} of ${files.length}…` : `Share ${ready.length} ${ready.length === 1 ? "photo" : "photos"}`}
            </h2>
            <p className="text-sm text-muted">Everyone will see them on the Photos page. Tap × to take one out.</p>
          </div>
          <IconButton aria-label="Cancel" onClick={close} disabled={sending !== null}>
            <X size={20} />
          </IconButton>
        </div>
        <div className="grid max-h-[50dvh] grid-cols-3 gap-2 overflow-y-auto sm:grid-cols-4">
          {ready.map((r, i) => (
            <div key={r.preview} className="relative aspect-square overflow-hidden rounded-xl bg-sunken">
              <img src={r.preview} alt={`Photo ${i + 1}`} className="h-full w-full object-cover" />
              {sending === null && (
                <button
                  type="button"
                  aria-label={`Take out photo ${i + 1}`}
                  onClick={() => {
                    setReady((list) => list.filter((x) => x !== r));
                    setRemoved((n) => n + 1);
                    URL.revokeObjectURL(r.preview);
                  }}
                  className="absolute top-1 right-1 grid h-7 w-7 place-items-center rounded-full bg-black/60 text-white"
                >
                  <X size={16} />
                </button>
              )}
            </div>
          ))}
          {preparing && <div className="aspect-square animate-pulse rounded-xl bg-sunken" />}
        </div>
        {failed > 0 && <p className="text-sm text-danger">{failed === 1 ? "1 file couldn't be opened" : `${failed} files couldn't be opened`} and was left out.</p>}
        {sending !== null && (
          <div className="grid gap-1.5">
            <div className="h-2 overflow-hidden rounded-full bg-sunken">
              <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${(sending / Math.max(1, ready.length)) * 100}%` }} />
            </div>
            <p className="text-sm text-muted">
              Sending {Math.min(sending + 1, ready.length)} of {ready.length}…
            </p>
          </div>
        )}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={close} disabled={sending !== null}>
            Cancel
          </Button>
          <Button onClick={send} disabled={preparing || sending !== null || ready.length === 0}>
            {sending !== null ? "Sending…" : `Send ${ready.length || ""}`.trim()}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

/** One photo, big, with who shared it and when. Its sharer or an admin can delete it. */
function PhotoViewer({ photo, onClose }: { photo: Photo; onClose(): void }) {
  const { me, isAdmin, data, actions, notify } = useData();
  const [asking, setAsking] = useState(false);
  const week = weekOf(new Date(photo.created_at));
  const who = data.names[photo.user_id];
  const canDelete = !!me && (me.id === photo.user_id || isAdmin);

  async function remove() {
    try {
      await actions.deletePhoto(photo.id);
      notify("Photo deleted.");
      onClose();
    } catch (err) {
      notify((err as Error).message);
    }
  }

  return (
    <Modal onClose={onClose}>
      <figure role="dialog" aria-modal="true" aria-label="Photo" className="grid w-full max-w-3xl gap-3" onClick={(e) => e.stopPropagation()}>
        <img src={photo.url} alt="" className="max-h-[75dvh] w-full rounded-[24px] bg-black object-contain" />
        <figcaption className="flex flex-wrap items-center gap-2 rounded-2xl bg-card px-4 py-3">
          <span className="min-w-0 flex-1 text-sm">
            {who && <span className="block font-medium">{who}</span>}
            <span className="text-muted">
              {parshaOfWeek(week).english} · {new Date(photo.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
            </span>
          </span>
          {canDelete &&
            (asking ? (
              <span className="flex items-center gap-2">
                <span className="text-sm">Delete this photo?</span>
                <Button variant="danger" className="h-9 px-3" onClick={remove}>
                  Delete
                </Button>
                <Button variant="ghost" className="h-9 px-3" onClick={() => setAsking(false)}>
                  Keep
                </Button>
              </span>
            ) : (
              <IconButton aria-label="Delete photo" onClick={() => setAsking(true)}>
                <Trash2 size={18} />
              </IconButton>
            ))}
          <Button variant="secondary" className="h-9 px-4" onClick={onClose}>
            Close
          </Button>
        </figcaption>
      </figure>
    </Modal>
  );
}

/**
 * On the Profile page: a dropdown with every photo this person shared, by week. Each photo has a
 * delete button that asks twice before it goes.
 */
export function MyPhotos() {
  const { photos, me, actions, notify } = useData();
  const [open, setOpen] = useState(false);
  // Which photo is being deleted, and how far: 1 = "Delete?", 2 = "Are you sure?"
  const [asking, setAsking] = useState<{ id: string; step: 1 | 2 } | null>(null);
  const [viewing, setViewing] = useState<Photo | null>(null);

  const weeks = useMemo(() => {
    const map = new Map<string, Photo[]>();
    for (const p of photos) {
      if (p.user_id !== me?.id) continue;
      const w = weekOf(new Date(p.created_at));
      map.set(w, [...(map.get(w) ?? []), p]);
    }
    return [...map.entries()];
  }, [photos, me]);
  const count = weeks.reduce((n, [, list]) => n + list.length, 0);
  if (!me) return null;

  async function remove(id: string) {
    setAsking(null);
    try {
      await actions.deletePhoto(id);
      notify("Photo deleted.");
    } catch (err) {
      notify((err as Error).message);
    }
  }

  return (
    <Card>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => {
          setOpen((o) => !o);
          setAsking(null);
        }}
        className="flex w-full items-center gap-3 px-6 py-5 text-left"
      >
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-sunken">
          <Images size={20} aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-lg font-medium">My photos</span>
          <span className="block text-sm text-muted">
            {count === 0 ? "You haven't shared any photos yet" : `${count} ${count === 1 ? "photo" : "photos"} you shared · tap to see or delete`}
          </span>
        </span>
        <ChevronDown size={22} aria-hidden className={cx("shrink-0 text-muted transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div className="grid gap-5 px-6 pb-6">
          {count === 0 ? (
            <p className="text-sm text-muted">Photos you add on the Photos page will show up here.</p>
          ) : (
            weeks.map(([week, list]) => (
              <section key={week} className="grid gap-2">
                <h3 className="flex items-baseline justify-between px-1 text-sm font-medium">
                  <span>{parshaOfWeek(week).english}</span>
                  <span className="text-xs font-normal text-muted">
                    {list.length} {list.length === 1 ? "photo" : "photos"} · {formatShort(week)}
                  </span>
                </h3>
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-6">
                  {list.map((p) => {
                    const step = asking?.id === p.id ? asking.step : 0;
                    return (
                      <div key={p.id} className="relative aspect-square overflow-hidden rounded-xl bg-sunken">
                        <button type="button" className="h-full w-full" aria-label="Open photo" onClick={() => setViewing(p)}>
                          <img src={p.thumbUrl} alt="" loading="lazy" className={cx("h-full w-full object-cover transition", step > 0 && "scale-105 blur-[2px] brightness-50")} />
                        </button>
                        {step === 0 ? (
                          <button
                            type="button"
                            aria-label="Delete photo"
                            onClick={() => setAsking({ id: p.id, step: 1 })}
                            className="absolute top-1 right-1 grid h-8 w-8 place-items-center rounded-full bg-black/60 text-white"
                          >
                            <Trash2 size={16} />
                          </button>
                        ) : (
                          <div className="absolute inset-0 grid content-center gap-1.5 p-1.5 text-center text-white">
                            <p className="text-xs font-medium">{step === 1 ? "Delete this photo?" : "Sure? It can't be undone."}</p>
                            <button
                              type="button"
                              onClick={() => (step === 1 ? setAsking({ id: p.id, step: 2 }) : remove(p.id))}
                              className="rounded-lg bg-danger py-1.5 text-xs font-medium text-white"
                            >
                              {step === 1 ? "Delete" : "Yes, delete"}
                            </button>
                            <button type="button" onClick={() => setAsking(null)} className="rounded-lg bg-white/20 py-1.5 text-xs font-medium text-white">
                              Keep
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>
            ))
          )}
        </div>
      )}
      {viewing && <PhotoViewer photo={viewing} onClose={() => setViewing(null)} />}
    </Card>
  );
}

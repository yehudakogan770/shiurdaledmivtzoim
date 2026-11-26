"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent, type TouchEvent } from "react";
import { CircleCheck, Heart, Lock, MapPin, Plus, Search, Trash2, UserRoundPlus } from "lucide-react";
import type { Photo, Profile } from "@/lib/types";
import { showOrder } from "@/lib/photos";
import { currentWeek } from "@/lib/dates";
import { QuickLog } from "./dashboard";
import { StopFields, blankStop, toInput, type StopDraft } from "./routes";
import { getLang, setLanguage, t, type Lang } from "@/lib/i18n";
import { useData } from "@/lib/data";
import { useNav } from "@/lib/nav";
import { setAccountDesk } from "@/lib/account-desk";
import { handle } from "@/lib/admin";
import { cleanUsername } from "@/lib/backend";
import { BLANK_CHAVRUSA, chavrusasOf, encodeChavrusa, type Chavrusa } from "@/lib/chavrusa";
import { ChavrusaFields } from "../chavrusa-fields";
import { LanguageButtons } from "../language-picker";
import { LogoMark } from "../brand";
import { Avatar, Button, Field, IconButton, Input, Modal, Select, cx } from "../ui";

const same = (a: string, b: string) => a.normalize("NFKC").replace(/[\s\p{Cf}]/gu, "").toLowerCase() === b.normalize("NFKC").replace(/[\s\p{Cf}]/gu, "").toLowerCase();

/**
 * The account desk (Owner only): the whole screen is the sign-up form, for people without a phone
 * or computer of their own. Accounts made here are ready at once, with no confirmation email.
 * Getting back to the Owner screens takes the Owner's password.
 */
export function AccountDeskView({ ownerLang }: { ownerLang: Lang }) {
  const { photos } = useData();
  const [tab, setTab] = useState<Tab>("create");
  // The account found on "Find my account": the Route stops tab works on it.
  const [picked, setPicked] = useState<Profile | null>(null);
  // After Done: a thank-you, and a nudge to add the route's stops when it has none.
  const [thanks, setThanks] = useState(false);
  const state = useRef({ tab, thanks });
  state.current = { tab, thanks };
  const [leaving, setLeaving] = useState(false);
  // Left alone for a while, the desk turns into a slideshow of the photos; a tap brings it back.
  const [resting, setResting] = useState(false);
  // Going to rest starts the forms over, so an account someone left open isn't waiting for the next person.
  const [round, setRound] = useState(0);
  const rest = () => {
    setResting(true);
    setLeaving(false);
    setTab("create");
    setPicked(null);
    setThanks(false);
    setRound((n) => n + 1);
  };
  useEffect(() => {
    if (resting) return;
    let last = Date.now();
    const awake = () => {
      last = Date.now();
    };
    // Someone in the middle of typing gets much longer, so a pause to think doesn't wipe their form.
    const typing = () => [...document.querySelectorAll<HTMLInputElement>("input, textarea")].some((el) => el.type !== "file" && el.value.trim() !== "");
    const timer = setInterval(() => {
      // Adding stops takes a while (finding a card, taking its picture), and the thank-you needs time to be read.
      const limit = state.current.tab === "stops" ? REST_ON_STOPS : state.current.thanks ? REST_ON_THANKS : typing() ? REST_WHILE_TYPING : REST_AFTER;
      if (Date.now() - last >= limit) rest();
    }, 500);
    const events = ["pointerdown", "keydown", "input", "scroll"] as const;
    for (const e of events) window.addEventListener(e, awake, { passive: true, capture: true });
    return () => {
      clearInterval(timer);
      for (const e of events) window.removeEventListener(e, awake, { capture: true });
    };
  }, [resting]);
  // Newest week first; inside a week the photos are mixed, so one person's aren't back to back.
  const shots = useMemo(() => showOrder(photos.filter((p) => p.url)), [photos]);
  const behind = shots.length > 0;
  // On a touch screen, a sideways swipe moves between the two tabs, like turning a page (anywhere on the screen).
  const from = useRef<{ x: number; y: number } | null>(null);
  const start = (e: TouchEvent) => {
    const el = e.target as HTMLElement;
    // Not from inside a box being typed in: there a sideways drag moves the cursor.
    from.current = el.closest("input, textarea, select") ? null : { x: e.touches[0].clientX, y: e.touches[0].clientY };
  };
  const end = (e: TouchEvent) => {
    if (!from.current) return;
    const dx = e.changedTouches[0].clientX - from.current.x;
    const dy = e.changedTouches[0].clientY - from.current.y;
    from.current = null;
    if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
    const forward = (dx < 0) === (document.documentElement.dir !== "rtl");
    const open = TABS.filter((k) => k !== "stops" || picked);
    const next = open[open.indexOf(tab) + (forward ? 1 : -1)];
    if (next && !thanks) setTab(next);
  };
  return (
    <div className="relative flex min-h-screen flex-col items-center overflow-x-clip px-4 py-8 sm:py-12" onTouchStart={start} onTouchEnd={end}>
      {/* The photos are always there: full and sharp while the desk rests, dimmed and blurred behind it once someone taps. */}
      {behind && <PhotoShow photos={shots} resting={resting} onWake={() => setResting(false)} />}
      {!(resting && behind) && (
        <div key={round} className={cx("relative z-10 flex w-full flex-col items-center", behind && "desk-pop")}>
          {thanks && picked ? (
            <ThankYou
              person={picked}
              onStops={() => {
                setThanks(false);
                setTab("stops");
              }}
              onClose={rest}
            />
          ) : (
            <DeskBody tab={tab} setTab={setTab} picked={picked} setPicked={setPicked} round={round} behind={behind} onLeave={() => setLeaving(true)} onDone={() => setThanks(true)} onClose={rest} />
          )}
        </div>
      )}
      {leaving && <LeaveDesk ownerLang={ownerLang} onClose={() => setLeaving(false)} />}
    </div>
  );
}

type Tab = "create" | "find" | "stops";
const TABS: Tab[] = ["create", "find", "stops"];

/** The desk itself: the three tabs, the form, and the Owner's way out. */
function DeskBody({
  tab,
  setTab,
  picked,
  setPicked,
  round,
  behind,
  onLeave,
  onDone,
  onClose,
}: {
  tab: Tab;
  setTab(tab: Tab): void;
  picked: Profile | null;
  setPicked(p: Profile | null): void;
  round: number;
  behind: boolean;
  onLeave(): void;
  /** Finished logging: on to the thank-you. */
  onDone(): void;
  /** Finished altogether: back to the photos. */
  onClose(): void;
}) {
  const { notify } = useData();
  const at = TABS.indexOf(tab);
  const label = { create: t("Create an account"), find: t("Find my account"), stops: t("Route stops") };
  const icon = { create: UserRoundPlus, find: Search, stops: MapPin };
  return (
    <>
      <div role="tablist" className="relative mb-6 grid w-full max-w-[44rem] grid-cols-3 gap-1 rounded-full bg-sunken p-1">
        {/* The colored pill slides from one tab to the other. */}
        <span aria-hidden className="desk-tab-pill absolute top-1 bottom-1 start-1 rounded-full bg-accent shadow-card" style={{ "--at": at } as React.CSSProperties} />
        {TABS.map((k) => {
          const Icon = icon[k];
          // Route stops belong to an account, so that tab opens once one is found.
          const locked = k === "stops" && !picked;
          return (
            <button
              key={k}
              type="button"
              role="tab"
              aria-selected={tab === k}
              aria-disabled={locked}
              onClick={() => {
                if (!locked) return setTab(k);
                setTab("find");
                notify(t("Find your account first, then you can add its route stops."));
              }}
              className={cx(
                "relative flex h-12 items-center justify-center gap-1.5 rounded-full px-1 text-xs font-medium transition-colors duration-300 sm:gap-2 sm:text-sm",
                tab === k ? "text-accent-ink" : locked ? "text-muted/60" : "text-ink hover:bg-ink/5",
              )}
            >
              <Icon size={18} aria-hidden className="shrink-0" />
              <span className="truncate">{label[k]}</span>
            </button>
          );
        })}
      </div>

      {/* The forms stay in place: the one in use sits still, the others wait just off to its side, so switching is one glide. */}
      <div className="relative -m-6 flex w-[calc(100%+3rem)] flex-col items-center overflow-clip p-6">
        {TABS.map((k, i) => (
          <div key={k} data-off={i < at ? "before" : "after"} inert={tab !== k} className={cx("desk-panel flex w-full flex-col items-center", tab === k ? "desk-panel-on" : "desk-panel-off")}>
            {k === "create" ? (
              <CreateAccount key={round} />
            ) : k === "find" ? (
              <FindAccount key={round} picked={picked} setPicked={setPicked} onDone={onDone} onStops={() => setTab("stops")} />
            ) : picked ? (
              <RouteStops key={picked.id} person={picked} onDone={onClose} />
            ) : null}
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={onLeave}
        className={cx("mt-8 inline-flex h-10 items-center gap-2 rounded-full px-4 text-sm", behind ? "bg-black/35 text-white/90 backdrop-blur-sm hover:bg-black/50" : "text-muted hover:bg-ink/5")}
      >
        <Lock size={16} aria-hidden /> {t("Owner")}
      </button>
    </>
  );
}


/** Making a new account: the same details as signing up, each sign-in detail typed twice. */
function CreateAccount() {
  const { actions, settings } = useData();
  const [name, setName] = useState("");
  const [partners, setPartners] = useState<Chavrusa[]>([BLANK_CHAVRUSA]);
  const [username, setUsername] = useState("");
  const [username2, setUsername2] = useState("");
  const [email, setEmail] = useState("");
  const [email2, setEmail2] = useState("");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [made, setMade] = useState<{ name: string; username: string } | null>(null);

  function clear() {
    setName("");
    setPartners([BLANK_CHAVRUSA]);
    setUsername("");
    setUsername2("");
    setEmail("");
    setEmail2("");
    setPassword("");
    setPassword2("");
    setError(null);
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!same(username, username2)) return setError(t("The two usernames don't match. Type them again."));
    if (!same(email, email2)) return setError(t("The two emails don't match. Type them again."));
    if (password !== password2) return setError(t("The two passwords don't match. Type them again."));
    setBusy(true);
    try {
      await actions.ownerCreateAccount({
        name: name.trim(),
        partners: partners.filter((c) => c.name.trim() || c.hebrew.trim()).map(encodeChavrusa),
        username,
        email,
        password,
        language: getLang(),
      });
      setMade({ name: name.trim(), username: cleanUsername(username) });
      clear();
      window.scrollTo(0, 0);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {made ? (
        <div className="grid w-full max-w-[40rem] justify-items-center gap-4 rounded-[28px] bg-card px-6 py-12 text-center sm:px-10">
          <span className="grid h-16 w-16 place-items-center rounded-full bg-sage-soft text-sage-on-soft">
            <CircleCheck size={34} aria-hidden />
          </span>
          <h1 className="text-[2rem] leading-tight">{t("Your account is ready")}</h1>
          <p className="text-base text-muted">{t("{name} can sign in on any phone or computer with this username and the password you chose.", { name: made.name })}</p>
          <p className="rounded-2xl bg-sunken px-5 py-3 text-2xl font-medium">{handle(made.username)}</p>
          <Button className="mt-2" onClick={() => setMade(null)}>
            {t("Next person")}
          </Button>
        </div>
      ) : (
        <form onSubmit={submit} className="grid w-full max-w-[64rem] gap-10 rounded-[28px] bg-card px-6 py-10 sm:px-10 md:grid-cols-2 md:gap-12 md:px-12 md:py-12">
          <div>
            <LogoMark className="h-12 w-12" />
            <p className="mt-6 text-sm font-medium text-accent">{t(settings.site_name)}</p>
            <h1 className="mt-1 text-[2.25rem] leading-tight font-normal sm:text-[2.75rem]">{t("Create your account")}</h1>
            <p className="mt-3 text-base text-muted">{t("Fill in your details. Your account is ready right away: sign in on any phone or computer with your username and password.")}</p>
          </div>

          <div className="grid content-start gap-5">
            <div className="grid gap-1.5">
              <p className="px-1 text-sm font-medium text-muted">{t("Language")}</p>
              <LanguageButtons />
            </div>
            <Field label={t("Route name")} htmlFor="desk-name">
              <Input id="desk-name" required value={name} onChange={(e) => setName(e.target.value)} placeholder={t("(general location)")} autoComplete="off" />
            </Field>
            <div className="grid gap-1.5">
              <p className="px-1 text-sm font-medium text-muted">{t("Chavrusas on this route")}</p>
              <ChavrusaFields value={partners} onChange={setPartners} idPrefix="desk-partner" requireHebrew />
            </div>

            <Field label={t("Username")} htmlFor="desk-username" hint={t("3 to 20 letters, numbers, dots or dashes. You'll use it to sign in.")}>
              <Input id="desk-username" required value={username} onChange={(e) => setUsername(e.target.value.replace(/[\s\p{Cf}]/gu, ""))} placeholder="mendel" autoComplete="off" autoCapitalize="none" autoCorrect="off" spellCheck={false} />
            </Field>
            <Field label={t("Type the username again")} htmlFor="desk-username2">
              <Input id="desk-username2" required value={username2} onChange={(e) => setUsername2(e.target.value.replace(/[\s\p{Cf}]/gu, ""))} autoComplete="off" autoCapitalize="none" autoCorrect="off" spellCheck={false} />
            </Field>

            <Field label={t("Email")} htmlFor="desk-email" hint={t("So the admin can reach you, and help if you forget your password.")}>
              <Input id="desk-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" autoComplete="off" autoCapitalize="none" />
            </Field>
            <Field label={t("Type the email again")} htmlFor="desk-email2">
              <Input id="desk-email2" type="email" required value={email2} onChange={(e) => setEmail2(e.target.value)} autoComplete="off" autoCapitalize="none" />
            </Field>

            <Field label={t("Password")} htmlFor="desk-password" hint={t("Use at least 6 characters.")}>
              <Input id="desk-password" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" />
            </Field>
            <Field label={t("Type the password again")} htmlFor="desk-password2">
              <Input id="desk-password2" type="password" required minLength={6} value={password2} onChange={(e) => setPassword2(e.target.value)} autoComplete="new-password" />
            </Field>

            {error && <p className="rounded-2xl bg-danger-soft px-4 py-3 text-sm whitespace-pre-line text-danger">{error}</p>}

            <div className="mt-4 flex justify-end">
              <Button type="submit" disabled={busy}>
                {busy ? t("Please wait…") : t("Create account")}
              </Button>
            </div>
          </div>
        </form>
      )}
    </>
  );
}

/**
 * For someone with an account but no phone: they find it by username and log their Mivtzoim here.
 * Names only show once a few letters are typed, so nobody can scroll through everyone's accounts.
 */
function FindAccount({ picked, setPicked, onDone, onStops }: { picked: Profile | null; setPicked(p: Profile | null): void; onDone(): void; onStops(): void }) {
  const { people, me } = useData();
  const [query, setQuery] = useState("");
  const back = () => {
    setPicked(null);
    setQuery("");
  };
  // By username, account (route) name, email, or the name of anyone on the account.
  const q = query.normalize("NFKC").replace(/\p{Cf}/gu, "").trim().toLowerCase();
  const names = (p: Profile) => chavrusasOf(p.partners).flatMap((c) => [c.name, c.hebrew]);
  const hit = (p: Profile) => [p.username, p.name, p.email, ...names(p)].some((v) => (v ?? "").toLowerCase().includes(q));
  const exact = (p: Profile) => Number([p.username, p.email].some((v) => (v ?? "").toLowerCase() === q));
  const found =
    q.length < 2
      ? []
      : people
          .filter((p) => p.id !== me?.id && hit(p))
          .sort((a, b) => exact(b) - exact(a))
          .slice(0, 8);
  // The person's own name under the account name, when that's what they searched by.
  const who = (p: Profile) => chavrusasOf(p.partners).map((c) => c.name || c.hebrew).filter(Boolean).join(", ");

  if (picked) {
    return (
      <div className="grid w-full max-w-[40rem] gap-5 rounded-[28px] bg-card px-5 py-8 sm:px-8">
        <div className="flex items-center gap-4">
          <Avatar name={picked.name} id={picked.id} src={picked.avatar_url} size={52} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-2xl">{picked.name}</p>
            {picked.username && <p className="text-sm text-muted">{handle(picked.username)}</p>}
          </div>
        </div>
        <p className="text-sm text-muted">{t("Tap a mivtza to add it to this week. Tap − to take one off.")}</p>
        <QuickLog week={currentWeek()} userId={picked.id} />
        <Button
          className="mt-2 justify-self-center"
          onClick={onDone}
        >
          {t("Done")}
        </Button>
        <button type="button" onClick={onStops} className="justify-self-center text-sm font-medium text-accent hover:underline">
          {t("Add your route's stops")}
        </button>
      </div>
    );
  }

  return (
    <div className="grid w-full max-w-[40rem] gap-5 rounded-[28px] bg-card px-5 py-8 sm:px-8">
      <div>
        <h1 className="text-[2rem] leading-tight">{t("Find my account")}</h1>
        <p className="mt-2 text-base text-muted">{t("Type your username, your account name, your email or your own name, then tap your account to log your Mivtzoim.")}</p>
      </div>
      <Field label={t("Username, account name, email or your name")} htmlFor="desk-find">
        <Input
          id="desk-find"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="mendel"
          autoComplete="off"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
        />
      </Field>
      {q.length >= 2 && (
        <div className="grid gap-2">
          {found.length ? (
            found.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setPicked(p)}
                className="flex items-center gap-4 rounded-2xl bg-sunken p-3 text-start transition hover:bg-ink/8"
              >
                <Avatar name={p.name} id={p.id} src={p.avatar_url} size={40} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-lg font-medium">{p.name}</span>
                  <span className="block truncate text-sm text-muted">{[p.username && handle(p.username), who(p)].filter(Boolean).join(" · ")}</span>
                </span>
              </button>
            ))
          ) : (
            <p className="px-1 text-sm text-muted">{t("No account found. Check the spelling, or create an account.")}</p>
          )}
        </div>
      )}
    </div>
  );
}

/** How many stops an account's routes have between them. */
function useStopsOf(userId: string) {
  const { data } = useData();
  const routes = data.routes.filter((r) => r.created_by === userId);
  const stops = data.stops.filter((x) => routes.some((r) => r.id === x.route_id)).sort((a, b) => a.position - b.position);
  return { routes, stops };
}

/**
 * After Done: thanks for filling out the Duch. An account whose route has no stops yet is asked
 * to bring its stops' business cards (or their details) and add them here.
 */
function ThankYou({ person, onStops, onClose }: { person: Profile; onStops(): void; onClose(): void }) {
  const { stops } = useStopsOf(person.id);
  return (
    <div className="grid w-full max-w-[40rem] justify-items-center gap-4 rounded-[28px] bg-card px-6 py-12 text-center sm:px-10">
      <span className="flame-fill grid h-16 w-16 place-items-center rounded-full">
        <Heart size={30} aria-hidden />
      </span>
      <h1 className="text-[2rem] leading-tight">{t("Thank you for filling out the Duch!")}</h1>
      <p className="text-base text-muted">{t("Every Mivtza you log is counted. See you next week.")}</p>
      {stops.length === 0 && (
        <div className="mt-2 grid gap-3 rounded-2xl bg-paper p-5 text-start">
          <p className="font-medium">{t("One more thing: your route has no stops yet")}</p>
          <p className="text-sm text-muted">
            {t("Next time you go out, please take a business card from each place you visit, or write down its name and address. Then add them here, so every stop on your route is on record.")}
          </p>
          <Button variant="tonal" onClick={onStops} className="justify-self-start">
            <MapPin size={16} aria-hidden /> {t("Add my stops now")}
          </Button>
        </div>
      )}
      <Button className="mt-2" onClick={onClose}>
        {t("Done")}
      </Button>
    </div>
  );
}

/**
 * The account's route stops: add a place by scanning its business card or typing it in. Only the
 * places themselves; logging what was done at each one is for the person's own phone.
 */
function RouteStops({ person, onDone }: { person: Profile; onDone(): void }) {
  const { data, actions, notify } = useData();
  const { routes, stops } = useStopsOf(person.id);
  const [routeId, setRouteId] = useState("");
  const [draft, setDraft] = useState<StopDraft>(blankStop);
  const [busy, setBusy] = useState(false);
  const [formKey, setFormKey] = useState(0);
  const route = routes.find((r) => r.id === routeId) ?? routes[0];
  const shown = stops.filter((x) => x.route_id === route?.id);

  async function add(e: FormEvent) {
    e.preventDefault();
    if (!draft.name.trim()) return notify(t("Give the stop a name first."));
    setBusy(true);
    try {
      // An account with no route yet gets one, named after the account.
      const target = route ?? (await actions.createRouteFor(person.id, person.name));
      await actions.addStop(target.id, toInput(draft), person.id);
      setRouteId(target.id);
      setDraft(blankStop);
      setFormKey((n) => n + 1);
      notify(t("Stop added."));
    } catch (err) {
      notify((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid w-full max-w-[40rem] gap-5 rounded-[28px] bg-card px-5 py-8 sm:px-8">
      <div className="flex items-center gap-4">
        <Avatar name={person.name} id={person.id} src={person.avatar_url} size={52} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-2xl">{t("Route stops")}</p>
          <p className="truncate text-sm text-muted">{person.name}</p>
        </div>
      </div>
      <p className="text-sm text-muted">{t("Add the places on your route: scan each one's business card, or type its details in.")}</p>
      {routes.length > 1 && (
        <Field label={t("Route")} htmlFor="desk-route">
          <Select id="desk-route" value={route?.id ?? ""} onChange={(e) => setRouteId(e.target.value)}>
            {routes.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </Select>
        </Field>
      )}
      {shown.length > 0 && (
        <ol className="divide-y divide-line/60 border-y border-line/60">
          {shown.map((x, i) => {
            const loc = data.locations.find((l) => l.id === x.location_id);
            return (
              <li key={x.id} className="flex items-center gap-3 py-2">
                <span className="tabular w-6 shrink-0 text-end text-sm font-semibold text-accent">{i + 1}.</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{loc?.name ?? t("Unknown place")}</span>
                  {loc?.address && <span className="block truncate text-sm text-muted">{loc.address}</span>}
                </span>
                <IconButton aria-label={t("Remove {name}", { name: loc?.name ?? "" })} disabled={busy} onClick={() => actions.removeStop(x.id).catch((err: Error) => notify(err.message))} className="h-9 w-9">
                  <Trash2 size={16} />
                </IconButton>
              </li>
            );
          })}
        </ol>
      )}
      <form onSubmit={add} className="grid gap-3 rounded-2xl bg-paper p-4">
        <p className="font-medium">{shown.length ? t("Add another stop") : t("Add your first stop")}</p>
        <StopFields key={formKey} value={draft} onChange={setDraft} idPrefix="desk-stop" />
        <Button type="submit" disabled={busy} className="justify-self-start">
          <Plus size={16} aria-hidden /> {busy ? t("Saving…") : t("Add stop")}
        </Button>
      </form>
      <Button className="justify-self-center" onClick={onDone}>
        {t("Done")}
      </Button>
    </div>
  );
}

/** How long the desk waits with nobody touching it before the photos take over. */
const REST_AFTER = 30_000;
const REST_WHILE_TYPING = 60_000;
const REST_ON_STOPS = 180_000;
const REST_ON_THANKS = 30_000;
/** A new photo this often; the cross-fade (2 seconds, in the CSS) is part of it. */
const SHOW_EACH = 4_000;

/**
 * The shared photos, filling the screen one after another, newest to oldest, then around again.
 * Resting: they are the whole screen, and any tap or key wakes the desk. Awake: they stay behind
 * the desk, blurred and darkened, so the desk seems to come up out of them.
 */
function PhotoShow({ photos, resting, onWake }: { photos: Photo[]; resting: boolean; onWake(): void }) {
  // `at` counts up forever; the photo is `at` around the list. `from` is the one fading out under it.
  const [at, setAt] = useState(0);
  const [from, setFrom] = useState<number | null>(null);
  const wake = useRef(onWake);
  wake.current = onWake;
  const list = useRef(photos);
  list.current = photos;
  useEffect(() => {
    let stop = false;
    let n = 0;
    let timer: ReturnType<typeof setTimeout>;
    const url = (k: number) => list.current[k % list.current.length]?.url ?? "";
    // Get the next few ready while this one shows, so a slow connection never holds up the rhythm.
    const ahead = () => {
      for (let k = 1; k <= 3; k++) ready(url(n + k));
    };
    const step = async () => {
      // Never fade to a photo that isn't fully loaded: wait for it (a broken one is skipped after a while).
      await Promise.race([ready(url(n + 1)), new Promise((r) => setTimeout(r, 8000))]);
      if (stop) return;
      setFrom(n);
      n += 1;
      setAt(n);
      ahead();
      timer = setTimeout(step, SHOW_EACH);
    };
    ahead();
    timer = setTimeout(step, SHOW_EACH);
    return () => {
      stop = true;
      clearTimeout(timer);
    };
  }, []);
  useEffect(() => {
    if (!resting) return;
    const key = () => wake.current();
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [resting]);
  const slide = (k: number, cls: string) => {
    const p = photos[k % photos.length];
    return (
      <div key={k} className={cx("absolute inset-0", cls)}>
        {/* The same photo, blurred, fills the edges a photo of another shape would leave empty. */}
        <img src={p.thumbUrl ?? p.url} alt="" className="absolute inset-0 h-full w-full scale-110 object-cover opacity-60 blur-2xl" />
        <img src={p.url} alt="" className="absolute inset-0 h-full w-full object-contain" />
      </div>
    );
  };
  return (
    <>
      <div aria-hidden className="fixed inset-0 z-0 overflow-hidden bg-black">
        <div className={cx("photo-stage absolute inset-0", !resting && "photo-stage-back")}>
          {/* One long, even cross-fade: the last photo fades out underneath as the next fades in. */}
          {from !== null && from !== at && photos.length > 1 && slide(from, "photo-out")}
          {slide(at, from === null ? "" : "photo-in")}
        </div>
      </div>
      {resting && (
        <button type="button" onClick={onWake} aria-label={t("Tap to start")} className="fixed inset-0 z-20 block h-full w-full cursor-pointer">
          <span className="absolute inset-x-0 bottom-8 flex justify-center">
            <span className="inline-flex items-center gap-3 rounded-full bg-black/55 py-2.5 ps-3 pe-6 text-base font-medium text-white backdrop-blur-sm">
              <LogoMark className="h-8 w-8" /> {t("Tap to start")}
            </span>
          </span>
        </button>
      )}
    </>
  );
}

/** Photos already fetched and decoded, so showing one never waits on the network. */
const loaded = new Map<string, Promise<void>>();
function ready(url: string) {
  if (!url) return Promise.resolve();
  let p = loaded.get(url);
  if (!p) {
    const img = new Image();
    img.src = url;
    p = img.decode().catch(() => {});
    loaded.set(url, p);
  }
  return p;
}

/** Back to the Owner screens: only with the Owner's password. */
function LeaveDesk({ ownerLang, onClose }: { ownerLang: Lang; onClose(): void }) {
  const { auth } = useData();
  const { go } = useNav();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [wrong, setWrong] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setWrong(false);
    try {
      await auth.verifyPassword(code);
      setLanguage(ownerLang);
      go("/admin");
      setAccountDesk(false);
    } catch {
      setWrong(true);
      setCode("");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal onClose={onClose} blur>
      <form
        role="dialog"
        aria-modal="true"
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
        className="grid w-full max-w-sm gap-4 rounded-[28px] bg-card p-6 shadow-pop"
      >
        <h2 className="text-xl">{t("Back to the Owner screens")}</h2>
        <p className="text-sm text-muted">{t("Enter the Owner account's password.")}</p>
        <Input type="password" autoFocus required value={code} onChange={(e) => setCode(e.target.value)} autoComplete="off" aria-label={t("Password")} id="desk-unlock" />
        {wrong && <p className={cx("rounded-2xl bg-danger-soft px-4 py-3 text-sm text-danger")}>{t("That isn't the Owner's password.")}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            {t("Cancel")}
          </Button>
          <Button type="submit" disabled={busy || !code}>
            {busy ? t("Please wait…") : t("Unlock")}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

"use client";

import { useState } from "react";
import { FlaskConical, Plus, Search, X } from "lucide-react";
import { useData } from "@/lib/data";
import { handle } from "@/lib/admin";
import { chanukahDates, setTestMoment, TEST_MOMENTS, useTestMoment, type TestMoment } from "@/lib/chanukah";
import { zmanimPlace } from "@/lib/shkiah";
import { HDate } from "@hebcal/core";
import { locale, t } from "@/lib/i18n";
import { Avatar, Card, CardTitle, Input, Select, cx } from "./ui";

/**
 * Chanukah test mode, on this phone only: see the Chanukah look and any moment of it ahead of
 * time (the countdown week, the day of the first candle, any night) and try logging. Everything
 * logged in test mode is marked as a test, never counts, and is deleted when test mode is turned
 * off. For the Owner (on Admin) and for the accounts the Owner picks (on Profile).
 */
export function ChanukahTestCard() {
  const { canTestChanukah, isOwner, actions, notify, chanukah, me } = useData();
  const moment = useTestMoment();
  const [busy, setBusy] = useState(false);
  if (!canTestChanukah) return null;
  const on = !!moment;

  // Labels with the real day each night falls on (next year's, once this year's is over).
  const year = new HDate(new Date()).getFullYear();
  const dates = (() => {
    const now = chanukahDates(year, zmanimPlace());
    return new Date() >= now.end ? chanukahDates(year + 1, zmanimPlace()) : now;
  })();
  const day = (d: Date) => new Intl.DateTimeFormat(locale(), { weekday: "long", month: "short", day: "numeric" }).format(d);
  const label = (m: TestMoment) =>
    m === "countdown" ? t("The countdown week") : m === "eve" ? t("The day of the first candle ({day})", { day: day(dates.firstNight) }) : t("Night {n} ({day})", { n: Number(m.split("-")[1]), day: day(dates.lightings[Number(m.split("-")[1]) - 1]) });

  async function turnOff() {
    setBusy(true);
    const tests = (chanukah ?? []).filter((e) => e.is_test && e.user_id === me?.id).length;
    try {
      await actions.deleteChanukahTests();
      setTestMoment("");
      notify(tests ? t("Test mode is off. {n} test entries were deleted.", { n: tests }) : t("Test mode is off."));
    } catch (e) {
      notify((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <span id="chanukah-test" />
      <CardTitle sub={t("See Chanukah ahead of time on this phone, and try logging. Only you see it, and nothing you log counts.")}>{t("Chanukah test mode")}</CardTitle>
      <div className="grid gap-4 px-6 pb-5">
        <label className="flex items-center gap-3 rounded-2xl bg-sunken px-4 py-3">
          <FlaskConical size={20} aria-hidden className="shrink-0 text-accent" />
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-medium">{t("Test Chanukah on this phone")}</span>
            <span className="block text-xs text-muted">{on ? t("Turning it off deletes what you logged while testing.") : t("Everyone else keeps seeing the regular site.")}</span>
          </span>
          <input
            type="checkbox"
            role="switch"
            checked={on}
            disabled={busy}
            onChange={(e) => (e.target.checked ? setTestMoment("night-1") : turnOff())}
            className="switch"
          />
        </label>
        {on && (
          <div className="grid gap-1.5">
            <label htmlFor="chanukah-moment" className="px-1 text-sm font-medium text-muted">
              {t("Show me")}
            </label>
            <Select id="chanukah-moment" value={moment} onChange={(e) => setTestMoment(e.target.value as TestMoment)}>
              {TEST_MOMENTS.map((m) => (
                <option key={m} value={m}>
                  {label(m)}
                </option>
              ))}
            </Select>
            <p className="px-1 text-xs text-muted">{t("Then open Home to see it. Friday is night 1 and Motzei Shabbos is night 2, so you can check those times too.")}</p>
          </div>
        )}
      </div>
      {isOwner && <TestersList />}
    </Card>
  );
}

/** The Owner: pick accounts that can test Chanukah too (they get the same switch on their Profile). */
function TestersList() {
  const { people, chanukahTesters, actions, notify, chanukah } = useData();
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  if (chanukah === null) {
    return <p className="px-6 pb-5 text-sm text-muted">{t("To pick testers, run database update 019 in Supabase first.")}</p>;
  }
  const testers = people.filter((p) => chanukahTesters.includes(p.id)).sort((a, b) => a.name.localeCompare(b.name));
  const q = query.trim().toLowerCase();
  const matches = q
    ? people.filter((p) => !chanukahTesters.includes(p.id) && [p.name, p.username, p.email].some((v) => v?.toLowerCase().includes(q))).slice(0, 6)
    : [];
  const set = async (id: string, name: string, on: boolean) => {
    setBusy(true);
    try {
      await actions.setChanukahTester(id, on);
      notify(on ? t("{name} can now test Chanukah.", { name }) : t("{name} can no longer test Chanukah.", { name }));
      if (on) setQuery("");
    } catch (e) {
      notify((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="border-t border-line/60 px-6 pt-4 pb-5">
      <p className="font-medium">{t("Testers")}</p>
      <p className="text-sm text-muted">{t("Accounts that can test Chanukah ahead of time. They get the same switch on their Profile page.")}</p>
      {testers.length > 0 && (
        <ul className="mt-2">
          {testers.map((p) => (
            <li key={p.id} className="flex items-center gap-3 py-1.5">
              <Avatar name={p.name} id={p.id} src={p.avatar_url} size={32} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{p.name}</span>
                <span className="block truncate text-xs text-muted">{p.username ? handle(p.username) : p.email ?? ""}</span>
              </span>
              <button type="button" disabled={busy} aria-label={t("Remove {name}", { name: p.name })} onClick={() => set(p.id, p.name, false)} className="grid h-9 w-9 place-items-center rounded-full text-muted hover:bg-ink/8">
                <X size={16} />
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="relative mt-3">
        <Search size={16} aria-hidden className="pointer-events-none absolute start-4 top-1/2 -translate-y-1/2 text-muted" />
        <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t("Add a tester: name, username or email")} aria-label={t("Find an account")} className="ps-10" />
      </div>
      {matches.map((p) => (
        <button key={p.id} type="button" disabled={busy} onClick={() => set(p.id, p.name, true)} className={cx("mt-1 flex w-full items-center gap-3 rounded-2xl px-2 py-2 text-start hover:bg-ink/5 disabled:opacity-50")}>
          <Avatar name={p.name} id={p.id} src={p.avatar_url} size={32} />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium">{p.name}</span>
            <span className="block truncate text-xs text-muted">{p.username ? handle(p.username) : p.email ?? ""}</span>
          </span>
          <Plus size={18} aria-hidden className="shrink-0 text-accent" />
        </button>
      ))}
      {q && matches.length === 0 && <p className="px-2 py-2 text-sm text-muted">{t("No account found.")}</p>}
    </div>
  );
}

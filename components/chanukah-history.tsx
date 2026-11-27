"use client";

import { ChevronDown, Moon, Pencil, Sun } from "lucide-react";
import { useData, sumChanukah } from "@/lib/data";
import { useNav } from "@/lib/nav";
import { formatDay } from "@/lib/dates";
import { locale, t, tn } from "@/lib/i18n";
import type { ChanukahEntry } from "@/lib/types";
import { MenorahIcon } from "./icons";

/**
 * Chanukah in History: a "Chanukah 5787" folder for each year, with its totals and every stop.
 * Bochurim see their own; the Owner sees everyone's, with whose each one is. It stays after
 * Chanukah is over. Opens by itself from a link with ?chanukah=1.
 */
export function ChanukahHistory() {
  const { chanukah, me, isOwner, data } = useData();
  const { query, Link } = useNav();
  if (!chanukah || !me) return null;
  const rows = chanukah.filter((e) => isOwner || e.user_id === me.id).sort((a, b) => b.created_at.localeCompare(a.created_at));
  if (!rows.length) return null;
  const years = [...new Set(rows.map((e) => e.year))].sort((a, b) => b - a);
  const nameOf = (id: string) => data.names[id] || t("Someone");

  return (
    <>
      {years.map((year, i) => {
        const list = rows.filter((e) => e.year === year);
        const real = sumChanukah(list.filter((e) => !e.is_test));
        return (
          <details key={year} open={i === 0 && (query.chanukah === "1" || undefined)} className="group overflow-hidden rounded-[28px] bg-card" id={`chanukah-${year}`}>
            <summary className="flex cursor-pointer list-none items-center gap-3 px-6 py-4 hover:bg-ink/5 [&::-webkit-details-marker]:hidden">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-candle-soft text-candle-on-soft">
                <MenorahIcon size={26} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-lg font-medium">{t("Chanukah {year}", { year })}</span>
                <span className="block text-sm text-muted">
                  {[tn(real.lit, "1 menorah lit", "{n} menorahs lit"), tn(real.people, "1 person lit", "{n} people lit"), tn(real.given, "1 menorah given out", "{n} menorahs given out")].join(" · ")}
                </span>
              </span>
              <ChevronDown size={20} aria-hidden className="shrink-0 text-muted transition-transform group-open:rotate-180" />
            </summary>
            <ul className="divide-y divide-line/60 border-t border-line/60">
              {list.map((e) => (
                <EntryRow key={e.id} e={e} who={isOwner ? nameOf(e.user_id) : null} editable={e.user_id === me.id || isOwner} Link={Link} />
              ))}
            </ul>
          </details>
        );
      })}
    </>
  );
}

function EntryRow({ e, who, editable, Link }: { e: ChanukahEntry; who: string | null; editable: boolean; Link: ReturnType<typeof useNav>["Link"] }) {
  const people = e.menorahs.reduce((a, n) => a + n, 0);
  return (
    <li className="flex items-start gap-3 px-6 py-3.5">
      <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-ink/8 text-muted" title={e.time_of_day === "night" ? t("Night") : t("Day")}>
        {e.time_of_day === "night" ? <Moon size={15} aria-hidden /> : <Sun size={15} aria-hidden />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-medium [overflow-wrap:anywhere]">
          {e.place}
          {e.is_test && <span className="ms-2 rounded-full bg-ink/10 px-2 py-0.5 text-xs font-normal text-muted">{t("Test")}</span>}
        </span>
        <span className="block text-sm text-muted">
          {[who, formatDay(e.entry_date), e.time_of_day === "night" ? t("Night") : t("Day")].filter(Boolean).join(" · ")}
        </span>
        <span className="mt-0.5 block text-sm">
          {[
            e.menorahs.length ? `${tn(e.menorahs.length, "1 menorah lit", "{n} menorahs lit")} (${e.menorahs.map((n) => n.toLocaleString(locale())).join(" + ")} = ${tn(people, "1 person lit", "{n} people lit")})` : "",
            e.given_out ? tn(e.given_out, "1 menorah given out", "{n} menorahs given out") : "",
          ]
            .filter(Boolean)
            .join(" · ")}
        </span>
        <span className="block text-sm text-muted [overflow-wrap:anywhere]">{t("Who went: {names}", { names: e.people.join(", ") })}</span>
        {e.notes && <span className="block text-sm text-muted [overflow-wrap:anywhere]">{e.notes}</span>}
      </span>
      {editable && (
        <Link href={`/chanukah?edit=${e.id}`} className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-muted hover:bg-ink/8 hover:text-ink">
          <Pencil size={17} aria-label={t("Edit")} />
        </Link>
      )}
    </li>
  );
}

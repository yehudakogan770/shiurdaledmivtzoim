"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Languages, ListChecks, LogOut } from "lucide-react";
import { needsListNames, rosterDisplay } from "@/lib/roster";
import { useData } from "@/lib/data";
import { chavrusasOf, encodeChavrusa, type Chavrusa } from "@/lib/chavrusa";
import { ChavrusaFields } from "./chavrusa-fields";
import { Button, Modal } from "./ui";
import { t } from "@/lib/i18n";

/** Chavrusas with an English name but no Hebrew name or mother's name yet. */
export function missingHebrewNames(partners: string[] | null | undefined) {
  return chavrusasOf(partners).some((c) => !c.hebrew.trim() || !c.mother.trim());
}

/**
 * Accounts whose Chavrusas are missing their Hebrew names see this until they fill them in.
 * It can't be closed (only signing out leaves it), and it goes away once everything is saved.
 */
export function HebrewNamesGate() {
  const { me, auth, notify, roster } = useData();
  // Also the gate for picking names from the Shiur Daled list, once that list is set up.
  const pick = needsListNames(me?.partners, roster);
  const [list, setList] = useState<Chavrusa[]>(() => chavrusasOf(me?.partners));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function save(e: FormEvent) {
    e.preventDefault();
    setError("");
    const filled = list.filter((c) => c.name.trim() || c.hebrew.trim());
    if (roster.length > 0 && (filled.length === 0 || filled.some((c) => !c.roster || !roster.some((r) => r.id === c.roster))))
      return setError(t("Pick the yeshiva and the name for everyone on this account."));
    if (filled.some((c) => !c.hebrew.trim() || !c.mother.trim())) return setError(t("Fill in the Hebrew name and the mother's name for each Chavrusa."));
    setBusy(true);
    try {
      await auth.updateProfile(me?.name ?? "", filled.map(encodeChavrusa));
      notify(pick ? t("Thank you! The names are saved.") : t("Thank you! The Hebrew names are saved."));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal onClose={() => {}} blur>
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby="hebrew-title"
        onSubmit={save}
        onClick={(e) => e.stopPropagation()}
        className="grid max-h-[92dvh] w-full max-w-md gap-4 overflow-y-auto rounded-[28px] bg-card p-6 shadow-pop"
      >
        <span className="grid h-12 w-12 place-items-center rounded-2xl bg-accent-soft text-accent-on-soft">
          {pick ? <ListChecks size={22} aria-hidden /> : <Languages size={22} aria-hidden />}
        </span>
        <div className="grid gap-1">
          <h2 id="hebrew-title" className="text-xl font-medium">
            {pick ? t("Pick your names from the list") : t("Add your Chavrusas' Hebrew names")}
          </h2>
          <p className="text-sm text-muted">
            {pick
              ? t("Names now come from the Shiur Daled list, so everyone's is spelled the same. For each person on this account, pick the yeshiva and then the name. It takes a moment, and then you can carry on.")
              : t("Your account is missing the Hebrew name and the mother's name of your Chavrusas. Please fill them in to continue.")}
          </p>
        </div>
        <ChavrusaFields value={list} onChange={setList} idPrefix="gate-partner" requireHebrew />
        {error && (
          <p role="alert" className="rounded-2xl bg-danger-soft px-4 py-3 text-sm text-danger">
            {error}
          </p>
        )}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Button type="button" variant="ghost" className="h-10 px-3" onClick={() => auth.signOut()}>
            <LogOut size={16} aria-hidden /> {t("Sign out")}
          </Button>
          <Button type="submit" disabled={busy}>
            {busy ? t("Saving…") : t("Save and continue")}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

/**
 * When a spelling is fixed on the Shiur Daled list, accounts that picked that name follow it:
 * the next time the account is opened, its copy of the name is quietly brought up to date.
 */
export function useListNamesInStep() {
  const { me, auth, roster } = useData();
  const key = me ? `${me.id}:${(me.partners ?? []).join("|")}:${roster.length}` : "";
  useEffect(() => {
    if (!me || roster.length === 0) return;
    const list = chavrusasOf(me.partners);
    const fixed = list.map((c) => {
      const r = roster.find((x) => x.id === c.roster);
      return r && (c.name !== rosterDisplay(r) || c.yeshiva !== r.yeshiva) ? { ...c, name: rosterDisplay(r), yeshiva: r.yeshiva } : c;
    });
    if (fixed.some((c, i) => c !== list[i])) auth.updateProfile(me.name, fixed.map(encodeChavrusa)).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, roster]);
}

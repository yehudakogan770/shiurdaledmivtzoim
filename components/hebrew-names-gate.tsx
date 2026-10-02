"use client";

import { useState, type FormEvent } from "react";
import { Languages, LogOut } from "lucide-react";
import { useData } from "@/lib/data";
import { chavrusasOf, encodeChavrusa, type Chavrusa } from "@/lib/chavrusa";
import { ChavrusaFields } from "./chavrusa-fields";
import { Button, Modal } from "./ui";

/** Chavrusas with an English name but no Hebrew name or mother's name yet. */
export function missingHebrewNames(partners: string[] | null | undefined) {
  return chavrusasOf(partners).some((c) => !c.hebrew.trim() || !c.mother.trim());
}

/**
 * Accounts whose Chavrusas are missing their Hebrew names see this until they fill them in.
 * It can't be closed (only signing out leaves it), and it goes away once everything is saved.
 */
export function HebrewNamesGate() {
  const { me, auth, notify } = useData();
  const [list, setList] = useState<Chavrusa[]>(() => chavrusasOf(me?.partners));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function save(e: FormEvent) {
    e.preventDefault();
    setError("");
    const filled = list.filter((c) => c.name.trim() || c.hebrew.trim());
    if (filled.some((c) => !c.hebrew.trim() || !c.mother.trim())) return setError("Fill in the Hebrew name and the mother's name for each Chavrusa.");
    setBusy(true);
    try {
      await auth.updateProfile(me?.name ?? "", filled.map(encodeChavrusa));
      notify("Thank you! The Hebrew names are saved.");
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
        className="grid w-full max-w-md gap-4 rounded-[28px] bg-card p-6 shadow-pop"
      >
        <span className="grid h-12 w-12 place-items-center rounded-2xl bg-accent-soft text-accent-on-soft">
          <Languages size={22} aria-hidden />
        </span>
        <div className="grid gap-1">
          <h2 id="hebrew-title" className="text-xl font-medium">
            Add your Chavrusas&apos; Hebrew names
          </h2>
          <p className="text-sm text-muted">
            Your account is missing the Hebrew name and the mother&apos;s name of your Chavrusas. Please fill them in to continue.
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
            <LogOut size={16} aria-hidden /> Sign out
          </Button>
          <Button type="submit" disabled={busy}>
            {busy ? "Saving…" : "Save and continue"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

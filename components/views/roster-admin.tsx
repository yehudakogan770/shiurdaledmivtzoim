"use client";

import { useState, type FormEvent } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { useData } from "@/lib/data";
import { namesIn, rosterLabel, yeshivasOf } from "@/lib/roster";
import { Button, Card, CardTitle, Field, IconButton, Input, Select } from "../ui";
import { t, tn } from "@/lib/i18n";

const NEW = "__new__";

/**
 * Admins: the Shiur Daled names list. Only names on it can be on an account, so this is where a
 * missing name is added or a spelling fixed. One yeshiva is shown at a time.
 */
export function RosterCard() {
  const { roster, actions, notify } = useData();
  const yeshivas = yeshivasOf(roster);
  const [yeshiva, setYeshiva] = useState("");
  const [open, setOpen] = useState(false);
  const [add, setAdd] = useState({ yeshiva: "", other: "", last: "", first: "" });
  const [edit, setEdit] = useState<{ id: string; yeshiva: string; last_name: string; first_name: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const run = async (work: () => Promise<void>, done: string) => {
    setBusy(true);
    try {
      await work();
      notify(done);
    } catch (e) {
      notify((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const y = add.yeshiva === NEW ? add.other : add.yeshiva;
    run(async () => {
      await actions.addRosterName(y, add.last, add.first);
      setAdd({ ...add, last: "", first: "" });
      setYeshiva(y.trim());
    }, t("Name added to the list."));
  };
  const names = namesIn(roster, yeshiva);

  return (
    <Card>
      <CardTitle
        action={
          <Button variant="tonal" className="h-9 px-4" onClick={() => setOpen(!open)}>
            {open ? t("Hide the list") : t("Open the list")}
          </Button>
        }
      >
        {t("Names list")}
      </CardTitle>
      <p className="px-6 pb-4 text-sm text-muted">
        {roster.length === 0
          ? t("No names yet. Until the list is set up (database update 023), people type their names in.")
          : t("{names} in {yeshivas}. Only names on this list can be on an account.", { names: tn(roster.length, "{n} name", "{n} names"), yeshivas: tn(yeshivas.length, "{n} yeshiva", "{n} yeshivas") })}
      </p>
      {open && (
        <div className="grid gap-5 px-6 pb-6">
          <form onSubmit={submit} className="grid gap-3 rounded-2xl bg-paper p-4">
            <p className="font-medium">{t("Add a name")}</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label={t("Yeshiva")} htmlFor="roster-add-yeshiva">
                <Select id="roster-add-yeshiva" required value={add.yeshiva} onChange={(e) => setAdd({ ...add, yeshiva: e.target.value })}>
                  <option value="">{t("Pick a yeshiva")}</option>
                  {yeshivas.map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                  <option value={NEW}>{t("A new yeshiva…")}</option>
                </Select>
              </Field>
              {add.yeshiva === NEW && (
                <Field label={t("New yeshiva's name")} htmlFor="roster-add-other">
                  <Input id="roster-add-other" required value={add.other} onChange={(e) => setAdd({ ...add, other: e.target.value })} />
                </Field>
              )}
              <Field label={t("Last name")} htmlFor="roster-add-last">
                <Input id="roster-add-last" required value={add.last} onChange={(e) => setAdd({ ...add, last: e.target.value })} autoComplete="off" />
              </Field>
              <Field label={t("First name")} htmlFor="roster-add-first">
                <Input id="roster-add-first" required value={add.first} onChange={(e) => setAdd({ ...add, first: e.target.value })} autoComplete="off" />
              </Field>
            </div>
            <Button type="submit" disabled={busy} className="justify-self-start">
              <Plus size={16} aria-hidden /> {t("Add to the list")}
            </Button>
          </form>

          <Field label={t("See a yeshiva's names")} htmlFor="roster-yeshiva">
            <Select id="roster-yeshiva" value={yeshiva} onChange={(e) => setYeshiva(e.target.value)}>
              <option value="">{t("Pick a yeshiva")}</option>
              {yeshivas.map((y) => (
                <option key={y} value={y}>
                  {y} ({namesIn(roster, y).length})
                </option>
              ))}
            </Select>
          </Field>
          {yeshiva && (
            <ul className="divide-y divide-line/60 border-y border-line/60">
              {names.map((r) =>
                edit?.id === r.id ? (
                  <li key={r.id} className="py-3">
                    <form
                      className="grid gap-2 sm:grid-cols-[1fr_1fr_1fr_auto]"
                      onSubmit={(e) => {
                        e.preventDefault();
                        run(async () => {
                          await actions.updateRosterName(r.id, edit);
                          setEdit(null);
                        }, t("Name saved."));
                      }}
                    >
                      <Input aria-label={t("Last name")} required value={edit.last_name} onChange={(e) => setEdit({ ...edit, last_name: e.target.value })} className="py-2" />
                      <Input aria-label={t("First name")} required value={edit.first_name} onChange={(e) => setEdit({ ...edit, first_name: e.target.value })} className="py-2" />
                      <Select aria-label={t("Yeshiva")} value={edit.yeshiva} onChange={(e) => setEdit({ ...edit, yeshiva: e.target.value })} className="py-2">
                        {yeshivas.map((y) => (
                          <option key={y} value={y}>
                            {y}
                          </option>
                        ))}
                      </Select>
                      <span className="flex gap-1">
                        <Button type="submit" disabled={busy} className="h-10 px-4">
                          {t("Save")}
                        </Button>
                        <Button variant="ghost" className="h-10 px-3" onClick={() => setEdit(null)}>
                          {t("Cancel")}
                        </Button>
                      </span>
                    </form>
                  </li>
                ) : (
                  <li key={r.id} className="flex items-center gap-1 py-1.5">
                    <span className="min-w-0 flex-1 truncate">{rosterLabel(r)}</span>
                    <IconButton aria-label={t("Edit {name}", { name: rosterLabel(r) })} disabled={busy} onClick={() => setEdit({ id: r.id, yeshiva: r.yeshiva, last_name: r.last_name, first_name: r.first_name })} className="h-9 w-9">
                      <Pencil size={16} />
                    </IconButton>
                    <IconButton
                      aria-label={t("Remove {name}", { name: rosterLabel(r) })}
                      disabled={busy}
                      className="h-9 w-9"
                      onClick={() => confirm(t("Take {name} off the list? Accounts with this name will be asked to pick again.", { name: rosterLabel(r) })) && run(() => actions.removeRosterName(r.id), t("Name removed."))}
                    >
                      <Trash2 size={16} />
                    </IconButton>
                  </li>
                ),
              )}
            </ul>
          )}
        </div>
      )}
    </Card>
  );
}

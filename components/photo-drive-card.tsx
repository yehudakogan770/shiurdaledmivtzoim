"use client";

import { useEffect, useState } from "react";
import { CircleCheck, Copy, ExternalLink, Printer } from "lucide-react";
import { t } from "@/lib/i18n";
import { useData } from "@/lib/data";
import { DRIVE_SCRIPT, isDriveUrl, sendToDrive } from "@/lib/drive";
import { Button, Card, CardTitle, Field, Input } from "./ui";

/**
 * The Owner only: connect the Google Drive that gets large print copies of every shared photo,
 * a folder per week. The website itself keeps showing the small, fast copies.
 */
export function PhotoDriveCard() {
  const { backend, notify } = useData();
  const [saved, setSaved] = useState<string | null>(null);
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [folder, setFolder] = useState<string | null>(null);
  const [showSteps, setShowSteps] = useState(false);

  useEffect(() => {
    backend?.photoDriveUrl?.().then((u) => {
      setSaved(u);
      setUrl(u ?? "");
    });
  }, [backend]);

  if (!backend?.setPhotoDriveUrl) return null;

  async function save() {
    const next = url.trim();
    if (next && !isDriveUrl(next)) return notify(t("That isn't a Google Apps Script address. It starts with https://script.google.com/"));
    setBusy(true);
    try {
      if (next) setFolder((await sendToDrive(next, { week: "", name: "", test: true })).folder ?? null);
      await backend!.setPhotoDriveUrl!(next || null);
      setSaved(next || null);
      notify(next ? t("Connected. New photos also go to Google Drive, in print quality.") : t("Disconnected from Google Drive."));
    } catch (e) {
      notify(t("Google Drive didn't answer: {reason}", { reason: (e as Error).message }));
    } finally {
      setBusy(false);
    }
  }

  async function copyScript() {
    try {
      await navigator.clipboard.writeText(DRIVE_SCRIPT);
      notify(t("Script copied."));
    } catch {
      notify(t("Couldn't copy. Select the script below and copy it."));
    }
  }

  return (
    <Card>
      <CardTitle sub={t("Every shared photo is also saved large (about 3000 pixels) in your Google Drive, a folder per week, ready to print. The website keeps showing the small, fast copies.")}>
        <span className="inline-flex items-center gap-2">
          <Printer size={20} aria-hidden /> {t("Print copies in Google Drive")}
        </span>
      </CardTitle>
      <div className="grid gap-4 px-6 pb-5">
        {saved ? (
          <p className="inline-flex items-center gap-2 rounded-2xl bg-sage-soft px-4 py-3 text-sm text-sage-on-soft">
            <CircleCheck size={18} aria-hidden /> {t("Connected. Photos go to the \"Mivtzoim Photos\" folder in your Drive.")}
            {folder && (
              <a href={folder} target="_blank" rel="noreferrer" className="ms-auto inline-flex items-center gap-1 font-medium underline">
                {t("Open")} <ExternalLink size={14} aria-hidden />
              </a>
            )}
          </p>
        ) : (
          <p className="rounded-2xl bg-sunken px-4 py-3 text-sm">{t("Not connected yet. Follow the steps once, while signed in to Google as sdmivtzoim87@gmail.com.")}</p>
        )}

        <Button variant="tonal" className="justify-self-start" onClick={() => setShowSteps((s) => !s)}>
          {showSteps ? t("Hide the steps") : t("Show the steps")}
        </Button>
        {showSteps && (
          <ol className="grid list-decimal gap-2 ps-6 text-sm">
            <li>{t("On a computer, sign in to Google as sdmivtzoim87@gmail.com and open script.google.com.")}</li>
            <li>{t("Click New project. Delete what's in the box, then paste the script (Copy script, below).")}</li>
            <li>{t("Click Deploy → New deployment. Next to Select type, click the gear and choose Web app.")}</li>
            <li>{t("Set Execute as: Me, and Who has access: Anyone. Click Deploy, then Authorize access and allow it.")}</li>
            <li>{t("Copy the Web app URL, paste it below and click Connect.")}</li>
            <li className="list-none pt-1">
              <Button variant="tonal" onClick={copyScript}>
                <Copy size={16} aria-hidden /> {t("Copy script")}
              </Button>
            </li>
          </ol>
        )}

        <Field label={t("Web app URL")} htmlFor="drive-url">
          <Input id="drive-url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://script.google.com/macros/s/…/exec" autoComplete="off" autoCapitalize="none" spellCheck={false} />
        </Field>
        <div className="flex flex-wrap gap-2">
          <Button disabled={busy || (url.trim() === (saved ?? ""))} onClick={save}>
            {busy ? t("Please wait…") : saved && !url.trim() ? t("Disconnect") : t("Connect")}
          </Button>
        </div>
      </div>
    </Card>
  );
}

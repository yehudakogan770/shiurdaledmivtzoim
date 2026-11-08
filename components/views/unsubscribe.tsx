"use client";

import { useEffect, useState } from "react";
import { MailCheck, MailX } from "lucide-react";
import { useData } from "@/lib/data";
import { t } from "@/lib/i18n";
import { useNav } from "@/lib/nav";
import { Button, Empty } from "../ui";

/** Opened from an email's Unsubscribe link: stops the Owner's emails, with a way to undo it. */
export function UnsubscribeView() {
  const { backend } = useData();
  const { query } = useNav();
  const token = query.t ?? "";
  const [state, setState] = useState<"working" | "off" | "on" | "bad">("working");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!backend?.emailUnsubscribe) return;
    if (!/^[0-9a-f-]{20,}$/i.test(token)) return setState("bad");
    backend.emailUnsubscribe(token, true).then(
      (ok) => setState(ok ? "off" : "bad"),
      () => setState("bad"),
    );
  }, [backend, token]);

  const change = async (off: boolean) => {
    setBusy(true);
    try {
      if (await backend!.emailUnsubscribe!(token, off)) setState(off ? "off" : "on");
    } catch {
      setState("bad");
    }
    setBusy(false);
  };

  if (state === "working") return <p className="pt-16 text-center text-sm text-muted">{t("One moment…")}</p>;
  if (state === "bad") {
    return <Empty title={t("This link didn't work")} icon={MailX}>{t("Please open the Unsubscribe link from the email again.")}</Empty>;
  }
  return (
    <Empty
      title={state === "off" ? t("You're unsubscribed") : t("You're subscribed again")}
      icon={state === "off" ? MailX : MailCheck}
      action={
        <Button variant="ghost" onClick={() => change(state !== "off")} disabled={busy}>
          {state === "off" ? t("Subscribe again") : t("Unsubscribe")}
        </Button>
      }
    >
      {state === "off" ? t("You won't get emails from Shiur Daled Mivtzoim anymore. Emails about your account (like resetting your password) still come.") : t("You'll get emails from Shiur Daled Mivtzoim again.")}
    </Empty>
  );
}

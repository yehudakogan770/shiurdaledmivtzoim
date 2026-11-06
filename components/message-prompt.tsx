"use client";

import { useState } from "react";
import { Megaphone } from "lucide-react";
import { useData } from "@/lib/data";
import { DESTINATIONS } from "@/lib/messages";
import { useNav } from "@/lib/nav";
import { t } from "@/lib/i18n";
import { Button, Modal } from "./ui";

/** A message the Owner sent this account, as a pop-up: one at a time, oldest first. */
export function MessagePrompt() {
  const { me, data, actions } = useData();
  const { go } = useNav();
  // "Later" hides a message until the site is opened again; only OK or the button removes it.
  const [later, setLater] = useState<string[]>([]);
  const message = [...data.messages].filter((m) => m.user_id === me?.id && !later.includes(m.id)).sort((a, b) => a.created_at.localeCompare(b.created_at))[0];
  if (!message) return null;
  const dest = DESTINATIONS.find((d) => d.key === message.go && d.href);
  const close = () => actions.dismissMessage(message.id);
  return (
    <Modal onClose={() => {}} blur>
      <div role="dialog" aria-modal="true" aria-labelledby="owner-message" onClick={(e) => e.stopPropagation()} className="grid w-full max-w-sm gap-4 rounded-[28px] bg-card p-6 shadow-pop">
        <span className="grid h-12 w-12 place-items-center rounded-2xl bg-accent-soft text-accent-on-soft">
          <Megaphone size={22} aria-hidden />
        </span>
        <div>
          <h2 id="owner-message" className="text-xl font-medium">
            {t("A message for you")}
          </h2>
          <p className="mt-2 whitespace-pre-line">{message.text}</p>
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          {dest ? (
            <>
              <Button variant="ghost" onClick={() => setLater((l) => [...l, message.id])}>
                {t("Later")}
              </Button>
              <Button
                onClick={() => {
                  close();
                  go(dest.href);
                }}
              >
                {t(dest.button)}
              </Button>
            </>
          ) : (
            <Button onClick={close}>{t("OK")}</Button>
          )}
        </div>
      </div>
    </Modal>
  );
}

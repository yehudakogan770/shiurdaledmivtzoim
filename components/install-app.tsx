"use client";

import { useEffect, useState } from "react";
import { Download, MoreVertical, Share, SquarePlus, X } from "lucide-react";
import { useInstall } from "@/lib/install";
import { Button, Card, CardTitle, IconButton } from "./ui";
import { LogoMark } from "./brand";

const DISMISS_KEY = "sdm-install-dismissed";

/** Step-by-step for phones where the browser can't install with one tap. */
function Steps({ platform }: { platform: "ios" | "android" | "other" }) {
  const icon = "mx-0.5 inline align-[-3px] text-accent";
  const steps =
    platform === "ios"
      ? [
          <>Open this site in <b className="font-medium">Safari</b>.</>,
          <>Tap the Share button <Share size={17} aria-label="Share" className={icon} /> at the bottom (or top) of the screen.</>,
          <>Scroll down and tap <b className="font-medium">Add to Home Screen</b> <SquarePlus size={17} aria-hidden className={icon} />.</>,
          <>Tap <b className="font-medium">Add</b>.</>,
        ]
      : [
          <>Open this site in <b className="font-medium">Chrome</b>.</>,
          <>Tap the menu <MoreVertical size={17} aria-label="menu" className={icon} /> at the top right.</>,
          <>Tap <b className="font-medium">Add to Home screen</b> or <b className="font-medium">Install app</b>, then <b className="font-medium">Install</b>.</>,
        ];
  return (
    <ol className="grid list-decimal gap-2 pl-5 text-sm leading-relaxed marker:font-medium">
      {steps.map((step, i) => (
        <li key={i}>{step}</li>
      ))}
    </ol>
  );
}

function InstallAction({ onDone }: { onDone?: () => void }) {
  const { platform, canPrompt, prompt } = useInstall();
  const [showSteps, setShowSteps] = useState(false);
  if (canPrompt) {
    return (
      <Button className="h-10 justify-self-start px-5" onClick={() => prompt().then((ok) => ok && onDone?.())}>
        <Download size={18} aria-hidden /> Install the app
      </Button>
    );
  }
  if (!showSteps) {
    return (
      <Button className="h-10 justify-self-start px-5" onClick={() => setShowSteps(true)}>
        <Download size={18} aria-hidden /> Show me how
      </Button>
    );
  }
  return <Steps platform={platform} />;
}

/** For the Profile page: always there, explains how to add the app to the home screen. */
export function InstallCard() {
  const { ready, installed } = useInstall();
  if (!ready) return null;
  return (
    <Card>
      <CardTitle sub="An icon on your home screen that opens the site full screen, like an app">Get the app</CardTitle>
      <div className="grid gap-4 px-6 pb-6">
        {installed ? (
          <p className="text-sm">You&apos;re using the app. To put it on another phone, open the site there and come back to this page.</p>
        ) : (
          <InstallAction />
        )}
      </div>
    </Card>
  );
}

/** A small note on the home page for phone users who haven't added the app yet. Can be closed. */
export function InstallBanner() {
  const { ready, installed, platform } = useInstall();
  const [hidden, setHidden] = useState(true);
  useEffect(() => {
    try {
      setHidden(localStorage.getItem(DISMISS_KEY) === "1");
    } catch {
      setHidden(false);
    }
  }, []);
  if (!ready || installed || hidden || platform === "other") return null;

  const close = () => {
    setHidden(true);
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      // Shown again next visit.
    }
  };

  return (
    <section className="grid gap-3 rounded-[28px] bg-card p-5">
      <div className="flex items-start gap-3">
        <LogoMark className="h-11 w-11" />
        <div className="min-w-0 flex-1">
          <p className="font-medium">Add the app to your home screen</p>
          <p className="text-sm text-muted">Open it with one tap, full screen, like any other app.</p>
        </div>
        <IconButton aria-label="Not now" onClick={close} className="-mt-1 -mr-2">
          <X size={18} />
        </IconButton>
      </div>
      <InstallAction onDone={close} />
    </section>
  );
}

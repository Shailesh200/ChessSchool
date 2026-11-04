"use client";

import { copy } from "@chessschool/design";
import { useEffect, useState } from "react";
import { requestNotifications, notificationsSupported } from "@/lib/notifications";
import { useApp } from "@/lib/state";
import { Cody } from "./Lottie";
import { Button, Sheet } from "./ui";

/** Offered once, after the first lesson. Never shown again whatever the answer. */
export function FirstRunNotificationSheet() {
  const { state, ready, setPrefs, markNotificationOffered } = useApp();
  const [open, setOpen] = useState(false);
  const eligible = ready && state.progress.completed.meet && !state.notificationOffered && state.prefs.notifications === "unknown" && state.pendingCeremony === null;

  useEffect(() => {
    if (!eligible || !notificationsSupported()) return;
    const t = setTimeout(() => setOpen(true), 900);
    return () => clearTimeout(t);
  }, [eligible]);

  const close = () => {
    setOpen(false);
    markNotificationOffered();
  };

  return (
    <Sheet open={open} onClose={close} labelledBy="notif-title">
      <Cody animation="sleepy" size={110} />
      <h2 id="notif-title">{copy.notificationsPrompt.title}</h2>
      <p>{copy.notificationsPrompt.body}</p>
      <Button
        block
        icon="bell"
        onClick={async () => {
          setPrefs({ notifications: await requestNotifications() });
          close();
        }}
      >
        {copy.notificationsPrompt.allow}
      </Button>
      <Button
        block
        variant="ghost"
        onClick={() => {
          setPrefs({ notifications: "dismissed" });
          close();
        }}
      >
        {copy.notificationsPrompt.later}
      </Button>
    </Sheet>
  );
}

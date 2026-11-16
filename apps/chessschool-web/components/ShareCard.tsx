"use client";

import { copy, type ShareCardData, type ShareCardKind } from "@chessschool/design";
import { useState } from "react";
import { shareCard } from "@/lib/share";
import { useApp } from "@/lib/state";
import { Button, useToast } from "./ui";

/** "Share": makes the card for the active learner and opens the share sheet (or saves the PNG). */
export function ShareCardButton({ kind, data, label = copy.share.button, variant = "secondary", block }: { kind: ShareCardKind; data: ShareCardData; label?: string; variant?: "primary" | "secondary" | "ghost"; block?: boolean }) {
  const { state, track } = useApp();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  return (
    <Button
      variant={variant}
      block={block}
      loading={busy}
      data-share-card={kind}
      onClick={async () => {
        setBusy(true);
        try {
          const done = await shareCard(kind, data, { child: state.activeChild, avatar: state.profile.avatar });
          if (done !== "none") track("share");
          if (done === "saved") toast(copy.share.saved);
        } catch {
          toast(copy.share.failed);
        } finally {
          setBusy(false);
        }
      }}
    >
      {label}
    </Button>
  );
}

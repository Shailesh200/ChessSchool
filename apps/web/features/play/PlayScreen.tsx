"use client";

import { MatchChooser } from "@/features/play/MatchChooser";
import { MatchView } from "@/features/play/MatchView";
import { useMatch } from "@/core/store/match.store";
import { useSettings } from "@/core/store/settings.store";
import { PlayDexShell } from "./PlayDexShell";
import { PlayHub } from "./PlayHub";
import { PlayMatch } from "./PlayMatch";

const SCENES = ["kira", "ash", "rex", "skye", "dark", "won", "lost"] as const;

export function PlayScreen({ scene }: { scene?: string }) {
  const uiKit = useSettings((s) => s.uiKit);
  const active = useMatch((s) => s.active);
  const known = SCENES.find((s) => s === scene);

  if (uiKit === "legacy" && !known) {
    if (active) return <MatchView active={active} />;
    return <MatchChooser />;
  }

  const preview = known && process.env.NODE_ENV !== "production" ? known : null;
  const body = preview ? (
    <PlayMatch scene={preview} />
  ) : active ? (
    <PlayMatch scene="live" />
  ) : (
    <PlayHub />
  );
  const screen =
    preview === "won"
      ? "12-play-won"
      : preview === "lost"
        ? "12-play-lost"
        : preview || active
          ? "12-play-match"
          : "12-play-hub";

  return (
    <PlayDexShell screen={screen} pad={screen !== "12-play-hub"}>
      {body}
    </PlayDexShell>
  );
}

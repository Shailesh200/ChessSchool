"use client";

import { MatchChooser } from "@/features/play/MatchChooser";
import { MatchView } from "@/features/play/MatchView";
import { useMatch } from "@/core/store/match.store";
import { useSettings } from "@/core/store/settings.store";
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
  if (known && process.env.NODE_ENV !== "production")
    return <PlayMatch scene={known} />;
  if (active) return <PlayMatch scene="live" />;
  return <PlayHub />;
}

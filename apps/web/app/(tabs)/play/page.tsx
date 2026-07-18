"use client";

import { MatchChooser } from "@/features/play/MatchChooser";
import { MatchView } from "@/features/play/MatchView";
import { useMatch } from "@/core/store/match.store";

export default function PlayPage() {
  const active = useMatch((s) => s.active);

  if (active) {
    return <MatchView active={active} />;
  }

  return <MatchChooser />;
}

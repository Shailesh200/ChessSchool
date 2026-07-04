"use client";

import { MatchChooser } from "@/features/play/MatchChooser";
import { MatchView } from "@/features/play/MatchView";
import { useMatch } from "@/core/store/match.store";
import { useMounted } from "@/core/hooks/useMounted";

export default function PlayPage() {
  const mounted = useMounted();
  const active = useMatch((s) => s.active);

  // Keep MatchView mounted after game-over (finished=true) so the result modal can show.
  // clear() in MatchView returns here to MatchChooser.
  if (mounted && active) {
    return <MatchView active={active} />;
  }

  return mounted ? <MatchChooser /> : <div className="skeleton h-64 rounded-card" />;
}

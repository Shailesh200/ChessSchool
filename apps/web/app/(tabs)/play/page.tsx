"use client";

import { MatchChooser } from "@/features/play/MatchChooser";
import { MatchView } from "@/features/play/MatchView";
import { useMatch } from "@/core/store/match.store";
import { useMounted } from "@/core/hooks/useMounted";

export default function PlayPage() {
  const mounted = useMounted();
  const active = useMatch((s) => s.active);

  if (mounted && active && !active.finished) {
    return <MatchView active={active} />;
  }

  return mounted ? <MatchChooser /> : <div className="skeleton h-64 rounded-card" />;
}

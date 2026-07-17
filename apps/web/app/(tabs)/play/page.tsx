"use client";

import { MatchChooser } from "@/features/play/MatchChooser";
import { MatchView } from "@/features/play/MatchView";
import { useMatch } from "@/core/store/match.store";
import { useMounted } from "@/core/hooks/useMounted";

export default function PlayPage() {
  const mounted = useMounted();
  const active = useMatch((s) => s.active);

  if (mounted && active) {
    return <MatchView active={active} />;
  }

  return mounted ? <MatchChooser /> : <div className="skeleton rounded-card h-64" />;
}

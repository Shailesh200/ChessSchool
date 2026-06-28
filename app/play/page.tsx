"use client";

import { AppShell } from "@/components/layout/AppShell";
import { MatchChooser } from "@/features/play/MatchChooser";
import { MatchView } from "@/features/play/MatchView";
import { useMatch } from "@/core/store/match.store";
import { useMounted } from "@/core/hooks/useMounted";

export default function PlayPage() {
  const mounted = useMounted();
  const active = useMatch((s) => s.active);

  // An active match takes over the screen in immersive focus mode (no nav).
  if (mounted && active) {
    return (
      <AppShell focus>
        <MatchView active={active} />
      </AppShell>
    );
  }

  return (
    <AppShell>
      {mounted ? <MatchChooser /> : <div className="skeleton h-64 rounded-card" />}
    </AppShell>
  );
}

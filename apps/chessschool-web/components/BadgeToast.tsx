"use client";

import { copy, newBadges } from "@chessschool/design";
import { useEffect } from "react";
import { useApp } from "@/lib/state";
import { useToast } from "./ui";

/** Celebrates each newly earned achievement once, wherever the learner is. */
export function BadgeToast() {
  const { state, ready, markBadgesSeen, cue } = useApp();
  const toast = useToast();
  const fresh = ready ? newBadges(state).join(",") : "";
  useEffect(() => {
    if (!fresh) return;
    const ids = fresh.split(",");
    const t = setTimeout(() => {
      for (const id of ids) toast(`${copy.badges.earned} ${copy.badges.list[id].name}`);
      cue("level-up");
      markBadgesSeen(ids);
    }, 1200);
    return () => clearTimeout(t);
  }, [fresh, toast, cue, markBadgesSeen]);
  return null;
}

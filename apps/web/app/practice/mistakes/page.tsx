"use client";

import Link from "next/link";
import { LessonPlayer } from "@/features/lessons/LessonPlayer";
import { useProgression } from "@/core/store/progression.store";
import { useMounted } from "@/core/hooks/useMounted";
import { Mascot } from "@/components/ui/Mascot";
import type { Lesson, LessonStep } from "@/features/lessons/types";

/**
 * Phase 2 — personalized puzzles built from the player's OWN mistakes (the
 * Mistake-DNA log: position + the move they missed). Re-solve them correctly.
 */
export default function PracticeMistakesPage() {
  const mounted = useMounted();
  const mistakeLog = useProgression((s) => s.mistakeLog);

  if (!mounted) {
    return <div className="flex min-h-dvh items-center justify-center bg-surface text-sm font-bold text-ink-500">Loading…</div>;
  }

  // De-dupe by position and keep the most recent dozen.
  const seen = new Set<string>();
  const picks = mistakeLog.filter((m) => (seen.has(m.fen) ? false : (seen.add(m.fen), true))).slice(0, 12);

  if (!picks.length) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-surface px-6 text-center">
        <Mascot expression="happy" size={96} />
        <p className="text-lg font-extrabold text-ink">No mistakes to practise yet 🎉</p>
        <p className="max-w-xs text-sm font-semibold text-ink-500">
          As you play lessons, the spots you get wrong are saved here so you can re-solve them correctly.
        </p>
        <Link href="/" className="text-sm font-extrabold text-brand">← Back to academy</Link>
      </div>
    );
  }

  const steps: LessonStep[] = picks.map((m, i) => ({
    id: `mx${i}`,
    kind: "move",
    coach: "You slipped here before — find the better move this time.",
    fen: m.fen,
    solution: [m.best],
    tag: m.tag || "review",
    successText: "That's the one! 🎯",
    failText: "Not quite — look again for the strongest move.",
  }));

  const lesson: Lesson = {
    id: "practice-mistakes",
    unit: "practice",
    title: "Practice your mistakes",
    subtitle: "Positions you got wrong, replayed",
    emoji: "🎯",
    prerequisites: [],
    xp: 20,
    tag: "review",
    exam: false,
    steps,
  };

  return <LessonPlayer lesson={lesson} nextLessonId={null} />;
}

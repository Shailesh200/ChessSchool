export type LessonStepKind = "info" | "observe" | "move" | "quiz";

export type PremiumFeedbackState = "none" | "correct" | "wrong";

export function isTapSquaresStep(step: { solution?: string[] }): boolean {
  const sol = step.solution;
  if (!sol?.length) return false;
  return sol.every((entry) => /^[a-h][1-8]$/i.test(entry.trim()) && !entry.includes(":"));
}

export function isWhyQuizStep(step: { kind: string; fen?: string; options?: unknown[] }): boolean {
  return step.kind === "quiz" && Boolean(step.fen) && Boolean(step.options?.length);
}

export function lessonStepBadge(
  lessonOrdinal: number,
  stepKind: LessonStepKind,
  opts: { hintLevel?: number; tapSquares?: boolean; phase?: string; tagSuffix?: string } = {},
): string {
  const n = Math.max(1, lessonOrdinal);
  if ((opts.hintLevel ?? 0) > 0 && stepKind === "move" && opts.phase === "playing") {
    return `Lesson ${n} · Hint ${Math.min(opts.hintLevel!, 3)} of 3`;
  }
  if (opts.tapSquares) return `Lesson ${n} · Tap the squares`;
  if (stepKind === "quiz") return `Lesson ${n} · Why it works`;
  if (stepKind === "move") return `Lesson ${n} · Your turn`;
  if (stepKind === "info" || stepKind === "observe") return `Lesson ${n} · ${opts.tagSuffix ?? "Lesson"}`;
  return `Lesson ${n}`;
}

export function premiumCoachMood(
  phase: PremiumFeedbackState | "playing" | "complete",
  stepKind: LessonStepKind,
  hintLevel: number,
): "thinking" | "happy" | "encouraging" | "celebrate" | "neutral" {
  if (phase === "complete") return "celebrate";
  if (phase === "correct") return "happy";
  if (phase === "wrong") return "encouraging";
  if (hintLevel > 0 && stepKind === "move") return "encouraging";
  if (stepKind === "move" || stepKind === "quiz") return "thinking";
  return "neutral";
}

export function mapCoachAvatarState(
  mood: ReturnType<typeof premiumCoachMood>,
): "idle" | "think" | "success" | "miss" | "speak" {
  switch (mood) {
    case "happy":
    case "celebrate":
      return "success";
    case "encouraging":
      return "miss";
    case "thinking":
      return "think";
    default:
      return "idle";
  }
}

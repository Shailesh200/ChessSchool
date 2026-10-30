import { formatCoachText } from "@chess-school/progression";

type StepLike = {
  kind: string;
  coach?: string;
  question?: string;
  tag?: string | null;
};

export function lessonTagSuffix(tag?: string | null): string {
  if (!tag) return "Lesson";
  if (tag === "fork") return "Forks";
  return tag.charAt(0).toUpperCase() + tag.slice(1);
}

export function stepTitle(step: StepLike, lessonTitle: string): string {
  if (step.question?.trim()) return step.question.trim();
  const coach = formatCoachText(step.coach ?? "").trim();
  const first = coach.split(/[.!?]/)[0]?.trim();
  if (step.kind === "move" && step.tag === "fork") return "Find the fork";
  if (step.kind === "move" && first) return first.length <= 48 ? first : "Your turn";
  if ((step.kind === "info" || step.kind === "observe") && first) {
    return first.length <= 64 ? first : lessonTitle;
  }
  return lessonTitle;
}

export function correctBarTitle(coachCharacter: string, fallback: string): string {
  if (coachCharacter === "genz") return "That's a W!";
  return fallback.split(/[.!?]/)[0]?.trim() || "Nice work!";
}

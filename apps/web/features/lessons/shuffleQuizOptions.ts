import type { QuizOption } from "./types";

/** Fisher–Yates shuffle; returns display order + mapped correct index. */
export function shuffleQuizOptions(
  options: QuizOption[],
  correct: number,
): { options: QuizOption[]; correctIdx: number } {
  if (options.length <= 1) {
    return { options: [...options], correctIdx: correct };
  }
  const order = options.map((_, i) => i);
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = order[i]!;
    order[i] = order[j]!;
    order[j] = tmp;
  }
  return {
    options: order.map((i) => options[i]!),
    correctIdx: order.indexOf(correct),
  };
}

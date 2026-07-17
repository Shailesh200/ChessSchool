import { Chess } from "chess.js";
import { conceptGroup } from "./concepts.mjs";
import { setupCoach, finishCoach, midCoachAt } from "./coach-voice.mjs";

/** @param {string} uci */
function uciMove(uci) {
  return {
    from: uci.slice(0, 2),
    to: uci.slice(2, 4),
    promotion: uci.length > 4 ? uci[4] : undefined,
  };
}

/**
 * Turn a bank puzzle into validated multi-step lesson steps.
 * @param {{ fen: string, line: string[], concepts: string[], coach?: { setup?: string, success?: string, hint?: string } }} puzzle
 * @returns {{ steps: object[] } | { error: string }}
 */
export function compilePuzzleSteps(puzzle) {
  const group = conceptGroup(puzzle.concepts[0] ?? "");
  if (!group) return { error: "unknown_concept" };

  const moves = puzzle.line.map((m) => m.replace(/:/g, ""));
  if (moves.length < 2) return { error: "line_too_short" };

  const g = new Chess(puzzle.fen);
  try {
    if (!g.move(uciMove(moves[0]))) return { error: "illegal_setup" };
  } catch {
    return { error: "illegal_setup" };
  }

  const steps = [];
  for (let i = 1; i < moves.length; i += 2) {
    const mv = uciMove(moves[i]);
    const before = g.fen();
    let applied;
    try {
      applied = g.move(mv);
    } catch {
      return { error: `illegal_student_move:${moves[i]}` };
    }
    if (!applied) return { error: `illegal_student_move:${moves[i]}` };

    const lastIdx = i + 1 >= moves.length;
    const moveNum = (i - 1) / 2;
    const coach =
      i === 1
        ? (puzzle.coach?.setup ?? setupCoach(group.id, puzzle.stage ?? "elementary"))
        : lastIdx
          ? (puzzle.coach?.success ?? finishCoach())
          : midCoachAt(moveNum);

    steps.push({
      id: `m${i}`,
      kind: "move",
      coach,
      fen: before,
      solution: [`${mv.from}:${mv.to}`],
      tag: group.id,
      successText: lastIdx ? "Solved! 🎉" : "Correct — keep going!",
      ...(i === 1 && puzzle.coach?.hint ? { hint: puzzle.coach.hint } : {}),
    });

    if (moves[i + 1]) {
      try {
        if (!g.move(uciMove(moves[i + 1]))) return { error: `illegal_reply:${moves[i + 1]}` };
      } catch {
        return { error: `illegal_reply:${moves[i + 1]}` };
      }
    }
  }

  return steps.length ? { steps } : { error: "no_steps" };
}

import { runAnalysis, type Evaluation } from "@chessschool/chess";
import { useEffect, useState } from "react";

/**
 * Engine evaluation of `fen`, refined a slice at a time on timers so the screen stays responsive.
 * Restarts (after a short pause) whenever the position changes; null `fen` switches it off.
 */
export function useEvaluation(fen: string | null, maxDepth = 4): { evaluation: Evaluation | null; done: boolean } {
  const [state, setState] = useState<{ fen: string | null; evaluation: Evaluation | null; done: boolean }>({ fen: null, evaluation: null, done: false });
  useEffect(() => {
    if (!fen) return;
    let stop = () => {};
    const start = setTimeout(() => {
      stop = runAnalysis(
        fen,
        (fn) => {
          const t = setTimeout(fn, 0);
          return () => clearTimeout(t);
        },
        (evaluation, done) => setState({ fen, evaluation, done }),
        { maxDepth },
      );
    }, 150);
    return () => {
      clearTimeout(start);
      stop();
    };
  }, [fen, maxDepth]);
  return state.fen === fen ? { evaluation: state.evaluation, done: state.done } : { evaluation: null, done: false };
}

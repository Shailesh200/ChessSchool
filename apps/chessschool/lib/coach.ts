import { detectMistakes, type Color, type MoveNote, type ReviewPly } from "@chessschool/chess";
import { agreeAi, aiAgreed, aiExplainOn, dayKey, recordReviewedGame, type CoachNote, type GameRecord } from "@chessschool/design";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useApp } from "@/lib/state";

export type CoachStatus = "idle" | "consent" | "loading" | "done" | "error" | "limit";

/** "Explain my game": the consent notice once per profile, then the coach's notes per move. */
export function useCoachNotes(game: GameRecord | undefined, startFen: string, side: Color | null) {
  const { state, update } = useApp();
  const [status, setStatus] = useState<CoachStatus>("idle");
  const [notes, setNotes] = useState<CoachNote[]>([]);
  const run = () => {
    if (!game) return;
    setStatus("loading");
    api
      .explainGame({ startFen, moves: game.history, side, coach: state.prefs.coach ?? "meera", consent: true })
      .then((r) => {
        setNotes(r.moments);
        setStatus("done");
      })
      .catch((err: { status?: number }) => setStatus(err?.status === 429 ? "limit" : "error"));
  };
  return {
    status,
    notes,
    signedIn: Boolean(state.account),
    allowed: aiExplainOn(state),
    ask: () => (aiAgreed(state) ? run() : setStatus("consent")),
    agree: () => {
      update(agreeAi);
      run();
    },
    cancel: () => setStatus("idle"),
    noteFor: (ply: number) => notes.find((n) => n.ply === ply) ?? null,
  };
}

/** Once a game's analysis is done, its mistakes feed the skills and practice (once per game). */
export function useReviewedSkills(game: GameRecord | undefined, plies: ReviewPly[], notes: Record<number, MoveNote>, done: boolean, side: Color | null) {
  const { update } = useApp();
  const id = game && !game.reviewed && side ? game.id : null;
  useEffect(() => {
    if (!id || !done || !plies.length) return;
    const mistakes = plies.flatMap((p) => {
      const n = notes[p.ply];
      if (p.by !== side || !n?.betterMove || !n.better || (n.verdict !== "mistake" && n.verdict !== "blunder")) return [];
      return [{ fen: p.fenBefore, from: n.betterMove.from, to: n.betterMove.to, better: n.better, tags: detectMistakes(p, n.better).tags }];
    });
    update((s) => recordReviewedGame(s, id, mistakes, dayKey(new Date())));
    // Runs once when the analysis finishes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, done]);
}

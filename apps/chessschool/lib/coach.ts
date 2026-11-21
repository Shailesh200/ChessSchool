import { detectMistakes, type Color, type MoveNote, type ReviewPly } from "@chessschool/chess";
import { aiExplainOn, dayKey, recordReviewedGame, type CoachNote, type GameRecord } from "@chessschool/design";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { isDeviceOnline } from "@/lib/hooks";
import { useApp } from "@/lib/state";

export type CoachStatus = "idle" | "loading" | "done" | "error" | "limit";

/** "Explain my game": the coach's notes per move (agreeing to the terms at the start covers sending the moves). */
export function useCoachNotes(moves: string[] | undefined, startFen: string, side: Color | null) {
  const { state, update } = useApp();
  const [status, setStatus] = useState<CoachStatus>("idle");
  const [notes, setNotes] = useState<CoachNote[]>([]);
  const run = () => {
    if (!moves) return;
    setStatus("loading");
    api
      .explainGame({ startFen, moves, side, coach: state.prefs.coach ?? "meera", consent: true })
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
    ask: run,
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

/**
 * In-game AI for a bot game, when signed in with AI on: the bot picks among its own candidate moves in its
 * style (sometimes with a remark), the hint gets a one-line reason, and the learner's mistakes get a comment.
 * Any failure or slow answer falls back quietly: the bot plays its model's pick and no line shows.
 */
export function usePlayAi(botGame: boolean) {
  const { state } = useApp();
  const coach = state.prefs.coach ?? "meera";
  const on = botGame && Boolean(state.account) && aiExplainOn(state);
  const [line, setLine] = useState<{ kind: "hint" | "comment"; text: string } | null>(null);
  const [botSay, setBotSay] = useState<string | null>(null);
  const say = (kind: "hint" | "comment", fen: string, move: string) => {
    // Offline, the hint stays the engine's move with no AI line, and the bot plays its own pick.
    if (!on || !isDeviceOnline()) return;
    api
      .coachLine({ kind, fen, move, coach })
      .then((r) => r.text && setLine({ kind, text: r.text }))
      .catch(() => {});
  };
  return {
    /** AI is on for this game (signed in, allowed for the account, Settings switch on). */
    active: on,
    line,
    botSay,
    clearLine: () => setLine(null),
    hint: (fen: string, san: string) => say("hint", fen, san),
    comment: (fenBefore: string, san: string) => say("comment", fenBefore, san),
    /** The bot's move: options[0] is its model's own pick, used when AI is off, slow or fails. */
    botMove: async <M extends { san: string }>(fen: string, bot: string, options: M[]): Promise<M | null> => {
      setBotSay(null);
      if (!on || !isDeviceOnline() || options.length < 2) return options[0] ?? null;
      try {
        const r = await api.botPick({ fen, bot, options: options.map((o) => o.san) });
        setBotSay(r.say);
        return options[r.pick] ?? options[0]!;
      } catch {
        return options[0]!;
      }
    },
  };
}

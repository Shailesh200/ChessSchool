"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { BackButton } from "@/components/ui/BackButton";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { ChessBoard } from "@/features/board/ChessBoard";
import { ChessEngine } from "@/features/chess-engine/engine";
import {
  calculationCoachPrompt,
  confirmCoachMove,
  hintArrow,
} from "@/features/coaching/coach";
import { applyCoachLine } from "@/features/coaching/personality";
import { useCoachSpeech } from "@/core/hooks/useCoachSpeech";
import type { CoachPersonality } from "@/core/store/settings.store";
import { useSettings } from "@/core/store/settings.store";
import { useProgression } from "@/core/store/progression.store";
import { audio } from "@/core/audio/audioEngine";
import { haptics } from "@/core/haptics/haptics";
import { toast } from "@/core/store/toast.store";
import type { CalculationPuzzle } from "@/features/play/calculationPuzzle";
import { moveMatchesSolution } from "@/features/play/calculationPuzzle";
import type { BoardArrow, MoveInput, Square } from "@/core/types/chess";

type Phase = "loading" | "calc" | "correct" | "wrong" | "revealed";

export function CalculationTrainer() {
  const personality = useSettings((s) => s.coachPersonality);
  const rating = useProgression((s) => s.rating);
  const [offset, setOffset] = useState(0);

  return (
    <CalculationTrainerSession
      key={`${offset}:${personality}:${rating}`}
      offset={offset}
      personality={personality}
      rating={rating}
      onNext={() => setOffset((n) => n + 1)}
    />
  );
}

function CalculationTrainerSession({
  offset,
  personality,
  rating,
  onNext,
}: {
  offset: number;
  personality: CoachPersonality;
  rating: number;
  onNext: () => void;
}) {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("loading");
  const [puzzle, setPuzzle] = useState<CalculationPuzzle | null>(null);
  const [coach, setCoach] = useState("");
  const [pendingMove, setPendingMove] = useState<MoveInput | null>(null);
  const [pendingSan, setPendingSan] = useState<string | null>(null);
  const [hintLevel, setHintLevel] = useState(0);
  const [attempted, setAttempted] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/think?n=${offset}`, { cache: "no-store" })
      .then((res) => {
        if (!res.ok) throw new Error("fetch");
        return res.json() as Promise<{ puzzle: CalculationPuzzle }>;
      })
      .then((data) => {
        if (cancelled) return;
        const p = data.puzzle;
        setPuzzle(p);
        const engine = new ChessEngine(p.fen);
        const intro = applyCoachLine(p.coach, personality, "lesson");
        const prompt = calculationCoachPrompt(0, engine.inCheck(), rating);
        setCoach(`${intro} ${prompt}`.trim());
        setPhase("calc");
      })
      .catch(() => {
        if (cancelled) return;
        toast("Could not load puzzle", { tone: "danger" });
        setPuzzle(null);
        setCoach("No puzzles in the pool yet — run db:fresh locally.");
        setPhase("calc");
      });
    return () => {
      cancelled = true;
    };
  }, [offset, personality, rating]);

  useCoachSpeech(coach, "lesson", phase === "calc" && !pendingMove, true);

  const arrows: BoardArrow[] = useMemo(() => {
    if (!puzzle) return [];
    if (phase === "revealed" || phase === "correct") {
      const [from, to] = puzzle.solutionKey.split(":") as [Square, Square];
      return [{ startSquare: from, endSquare: to, color: "#22c55e" }];
    }
    if (hintLevel >= 2) {
      const hint = hintArrow(puzzle.fen, Math.max(900, rating));
      if (hint) return [hint];
    }
    return [];
  }, [puzzle, phase, hintLevel, rating]);

  const highlightSquare =
    hintLevel >= 1 && puzzle && phase === "calc"
      ? (puzzle.solutionKey.split(":")[0] as Square)
      : null;

  const stagedMove =
    pendingMove && puzzle ? { from: pendingMove.from, to: pendingMove.to } : null;

  const commitMove = useCallback(
    (move: MoveInput) => {
      if (!puzzle) return;
      const engine = new ChessEngine(puzzle.fen);
      const applied = engine.move(move);
      if (!applied) return;

      setAttempted(true);
      if (moveMatchesSolution(move, puzzle.allSolutions)) {
        setCoach(applyCoachLine(puzzle.successText, personality, "success"));
        setPhase("correct");
        audio.play(applied.captured ? "capture" : "success");
        haptics.fire("success");
        return;
      }

      setCoach(applyCoachLine(puzzle.failText, personality, "wrong"));
      setPhase("wrong");
      audio.play("fail");
      haptics.fire("error");
    },
    [puzzle, personality],
  );

  const handleMove = useCallback(
    (move: MoveInput): boolean => {
      if (!puzzle || phase !== "calc") return false;
      const trial = new ChessEngine(puzzle.fen);
      const preview = trial.move(move);
      if (!preview) return false;
      setPendingMove(move);
      setPendingSan(preview.san);
      setCoach(confirmCoachMove(preview.san));
      return false;
    },
    [puzzle, phase],
  );

  const confirmPending = useCallback(() => {
    if (!pendingMove) return;
    commitMove(pendingMove);
    setPendingMove(null);
    setPendingSan(null);
  }, [pendingMove, commitMove]);

  const cancelPending = useCallback(() => {
    if (!puzzle) return;
    setPendingMove(null);
    setPendingSan(null);
    const engine = new ChessEngine(puzzle.fen);
    setCoach(calculationCoachPrompt(engine.history().length, engine.inCheck(), rating));
  }, [puzzle, rating]);

  const revealSolution = useCallback(() => {
    if (!puzzle) return;
    setPendingMove(null);
    setPendingSan(null);
    setPhase("revealed");
    setCoach(
      applyCoachLine(
        "Here's the idea — study the line, then try another.",
        personality,
        "lesson",
      ),
    );
    audio.play("notify");
  }, [puzzle, personality]);

  const tryAgain = useCallback(() => {
    if (!puzzle) return;
    setPendingMove(null);
    setPendingSan(null);
    setPhase("calc");
    const engine = new ChessEngine(puzzle.fen);
    setCoach(calculationCoachPrompt(0, engine.inCheck(), rating));
  }, [puzzle, rating]);

  return (
    <AppShell>
      <div className="mx-auto flex max-w-xl flex-col gap-4 pb-8">
        <BackButton fallback="/play" />
        <div className="flex items-center justify-between gap-2">
          <h1 className="text-ink text-xl font-extrabold">Calculation trainer</h1>
          <span className="bg-brand-50 text-brand-700 rounded-pill inline-flex items-center gap-1 px-2 py-1 text-[10px] font-extrabold tracking-wide uppercase">
            <Icon name="brain" size={12} />
            Think
          </span>
        </div>

        {puzzle && (
          <p className="text-ink-500 text-xs font-semibold">
            {puzzle.emoji} {puzzle.title} · {puzzle.tag}
          </p>
        )}

        <div className="border-hairline bg-surface-card text-ink min-h-[3.5rem] rounded-2xl border px-3 py-2 text-sm font-semibold [box-shadow:var(--shadow-card)]">
          <span className="text-ink-500 block text-[10px] font-extrabold tracking-wide uppercase">
            Coach
          </span>
          <span className="line-clamp-3">
            {phase === "loading" ? "Loading position…" : coach}
          </span>
        </div>

        <div className="relative mx-auto w-full max-w-[min(100%,520px)]">
          {puzzle ? (
            <ChessBoard
              fen={puzzle.fen}
              orientation={puzzle.orientation}
              onMove={handleMove}
              lastMove={stagedMove}
              arrows={arrows}
              highlight={highlightSquare ? [highlightSquare] : []}
              interactive={phase === "calc"}
              showNotation
            />
          ) : (
            <div className="skeleton aspect-square w-full rounded-lg" />
          )}
        </div>

        {pendingMove && pendingSan && phase === "calc" && (
          <div className="flex flex-col gap-2">
            <p className="text-ink-500 text-center text-xs font-semibold">
              Your line: <span className="text-ink font-extrabold">{pendingSan}</span>
            </p>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" block onClick={cancelPending}>
                Rethink
              </Button>
              <Button size="sm" block onClick={confirmPending}>
                Lock in {pendingSan}
              </Button>
            </div>
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          {phase === "calc" && (
            <>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setHintLevel((h) => Math.min(2, h + 1))}
                disabled={hintLevel >= 2}
              >
                Hint {hintLevel > 0 ? `(${hintLevel}/2)` : ""}
              </Button>
              <Button size="sm" variant="outline" onClick={revealSolution}>
                Show solution
              </Button>
            </>
          )}
          {phase === "wrong" && (
            <>
              <Button size="sm" block onClick={tryAgain}>
                Try again
              </Button>
              <Button size="sm" variant="outline" block onClick={revealSolution}>
                Show solution
              </Button>
            </>
          )}
          {(phase === "correct" || phase === "revealed") && (
            <Button size="sm" block onClick={onNext}>
              Next puzzle
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={() => router.push("/play")}>
            Back to play
          </Button>
        </div>

        {attempted && phase === "calc" && (
          <p className="text-ink-400 text-center text-xs font-semibold">
            Answer hidden until you lock in a move or tap Show solution.
          </p>
        )}
      </div>
    </AppShell>
  );
}

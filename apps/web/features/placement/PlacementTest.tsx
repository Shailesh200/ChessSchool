"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ChessBoard } from "@/features/board/ChessBoard";
import { ChessEngine } from "@/features/chess-engine/engine";
import { Button } from "@/components/ui/Button";
import { Mascot } from "@/components/ui/Mascot";
import { Confetti } from "@/components/ui/Confetti";
import { useProgression } from "@/core/store/progression.store";
import { startNav } from "@/core/store/nav.store";
import { audio } from "@/core/audio/audioEngine";
import { haptics } from "@/core/haptics/haptics";
import { useSquareSize } from "@/core/hooks/useSquareSize";
import type { MoveInput } from "@/core/types/chess";

export interface PlacementQuestion {
  fen: string;
  solution: string; // "from:to"
  orientation?: "white" | "black";
}
export interface PlacementStage {
  id: string;
  name: string;
  classIds: string[];
}

/**
 * Sign-up placement test (#10). A handful of increasingly hard puzzles → a
 * recommended stage. Accepting it graduates every class before that stage so
 * the student is admitted straight into Middle / High School.
 */
export function PlacementTest({
  questions,
  stages,
}: {
  questions: PlacementQuestion[];
  stages: PlacementStage[];
}) {
  const router = useRouter();
  const graduateClass = useProgression((s) => s.graduateClass);
  const markPlacementDone = useProgression((s) => s.markPlacementDone);
  const [boardBox, boardSize] = useSquareSize();
  const [i, setI] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [movedFen, setMovedFen] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<"correct" | "wrong" | null>(null);
  const [done, setDone] = useState(false);

  const q = questions[i];
  const displayFen = movedFen ?? q?.fen ?? "";

  function onMove(move: MoveInput): boolean {
    const q = questions[i];
    if (!q || feedback) return false;
    const eng = new ChessEngine(q.fen);
    const applied = eng.move(move);
    if (!applied) return false;
    setMovedFen(eng.fen());
    const [from, to] = q.solution.split(":");
    const ok = move.from === from && move.to === to;
    if (ok) {
      setCorrect((c) => c + 1);
      audio.play("unlock");
    } else {
      audio.play("fail");
    }
    setFeedback(ok ? "correct" : "wrong");
    haptics.fire(ok ? "success" : "error");
    window.setTimeout(() => {
      if (i + 1 >= questions.length) setDone(true);
      else {
        setFeedback(null);
        setMovedFen(null);
        setI(i + 1);
      }
    }, 750);
    return true;
  }

  if (done) {
    const pct = questions.length ? correct / questions.length : 0;
    const max = stages.length - 1;
    const targetIdx = pct >= 0.7 ? max : pct >= 0.4 ? Math.min(1, max) : 0;
    const target = stages[targetIdx]!;

    const admit = (idx: number) => {
      stages.slice(0, idx).forEach((s) => s.classIds.forEach((id) => graduateClass(id)));
      markPlacementDone();
      audio.play("graduation");
      startNav();
      router.push("/");
    };

    return (
      <div className="relative flex min-h-dvh flex-col items-center justify-center gap-5 px-6 text-center">
        <Confetti count={30} />
        <Mascot expression="cheer" size={120} />
        <h1 className="text-2xl font-extrabold text-ink">
          You scored {correct}/{questions.length}
        </h1>
        <p className="max-w-xs text-sm font-semibold text-ink-500">
          Based on your test, we recommend starting at <span className="font-extrabold text-brand">{target.name}</span>.
        </p>
        <div className="flex w-full max-w-xs flex-col gap-2">
          <Button size="lg" block onClick={() => admit(targetIdx)}>
            Start at {target.name} →
          </Button>
          <Button variant="ghost" block onClick={() => admit(0)}>
            Start from the beginning
          </Button>
        </div>
      </div>
    );
  }

  if (!q) return null;

  return (
    <div className="flex min-h-dvh flex-col bg-surface">
      <div className="pt-safe px-4 py-3 text-center">
        <p className="text-xs font-extrabold uppercase tracking-wide text-brand">Placement test</p>
        <p className="text-sm font-bold text-ink">
          Question {i + 1} of {questions.length} · find the best move
        </p>
      </div>
      <div ref={boardBox} className="flex min-h-0 flex-1 items-center justify-center px-3">
        <motion.div
          key={i}
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          style={{ width: boardSize || undefined, height: boardSize || undefined }}
        >
          <ChessBoard
            key={i}
            fen={displayFen}
            orientation={q.orientation ?? "white"}
            onMove={onMove}
            interactive={!feedback}
          />
        </motion.div>
      </div>
      <div className="px-4 pb-6 pt-2 text-center">
        <p className="text-sm font-bold text-ink">
          {feedback === "correct" ? "✅ Correct!" : feedback === "wrong" ? "❌ Not the best move" : "Your move."}
        </p>
      </div>
    </div>
  );
}

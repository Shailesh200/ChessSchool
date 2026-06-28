"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { ChessBoard } from "@/features/board/ChessBoard";
import { ChessEngine } from "@/features/chess-engine/engine";
import { hintArrow } from "@/features/coaching/coach";
import { audio } from "@/core/audio/audioEngine";
import { haptics } from "@/core/haptics/haptics";
import { toast } from "@/core/store/toast.store";
import type { BoardArrow, MoveInput, Square } from "@/core/types/chess";

const START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

export default function PlaygroundPage() {
  const engineRef = useRef(new ChessEngine());
  const [fen, setFen] = useState(START_FEN);
  const [flip, setFlip] = useState(false);
  const [lastMove, setLastMove] = useState<{ from: Square; to: Square } | null>(null);
  const [hint, setHint] = useState<BoardArrow[]>([]);
  const [fenInput, setFenInput] = useState("");
  const [msg, setMsg] = useState("Free play — move any piece, any side.");

  const view = useMemo(() => new ChessEngine(fen), [fen]);

  const handleMove = useCallback((move: MoveInput): boolean => {
    const e = engineRef.current;
    const applied = e.move(move);
    if (!applied) return false;
    setFen(e.fen());
    setLastMove({ from: move.from, to: move.to });
    setHint([]);
    audio.play(applied.captured ? "capture" : "move");
    haptics.fire("tap");
    setMsg(e.isGameOver() ? "Game over — reset to keep exploring." : `${e.turn() === "w" ? "White" : "Black"} to move`);
    return true;
  }, []);

  function reset() {
    engineRef.current = new ChessEngine();
    setFen(START_FEN);
    setLastMove(null);
    setHint([]);
    setMsg("Fresh board.");
    audio.play("transition");
  }

  function undo() {
    engineRef.current.undo();
    setFen(engineRef.current.fen());
    setLastMove(null);
    setHint([]);
  }

  function showHint() {
    const a = hintArrow(engineRef.current.fen(), 1800);
    if (a) {
      setHint([a]);
      audio.play("notify");
    }
  }

  function loadFen() {
    const e = new ChessEngine();
    if (e.load(fenInput.trim())) {
      engineRef.current = e;
      setFen(e.fen());
      setLastMove(null);
      setHint([]);
      setMsg("Position loaded.");
      audio.play("success");
    } else {
      setMsg("⚠️ Invalid FEN — check the string.");
      audio.play("fail");
    }
  }

  async function copyFen() {
    try {
      await navigator.clipboard.writeText(engineRef.current.fen());
      toast("FEN copied to clipboard", { icon: "check", tone: "success" });
      audio.play("notify");
    } catch {
      toast("Clipboard unavailable", { tone: "danger" });
    }
  }

  const checkSquare = view.inCheck() ? view.kingSquare(view.turn()) : null;

  return (
    <AppShell>
      <div className="flex flex-col gap-4">
        <h1 className="text-xl font-extrabold text-ink">Playground</h1>
        <div className="rounded-card border border-hairline bg-surface-card px-3 py-2 text-center text-sm font-bold text-ink">
          {msg}
        </div>

        <div className="mx-auto w-full max-w-md">
          <ChessBoard
            fen={fen}
            orientation={flip ? "black" : "white"}
            onMove={handleMove}
            lastMove={lastMove}
            arrows={hint}
            checkSquare={checkSquare}
          />
        </div>

        <div className="grid grid-cols-4 gap-2">
          <Button variant="outline" size="sm" onClick={undo}><Icon name="undo" size={16} />Undo</Button>
          <Button variant="outline" size="sm" onClick={() => setFlip((f) => !f)}><Icon name="flip" size={16} />Flip</Button>
          <Button variant="outline" size="sm" onClick={showHint}><Icon name="bulb" size={16} />Hint</Button>
          <Button variant="outline" size="sm" onClick={reset}><Icon name="plus" size={16} />Reset</Button>
        </div>

        <div className="flex gap-2">
          <input
            value={fenInput}
            onChange={(e) => setFenInput(e.target.value)}
            placeholder="Paste a FEN to load…"
            className="flex-1 rounded-pill border border-hairline bg-surface px-3 py-2 text-xs font-semibold text-ink"
            aria-label="FEN input"
          />
          <Button size="sm" onClick={loadFen}>Load</Button>
          <Button size="sm" variant="outline" onClick={copyFen}>Copy</Button>
        </div>
      </div>
    </AppShell>
  );
}

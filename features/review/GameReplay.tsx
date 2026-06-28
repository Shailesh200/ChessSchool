"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ChessBoard } from "@/features/board/ChessBoard";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { getGame, type SavedGame } from "@/core/db/db";
import { replayFrames, analyzeMate, type Frame } from "./replay";
import type { BoardArrow, Square } from "@/core/types/chess";
import { audio } from "@/core/audio/audioEngine";

export function GameReplay({ id }: { id: string }) {
  const [game, setGame] = useState<SavedGame | null | undefined>(undefined);
  const [frames, setFrames] = useState<Frame[]>([]);
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const timer = useRef<number | null>(null);

  useEffect(() => {
    let alive = true;
    getGame(id).then((g) => {
      if (!alive) return;
      setGame(g ?? null);
      if (g) {
        const f = replayFrames(g.pgn);
        setFrames(f);
        setIdx(f.length - 1); // start on the final position
      }
    });
    return () => {
      alive = false;
    };
  }, [id]);

  useEffect(() => {
    if (!playing) return;
    timer.current = window.setInterval(() => {
      setIdx((i) => {
        if (i >= frames.length - 1) {
          setPlaying(false);
          return i;
        }
        audio.play("move");
        return i + 1;
      });
    }, 700);
    return () => {
      if (timer.current) window.clearInterval(timer.current);
    };
  }, [playing, frames.length]);

  const frame = frames[idx];
  const isMateFrame = Boolean(frame?.mate);
  const mate = useMemo(
    () => (isMateFrame && frame ? analyzeMate(frame.fen) : null),
    [isMateFrame, frame],
  );

  const arrows: BoardArrow[] = useMemo(() => {
    if (!mate) return [];
    return mate.attackers.map((a) => ({
      startSquare: a,
      endSquare: mate.kingSquare,
      color: "#f43f5e",
    }));
  }, [mate]);

  const highlight: Square[] = mate ? mate.covered.map((c) => c.square) : [];

  if (game === undefined) return <div className="skeleton h-96 rounded-card" />;
  if (game === null) {
    return (
      <Card className="text-center">
        <p className="text-sm font-bold text-ink">Game not found.</p>
        <Link href="/review">
          <Button className="mt-3" variant="outline">Back to review</Button>
        </Link>
      </Card>
    );
  }

  const preventionTip =
    mate?.pattern === "back-rank"
      ? "It's a back-rank mate — your own pawns trapped the king. Play a quiet pawn move (luft) earlier to give it air."
      : mate?.pattern === "diagonal"
        ? "A diagonal mate — pushing the f- or g-pawns early opened lines to your king. Keep the squares around your king defended."
        : "Spot the attacker's path a move earlier: make an escape square, block the check, or trade off the attacking piece.";

  return (
    <div className="flex flex-col gap-4">
      <Link href="/review" className="text-sm font-bold text-brand">← All games</Link>

      <div className="mx-auto w-full max-w-md">
        <ChessBoard
          fen={frame?.fen ?? game.fen}
          orientation="white"
          interactive={false}
          lastMove={frame?.from && frame?.to ? { from: frame.from, to: frame.to } : null}
          arrows={arrows}
          highlight={highlight}
          checkSquare={mate ? mate.kingSquare : null}
        />
      </div>

      {/* scrubber */}
      <div className="flex items-center gap-2">
        <Ctrl label="Start" onClick={() => setIdx(0)}>⏮</Ctrl>
        <Ctrl label="Previous" onClick={() => setIdx((i) => Math.max(0, i - 1))}>◀</Ctrl>
        <Ctrl label={playing ? "Pause" : "Play"} onClick={() => setPlaying((p) => !p)}>
          {playing ? "⏸" : "▶"}
        </Ctrl>
        <Ctrl label="Next" onClick={() => setIdx((i) => Math.min(frames.length - 1, i + 1))}>▶</Ctrl>
        <Ctrl label="End" onClick={() => setIdx(frames.length - 1)}>⏭</Ctrl>
        <input
          type="range"
          min={0}
          max={Math.max(0, frames.length - 1)}
          value={idx}
          onChange={(e) => { setPlaying(false); setIdx(Number(e.target.value)); }}
          className="flex-1 accent-[var(--brand-500)]"
          aria-label="Scrub moves"
        />
      </div>

      <p className="text-center text-sm font-bold text-ink">
        {idx === 0 ? "Starting position" : `${Math.ceil(idx / 2)}. ${frame?.san ?? ""}`}
        {frame?.check && !frame?.mate ? " +" : ""}
        {frame?.mate ? " #" : ""}
      </p>

      {mate && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Card className="border-danger/40 bg-danger/5">
            <p className="text-sm font-extrabold text-danger">How the checkmate happened</p>
            <ul className="mt-2 space-y-1 text-xs font-semibold text-ink-700">
              <li>👑 The king on <b>{mate.kingSquare}</b> is in check and cannot move.</li>
              <li>🎯 Delivered by {mate.attackers.length > 1 ? "pieces on" : "the piece on"} <b>{mate.attackers.join(", ")}</b> (red arrows).</li>
              <li>🚫 Every escape square is covered or blocked (outlined).</li>
            </ul>
            <p className="mt-2 rounded-lg bg-surface-sunken px-3 py-2 text-xs font-bold text-ink">
              💡 What could have prevented this? {preventionTip}
            </p>
          </Card>
        </motion.div>
      )}

      {/* move list */}
      <Card className="py-3">
        <p className="mb-2 text-xs font-extrabold uppercase tracking-wide text-ink-300">Moves</p>
        <div className="flex flex-wrap gap-1.5">
          {frames.slice(1).map((f, i) => (
            <button
              key={f.ply}
              onClick={() => { setPlaying(false); setIdx(i + 1); }}
              className={`rounded-md px-2 py-1 text-xs font-bold ${
                idx === i + 1 ? "bg-brand text-white" : "bg-surface-sunken text-ink-700"
              }`}
            >
              {i % 2 === 0 ? `${i / 2 + 1}.` : ""} {f.san}
            </button>
          ))}
        </div>
      </Card>
    </div>
  );
}

function Ctrl({ children, label, onClick }: { children: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button
      aria-label={label}
      onClick={onClick}
      className="btn-tactile flex h-10 w-10 items-center justify-center rounded-pill border-2 border-hairline bg-surface-card text-sm"
    >
      {children}
    </button>
  );
}

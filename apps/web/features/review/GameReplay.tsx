"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ChessBoard } from "@/features/board/ChessBoard";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { getGame, type SavedGame } from "@/core/db/db";
import { replayFrames, analyzeMate, matePreventionTip, type Frame } from "./replay";
import type { BoardArrow, Square } from "@/core/types/chess";
import { audio } from "@/core/audio/audioEngine";
import { useMatch } from "@/core/store/match.store";
import { shadowFromGame } from "@/features/play/shadow";
import { startNav } from "@/core/store/nav.store";
import { haptics } from "@/core/haptics/haptics";

export function GameReplay({ id }: { id: string }) {
  const router = useRouter();
  const startMatch = useMatch((s) => s.start);
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

  if (game === undefined) return <div className="skeleton rounded-card h-96" />;
  if (game === null) {
    return (
      <Card className="text-center">
        <p className="text-ink text-sm font-bold">Game not found.</p>
        <Link href="/review">
          <Button className="mt-3" variant="outline">
            Back to review
          </Button>
        </Link>
      </Card>
    );
  }

  const preventionTip = mate ? matePreventionTip(mate.pattern) : "";

  function startShadowRematch(flipColor = false) {
    if (!game) return;
    const shadow = shadowFromGame(game, { flipColor });
    if (!shadow) return;
    haptics.fire("success");
    audio.play("unlock");
    startMatch("shadow", 0, 0, {
      shadow: {
        sourceGameId: shadow.gameId,
        shadowPgn: shadow.pgn,
        playerColor: shadow.playerColor,
        opponentName: shadow.opponentName,
        flipped: shadow.flipped,
      },
    });
    startNav();
    router.push("/play");
  }

  return (
    <div className="flex flex-col gap-4">
      <Link href="/review" className="text-brand text-sm font-bold">
        ← All games
      </Link>

      <div className="mx-auto w-full max-w-md">
        <ChessBoard
          fen={frame?.fen ?? game.fen}
          orientation="white"
          interactive={false}
          showNotation
          lastMove={
            frame?.from && frame?.to ? { from: frame.from, to: frame.to } : null
          }
          arrows={arrows}
          highlight={highlight}
          checkSquare={mate ? mate.kingSquare : null}
        />
      </div>

      {/* scrubber */}
      <div className="flex items-center gap-2">
        <Ctrl label="Start" onClick={() => setIdx(0)}>
          <Icon name="skipBack" size={16} />
        </Ctrl>
        <Ctrl label="Previous" onClick={() => setIdx((i) => Math.max(0, i - 1))}>
          <Icon name="chevronLeft" size={16} />
        </Ctrl>
        <Ctrl label={playing ? "Pause" : "Play"} onClick={() => setPlaying((p) => !p)}>
          <Icon name={playing ? "pause" : "playFill"} size={16} />
        </Ctrl>
        <Ctrl
          label="Next"
          onClick={() => setIdx((i) => Math.min(frames.length - 1, i + 1))}
        >
          <Icon name="chevronRight" size={16} />
        </Ctrl>
        <Ctrl label="End" onClick={() => setIdx(frames.length - 1)}>
          <Icon name="skipForward" size={16} />
        </Ctrl>
        <input
          type="range"
          min={0}
          max={Math.max(0, frames.length - 1)}
          value={idx}
          onChange={(e) => {
            setPlaying(false);
            setIdx(Number(e.target.value));
          }}
          className="flex-1 accent-[var(--brand-500)]"
          aria-label="Scrub moves"
        />
      </div>

      <p className="text-ink text-center text-sm font-bold">
        {idx === 0 ? "Starting position" : `${Math.ceil(idx / 2)}. ${frame?.san ?? ""}`}
        {frame?.check && !frame?.mate ? " +" : ""}
        {frame?.mate ? " #" : ""}
      </p>

      {mate && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="border-danger/40 bg-danger/5">
            <p className="text-danger text-sm font-extrabold">
              How the checkmate happened
            </p>
            <ul className="text-ink-700 mt-2 space-y-1 text-xs font-semibold">
              <li className="flex items-start gap-1.5">
                <Icon name="crown" size={14} className="text-brand mt-0.5 shrink-0" />
                <span>
                  The king on <b>{mate.kingSquare}</b> is in check and cannot move.
                </span>
              </li>
              <li className="flex items-start gap-1.5">
                <Icon name="target" size={14} className="text-brand mt-0.5 shrink-0" />
                <span>
                  Delivered by{" "}
                  {mate.attackers.length > 1 ? "pieces on" : "the piece on"}{" "}
                  <b>{mate.attackers.join(", ")}</b> (red arrows).
                </span>
              </li>
              <li className="flex items-start gap-1.5">
                <Icon name="close" size={14} className="text-brand mt-0.5 shrink-0" />
                <span>Every escape square is covered or blocked (outlined).</span>
              </li>
            </ul>
            <p className="bg-surface-sunken text-ink mt-2 flex items-start gap-1.5 rounded-lg px-3 py-2 text-xs font-bold">
              <Icon name="bulb" size={14} className="text-brand mt-0.5 shrink-0" />
              <span>What could have prevented this? {preventionTip}</span>
            </p>
          </Card>
        </motion.div>
      )}

      {/* move list */}
      <Card className="py-3">
        <p className="text-ink-300 mb-2 text-xs font-extrabold tracking-wide uppercase">
          Moves
        </p>
        <div className="flex flex-wrap gap-1.5">
          {frames.slice(1).map((f, i) => (
            <button
              key={f.ply}
              onClick={() => {
                setPlaying(false);
                setIdx(i + 1);
              }}
              className={`rounded-md px-2 py-1 text-xs font-bold ${
                idx === i + 1 ? "bg-brand text-white" : "bg-surface-sunken text-ink-700"
              }`}
            >
              {i % 2 === 0 ? `${i / 2 + 1}.` : ""} {f.san}
            </button>
          ))}
        </div>
      </Card>

      {game.moveCount >= 2 && (
        <div className="flex flex-col gap-2">
          <Button className="w-full" onClick={() => startShadowRematch(false)}>
            <span className="inline-flex items-center gap-2">
              <Icon name="users" size={18} />
              Shadow rematch
            </span>
          </Button>
          <Button
            className="w-full"
            variant="outline"
            onClick={() => startShadowRematch(true)}
          >
            <span className="inline-flex items-center gap-2">
              <Icon name="flip" size={18} />
              Defend vs your attack
            </span>
          </Button>
        </div>
      )}
    </div>
  );
}

function Ctrl({
  children,
  label,
  onClick,
}: {
  children: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      aria-label={label}
      onClick={onClick}
      className="btn-tactile rounded-pill border-hairline bg-surface-card flex h-10 w-10 items-center justify-center border-2 text-sm"
    >
      {children}
    </button>
  );
}

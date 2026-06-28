"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { ChessBoard } from "@/features/board/ChessBoard";
import { ChessEngine } from "@/features/chess-engine/engine";
import { chooseMove, eloToConfig } from "@/features/chess-engine/bot";
import { commentOnMove } from "@/features/coaching/coach";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { Confetti } from "@/components/ui/Confetti";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { materialAdvantage } from "@/features/chess-engine/material";
import { useSquareSize } from "@/core/hooks/useSquareSize";
import { toast } from "@/core/store/toast.store";
import { audio } from "@/core/audio/audioEngine";
import { haptics } from "@/core/haptics/haptics";
import { useMatch, type ActiveMatch } from "@/core/store/match.store";
import { useProgression } from "@/core/store/progression.store";
import { ReflectSheet } from "@/features/journal/ReflectSheet";
import { saveGame, type EndReason, type SavedGame } from "@/core/db/db";
import type { MoveInput, Square } from "@/core/types/chess";

function engineFromPgn(pgn: string): ChessEngine {
  if (!pgn.trim()) return new ChessEngine();
  try {
    return ChessEngine.fromPgn(pgn);
  } catch {
    return new ChessEngine();
  }
}

export function MatchView({ active }: { active: ActiveMatch }) {
  const router = useRouter();
  const sync = useMatch((s) => s.sync);
  const persistClocks = useMatch((s) => s.setClocks);
  const markFinished = useMatch((s) => s.markFinished);
  const clear = useMatch((s) => s.clear);
  const progression = useProgression();

  const engineRef = useRef<ChessEngine>(engineFromPgn(active.pgn));
  const [fen, setFen] = useState(active.fen);
  const [thinking, setThinking] = useState(false);
  const [lastMove, setLastMove] = useState<{ from: Square; to: Square } | null>(
    active.lastFrom && active.lastTo
      ? { from: active.lastFrom, to: active.lastTo }
      : null,
  );
  const [flip, setFlip] = useState(active.mode === "pass");
  const [coach, setCoach] = useState(
    active.pgn ? "Welcome back — your game is right where you left it." : "Your move. Good luck!",
  );
  const [over, setOver] = useState<null | { text: string; win: boolean; gameId: string }>(null);
  const [copied, setCopied] = useState(false);
  const [reflectOpen, setReflectOpen] = useState(false);
  const [resignOpen, setResignOpen] = useState(false);

  const [boardBox, boardSize] = useSquareSize();
  const hasClock = active.timeControlMin > 0;
  const clockRef = useRef({ w: active.whiteMs, b: active.blackMs });
  const [clock, setClock] = useState({ w: active.whiteMs, b: active.blackMs });

  const isBot = active.mode === "bot";
  const playerColor: "w" | "b" = "w";

  const persist = useCallback(
    (from?: string, to?: string) => {
      const e = engineRef.current;
      persistClocks(clockRef.current.w, clockRef.current.b);
      sync({ fen: e.fen(), pgn: e.pgn(), from, to });
    },
    [sync],
  );

  const finalize = useCallback(
    async (reason: EndReason, winner: "w" | "b" | null) => {
      const e = engineRef.current;
      const result = winner === "w" ? "1-0" : winner === "b" ? "0-1" : "1/2-1/2";
      const game: SavedGame = {
        id: active.id,
        mode: active.mode,
        pgn: e.pgn(),
        fen: e.fen(),
        whiteName: isBot ? "You" : "White",
        blackName: isBot ? `Bot ${active.targetElo}` : "Black",
        createdAt: active.createdAt,
        updatedAt: Date.now(),
        turn: e.turn(),
        result,
        endReason: reason,
        winner,
        moveCount: e.history().length,
        elo: isBot ? active.targetElo : null,
        durationMs: Date.now() - active.createdAt,
      };
      await saveGame(game);
      markFinished();
      const playerWon = isBot && winner === playerColor;
      if (playerWon) {
        progression.awardXp(40);
        progression.unlockAchievement("first-win");
        audio.play("victory");
      } else if (winner === null) {
        audio.play("notify");
      } else {
        audio.play("fail");
      }
      const sideName = winner === "w" ? "White" : "Black";
      const text =
        reason === "resign"
          ? winner === playerColor || !isBot
            ? `${sideName} wins by resignation`
            : "You resigned"
          : reason === "timeout"
            ? winner === playerColor || !isBot
              ? `${sideName} wins on time ⏱️`
              : "You lost on time"
            : reason === "checkmate"
              ? playerWon
                ? "Checkmate — you win! 🏆"
                : isBot
                  ? "Checkmate — bot wins"
                  : `Checkmate — ${sideName} wins`
              : "Draw";
      setOver({ text, win: playerWon, gameId: active.id });
    },
    [active, isBot, markFinished, progression],
  );

  const checkOver = useCallback((): boolean => {
    const e = engineRef.current;
    if (!e.isGameOver()) return false;
    const status = e.status();
    if (status === "checkmate") {
      const winner = e.turn() === "w" ? "b" : "w"; // side to move is mated
      void finalize("checkmate", winner);
    } else {
      const reason: EndReason =
        status === "stalemate"
          ? "stalemate"
          : status === "insufficient"
            ? "insufficient"
            : "draw";
      void finalize(reason, null);
    }
    return true;
  }, [finalize]);

  const botMove = useCallback(() => {
    const e = engineRef.current;
    if (e.isGameOver()) return;
    setThinking(true);
    window.setTimeout(() => {
      const move = chooseMove(e.fen(), eloToConfig(active.targetElo), Math.random());
      if (move) {
        const applied = e.move(move);
        if (applied) {
          setLastMove({ from: move.from, to: move.to });
          setFen(e.fen());
          audio.play(applied.captured ? "capture" : "move");
          if (e.inCheck()) audio.play("check");
          persist(move.from, move.to);
        }
      }
      setThinking(false);
      checkOver();
    }, 1000); // give the bot a deliberate ≥1s "thinking" beat
  }, [active.targetElo, persist, checkOver]);

  // Resume: if it's the bot's turn on mount (e.g. after refresh), let it move.
  useEffect(() => {
    const e = engineRef.current;
    if (isBot && !e.isGameOver() && e.turn() !== playerColor) botMove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Warn on refresh/close while a game is unfinished.
  useEffect(() => {
    const handler = (ev: BeforeUnloadEvent) => {
      if (!over) {
        ev.preventDefault();
        ev.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [over]);

  // Chess clock — ticks down for the side to move; flag = loss on time.
  useEffect(() => {
    if (!hasClock || over) return;
    let last = performance.now();
    const id = window.setInterval(() => {
      const now = performance.now();
      const dt = now - last;
      last = now;
      const turn = engineRef.current.turn();
      const c = clockRef.current;
      if (turn === "w") c.w = Math.max(0, c.w - dt);
      else c.b = Math.max(0, c.b - dt);
      setClock({ w: c.w, b: c.b });
      if (c.w <= 0 || c.b <= 0) {
        window.clearInterval(id);
        void finalize("timeout", c.w <= 0 ? "b" : "w");
      }
    }, 250);
    return () => window.clearInterval(id);
  }, [hasClock, over, finalize]);

  const handleMove = useCallback(
    (move: MoveInput): boolean => {
      const e = engineRef.current;
      if (thinking || e.isGameOver()) return false;
      if (isBot && e.turn() !== playerColor) return false;
      const before = e.fen();
      const applied = e.move(move);
      if (!applied) return false;
      setLastMove({ from: move.from, to: move.to });
      setFen(e.fen());
      audio.play(applied.captured ? "capture" : "move");
      if (applied.promotion) audio.play("promotion");
      if (e.inCheck()) audio.play("check");
      haptics.fire("tap");
      persist(move.from, move.to);
      if (isBot) setCoach(commentOnMove(before, applied, Math.random()));
      if (!checkOver() && isBot) botMove();
      return true;
    },
    [thinking, isBot, persist, checkOver, botMove],
  );

  function doResign() {
    setResignOpen(false);
    if (over) return;
    const e = engineRef.current;
    // In pass-and-play the side to move resigns; vs bot the player (white) resigns.
    const loser = isBot ? playerColor : e.turn();
    const winner: "w" | "b" = loser === "w" ? "b" : "w";
    void finalize("resign", winner);
  }

  async function share() {
    const pgn = engineRef.current.pgn() || "(no moves yet)";
    const canShare = "share" in navigator;
    try {
      if (canShare) {
        await navigator.share({ title: "ChessSchool game", text: pgn });
      } else {
        await navigator.clipboard.writeText(pgn);
      }
      setCopied(true);
      audio.play("notify");
      toast(canShare ? "Game shared" : "PGN copied", { icon: "check", tone: "success" });
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      /* user cancelled share */
    }
  }

  const view = useMemo(() => new ChessEngine(fen), [fen]);
  const orientation: "white" | "black" =
    isBot ? "white" : flip && view.turn() === "b" ? "black" : "white";
  const checkSquare = view.inCheck() ? view.kingSquare(view.turn()) : null;
  const mat = useMemo(() => materialAdvantage(fen), [fen]);
  const turn = view.turn();

  // Bottom row is always White (the player vs bot); top row is the opponent.
  const bottomClock = clock.w;
  const topClock = clock.b;
  const bottomAdv = mat.diff > 0 ? mat.diff : 0;
  const topAdv = mat.diff < 0 ? -mat.diff : 0;

  return (
    <div className="flex min-h-dvh flex-col bg-surface">
      {/* top action bar */}
      <div className="pt-safe sticky top-0 z-20 border-b border-hairline bg-surface/90 px-3 py-2 backdrop-blur">
        <div className="mx-auto flex max-w-xl items-center justify-between gap-2">
          <span className="text-sm font-extrabold text-ink">
            {isBot ? `vs Bot ${active.targetElo}` : "vs Human"}
          </span>
          <div className="flex items-center gap-1.5">
            <IconBtn label="Flip board" onClick={() => setFlip((f) => !f)}>
              <Icon name="flip" size={18} />
            </IconBtn>
            <IconBtn label="Share PGN" onClick={share}>
              <Icon name={copied ? "check" : "share"} size={18} />
            </IconBtn>
            {over ? (
              <Button size="sm" onClick={() => { clear(); audio.play("transition"); }}>
                New game
              </Button>
            ) : (
              <Button size="sm" variant="danger" onClick={() => setResignOpen(true)}>
                Resign
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* opponent bar (clock + captured material) */}
      <div className="mx-auto w-full max-w-xl px-3 pt-2">
        <PlayerBar
          name={isBot ? `Bot ${active.targetElo}` : "Black"}
          advantage={topAdv}
          ms={hasClock ? topClock : null}
          active={hasClock && !over && turn === "b"}
        />
      </div>

      {/* board spans the largest square that fits the remaining height/width */}
      <div ref={boardBox} className="flex min-h-0 flex-1 items-center justify-center px-3 py-2">
        <div className="relative" style={{ width: boardSize || undefined, height: boardSize || undefined }}>
          <ChessBoard
            fen={fen}
            orientation={orientation}
            onMove={handleMove}
            lastMove={lastMove}
            checkSquare={checkSquare}
            interactive={!over && !thinking}
          />
          <AnimatePresence>
            {over && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 flex flex-col items-center justify-center gap-3 rounded-card bg-ink/45 backdrop-blur-sm"
              >
                {over.win && <Confetti />}
                <motion.div
                  initial={{ scale: 0.6, y: 10 }}
                  animate={{ scale: 1, y: 0 }}
                  className="rounded-card bg-surface-card px-8 py-6 text-center [box-shadow:var(--shadow-pop)]"
                >
                  <div className="text-2xl font-extrabold text-ink">{over.text}</div>
                  <div className="mt-4 flex flex-wrap justify-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => setReflectOpen(true)}>
                      📝 Reflect
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => router.push(`/review/${over.gameId}`)}>
                      Review
                    </Button>
                    <Button size="sm" onClick={() => { clear(); audio.play("transition"); }}>
                      New game
                    </Button>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* player bar (clock + captured material) */}
      <div className="mx-auto w-full max-w-xl px-3">
        <PlayerBar
          name={isBot ? "You" : "White"}
          advantage={bottomAdv}
          ms={hasClock ? bottomClock : null}
          active={hasClock && !over && turn === "w"}
        />
      </div>

      {/* coach caption */}
      <div className="mx-auto w-full max-w-xl px-4 pb-3 pt-2">
        <p className="truncate text-center text-sm font-semibold text-ink-500">
          {thinking ? "Thinking…" : coach}
        </p>
      </div>

      <ReflectSheet
        open={reflectOpen}
        onClose={() => setReflectOpen(false)}
        kind="match"
        title={isBot ? `Match vs Bot ${active.targetElo}` : "vs Human match"}
        summary={over?.text ?? "Match complete."}
        refId={active.id}
      />

      <ConfirmDialog
        open={resignOpen}
        title="Resign this game?"
        message="It will be saved to your review history."
        confirmLabel="Resign"
        tone="danger"
        onConfirm={doResign}
        onCancel={() => setResignOpen(false)}
      />
    </div>
  );
}

function fmtClock(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function PlayerBar({
  name,
  advantage,
  ms,
  active,
}: {
  name: string;
  advantage: number;
  ms: number | null;
  active: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <div className="flex items-center gap-2">
        <span className="text-sm font-extrabold text-ink">{name}</span>
        {advantage > 0 && (
          <span className="rounded-pill bg-surface-sunken px-2 py-0.5 text-xs font-bold text-ink-700">
            +{advantage}
          </span>
        )}
      </div>
      {ms !== null && (
        <span
          className={`rounded-lg px-2.5 py-1 font-mono text-base font-extrabold tabular-nums ${
            active ? "bg-brand text-white" : "bg-surface-sunken text-ink-700"
          }`}
        >
          {fmtClock(ms)}
        </span>
      )}
    </div>
  );
}

function IconBtn({
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
      className="btn-tactile flex h-9 w-9 items-center justify-center rounded-pill border-2 border-hairline bg-surface-card text-base"
    >
      {children}
    </button>
  );
}

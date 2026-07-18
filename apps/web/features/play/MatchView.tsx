"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { ChessBoard } from "@/features/board/ChessBoard";
import { ChessEngine } from "@/features/chess-engine/engine";
import { getBotMove, eloToConfig } from "@/features/chess-engine/bot";
import {
  commentOnMove,
  matchGreeting,
  passPlayGreeting,
  matchRecap,
  calculationCoachPrompt,
  confirmCoachMove,
  thinkingGreeting,
  shadowGreeting,
  shadowMoveLine,
  shadowOffBookLine,
} from "@/features/coaching/coach";
import { useCoachSpeech } from "@/core/hooks/useCoachSpeech";
import { botProfile } from "@/features/play/bots";
import { BotAvatar } from "@/features/play/BotAvatar";
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
import { useArena } from "@/core/store/arena.store";
import type { ArenaRunRecord } from "@/features/play/arena";
import { useProgression, isoDay } from "@/core/store/progression.store";
import { useSettings } from "@/core/store/settings.store";
import { trackEvent } from "@/core/analytics/track";
import { usePlan } from "@/core/store/plan.store";
import { checkMatchAchievements } from "@/features/progression/achievements";
import { unlockAndCelebrate } from "@/features/progression/celebrate";
import { ReflectSheet } from "@/features/journal/ReflectSheet";
import { MatchMateReviewModal } from "@/features/play/MatchMateReviewModal";
import { saveGame, type EndReason, type SavedGame } from "@/core/db/db";
import { opponentMoves } from "@/features/play/shadow";
import type { MoveInput, Square, VerboseMove } from "@/core/types/chess";

function engineFromPgn(pgn: string): ChessEngine {
  if (!pgn.trim()) return new ChessEngine();
  try {
    return ChessEngine.fromPgn(pgn);
  } catch {
    return new ChessEngine();
  }
}

/** FEN after each ply (start … current) for the view-only rewind/forward control. */
function framesFromPgn(pgn: string): string[] {
  const replay = new ChessEngine();
  const frames = [replay.fen()];
  try {
    const src = ChessEngine.fromPgn(pgn || "");
    for (const m of src.history()) {
      replay.move({ from: m.from, to: m.to, promotion: m.promotion });
      frames.push(replay.fen());
    }
  } catch {
    /* no history */
  }
  return frames;
}

/** Largest square board side (px) — keeps play usable on wide desktop viewports. */
const BOARD_MAX_PX = 520;

export function MatchView({ active }: { active: ActiveMatch }) {
  const router = useRouter();
  const sound = useSettings((s) => s.sound);
  const toggleSetting = useSettings((s) => s.toggle);
  const sync = useMatch((s) => s.sync);
  const persistClocks = useMatch((s) => s.setClocks);
  const setEndSnapshot = useMatch((s) => s.setEndSnapshot);
  const dismissMateReview = useMatch((s) => s.dismissMateReview);
  const clear = useMatch((s) => s.clear);
  const progression = useProgression();

  const snap = active.endSnapshot;
  const restoredMateHistory = useMemo(
    () => (snap?.mateReviewPending ? engineFromPgn(active.pgn).history() : []),
    [snap?.mateReviewPending, active.pgn],
  );
  const engineRef = useRef<ChessEngine>(engineFromPgn(active.pgn));
  const [fen, setFen] = useState(active.fen);
  const [pgn, setPgn] = useState(active.pgn);
  const [thinking, setThinking] = useState(false);
  const [lastMove, setLastMove] = useState<{ from: Square; to: Square } | null>(
    active.lastFrom && active.lastTo
      ? { from: active.lastFrom, to: active.lastTo }
      : null,
  );
  const [flip, setFlip] = useState(active.mode === "pass");
  const [coach, setCoach] = useState(() => {
    if (active.pgn) return matchGreeting(0, "Coach", true);
    if (active.mode === "shadow" && active.shadow) {
      return shadowGreeting(
        active.shadow.opponentName,
        active.shadow.playerColor,
        active.shadow.flipped ?? false,
      );
    }
    if (active.mode === "bot") {
      const b = botProfile(active.targetElo);
      if (active.thinkingMode) return thinkingGreeting(active.targetElo, b.name);
      return matchGreeting(active.targetElo, b.name, false);
    }
    return passPlayGreeting();
  });
  const [shadowOffBook, setShadowOffBook] = useState(false);
  const [pendingMove, setPendingMove] = useState<MoveInput | null>(null);
  const [pendingSan, setPendingSan] = useState<string | null>(null);
  const [over, setOver] = useState<null | {
    text: string;
    win: boolean;
    gameId: string;
    ratingDelta: number;
    newRating: number;
    reason: EndReason;
  }>(() =>
    snap
      ? {
          text: snap.text,
          win: snap.win,
          gameId: active.id,
          ratingDelta: snap.ratingDelta,
          newRating: snap.newRating,
          reason: snap.reason,
        }
      : null,
  );
  const [copied, setCopied] = useState(false);
  const [reflectOpen, setReflectOpen] = useState(false);
  const [resignOpen, setResignOpen] = useState(false);
  const [mateReviewOpen, setMateReviewOpen] = useState(
    snap?.mateReviewPending ?? false,
  );
  const [mateReviewHistory, setMateReviewHistory] =
    useState<VerboseMove[]>(restoredMateHistory);
  const [finalPgn, setFinalPgn] = useState(snap?.mateReviewPending ? active.pgn : "");
  const [arenaRunDone, setArenaRunDone] = useState<ArenaRunRecord | null>(null);
  const [viewPly, setViewPly] = useState<number | null>(null); // null = live; else viewing history

  const [boardBox, boardSize] = useSquareSize();
  const hasClock = active.timeControlMin > 0;
  const clockRef = useRef({ w: active.whiteMs, b: active.blackMs });
  const [clock, setClock] = useState({ w: active.whiteMs, b: active.blackMs });

  const isBot = active.mode === "bot";
  const isShadow = active.mode === "shadow";
  const arena = active.arena;
  const isArena = Boolean(arena);
  const shadow = active.shadow;
  const autoOpponent = isBot || isShadow;
  const bot = botProfile(active.targetElo);
  const botName = bot.name;
  const playerColor = shadow?.playerColor ?? "w";
  const shadowLineRef = useRef(opponentMoves(shadow?.shadowPgn ?? "", playerColor));
  const thinkingGame = Boolean(active.thinkingMode) && isBot;

  // Coach narrates the match (move commentary, greetings, recap) when coach speech is on.
  useCoachSpeech(coach, "match", true, true);

  const showCalculationPrompt = useCallback(() => {
    const e = engineRef.current;
    setCoach(calculationCoachPrompt(e.history().length, e.inCheck(), active.targetElo));
  }, [active.targetElo]);

  const persist = useCallback(
    (from?: string, to?: string) => {
      const e = engineRef.current;
      persistClocks(clockRef.current.w, clockRef.current.b);
      sync({ fen: e.fen(), pgn: e.pgn(), from, to });
    },
    [sync, persistClocks],
  );

  const leaveMatch = useCallback(() => {
    clear();
  }, [clear]);

  const finalize = useCallback(
    async (reason: EndReason, winner: "w" | "b" | null) => {
      const e = engineRef.current;
      const history = e.history();
      const pgnText = e.pgn();
      const result = winner === "w" ? "1-0" : winner === "b" ? "0-1" : "1/2-1/2";
      const game: SavedGame = {
        id: active.id,
        mode: isShadow ? "shadow" : active.mode,
        pgn: pgnText,
        fen: e.fen(),
        whiteName: isShadow
          ? playerColor === "w"
            ? "You"
            : shadow!.opponentName
          : isBot
            ? "You"
            : "White",
        blackName: isShadow
          ? playerColor === "b"
            ? "You"
            : shadow!.opponentName
          : isBot
            ? `${bot.name} (${active.targetElo})`
            : "Black",
        createdAt: active.createdAt,
        updatedAt: Date.now(),
        turn: e.turn(),
        result,
        endReason: reason,
        winner,
        moveCount: history.length,
        elo: isBot ? active.targetElo : null,
        durationMs: Date.now() - active.createdAt,
      };
      const playerWon = (isBot || isShadow) && winner === playerColor;
      const ratingBefore = useProgression.getState().rating;
      if (isBot && !isArena) {
        const score = winner === null ? 0.5 : playerWon ? 1 : 0;
        progression.updateRating(active.targetElo, score);
        const st = useProgression.getState();
        checkMatchAchievements({
          won: playerWon,
          wins: st.botWins,
          botElo: active.targetElo,
          rating: st.rating,
        }).forEach((id) => unlockAndCelebrate(id));
      }
      if (isArena && arena) {
        const score = winner === null ? 0.5 : playerWon ? 1 : 0;
        useArena.getState().recordResult(arena.opponentId, score, active.id);
        const record = useArena.getState().completeIfDone();
        if (record) setArenaRunDone(record);
      }
      const ratingAfter = useProgression.getState().rating;
      if (playerWon && !isArena) {
        progression.awardXp(40);
        audio.play("victory");
      } else if (playerWon && isArena) {
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
              ? `${sideName} wins on time`
              : "You lost on time"
            : reason === "checkmate"
              ? playerWon
                ? "Checkmate — you win!"
                : isBot
                  ? "Checkmate — bot wins"
                  : `Checkmate — ${sideName} wins`
              : "Draw";
      setOver({
        text,
        win: playerWon,
        gameId: active.id,
        ratingDelta: ratingAfter - ratingBefore,
        newRating: ratingAfter,
        reason,
      });
      if (isBot) {
        setCoach(
          matchRecap({
            history,
            botElo: active.targetElo,
            botName: bot.name,
            playerColor,
            playerWon,
            reason,
          }),
        );
      }
      setEndSnapshot({
        text,
        win: playerWon,
        ratingDelta: ratingAfter - ratingBefore,
        newRating: ratingAfter,
        reason,
        mateReviewPending: reason === "checkmate",
      });
      if (reason === "checkmate") {
        setFinalPgn(pgnText);
        setMateReviewHistory(history);
        setMateReviewOpen(true);
      }
      await saveGame(game);
      usePlan.getState().markActivity("match", isoDay());
      trackEvent("game_end", {
        mode: isArena ? "arena" : isShadow ? "shadow" : active.mode,
        result,
        reason,
        bot: isBot,
        targetElo: isBot ? active.targetElo : null,
        moveCount: game.moveCount,
      });
    },
    [
      active,
      isBot,
      isArena,
      isShadow,
      arena,
      playerColor,
      shadow,
      progression,
      bot.name,
      setEndSnapshot,
    ],
  );

  /** Restore game-over UI when PGN already ended but snapshot missing (older sessions). */
  useEffect(() => {
    if (over || active.endSnapshot) return;
    const e = engineRef.current;
    if (!e.isGameOver()) return;
    const status = e.status();
    const winner = status === "checkmate" ? (e.turn() === "w" ? "b" : "w") : null;
    const playerWon = isBot && winner === playerColor;
    const reason: EndReason =
      status === "checkmate"
        ? "checkmate"
        : status === "stalemate"
          ? "stalemate"
          : status === "insufficient"
            ? "insufficient"
            : "draw";
    const sideName = winner === "w" ? "White" : "Black";
    const text =
      reason === "checkmate"
        ? playerWon
          ? "Checkmate — you win!"
          : isBot
            ? "Checkmate — bot wins"
            : `Checkmate — ${sideName} wins`
        : "Draw";
    const rating = useProgression.getState().rating;
    const payload = {
      text,
      win: playerWon,
      gameId: active.id,
      ratingDelta: 0,
      newRating: rating,
      reason,
    };
    setOver(payload);
    setEndSnapshot({
      text,
      win: playerWon,
      ratingDelta: 0,
      newRating: rating,
      reason,
      mateReviewPending: reason === "checkmate",
    });
    if (reason === "checkmate") {
      setFinalPgn(e.pgn());
      setMateReviewHistory(e.history());
      setMateReviewOpen(true);
    }
  }, [active.endSnapshot, active.id, isBot, over, playerColor, setEndSnapshot]);

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
    const elo = isShadow ? Math.max(active.targetElo, 1200) : active.targetElo;
    // Search runs in a Web Worker (no UI freeze), overlapped with a ≥1s beat.
    const before = e.fen();
    Promise.all([
      getBotMove(e.fen(), eloToConfig(elo), Math.random()),
      new Promise((r) => window.setTimeout(r, 1000)),
    ]).then(([move]) => {
      if (move) {
        const applied = e.move(move);
        if (applied) {
          setLastMove({ from: move.from, to: move.to });
          setFen(e.fen());
          setPgn(e.pgn());
          audio.play(applied.captured ? "capture" : "move");
          if (e.inCheck()) audio.play("check");
          // The bot reacts to its own move (the bubble shows who's speaking).
          setCoach(
            commentOnMove({
              beforeFen: before,
              move: applied,
              botElo: active.targetElo,
              botName: bot.name,
              reactingToPlayer: false,
              moveNumber: e.history().length,
            }),
          );
          persist(move.from, move.to);
        }
      }
      setThinking(false);
      checkOver();
    });
  }, [active.targetElo, isShadow, persist, checkOver, bot.name]);

  const shadowFallbackToBot = useCallback(() => {
    setShadowOffBook(true);
    setCoach(shadowOffBookLine());
    const e = engineRef.current;
    if (!e.isGameOver() && e.turn() !== playerColor) botMove();
    else setThinking(false);
  }, [playerColor, botMove]);

  const shadowMove = useCallback(() => {
    if (!shadow || shadowOffBook) return;
    const e = engineRef.current;
    if (e.isGameOver() || e.turn() === playerColor) return;
    setThinking(true);
    const oppIdx = e.history().filter((m) => m.color !== playerColor).length;
    const move = shadowLineRef.current[oppIdx];
    window.setTimeout(() => {
      if (!move) {
        shadowFallbackToBot();
        return;
      }
      const applied = e.move(move);
      if (!applied) {
        shadowFallbackToBot();
        return;
      }
      setLastMove({ from: move.from, to: move.to });
      setFen(e.fen());
      setPgn(e.pgn());
      audio.play(applied.captured ? "capture" : "move");
      if (e.inCheck()) audio.play("check");
      setCoach(shadowMoveLine(applied.san, shadow.opponentName));
      persist(move.from, move.to);
      setThinking(false);
      checkOver();
    }, 650);
  }, [shadow, shadowOffBook, playerColor, persist, checkOver, shadowFallbackToBot]);

  const runOpponentTurn = useCallback(() => {
    if (isShadow && shadowOffBook) botMove();
    else if (isShadow) shadowMove();
    else if (isBot) botMove();
  }, [isShadow, isBot, shadowOffBook, botMove, shadowMove]);

  const commitMove = useCallback(
    (move: MoveInput): boolean => {
      const e = engineRef.current;
      const before = e.fen();
      const applied = e.move(move);
      if (!applied) return false;
      setLastMove({ from: move.from, to: move.to });
      setFen(e.fen());
      setPgn(e.pgn());
      audio.play(applied.captured ? "capture" : "move");
      if (applied.promotion) audio.play("promotion");
      if (e.inCheck()) audio.play("check");
      haptics.fire("tap");
      persist(move.from, move.to);
      if (isBot) {
        setCoach(
          commentOnMove({
            beforeFen: before,
            move: applied,
            botElo: active.targetElo,
            botName: bot.name,
            reactingToPlayer: true,
            moveNumber: e.history().length,
          }),
        );
      }
      if (!checkOver() && autoOpponent && engineRef.current.turn() !== playerColor)
        runOpponentTurn();
      return true;
    },
    [
      isBot,
      autoOpponent,
      shadowOffBook,
      persist,
      checkOver,
      runOpponentTurn,
      active.targetElo,
      bot.name,
      playerColor,
    ],
  );

  // Thinking game: coach calculation prompt when it's the player's turn.
  useEffect(() => {
    if (!thinkingGame || over || !isBot || thinking || pendingMove) return;
    const e = engineRef.current;
    if (e.isGameOver() || e.turn() !== playerColor) return;
    showCalculationPrompt();
  }, [
    fen,
    thinkingGame,
    over,
    isBot,
    thinking,
    pendingMove,
    playerColor,
    showCalculationPrompt,
  ]);

  const handleMove = useCallback(
    (move: MoveInput): boolean => {
      const e = engineRef.current;
      if (thinking || e.isGameOver()) return false;
      if (autoOpponent && e.turn() !== playerColor) return false;

      if (thinkingGame && isBot) {
        const trial = new ChessEngine(e.fen());
        const preview = trial.move(move);
        if (!preview) return false;
        setPendingMove(move);
        setPendingSan(preview.san);
        setCoach(confirmCoachMove(preview.san));
        return false;
      }

      return commitMove(move);
    },
    [thinking, thinkingGame, isBot, commitMove],
  );

  const confirmPending = useCallback(() => {
    if (!pendingMove) return;
    if (commitMove(pendingMove)) {
      setPendingMove(null);
      setPendingSan(null);
    }
  }, [pendingMove, commitMove]);

  const cancelPending = useCallback(() => {
    setPendingMove(null);
    setPendingSan(null);
    showCalculationPrompt();
  }, [showCalculationPrompt]);

  // Resume: if it's the opponent's turn on mount (e.g. after refresh), let them move.
  useEffect(() => {
    const e = engineRef.current;
    if (!e.isGameOver() && e.turn() !== playerColor && autoOpponent) runOpponentTurn();
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

  function doResign() {
    setResignOpen(false);
    if (over) return;
    const e = engineRef.current;
    // In pass-and-play the side to move resigns; vs bot the player (white) resigns.
    const loser = autoOpponent ? playerColor : e.turn();
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
      toast(canShare ? "Game shared" : "PGN copied", {
        icon: "check",
        tone: "success",
      });
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      /* user cancelled share */
    }
  }

  const view = useMemo(() => new ChessEngine(fen), [fen]);
  const orientation: "white" | "black" = isBot
    ? "white"
    : isShadow
      ? playerColor === "w"
        ? "white"
        : "black"
      : flip && view.turn() === "b"
        ? "black"
        : "white";
  const checkSquare = view.inCheck() ? view.kingSquare(view.turn()) : null;
  const mat = useMemo(() => materialAdvantage(fen), [fen]);
  const turn = view.turn();

  // Bottom row is always White (the player vs bot); top row is the opponent.
  const bottomClock = clock.w;
  const topClock = clock.b;
  const bottomAdv = mat.diff > 0 ? mat.diff : 0;
  const topAdv = mat.diff < 0 ? -mat.diff : 0;

  // View-only rewind/forward through the game's moves (doesn't change the game).
  const frames = useMemo(() => framesFromPgn(pgn), [pgn]);
  const [lastFen, setLastFen] = useState(fen);
  if (fen !== lastFen) {
    setLastFen(fen);
    setViewPly(null); // a new move snaps back to the live position
  }
  const viewing = viewPly !== null;
  const displayFen = viewing && frames[viewPly] ? frames[viewPly] : fen;
  const boardPx = boardSize ? Math.min(boardSize, BOARD_MAX_PX) : 0;
  const stagedMove =
    pendingMove && !viewing ? { from: pendingMove.from, to: pendingMove.to } : lastMove;

  return (
    <div className="bg-surface flex min-h-dvh flex-col">
      {/* top action bar */}
      <div className="pt-safe border-hairline bg-surface/90 sticky top-0 z-20 border-b px-3 py-2 backdrop-blur">
        <div className="mx-auto flex max-w-xl items-center justify-between gap-2">
          <span className="text-ink flex items-center gap-2 text-sm font-extrabold">
            {isArena
              ? `Arena · vs ${arena?.opponentName ?? "bot"}`
              : isShadow
                ? `Shadow vs ${shadow?.opponentName ?? "opponent"}`
                : isBot
                  ? `vs ${botName} · ${active.targetElo}`
                  : "vs Human"}
            {thinkingGame && (
              <span className="bg-brand-50 text-brand-700 rounded-pill inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-extrabold tracking-wide uppercase">
                <Icon name="brain" size={12} />
                Thinking
              </span>
            )}
          </span>
          <div className="flex items-center gap-1.5">
            <IconBtn
              label={sound ? "Mute sounds" : "Unmute sounds"}
              onClick={() => {
                audio.unlock();
                toggleSetting("sound");
                if (!sound) audio.play("notify");
              }}
            >
              <Icon name={sound ? "volume" : "volumeOff"} size={18} />
            </IconBtn>
            <IconBtn label="Flip board" onClick={() => setFlip((f) => !f)}>
              <Icon name="flip" size={18} />
            </IconBtn>
            {!isBot && (
              <IconBtn label="Share PGN" onClick={share}>
                <Icon name={copied ? "check" : "share"} size={18} />
              </IconBtn>
            )}
            {over ? (
              <Button
                size="sm"
                onClick={() => {
                  leaveMatch();
                  audio.play("transition");
                  if (isArena) router.push("/play/arena");
                }}
              >
                {isArena ? "Arena" : "New game"}
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
          name={
            isShadow
              ? playerColor === "b"
                ? "You"
                : (shadow?.opponentName ?? "Shadow")
              : isBot
                ? `${botName} · ${active.targetElo}`
                : "Black"
          }
          advantage={topAdv}
          ms={hasClock ? topClock : null}
          active={hasClock && !over && turn === "b"}
        />
      </div>

      {/* Fixed-height coach slot so bubble text changes don't resize/jump the board. */}
      <div className="mx-auto w-full max-w-xl shrink-0 px-3 pt-2">
        <div className="flex h-[4.75rem] items-start gap-2">
          <div className="bg-brand-50 flex h-12 w-12 shrink-0 items-center justify-center rounded-full">
            {autoOpponent ? (
              isShadow ? (
                <Icon name="users" size={22} duotone />
              ) : (
                <BotAvatar elo={active.targetElo} size={44} />
              )
            ) : (
              <Icon name="message" size={22} duotone />
            )}
          </div>
          <div className="border-hairline bg-surface-card text-ink flex h-full min-w-0 flex-1 flex-col justify-center overflow-hidden rounded-2xl rounded-tl-sm border px-3 py-2 text-sm font-semibold [box-shadow:var(--shadow-card)]">
            <span className="text-ink-500 block text-[10px] font-extrabold tracking-wide uppercase">
              {isShadow ? "Shadow" : isBot ? bot.name : "Coach"}
            </span>
            <span className="line-clamp-2">{thinking ? "Thinking…" : coach}</span>
          </div>
        </div>
      </div>

      {/* board — capped square; container max-w-xl matches coach/clocks row */}
      <div
        ref={boardBox}
        className="mx-auto flex min-h-0 w-full max-w-xl flex-1 flex-col items-center justify-center px-3 py-2"
      >
        <div
          className="relative max-w-full shrink-0"
          style={{
            width: boardPx || undefined,
            height: boardPx || undefined,
            maxWidth: BOARD_MAX_PX,
            maxHeight: BOARD_MAX_PX,
          }}
        >
          <ChessBoard
            fen={displayFen}
            orientation={orientation}
            onMove={handleMove}
            lastMove={stagedMove}
            checkSquare={checkSquare}
            interactive={!over && !thinking && !viewing}
          />
          <AnimatePresence>
            {over && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="rounded-card bg-ink/45 absolute inset-0 flex flex-col items-center justify-center gap-3 backdrop-blur-sm"
              >
                {over.win && <Confetti />}
                <motion.div
                  initial={{ scale: 0.6, y: 10 }}
                  animate={{ scale: 1, y: 0 }}
                  className="rounded-card bg-surface-card px-8 py-6 text-center [box-shadow:var(--shadow-pop)]"
                >
                  <div className="flex justify-center">
                    <Icon
                      name={
                        over.win
                          ? "trophy"
                          : over.text.startsWith("Draw")
                            ? "handshake"
                            : "pawn"
                      }
                      size={32}
                      duotone
                      className="text-brand"
                    />
                  </div>
                  <div className="text-ink mt-1 text-2xl font-extrabold">
                    {over.text}
                  </div>
                  {arenaRunDone && (
                    <div className="rounded-pill bg-brand-50 text-brand-700 mt-3 inline-flex items-center gap-2 px-4 py-1.5 text-sm font-extrabold">
                      Arena complete · #{arenaRunDone.placement} · +
                      {arenaRunDone.xpEarned} XP
                    </div>
                  )}
                  {isBot && !isArena && over.ratingDelta !== 0 && (
                    <div className="rounded-pill bg-surface-sunken mt-3 inline-flex items-center gap-2 px-4 py-1.5">
                      <span className="text-ink-500 text-xs font-bold">Rating</span>
                      <span
                        className={`text-sm font-extrabold ${over.ratingDelta > 0 ? "text-success" : "text-danger"}`}
                      >
                        {over.ratingDelta > 0 ? "+" : ""}
                        {over.ratingDelta}
                      </span>
                      <span className="text-ink text-sm font-extrabold">
                        → {over.newRating}
                      </span>
                    </div>
                  )}
                  <div className="mt-4 flex flex-wrap justify-center gap-2">
                    {over.reason === "checkmate" && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const e = engineRef.current;
                          setMateReviewHistory(e.history());
                          setFinalPgn(e.pgn());
                          setMateReviewOpen(true);
                        }}
                      >
                        How it happened
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setReflectOpen(true)}
                    >
                      <span className="inline-flex items-center gap-1.5">
                        <Icon name="journal" size={16} />
                        Reflect
                      </span>
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const g = over.gameId;
                        leaveMatch();
                        router.push(`/review/${g}`);
                      }}
                    >
                      Review
                    </Button>
                    {active.fromHomework ? (
                      <Button
                        size="sm"
                        onClick={() => {
                          leaveMatch();
                          router.push("/plan");
                        }}
                      >
                        Back to homework
                      </Button>
                    ) : isArena ? (
                      <Button
                        size="sm"
                        onClick={() => {
                          leaveMatch();
                          router.push("/play/arena");
                        }}
                      >
                        {arenaRunDone ? "Arena home" : "Next round"}
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        onClick={() => {
                          leaveMatch();
                          audio.play("transition");
                        }}
                      >
                        New game
                      </Button>
                    )}
                  </div>
                  <button
                    onClick={() => {
                      leaveMatch();
                      router.push(active.fromHomework ? "/plan" : "/academy");
                    }}
                    className="text-ink-500 mt-3 text-xs font-bold underline-offset-2 hover:underline"
                  >
                    {active.fromHomework ? "← Back to homework" : "← Back to academy"}
                  </button>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {pendingMove && pendingSan && !over && (
        <div className="mx-auto w-full max-w-xl px-3 pb-2">
          <div className="border-hairline bg-surface-card rounded-2xl border p-3 [box-shadow:var(--shadow-card)] lg:mx-auto lg:max-w-md">
            <p className="text-ink-500 text-center text-xs font-semibold">
              Staged move: <span className="text-ink font-extrabold">{pendingSan}</span>
            </p>
            <div className="mt-2 flex gap-2">
              <Button size="sm" variant="outline" block onClick={cancelPending}>
                Rethink
              </Button>
              <Button size="sm" block onClick={confirmPending}>
                Play {pendingSan}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* player bar (clock + captured material) */}
      <div className="mx-auto w-full max-w-xl px-3">
        <PlayerBar
          name={isShadow || isBot ? "You" : "White"}
          advantage={bottomAdv}
          ms={hasClock ? bottomClock : null}
          active={hasClock && !over && turn === "w"}
        />
      </div>

      {/* Rewind / forward — view earlier positions without changing the game. */}
      <div className="mx-auto flex w-full max-w-xl items-center justify-center gap-3 px-4 pt-2 pb-3">
        <IconBtn
          label="Previous move"
          onClick={() => setViewPly((v) => Math.max(0, (v ?? frames.length - 1) - 1))}
        >
          <Icon name="skipBack" size={18} />
        </IconBtn>
        <span className="text-ink-500 min-w-24 text-center text-xs font-bold">
          {viewing ? `move ${viewPly}/${frames.length - 1}` : "● live"}
        </span>
        <IconBtn
          label="Next move"
          onClick={() =>
            setViewPly((v) => {
              if (v === null) return null;
              const n = v + 1;
              return n >= frames.length - 1 ? null : n;
            })
          }
        >
          <Icon name="skipForward" size={18} />
        </IconBtn>
      </div>

      <MatchMateReviewModal
        open={mateReviewOpen}
        pgn={finalPgn || pgn}
        history={mateReviewHistory}
        orientation={orientation}
        onClose={() => {
          setMateReviewOpen(false);
          dismissMateReview();
        }}
      />

      <ReflectSheet
        open={reflectOpen}
        onClose={() => setReflectOpen(false)}
        kind="match"
        title={
          isShadow
            ? `Shadow vs ${shadow?.opponentName ?? "opponent"}`
            : isBot
              ? `Match vs ${bot.name} (${active.targetElo})`
              : "vs Human match"
        }
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
        <span className="text-ink text-sm font-extrabold">{name}</span>
        {advantage > 0 && (
          <span className="rounded-pill bg-surface-sunken text-ink-700 px-2 py-0.5 text-xs font-bold">
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
      className="btn-tactile rounded-pill border-hairline bg-surface-card flex h-9 w-9 items-center justify-center border-2 text-base"
    >
      {children}
    </button>
  );
}

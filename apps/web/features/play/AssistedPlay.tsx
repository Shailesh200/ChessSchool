"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { BackButton } from "@/components/ui/BackButton";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { ChessBoard } from "@/features/board/ChessBoard";
import { ChessEngine } from "@/features/chess-engine/engine";
import { getBotMove, eloToConfig } from "@/features/chess-engine/bot";
import { botProfile } from "@/features/play/bots";
import { BotAvatar } from "@/features/play/BotAvatar";
import {
  explainAssistedBotReply,
  explainAssistedPlayerMove,
  explainAssistedPuzzleMove,
  assistedPuzzlePrompt,
} from "@/features/coaching/assistedCoach";
import { applyCoachLine } from "@/features/coaching/personality";
import { thinkingMatchGreeting } from "@/features/coaching/thinkingPrompt";
import { stopCoachSpeech, speakCoachText } from "@/core/audio/coachSpeech";
import { useCoachSpeech } from "@/core/hooks/useCoachSpeech";
import { useSettings } from "@/core/store/settings.store";
import { useProgression } from "@/core/store/progression.store";
import { audio } from "@/core/audio/audioEngine";
import { haptics } from "@/core/haptics/haptics";
import { toast } from "@/core/store/toast.store";
import type { CalculationPuzzle } from "@/features/play/calculationPuzzle";
import { moveMatchesSolution } from "@/features/play/calculationPuzzle";
import type { CoachPersonality } from "@/core/store/settings.store";
import type { BoardArrow, MoveInput, VerboseMove } from "@/core/types/chess";
import { hintArrow } from "@/features/coaching/coach";

const START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
const BOARD_SHELL = "relative mx-auto w-full max-w-[min(100%,520px)]";
const PAGE_SHELL = "mx-auto flex w-full max-w-xl flex-col gap-4 px-4 pb-8";

function CoachBubble({
  children,
  loading,
}: {
  children: ReactNode;
  loading?: boolean;
}) {
  return (
    <div className="border-hairline bg-surface-card text-ink min-h-[3.5rem] rounded-2xl border px-3 py-2 text-sm font-semibold [box-shadow:var(--shadow-card)]">
      <span className="text-ink-500 block text-[10px] font-extrabold tracking-wide uppercase">
        Coach
      </span>
      <span className="line-clamp-4 leading-relaxed">
        {loading ? "Loading position…" : children}
      </span>
    </div>
  );
}

function BoardShell({ children }: { children: ReactNode }) {
  return <div className={BOARD_SHELL}>{children}</div>;
}

type AssistedVariant = "full" | "puzzle";

export function AssistedPlay({ variant }: { variant: AssistedVariant }) {
  const personality = useSettings((s) => s.coachPersonality);
  const rating = useProgression((s) => s.rating);
  const title = variant === "full" ? "Assisted full game" : "Assisted puzzle drill";
  const subtitle =
    variant === "full"
      ? "Coach explains every move · rated ~{rating}"
      : "Coached puzzles with undo · rated ~{rating}";

  return (
    <AppShell focus>
      <div className="flex min-h-dvh flex-col">
        <header className="pt-safe border-hairline bg-surface/90 sticky top-0 z-20 border-b backdrop-blur">
          <div className="mx-auto flex w-full max-w-xl items-center gap-2 px-4 py-2">
            <BackButton fallback="/play" label="Play" />
            <div className="min-w-0 flex-1">
              <h1 className="text-ink truncate text-base font-extrabold">{title}</h1>
              <p className="text-ink-500 text-xs font-semibold">
                {subtitle.replace("{rating}", String(rating))}
              </p>
            </div>
          </div>
        </header>

        {variant === "full" ? (
          <AssistedFullGame key={`full:${personality}:${rating}`} rating={rating} />
        ) : (
          <AssistedPuzzleDrill
            key={`puzzle:${personality}:${rating}`}
            personality={personality}
            rating={rating}
          />
        )}
      </div>
    </AppShell>
  );
}

const AUTO_ADVANCE_MS = 4000;

type TurnPhase = "your-turn" | "review-player" | "bot-thinking" | "review-bot";

type PendingPlayerMove = {
  beforeFen: string;
  move: VerboseMove;
  afterFen: string;
  inCheckAfter: boolean;
  moveNumber: number;
};

function AssistedFullGame({ rating }: { rating: number }) {
  const personality = useSettings((s) => s.coachPersonality);
  const bot = botProfile(rating);
  const engineRef = useRef(new ChessEngine(START_FEN));
  const pendingPlayerRef = useRef<PendingPlayerMove | null>(null);
  const advanceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [history, setHistory] = useState({ fens: [START_FEN], cursor: 0 });
  const [fen, setFen] = useState(START_FEN);
  // Parent remounts this component when personality/rating change (`key`).
  const [coach, setCoach] = useState(() =>
    thinkingMatchGreeting(rating, bot.name, personality),
  );
  const [turnPhase, setTurnPhase] = useState<TurnPhase>("your-turn");
  const [autoAdvance, setAutoAdvance] = useState(false);
  const [lastMove, setLastMove] = useState<{ from: string; to: string } | null>(null);

  const cursor = history.cursor;
  const snapshots = history.fens;
  const canUndo = cursor > 0;
  const canRedo = cursor < snapshots.length - 1;
  const boardLocked = turnPhase !== "your-turn";

  const clearAdvanceTimer = useCallback(() => {
    if (advanceTimerRef.current) {
      clearTimeout(advanceTimerRef.current);
      advanceTimerRef.current = null;
    }
  }, []);

  useCoachSpeech(coach, "match", turnPhase !== "bot-thinking", true);

  useEffect(() => {
    void speakCoachText(thinkingMatchGreeting(rating, bot.name, personality));
  }, [rating, bot.name, personality]);

  useEffect(() => () => clearAdvanceTimer(), [clearAdvanceTimer]);

  const loadSnapshot = useCallback(
    (index: number, list: string[]) => {
      const f = list[index] ?? START_FEN;
      engineRef.current = new ChessEngine(f);
      setFen(f);
      setHistory({ fens: list, cursor: index });
      setLastMove(null);
      pendingPlayerRef.current = null;
      clearAdvanceTimer();
      setTurnPhase("your-turn");
    },
    [clearAdvanceTimer],
  );

  const pushSnapshot = useCallback((nextFen: string) => {
    setHistory((h) => {
      const fens = [...h.fens.slice(0, h.cursor + 1), nextFen];
      return { fens, cursor: fens.length - 1 };
    });
    engineRef.current = new ChessEngine(nextFen);
    setFen(nextFen);
  }, []);

  const finishBotReview = useCallback(() => {
    stopCoachSpeech();
    clearAdvanceTimer();
    setTurnPhase("your-turn");
  }, [clearAdvanceTimer]);

  const playBotMove = useCallback(() => {
    const e = engineRef.current;
    if (e.isGameOver() || e.turn() !== "b") {
      finishBotReview();
      return;
    }

    stopCoachSpeech();
    clearAdvanceTimer();
    setTurnPhase("bot-thinking");

    const before = e.fen();
    const playerCtx = pendingPlayerRef.current;

    Promise.all([
      getBotMove(e.fen(), eloToConfig(rating), Math.random()),
      new Promise((r) => window.setTimeout(r, 500)),
    ]).then(([move]) => {
      if (!move) {
        setTurnPhase("your-turn");
        return;
      }
      const applied = e.move(move);
      if (!applied) {
        setTurnPhase("your-turn");
        return;
      }
      const next = e.fen();
      setLastMove({ from: move.from, to: move.to });
      pushSnapshot(next);
      audio.play(applied.captured ? "capture" : "move");
      if (e.inCheck()) audio.play("check");

      const botLine = e.isGameOver()
        ? applyCoachLine("Game over — review the key moments.", personality, "match")
        : explainAssistedBotReply({
            beforeFen: before,
            afterFen: next,
            move: applied,
            botName: bot.name,
            playerRating: rating,
            personality,
            moveNumber: e.history().length,
            playerMoveBefore: playerCtx?.move,
          });

      pendingPlayerRef.current = null;
      setCoach(botLine);
      void speakCoachText(botLine);
      setTurnPhase("review-bot");
    });
  }, [rating, bot.name, personality, pushSnapshot, finishBotReview, clearAdvanceTimer]);

  const handleNext = useCallback(() => {
    haptics.fire("select");
    if (turnPhase === "review-player") {
      playBotMove();
    } else if (turnPhase === "review-bot") {
      finishBotReview();
    }
  }, [turnPhase, playBotMove, finishBotReview]);

  useEffect(() => {
    clearAdvanceTimer();
    if (!autoAdvance) return;
    if (turnPhase === "review-player") {
      advanceTimerRef.current = setTimeout(() => playBotMove(), AUTO_ADVANCE_MS);
    } else if (turnPhase === "review-bot") {
      advanceTimerRef.current = setTimeout(() => finishBotReview(), AUTO_ADVANCE_MS);
    }
    return clearAdvanceTimer;
  }, [autoAdvance, turnPhase, playBotMove, finishBotReview, clearAdvanceTimer]);

  const undo = useCallback(() => {
    if (!canUndo || turnPhase === "bot-thinking") return;
    haptics.fire("select");
    loadSnapshot(cursor - 1, snapshots);
    setCoach("Undone — reconsider the position.");
  }, [canUndo, turnPhase, cursor, snapshots, loadSnapshot]);

  const redo = useCallback(() => {
    if (!canRedo || turnPhase === "bot-thinking") return;
    haptics.fire("select");
    loadSnapshot(cursor + 1, snapshots);
    setCoach("Redo — continue from here.");
  }, [canRedo, turnPhase, cursor, snapshots, loadSnapshot]);

  const onMove = useCallback(
    (move: MoveInput): boolean => {
      if (boardLocked) return false;
      const e = engineRef.current;
      if (e.turn() !== "w" || e.isGameOver()) return false;
      const before = e.fen();
      const applied = e.move(move);
      if (!applied) return false;
      const next = e.fen();
      setLastMove({ from: move.from, to: move.to });
      pushSnapshot(next);
      audio.play(applied.captured ? "capture" : "move");
      if (applied.promotion) audio.play("promotion");
      if (e.inCheck()) audio.play("check");
      haptics.fire("tap");

      const pending: PendingPlayerMove = {
        beforeFen: before,
        move: applied,
        afterFen: next,
        inCheckAfter: e.inCheck(),
        moveNumber: e.history().length,
      };
      pendingPlayerRef.current = pending;

      const playerLine = explainAssistedPlayerMove({
        beforeFen: before,
        move: applied,
        afterFen: next,
        inCheckAfter: e.inCheck(),
        moveNumber: e.history().length,
        playerRating: rating,
        botName: bot.name,
        personality,
      });
      void speakCoachText(playerLine);
      setCoach(playerLine);
      setTurnPhase(e.isGameOver() ? "review-bot" : "review-player");
      return true;
    },
    [boardLocked, rating, bot.name, personality, pushSnapshot],
  );

  const showAdvance = turnPhase === "review-player" || turnPhase === "review-bot";

  return (
    <div className={PAGE_SHELL}>
      <Card className="flex items-center gap-3">
        <BotAvatar elo={rating} size={48} />
        <div>
          <p className="text-ink text-sm font-extrabold">{bot.name}</p>
          <p className="text-ink-500 text-xs font-semibold">
            Training partner · ~{rating}
          </p>
        </div>
      </Card>

      <CoachBubble>
        {turnPhase === "bot-thinking" ? `${bot.name} is thinking…` : coach}
      </CoachBubble>

      <BoardShell>
        <ChessBoard
          fen={fen}
          onMove={onMove}
          lastMove={lastMove ?? undefined}
          orientation="white"
          showNotation
          interactive={!boardLocked}
        />
      </BoardShell>

      <div className="flex flex-wrap items-center gap-2">
        {showAdvance && (
          <>
            <Button size="sm" onClick={handleNext}>
              Next
              <Icon name="chevronRight" size={16} />
            </Button>
            <Button
              variant={autoAdvance ? "primary" : "outline"}
              size="sm"
              onClick={() => {
                haptics.fire("select");
                setAutoAdvance((on) => !on);
              }}
            >
              Auto {autoAdvance ? "on" : "off"}
            </Button>
            {autoAdvance && (
              <span className="text-ink-500 text-xs font-semibold">
                {turnPhase === "review-player"
                  ? `Bot replies in ${AUTO_ADVANCE_MS / 1000}s`
                  : `Your turn in ${AUTO_ADVANCE_MS / 1000}s`}
              </span>
            )}
          </>
        )}
        <Button
          variant="outline"
          size="sm"
          disabled={!canUndo || turnPhase === "bot-thinking"}
          onClick={undo}
        >
          <Icon name="undo" size={16} /> Undo
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={!canRedo || turnPhase === "bot-thinking"}
          onClick={redo}
        >
          <Icon name="redo" size={16} /> Redo
        </Button>
        {turnPhase === "bot-thinking" && (
          <span className="text-ink-500 ml-auto text-xs font-bold">Thinking…</span>
        )}
      </div>
    </div>
  );
}

function AssistedPuzzleDrill({
  personality,
  rating,
}: {
  personality: CoachPersonality;
  rating: number;
}) {
  const router = useRouter();
  const [offset, setOffset] = useState(0);
  const [puzzle, setPuzzle] = useState<CalculationPuzzle | null>(null);
  const [coach, setCoach] = useState("");
  const [pendingMove, setPendingMove] = useState<MoveInput | null>(null);
  const [phase, setPhase] = useState<"loading" | "calc" | "done">("loading");
  const [trialFen, setTrialFen] = useState<string | null>(null);
  const [trialStack, setTrialStack] = useState<string[]>([]);
  const [trialCursor, setTrialCursor] = useState(0);

  useCoachSpeech(coach, "lesson", phase === "calc", true);

  useEffect(() => {
    let cancelled = false;
    // Phase is set to "loading" by the Next-puzzle click handler (and initial state).
    fetch(`/api/think?n=${offset}`, { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data: { puzzle: CalculationPuzzle }) => {
        if (cancelled) return;
        const p = data.puzzle;
        setPuzzle(p);
        setTrialFen(p.fen);
        setTrialStack([p.fen]);
        setTrialCursor(0);
        setPendingMove(null);
        const engine = new ChessEngine(p.fen);
        const intro = applyCoachLine(p.coach, personality, "lesson");
        const prompt = assistedPuzzlePrompt(
          personality,
          rating,
          engine.history().length,
          engine.inCheck(),
        );
        setCoach(`${intro} ${prompt}`.trim());
        setPhase("calc");
      })
      .catch(() => {
        if (cancelled) return;
        toast("Could not load puzzle", { tone: "danger" });
        setPhase("calc");
        setCoach("No puzzles available.");
      });
    return () => {
      cancelled = true;
    };
  }, [offset, personality, rating]);

  const displayFen = trialFen ?? puzzle?.fen ?? START_FEN;
  const canTrialUndo = trialCursor > 0;
  const canTrialRedo = trialCursor < trialStack.length - 1;

  const arrows: BoardArrow[] = useMemo(() => {
    if (!puzzle || phase !== "calc") return [];
    return [];
  }, [puzzle, phase]);

  const handleMove = useCallback(
    (move: MoveInput): boolean => {
      if (!puzzle || phase !== "calc" || pendingMove) return false;
      const engine = new ChessEngine(displayFen);
      const applied = engine.move(move);
      if (!applied) return false;

      const nextFen = engine.fen();
      const newStack = trialStack.slice(0, trialCursor + 1).concat(nextFen);
      setTrialStack(newStack);
      setTrialCursor(newStack.length - 1);
      setTrialFen(nextFen);
      setPendingMove(move);
      const feedback = explainAssistedPuzzleMove({
        san: applied.san,
        correct: moveMatchesSolution(move, puzzle.allSolutions),
        successText: puzzle.successText,
        failText: puzzle.failText,
        personality,
        playerRating: rating,
      });
      void speakCoachText(feedback);
      setCoach(feedback);
      if (moveMatchesSolution(move, puzzle.allSolutions)) {
        audio.play("success");
        haptics.fire("success");
        setPhase("done");
      } else {
        audio.play("fail");
        haptics.fire("error");
      }
      return false;
    },
    [
      puzzle,
      phase,
      pendingMove,
      displayFen,
      trialStack,
      trialCursor,
      personality,
      rating,
    ],
  );

  const resetPuzzle = useCallback(() => {
    if (!puzzle) return;
    setTrialFen(puzzle.fen);
    setTrialStack([puzzle.fen]);
    setTrialCursor(0);
    setPendingMove(null);
    setPhase("calc");
    const engine = new ChessEngine(puzzle.fen);
    setCoach(assistedPuzzlePrompt(personality, rating, 0, engine.inCheck()));
  }, [puzzle, personality, rating]);

  const trialUndo = useCallback(() => {
    if (!canTrialUndo) return;
    const next = trialCursor - 1;
    setTrialCursor(next);
    setTrialFen(trialStack[next] ?? puzzle?.fen ?? START_FEN);
    setPendingMove(null);
    setPhase("calc");
  }, [canTrialUndo, trialCursor, trialStack, puzzle?.fen]);

  const trialRedo = useCallback(() => {
    if (!canTrialRedo) return;
    const next = trialCursor + 1;
    setTrialCursor(next);
    setTrialFen(trialStack[next] ?? START_FEN);
    setPendingMove(null);
  }, [canTrialRedo, trialCursor, trialStack]);

  const hintSquare =
    pendingMove || !puzzle || phase !== "calc"
      ? null
      : (hintArrow(puzzle.fen, rating)?.startSquare ?? null);

  return (
    <div className={PAGE_SHELL}>
      {puzzle && (
        <p className="text-ink-500 text-xs font-semibold">
          {puzzle.title} · {puzzle.tag}
        </p>
      )}

      <CoachBubble loading={phase === "loading"}>{coach}</CoachBubble>

      <BoardShell>
        {puzzle || phase === "loading" ? (
          <ChessBoard
            fen={displayFen}
            onMove={handleMove}
            arrows={arrows}
            highlight={hintSquare ? [hintSquare] : []}
            showNotation
          />
        ) : (
          <div className="skeleton aspect-square w-full rounded-lg" />
        )}
      </BoardShell>

      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={!canTrialUndo}
          onClick={trialUndo}
        >
          <Icon name="undo" size={16} /> Undo
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={!canTrialRedo}
          onClick={trialRedo}
        >
          <Icon name="redo" size={16} /> Redo
        </Button>
        <Button variant="ghost" size="sm" onClick={resetPuzzle}>
          Reset position
        </Button>
        {phase === "done" && (
          <Button
            size="sm"
            className="ml-auto"
            onClick={() => {
              setPhase("loading");
              setOffset((n) => n + 1);
            }}
          >
            Next puzzle →
          </Button>
        )}
      </div>
      <Button variant="outline" size="sm" onClick={() => router.push("/play")}>
        Back to play setup
      </Button>
    </div>
  );
}

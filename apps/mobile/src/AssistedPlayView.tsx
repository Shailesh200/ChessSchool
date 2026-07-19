import { useCallback, useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { ChessEngine, getBotMove, eloToConfig } from "@chess-school/core";
import { ChessBoard } from "@/ChessBoard";
import { BackButton } from "@/BackButton";
import { Button } from "@/Button";
import { BotAvatar } from "@/BotAvatar";
import { CoachAvatar } from "@/CoachAvatar";
import { api } from "@/api";
import { ScreenLoader } from "@/ScreenLoader";
import { haptics } from "@/haptics";
import { sfx } from "@/sfx";
import { useProgress } from "@/progressStore";
import { useSettings } from "@/settings";
import { botProfile } from "@/bots";
import { applyCoachLine } from "@/coaching/personality";
import { commentOnMove, normalizeCoachPersonality } from "@/matchCoach";
import { useCoachSpeech } from "@/useCoachSpeech";
import { stopCoachSpeech } from "@/coachSpeech";
import { useAppTheme } from "@/ThemeProvider";
import { font, radius, shadowCard, space, type } from "@/theme";
import { trackEvent } from "@/productAnalytics/track";
import {
  outcomeFromWinner,
  scoreFromWinner,
  trackMatchEnd,
  trackMatchStart,
} from "@/productAnalytics/matchEvents";

const START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

type Puzzle = {
  lessonId: string;
  title: string;
  fen: string;
  orientation: "white" | "black";
  solutionKey: string;
  allSolutions: string[];
  coach: string;
  successText: string;
  failText: string;
};

type TurnPhase = "your-turn" | "review-player" | "bot-thinking" | "review-bot";

export function AssistedPlayView({ variant }: { variant: "full" | "puzzle" }) {
  useEffect(() => {
    trackEvent("feature_open", { feature: "assisted", variant });
  }, [variant]);

  if (variant === "puzzle") return <AssistedPuzzle />;
  return <AssistedFullGame />;
}

function AssistedFullGame() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { colors } = useAppTheme();
  const boardSize = Math.min(width - 24, 440);
  const rating = (useProgress()?.rating as number | undefined) ?? 800;
  const { coachCharacter, coachPersonality } = useSettings();
  const personality = normalizeCoachPersonality(coachCharacter ?? coachPersonality);
  const bot = botProfile(rating);
  const engineRef = useRef(new ChessEngine(START_FEN));
  const endedRef = useRef(false);
  const [fen, setFen] = useState(START_FEN);
  const [lastMove, setLastMove] = useState<{ from: string; to: string } | null>(null);
  const [coach, setCoach] = useState(`Coached bot match at ~${rating}. Make a move — I'll explain it.`);
  const [phase, setPhase] = useState<TurnPhase>("your-turn");
  const [autoAdvance, setAutoAdvance] = useState(false);

  useEffect(() => {
    trackMatchStart({
      channel: "assisted",
      opponent: "bot",
      targetElo: rating,
      variant: "full",
    });
  }, [rating]);

  const recordEndIfOver = useCallback(() => {
    const e = engineRef.current;
    if (!e.isGameOver() || endedRef.current) return;
    endedRef.current = true;
    const status = e.status();
    const winner =
      status === "checkmate" ? (e.turn() === "w" ? "b" : "w") : null;
    trackMatchEnd({
      channel: "assisted",
      opponent: "bot",
      targetElo: rating,
      variant: "full",
      outcome: outcomeFromWinner(winner, "w"),
      result: scoreFromWinner(winner),
      reason: status === "playing" ? "draw" : status,
      moveCount: e.history().length,
    });
  }, [rating]);

  const styles = StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.surface },
    header: { paddingHorizontal: space[4], paddingTop: 6 },
    board: { alignItems: "center", marginTop: space[2] },
    bubble: { margin: space[4], backgroundColor: colors.surfaceCard, borderRadius: radius.card, padding: space[4], ...shadowCard },
    label: { ...type.caption, fontFamily: font.bold, color: colors.ink500, textTransform: "uppercase" },
    text: { ...type.sm, fontFamily: font.semibold, color: colors.ink, marginTop: 4, lineHeight: 20 },
    row: { flexDirection: "row", gap: space[2], marginHorizontal: space[4], marginBottom: space[4] },
  });

  useCoachSpeech(coach, phase !== "bot-thinking");

  const advance = useCallback(() => {
    stopCoachSpeech();
    if (phase === "review-player") {
      setPhase("bot-thinking");
      setTimeout(async () => {
        const e = engineRef.current;
        const m = await getBotMove(e.fen(), eloToConfig(rating), Math.random());
        if (m && e.move(m as never)) {
          const h = e.history();
          const botMove = h[h.length - 1]!;
          sfx.play(botMove.captured ? "capture" : "move");
          setFen(e.fen());
          setLastMove({ from: m.from, to: m.to });
          setCoach(
            commentOnMove({
              beforeFen: fen,
              move: botMove,
              botElo: rating,
              botName: bot.name,
              personality,
              reactingToPlayer: false,
              moveNumber: h.length,
            }),
          );
          setPhase("review-bot");
          if (e.isGameOver()) recordEndIfOver();
        } else {
          setPhase("your-turn");
        }
      }, 500);
    } else if (phase === "review-bot") {
      setPhase("your-turn");
      setCoach("Your turn — calculate checks, captures, and threats.");
    }
  }, [bot.name, fen, personality, phase, rating, recordEndIfOver]);

  useEffect(() => {
    if (!autoAdvance) return;
    if (phase === "review-player" || phase === "review-bot") {
      const t = setTimeout(advance, 4000);
      return () => clearTimeout(t);
    }
  }, [advance, autoAdvance, phase]);

  function handleMove(from: string, to: string, promotion: "q" | "r" | "b" | "n" = "q"): boolean {
    if (phase !== "your-turn") return false;
    const e = engineRef.current;
    const before = e.fen();
    const applied = e.move({ from, to, promotion });
    if (!applied) return false;
    haptics.tap();
    sfx.play(applied.captured ? "capture" : "move");
    setFen(e.fen());
    setLastMove({ from, to });
    setCoach(
      commentOnMove({
        beforeFen: before,
        move: applied,
        botElo: rating,
        botName: bot.name,
        personality,
        reactingToPlayer: true,
        moveNumber: e.history().length,
      }),
    );
    setPhase("review-player");
    if (e.isGameOver()) recordEndIfOver();
    return true;
  }

  const checkSquare = (() => {
    const v = new ChessEngine(fen);
    return v.inCheck() ? v.kingSquare(v.turn()) : null;
  })();

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <BackButton
          label="Play"
          onPress={() => {
            stopCoachSpeech();
            router.back();
          }}
        />
        <View style={{ flexDirection: "row", alignItems: "center", gap: space[2], marginTop: space[2] }}>
          <BotAvatar elo={rating} size={36} />
          <View style={{ flex: 1 }}>
            <Text style={{ ...type.lg, fontFamily: font.bold, color: colors.ink }}>Assisted full game</Text>
            <Text style={{ ...type.xs, fontFamily: font.semibold, color: colors.ink500 }}>
              vs {bot.name} · Coach explains every move · ~{rating}
            </Text>
          </View>
        </View>
      </View>
      <View style={[styles.bubble, { flexDirection: "row", alignItems: "flex-start", gap: space[3] }]}>
        <CoachAvatar
          character={personality}
          state={phase === "bot-thinking" ? "think" : "speak"}
          size={48}
        />
        <View style={{ flex: 1 }}>
          <Text style={styles.label}>Coach</Text>
          <Text style={styles.text}>{phase === "bot-thinking" ? "Bot is thinking…" : coach}</Text>
        </View>
      </View>
      <View style={styles.board}>
        <ChessBoard fen={fen} size={boardSize} onMove={handleMove} interactive={phase === "your-turn"} lastMove={lastMove} checkSquare={checkSquare} showNotation />
      </View>
      <View style={[styles.row, { flexWrap: "wrap" }]}>
        {(phase === "review-player" || phase === "review-bot") && (
          <Button label="Next →" size="sm" block={false} onPress={advance} />
        )}
        {(phase === "review-player" || phase === "review-bot") && (
          <Button
            label={autoAdvance ? "Auto on" : "Auto off"}
            size="sm"
            variant="outline"
            block={false}
            onPress={() => setAutoAdvance((v) => !v)}
          />
        )}
        {autoAdvance && (phase === "review-player" || phase === "review-bot") && (
          <Text style={{ ...type.caption, fontFamily: font.semibold, color: colors.ink500, alignSelf: "center" }}>
            Bot replies in ~4s
          </Text>
        )}
      </View>
    </SafeAreaView>
  );
}

function AssistedPuzzle() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { colors } = useAppTheme();
  const boardSize = Math.min(width - 24, 440);
  const rating = (useProgress()?.rating as number | undefined) ?? 800;
  const { coachCharacter, coachPersonality } = useSettings();
  const personality = normalizeCoachPersonality(coachCharacter ?? coachPersonality);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [puzzle, setPuzzle] = useState<Puzzle | null>(null);
  const [coach, setCoach] = useState("");
  const [phase, setPhase] = useState<"calc" | "done" | "miss">("calc");
  const [lastMove, setLastMove] = useState<{ from: string; to: string } | null>(null);

  useEffect(() => {
    setLoading(true);
    setPhase("calc");
    api<{ puzzle: Puzzle }>(`/api/think?n=${offset}`)
      .then((d) => {
        const p = d.puzzle;
        setPuzzle(p);
        setCoach(
          applyCoachLine(`${p.coach} Find the best move.`, personality, "lesson", p.lessonId),
        );
        setLoading(false);
        trackMatchStart({
          channel: "assisted",
          opponent: "bot",
          variant: "puzzle",
          targetElo: rating,
        });
      })
      .catch(() => {
        setPuzzle(null);
        setCoach("Could not load a puzzle.");
        setLoading(false);
      });
  }, [offset, rating, personality]);

  useCoachSpeech(coach, !loading && Boolean(puzzle));

  const styles = StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.surface },
    header: { paddingHorizontal: space[4], paddingTop: 6 },
    center: { flex: 1, justifyContent: "center", alignItems: "center", padding: space[5] },
    bubble: { margin: space[4], backgroundColor: colors.surfaceCard, borderRadius: radius.card, padding: space[4], ...shadowCard },
  });

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <ScreenLoader label="Loading puzzle…" />
      </SafeAreaView>
    );
  }

  if (!puzzle) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <CoachAvatar character={personality} state="miss" size={100} />
          <Text style={{ ...type.base, fontFamily: font.bold, color: colors.ink, marginTop: space[3] }}>{coach}</Text>
          <View style={{ marginTop: space[4], width: 200 }}>
            <Button label="Try again" onPress={() => { stopCoachSpeech(); setOffset((n) => n + 1); }} />
          </View>
        </View>
      </SafeAreaView>
    );
  }

  function onMove(from: string, to: string): boolean {
    if (phase !== "calc" && phase !== "miss") return false;
    const key = `${from}:${to}`;
    const ok = puzzle!.allSolutions.includes(key);
    const engine = new ChessEngine(puzzle!.fen);
    engine.move({ from, to, promotion: "q" });
    setLastMove({ from, to });
    if (ok) {
      haptics.success();
      sfx.play("success");
      setCoach(applyCoachLine(puzzle!.successText, personality, "success", key));
      setPhase("done");
      trackEvent("think_puzzle_result", {
        outcome: "win",
        puzzleId: `${puzzle!.lessonId}`,
        source: "assisted",
      });
    } else {
      haptics.error();
      sfx.play("error");
      setCoach(applyCoachLine(puzzle!.failText, personality, "wrong", key));
      setPhase("miss");
      trackEvent("think_puzzle_result", {
        outcome: "loss",
        puzzleId: `${puzzle!.lessonId}`,
        source: "assisted",
      });
    }
    return true;
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <BackButton label="Play" />
        <Text style={{ ...type.lg, fontFamily: font.bold, color: colors.ink }}>Assisted puzzle drill</Text>
      </View>
      <View style={[styles.bubble, { flexDirection: "row", alignItems: "flex-start", gap: space[3] }]}>
        <CoachAvatar
          character={personality}
          state={phase === "done" ? "success" : phase === "miss" ? "miss" : "think"}
          size={48}
        />
        <View style={{ flex: 1 }}>
          <Text style={{ ...type.caption, fontFamily: font.bold, color: colors.ink500 }}>COACH</Text>
          <Text style={{ ...type.sm, fontFamily: font.semibold, color: colors.ink, marginTop: 4 }}>{coach}</Text>
        </View>
      </View>
      <View style={{ alignItems: "center", marginTop: space[2] }}>
        <ChessBoard fen={puzzle.fen} size={boardSize} orientation={puzzle.orientation} onMove={onMove} interactive={phase === "calc" || phase === "miss"} lastMove={lastMove} showNotation />
      </View>
      {phase === "done" && (
        <View style={{ marginHorizontal: space[4] }}>
          <Button label="Next puzzle →" onPress={() => { stopCoachSpeech(); setOffset((n) => n + 1); }} />
        </View>
      )}
    </SafeAreaView>
  );
}

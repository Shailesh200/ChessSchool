import { useCallback, useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { ChessEngine } from "@chess-school/core";
import { api } from "@/api";
import { ChessBoard } from "@/ChessBoard";
import { BackButton } from "@/BackButton";
import { Button } from "@/Button";
import { Cody } from "@/Cody";
import { ScreenLoader } from "@/ScreenLoader";
import { haptics } from "@/haptics";
import { sfx } from "@/sfx";
import { useProgress } from "@/progressStore";
import { colors, font, radius, shadowCard, space, type } from "@/theme";
import { trackEvent } from "@/productAnalytics/track";
import { trackMatchStart } from "@/productAnalytics/matchEvents";

type Puzzle = {
  lessonId: string;
  title: string;
  tag: string;
  fen: string;
  orientation: "white" | "black";
  solutionKey: string;
  allSolutions: string[];
  coach: string;
  successText: string;
  failText: string;
};

function moveMatches(move: { from: string; to: string }, solutions: string[]): boolean {
  const key = `${move.from}:${move.to}`;
  return solutions.includes(key);
}

export default function LessonTrainerScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const boardSize = Math.min(width - 24, 440);
  const rating = (useProgress()?.rating as number | undefined) ?? 800;

  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [puzzle, setPuzzle] = useState<Puzzle | null>(null);
  const [coach, setCoach] = useState("");
  const [phase, setPhase] = useState<"calc" | "done">("calc");
  const [pending, setPending] = useState(false);
  const [lastMove, setLastMove] = useState<{ from: string; to: string } | null>(null);
  const [displayFen, setDisplayFen] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setPhase("calc");
    setPending(false);
    setLastMove(null);
    setDisplayFen(null);
    api<{ puzzle: Puzzle }>(`/api/think?n=${offset}`)
      .then((data) => {
        if (cancelled) return;
        const p = data.puzzle;
        setPuzzle(p);
        setCoach(`${p.coach} Find the best move for ${p.orientation === "black" ? "Black" : "White"}.`);
        setLoading(false);
        const puzzleId = `${p.lessonId}:${p.title}`;
        trackEvent("feature_open", { feature: "think", puzzleId });
        trackMatchStart({
          channel: "think",
          opponent: "bot",
          variant: "puzzle",
          targetElo: rating,
        });
      })
      .catch(() => {
        if (cancelled) return;
        setPuzzle(null);
        setCoach("Could not load a puzzle. Check your connection and try again.");
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [offset, rating]);

  const onMove = useCallback(
    (from: string, to: string, promotion: "q" | "r" | "b" | "n" = "q"): boolean => {
      if (!puzzle || pending || phase !== "calc") return false;
      const engine = new ChessEngine(displayFen ?? puzzle.fen);
      const applied = engine.move({ from, to, promotion });
      if (!applied) return false;

      setDisplayFen(engine.fen());
      setLastMove({ from, to });
      setPending(true);
      sfx.play(applied.captured ? "capture" : "move");

      const correct = moveMatches({ from, to }, puzzle.allSolutions);
      if (correct) {
        setCoach(puzzle.successText);
        setPhase("done");
        haptics.success();
        sfx.play("success");
        trackEvent("think_puzzle_result", {
          outcome: "win",
          puzzleId: `${puzzle.lessonId}:${puzzle.title}`,
        });
      } else {
        setCoach(puzzle.failText);
        haptics.error();
        sfx.play("error");
        trackEvent("think_puzzle_result", {
          outcome: "loss",
          puzzleId: `${puzzle.lessonId}:${puzzle.title}`,
        });
        setTimeout(() => {
          setDisplayFen(null);
          setLastMove(null);
          setPending(false);
          setCoach(`${puzzle.coach} Try again — calculate checks, captures, and threats.`);
        }, 900);
      }
      return true;
    },
    [puzzle, pending, phase, displayFen],
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <ScreenLoader variant="fullscreen" label="Loading puzzle…" />
      </SafeAreaView>
    );
  }

  if (!puzzle) {
    return (
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <View style={styles.header}>
          <BackButton label="Play" />
          <Text style={styles.h1}>Lesson trainer</Text>
        </View>
        <View style={styles.center}>
          <Cody expression="sad" size={96} />
          <Text style={styles.muted}>{coach}</Text>
          <View style={{ width: 200, marginTop: space[4] }}>
            <Button label="Back to play" onPress={() => router.replace("/(tabs)/play")} />
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <BackButton label="Play" />
        <View style={{ flex: 1 }}>
          <Text style={styles.h1}>Lesson trainer</Text>
          <Text style={styles.muted}>
            {puzzle.title} · {puzzle.tag}
          </Text>
        </View>
      </View>

      <View style={styles.coach}>
        <Cody expression={phase === "done" ? "cheer" : "think"} size={64} />
        <View style={styles.bubble}>
          <Text style={styles.bubbleText}>{coach}</Text>
        </View>
      </View>

      <View style={styles.boardWrap}>
        <ChessBoard
          fen={displayFen ?? puzzle.fen}
          size={boardSize}
          orientation={puzzle.orientation}
          onMove={onMove}
          interactive={phase === "calc" && !pending}
          lastMove={lastMove}
          showNotation
        />
      </View>

      <View style={styles.footer}>
        {phase === "done" ? (
          <Button label="Next puzzle →" onPress={() => setOffset((n) => n + 1)} />
        ) : (
          <Pressable
            style={styles.hint}
            onPress={() => {
              const [from, to] = puzzle.solutionKey.split(":");
              if (from && to) setLastMove({ from, to });
            }}
          >
            <Text style={styles.hintText}>Reveal hint arrow</Text>
          </Pressable>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: space[3],
    paddingHorizontal: space[4],
    paddingTop: 6,
  },
  h1: { ...type.xl, fontFamily: font.bold, color: colors.ink },
  muted: { ...type.sm, fontFamily: font.semibold, color: colors.ink500, textAlign: "center" },
  center: { flex: 1, justifyContent: "center", alignItems: "center", padding: space[5], gap: space[3] },
  coach: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: space[2],
    paddingHorizontal: space[4],
    marginTop: space[4],
  },
  bubble: {
    flex: 1,
    backgroundColor: colors.surfaceCard,
    borderRadius: radius.card,
    borderBottomLeftRadius: 4,
    paddingHorizontal: space[4],
    paddingVertical: space[3],
    ...shadowCard,
  },
  bubbleText: { ...type.base, fontFamily: font.bold, color: colors.ink },
  boardWrap: { flex: 1, justifyContent: "center", alignItems: "center" },
  footer: { padding: space[4], paddingBottom: space[6] },
  hint: { alignItems: "center", paddingVertical: space[3] },
  hintText: { ...type.sm, fontFamily: font.bold, color: colors.brand },
});

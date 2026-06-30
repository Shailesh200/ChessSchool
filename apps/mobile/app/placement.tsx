import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { ChessEngine } from "@chess-school/core";
import { ChessBoard } from "@/ChessBoard";
import { Cody, type CodyExpression } from "@/Cody";
import { Button } from "@/Button";
import { BackButton } from "@/BackButton";
import { api } from "@/api";
import { settings } from "@/settings";
import { haptics } from "@/haptics";
import { sfx } from "@/sfx";
import { colors, font, radius, space, type } from "@/theme";

type Puzzle = { fen: string; solution: string[] };

function placedElo(pct: number): { elo: number; label: string } {
  if (pct >= 0.85) return { elo: 1400, label: "High School" };
  if (pct >= 0.55) return { elo: 1000, label: "Middle School" };
  if (pct >= 0.3) return { elo: 700, label: "Elementary School" };
  return { elo: 500, label: "Elementary School" };
}

export default function PlacementScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const boardSize = Math.min(width - 24, 440);
  const [puzzles, setPuzzles] = useState<Puzzle[] | null>(null);
  const [i, setI] = useState(0);
  const correctRef = useRef(0);
  const [feedback, setFeedback] = useState<"correct" | "wrong" | null>(null);
  const [displayFen, setDisplayFen] = useState<string | undefined>();
  const [lastMove, setLastMove] = useState<{ from: string; to: string } | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    api<{ puzzles: Puzzle[] }>("/api/placement").then((d) => setPuzzles(d.puzzles ?? [])).catch(() => setPuzzles([]));
  }, []);

  if (!puzzles) {
    return (
      <SafeAreaView style={styles.safe}><View style={styles.center}><ActivityIndicator color={colors.brand} size="large" /></View></SafeAreaView>
    );
  }

  if (done || puzzles.length === 0) {
    const pct = puzzles.length ? correctRef.current / puzzles.length : 0;
    const { elo, label } = placedElo(pct);
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <Cody expression="cheer" size={140} />
          <Text style={styles.doneTitle}>You're placed!</Text>
          <Text style={styles.doneSub}>{correctRef.current}/{puzzles.length} correct · starting in {label}</Text>
          <View style={{ marginTop: space[5], width: 260 }}>
            <Button label="Start learning →" variant="success" onPress={() => { settings.set("targetElo", elo); router.replace("/(tabs)"); }} />
          </View>
        </View>
      </SafeAreaView>
    );
  }

  const puzzle = puzzles[i]!;
  const turn = puzzle.fen.split(" ")[1] === "b" ? "Black" : "White";
  const mood: CodyExpression = feedback === "correct" ? "cheer" : feedback === "wrong" ? "sad" : "think";

  function onMove(from: string, to: string): boolean {
    if (feedback) return false;
    const e = new ChessEngine(puzzle.fen);
    const mv = e.move({ from, to, promotion: "q" });
    if (!mv) return false; // illegal — board snaps back, no penalty
    const ok = puzzle.solution.includes(`${from}:${to}`);
    setDisplayFen(e.fen()); // show + animate the played move
    setLastMove({ from, to });
    sfx.play(mv.captured ? "capture" : "move");
    if (ok) { correctRef.current += 1; haptics.success(); setTimeout(() => sfx.play("success"), 180); } else { haptics.error(); setTimeout(() => sfx.play("error"), 180); }
    setFeedback(ok ? "correct" : "wrong");
    setTimeout(() => {
      setFeedback(null);
      setDisplayFen(undefined);
      setLastMove(null);
      if (i + 1 >= puzzles!.length) setDone(true);
      else setI((n) => n + 1);
    }, ok ? 900 : 1250);
    return true;
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <BackButton />
        <View style={styles.track}><View style={[styles.fill, { width: `${((i + 1) / puzzles.length) * 100}%` }]} /></View>
        <Text style={styles.count}>{i + 1}/{puzzles.length}</Text>
      </View>

      <View style={styles.coach}>
        <Cody expression={mood} size={64} />
        <View style={styles.bubble}>
          <Text style={styles.bubbleText}>
            {feedback === "correct" ? "Nice! ✓" : feedback === "wrong" ? "Not the best — moving on." : `Find the best move for ${turn}.`}
          </Text>
        </View>
      </View>

      <View style={styles.boardWrap}>
        <ChessBoard fen={displayFen ?? puzzle.fen} size={boardSize} orientation={turn === "Black" ? "black" : "white"} onMove={onMove} interactive={!feedback} lastMove={lastMove} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface },
  center: { flex: 1, justifyContent: "center", alignItems: "center", padding: space[5] },
  header: { flexDirection: "row", alignItems: "center", gap: space[3], paddingHorizontal: space[4], paddingTop: 6 },
  track: { flex: 1, height: 12, borderRadius: radius.pill, backgroundColor: colors.surfaceSunken, overflow: "hidden" },
  fill: { height: 12, borderRadius: radius.pill, backgroundColor: colors.brand },
  count: { ...type.sm, fontFamily: font.bold, color: colors.ink500 },
  coach: { flexDirection: "row", alignItems: "flex-start", gap: space[2], paddingHorizontal: space[4], marginTop: space[4] },
  bubble: { flex: 1, backgroundColor: colors.surfaceCard, borderRadius: radius.card, borderBottomLeftRadius: 4, paddingHorizontal: space[4], paddingVertical: space[3], borderWidth: 1, borderColor: colors.hairline },
  bubbleText: { ...type.base, fontFamily: font.bold, color: colors.ink },
  boardWrap: { flex: 1, justifyContent: "center", alignItems: "center" },
  doneTitle: { ...type["3xl"], fontFamily: font.bold, color: colors.ink, marginTop: space[4] },
  doneSub: { ...type.base, fontFamily: font.semibold, color: colors.ink500, marginTop: space[2], textAlign: "center" },
});

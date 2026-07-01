import { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { ChessEngine } from "@chess-school/core";
import { ChessBoard } from "@/ChessBoard";
import { BackButton } from "@/BackButton";
import { Button } from "@/Button";
import { Cody } from "@/Cody";
import { useProgress } from "@/progressStore";
import { haptics } from "@/haptics";
import { sfx } from "@/sfx";
import { colors, font, radius, shadowCard, space, type } from "@/theme";

type Mistake = { fen: string; played: string; best: string; tag: string; at: number };

export default function MistakePracticeScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const boardSize = Math.min(width - 24, 440);
  const progress = useProgress();
  const mistakes = useMemo(() => {
    const rows = ((progress?.mistakeLog as Mistake[]) ?? []).filter((m) => m.fen && m.best);
    const seen = new Set<string>();
    return rows.filter((m) => {
      const key = `${m.fen}|${m.best}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }).slice(0, 12);
  }, [progress]);
  const [index, setIndex] = useState(0);
  const [feedback, setFeedback] = useState<"correct" | "wrong" | null>(null);
  const [lastMove, setLastMove] = useState<{ from: string; to: string } | null>(null);
  const [displayFen, setDisplayFen] = useState<string | null>(null);

  const item = mistakes[index];

  function next() {
    setFeedback(null);
    setLastMove(null);
    setDisplayFen(null);
    setIndex((n) => n + 1);
  }

  function onMove(from: string, to: string, promotion: "q" | "r" | "b" | "n" = "q"): boolean {
    if (!item || feedback) return false;
    const engine = new ChessEngine(item.fen);
    const move = engine.move({ from, to, promotion });
    if (!move) return false;
    const ok = `${from}:${to}` === item.best;
    setDisplayFen(engine.fen());
    setLastMove({ from, to });
    sfx.play(move.captured ? "capture" : "move");
    if (ok) {
      setFeedback("correct");
      haptics.success();
      setTimeout(() => sfx.play("success"), 160);
    } else {
      setFeedback("wrong");
      haptics.error();
      setTimeout(() => {
        sfx.play("error");
        setDisplayFen(null);
        setLastMove(null);
        setFeedback(null);
      }, 950);
    }
    return true;
  }

  if (mistakes.length === 0) {
    return (
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <View style={styles.header}><BackButton /><Text style={styles.h1}>Mistake practice</Text></View>
        <View style={styles.center}>
          <Cody expression="cheer" size={128} />
          <Text style={styles.doneTitle}>No mistakes to practise yet 🎉</Text>
          <Text style={styles.muted}>Play lessons and matches. I’ll turn your missed positions into drills here.</Text>
          <View style={{ width: 220, marginTop: space[4] }}>
            <Button label="Back to academy" onPress={() => router.back()} />
          </View>
        </View>
      </SafeAreaView>
    );
  }

  if (!item) {
    return (
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <View style={styles.center}>
          <Cody expression="cheer" size={128} />
          <Text style={styles.doneTitle}>Practice complete!</Text>
          <Text style={styles.muted}>You reviewed {mistakes.length} mistake positions.</Text>
          <View style={{ width: 220, marginTop: space[4] }}>
            <Button label="Back to academy" onPress={() => router.replace("/(tabs)")} />
          </View>
        </View>
      </SafeAreaView>
    );
  }

  const turn = item.fen.split(" ")[1] === "b" ? "Black" : "White";
  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <BackButton />
        <View style={{ flex: 1 }}>
          <Text style={styles.h1}>Mistake practice</Text>
          <Text style={styles.muted}>{index + 1}/{mistakes.length} · {item.tag}</Text>
        </View>
      </View>

      <View style={styles.coach}>
        <Cody expression={feedback === "wrong" ? "sad" : feedback === "correct" ? "cheer" : "think"} size={64} />
        <View style={styles.bubble}>
          <Text style={styles.bubbleText}>
            {feedback === "correct" ? "Correct — that's the best move." : feedback === "wrong" ? "Not that one. Try the position again." : `Find the best move for ${turn}.`}
          </Text>
        </View>
      </View>

      <View style={styles.boardWrap}>
        <ChessBoard fen={displayFen ?? item.fen} size={boardSize} orientation={turn === "Black" ? "black" : "white"} onMove={onMove} interactive={!feedback} lastMove={lastMove} />
      </View>

      <View style={styles.footer}>
        {feedback === "correct" ? (
          <Button label={index + 1 >= mistakes.length ? "Finish practice" : "Next position →"} variant="success" onPress={next} />
        ) : (
          <Pressable style={styles.hint} onPress={() => setLastMove({ from: item.best.split(":")[0]!, to: item.best.split(":")[1]! })}>
            <Text style={styles.hintText}>Hint: show best-move arrow</Text>
          </Pressable>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface },
  header: { flexDirection: "row", alignItems: "center", gap: space[3], paddingHorizontal: space[4], paddingTop: 6 },
  h1: { ...type.xl, fontFamily: font.bold, color: colors.ink },
  muted: { ...type.sm, fontFamily: font.semibold, color: colors.ink500 },
  center: { flex: 1, justifyContent: "center", alignItems: "center", padding: space[5] },
  doneTitle: { ...type.xl, fontFamily: font.bold, color: colors.ink, textAlign: "center", marginTop: space[3] },
  coach: { flexDirection: "row", alignItems: "flex-start", gap: space[2], paddingHorizontal: space[4], marginTop: space[4] },
  bubble: { flex: 1, backgroundColor: colors.surfaceCard, borderRadius: radius.card, borderBottomLeftRadius: 4, paddingHorizontal: space[4], paddingVertical: space[3], ...shadowCard },
  bubbleText: { ...type.base, fontFamily: font.bold, color: colors.ink },
  boardWrap: { flex: 1, justifyContent: "center", alignItems: "center" },
  footer: { paddingHorizontal: space[4], paddingBottom: space[4], minHeight: 72 },
  hint: { alignItems: "center", borderRadius: radius.pill, backgroundColor: colors.surfaceCard, paddingVertical: space[3], borderWidth: 1, borderColor: colors.hairline },
  hintText: { ...type.sm, fontFamily: font.bold, color: colors.brand },
});

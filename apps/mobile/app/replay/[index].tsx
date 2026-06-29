import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ChessEngine } from "@chess-school/core";
import { ChessBoard } from "@/ChessBoard";
import { api } from "@/api";
import { colors, font, radius } from "@/theme";

type Game = { moves: string[]; result: string; elo: number };

function buildFrames(moves: string[]): { fen: string; last: { from: string; to: string } | null }[] {
  const e = new ChessEngine();
  const frames: { fen: string; last: { from: string; to: string } | null }[] = [{ fen: e.fen(), last: null }];
  for (const mv of moves) {
    const [from, to] = mv.split(":");
    if (!e.move({ from: from!, to: to!, promotion: "q" })) break;
    frames.push({ fen: e.fen(), last: { from: from!, to: to! } });
  }
  return frames;
}

export default function ReplayScreen() {
  const { index } = useLocalSearchParams<{ index: string }>();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const boardSize = Math.min(width - 32, 440);
  const [game, setGame] = useState<Game | null>(null);
  const [ply, setPly] = useState(0);

  useEffect(() => {
    api<{ recentGames: Game[] }>("/api/progress")
      .then((d) => setGame(d.recentGames?.[Number(index)] ?? null))
      .catch(() => void 0);
  }, [index]);

  const frames = useMemo(() => (game ? buildFrames(game.moves) : []), [game]);

  if (!game) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <ActivityIndicator color={colors.brand} size="large" />
        </View>
      </SafeAreaView>
    );
  }

  const frame = frames[ply] ?? frames[0]!;

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Text style={styles.close}>✕</Text>
        </Pressable>
        <Text style={styles.h1}>Replay · vs {game.elo}</Text>
      </View>

      <View style={{ alignItems: "center", marginTop: 10 }}>
        <ChessBoard fen={frame.fen} size={boardSize} interactive={false} lastMove={frame.last} />
      </View>

      <View style={styles.controls}>
        <Pressable style={styles.ctrl} onPress={() => setPly(0)}>
          <Text style={styles.ctrlText}>⏮</Text>
        </Pressable>
        <Pressable style={styles.ctrl} onPress={() => setPly((p) => Math.max(0, p - 1))}>
          <Text style={styles.ctrlText}>◀</Text>
        </Pressable>
        <Text style={styles.counter}>
          {ply}/{frames.length - 1}
        </Text>
        <Pressable style={styles.ctrl} onPress={() => setPly((p) => Math.min(frames.length - 1, p + 1))}>
          <Text style={styles.ctrlText}>▶</Text>
        </Pressable>
        <Pressable style={styles.ctrl} onPress={() => setPly(frames.length - 1)}>
          <Text style={styles.ctrlText}>⏭</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  header: { flexDirection: "row", alignItems: "center", gap: 14, paddingHorizontal: 20, paddingTop: 6 },
  close: { fontSize: 20, color: colors.ink500, fontFamily: font.bold },
  h1: { fontSize: 20, fontFamily: font.bold, color: colors.ink },
  controls: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 14, marginTop: 22 },
  ctrl: { width: 52, height: 44, borderRadius: radius.md, backgroundColor: colors.surfaceCard, justifyContent: "center", alignItems: "center", borderWidth: 1, borderColor: colors.hairline },
  ctrlText: { fontSize: 18, color: colors.ink, fontFamily: font.bold },
  counter: { minWidth: 56, textAlign: "center", fontFamily: font.bold, color: colors.ink500, fontSize: 14 },
});

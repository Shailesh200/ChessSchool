import { useRef, useState } from "react";
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { ChessEngine } from "@chess-school/core";
import { ChessBoard } from "@/ChessBoard";
import { Button } from "@/Button";
import { Icon } from "@/Icon";
import { haptics } from "@/haptics";
import { sfx } from "@/sfx";
import { colors, font, radius, space, type } from "@/theme";

/** Pass & play — two players take turns on one device (vs Human). */
export default function PassPlayScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const boardSize = Math.min(width - 16, 470);
  const engineRef = useRef(new ChessEngine());
  const [fen, setFen] = useState(engineRef.current.fen());
  const [lastMove, setLastMove] = useState<{ from: string; to: string } | null>(null);
  const [over, setOver] = useState<string | null>(null);

  const turn = engineRef.current.turn();
  const orientation = turn === "w" ? "white" : "black";

  function reset() {
    engineRef.current = new ChessEngine();
    setFen(engineRef.current.fen());
    setLastMove(null);
    setOver(null);
  }

  function handleMove(from: string, to: string): boolean {
    const e = engineRef.current;
    if (over) return false;
    if (!e.move({ from, to, promotion: "q" })) return false;
    haptics.tap();
    const h = e.history();
    sfx.play(h[h.length - 1]?.captured ? "capture" : "move");
    setFen(e.fen());
    setLastMove({ from, to });
    if (e.isGameOver()) {
      const st = e.status();
      if (st === "checkmate") {
        setOver(`Checkmate — ${e.turn() === "w" ? "Black" : "White"} wins! 🏆`);
        haptics.success();
        sfx.play("win");
      } else setOver("Draw");
    }
    return true;
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <Pressable style={styles.circle} onPress={() => router.back()} hitSlop={8}>
          <View style={{ transform: [{ rotate: "180deg" }] }}><Icon name="chevronRight" size={20} color={colors.ink} /></View>
        </Pressable>
        <Text style={styles.title}>Pass & play</Text>
      </View>

      <View style={styles.statusRow}>
        <View style={[styles.dot, { backgroundColor: turn === "b" ? colors.ink : "#fff" }]} />
        <Text style={styles.status}>{over ?? `${turn === "w" ? "White" : "Black"} to move`}</Text>
      </View>

      <View style={styles.boardWrap}>
        <ChessBoard fen={fen} size={boardSize} orientation={orientation} onMove={handleMove} interactive={!over} lastMove={lastMove} />
      </View>

      <View style={{ width: 220, alignSelf: "center", marginTop: space[4] }}>
        <Button label={over ? "New game" : "Restart"} onPress={reset} />
      </View>
    </SafeAreaView>
  );
}

const CIRCLE = 40;
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface },
  header: { flexDirection: "row", alignItems: "center", gap: space[2], paddingHorizontal: space[4], paddingTop: 6 },
  circle: { width: CIRCLE, height: CIRCLE, borderRadius: CIRCLE / 2, backgroundColor: colors.surfaceCard, justifyContent: "center", alignItems: "center", borderWidth: 1, borderColor: colors.hairline },
  title: { ...type.xl, fontFamily: font.bold, color: colors.ink },
  statusRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginTop: space[3] },
  dot: { width: 14, height: 14, borderRadius: 7, borderWidth: 1, borderColor: colors.ink300 },
  status: { ...type.base, fontFamily: font.bold, color: colors.ink },
  boardWrap: { flex: 1, justifyContent: "center", alignItems: "center" },
});

import { useRef, useState } from "react";
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { ChessEngine } from "@chess-school/core";
import { ChessBoard } from "@/ChessBoard";
import { Icon } from "@/Icon";
import { useSettings } from "@/settings";
import { haptics } from "@/haptics";
import { sfx } from "@/sfx";
import { colors, font, radius, shadowCard, space, type } from "@/theme";

function PlayerBar({ name, emoji, active, captured }: { name: string; emoji: string; active: boolean; captured: number }) {
  return (
    <View style={[styles.bar, active && styles.barActive]}>
      <Text style={styles.barEmoji}>{emoji}</Text>
      <Text style={styles.barName} numberOfLines={1}>{name}</Text>
      {active && <View style={styles.dot} />}
      {captured > 0 && <Text style={styles.adv}>+{captured}</Text>}
    </View>
  );
}

const VAL: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
function material(fen: string) {
  let w = 0, b = 0;
  for (const ch of fen.split(" ")[0]!) {
    const v = VAL[ch.toLowerCase()] ?? 0;
    if (ch >= "A" && ch <= "Z") w += v;
    else if (ch >= "a" && ch <= "z") b += v;
  }
  return { w, b };
}

/** Pass & play — two players share one device (You = White, Guest = Black). */
export default function PassPlayScreen() {
  const router = useRouter();
  const { avatar } = useSettings();
  const { width } = useWindowDimensions();
  const boardSize = Math.min(width - 16, 460);
  const engineRef = useRef(new ChessEngine());
  const [fen, setFen] = useState(engineRef.current.fen());
  const [lastMove, setLastMove] = useState<{ from: string; to: string } | null>(null);
  const [over, setOver] = useState<string | null>(null);

  const turn = engineRef.current.turn();
  const mat = material(fen);

  function reset() {
    engineRef.current = new ChessEngine();
    setFen(engineRef.current.fen());
    setLastMove(null);
    setOver(null);
  }

  function resign() {
    if (over) return;
    setOver(`${turn === "w" ? "You" : "Guest"} resigned — ${turn === "w" ? "Guest" : "You"} win${turn === "w" ? "s" : ""}`);
    haptics.success();
    sfx.play("win");
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
        setOver(`Checkmate — ${e.turn() === "w" ? "Guest" : "You"} win${e.turn() === "w" ? "s" : ""}! 🏆`);
        haptics.success();
        sfx.play("win");
      } else setOver(st === "stalemate" ? "Stalemate — draw" : "Draw");
    }
    return true;
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <Pressable style={styles.circle} onPress={() => router.back()} hitSlop={8}>
          <View style={{ transform: [{ rotate: "180deg" }] }}><Icon name="chevronRight" size={20} color={colors.ink} /></View>
        </Pressable>
        <Text style={styles.title}>Pass &amp; play</Text>
        {!over ? (
          <Pressable style={styles.resign} onPress={resign}><Text style={styles.resignText}>Resign</Text></Pressable>
        ) : (
          <Pressable style={styles.newBtn} onPress={reset}><Text style={styles.newText}>New game</Text></Pressable>
        )}
      </View>

      <View style={styles.statusRow}>
        <Text style={styles.status}>{over ?? `${turn === "w" ? "Your" : "Guest's"} move`}</Text>
      </View>

      <View style={{ flex: 1, justifyContent: "center" }}>
        <PlayerBar name="Guest Player" emoji="🙂" active={turn === "b" && !over} captured={Math.max(0, mat.b - mat.w)} />
        <View style={{ alignItems: "center", marginVertical: space[2] }}>
          <ChessBoard fen={fen} size={boardSize} orientation="white" onMove={handleMove} interactive={!over} lastMove={lastMove} />
        </View>
        <PlayerBar name="You" emoji={avatar || "🎓"} active={turn === "w" && !over} captured={Math.max(0, mat.w - mat.b)} />
      </View>
    </SafeAreaView>
  );
}

const CIRCLE = 40;
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface },
  header: { flexDirection: "row", alignItems: "center", gap: space[2], paddingHorizontal: space[4], paddingTop: 6 },
  circle: { width: CIRCLE, height: CIRCLE, borderRadius: CIRCLE / 2, backgroundColor: colors.surfaceCard, justifyContent: "center", alignItems: "center", borderWidth: 1, borderColor: colors.hairline },
  title: { flex: 1, ...type.xl, fontFamily: font.bold, color: colors.ink },
  resign: { borderRadius: radius.md, backgroundColor: colors.danger, paddingHorizontal: space[3], paddingVertical: 8 },
  resignText: { ...type.xs, fontFamily: font.bold, color: "#fff" },
  newBtn: { borderRadius: radius.md, backgroundColor: colors.brand, paddingHorizontal: space[3], paddingVertical: 8 },
  newText: { ...type.xs, fontFamily: font.bold, color: "#fff" },
  statusRow: { alignItems: "center", marginTop: space[2] },
  status: { ...type.base, fontFamily: font.bold, color: colors.ink },
  bar: { flexDirection: "row", alignItems: "center", gap: space[2], marginHorizontal: space[4], paddingHorizontal: space[3], paddingVertical: space[2], borderRadius: radius.md, borderWidth: 1, borderColor: "transparent" },
  barActive: { backgroundColor: colors.surfaceCard, borderColor: colors.brand100, ...shadowCard },
  barEmoji: { fontSize: 22 },
  barName: { flex: 1, ...type.sm, fontFamily: font.bold, color: colors.ink },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.success },
  adv: { ...type.sm, fontFamily: font.bold, color: colors.ink500 },
});

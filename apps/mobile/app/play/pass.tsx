import { useRef, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ChessEngine } from "@chess-school/core";
import { ChessBoard } from "@/ChessBoard";
import { GameOverOverlay } from "@/GameOverOverlay";
import { ReflectSheet } from "@/ReflectSheet";
import { Icon } from "@/Icon";
import { mutateProgress } from "@/progressStore";
import { prependRecentGame, type EndReason } from "@/progression";
import { buildSyncGame, winnerFromPlayerResult, endReasonFromStatus } from "@/gameHistory";
import { useSettings } from "@/settings";
import { clock as fmtClock } from "@/chess-utils";
import { parseTimeControl, useChessClock } from "@/useChessClock";
import { haptics } from "@/haptics";
import { sfx } from "@/sfx";
import { colors, font, radius, shadowCard, space, type } from "@/theme";

function PlayerBar({ name, emoji, active, captured, clockMs }: { name: string; emoji: string; active: boolean; captured: number; clockMs?: number }) {
  return (
    <View style={[styles.bar, active && styles.barActive]}>
      <Text style={styles.barEmoji}>{emoji}</Text>
      <Text style={styles.barName} numberOfLines={1}>{name}</Text>
      {active && <View style={styles.dot} />}
      {captured > 0 && <Text style={styles.adv}>+{captured}</Text>}
      {clockMs !== undefined && <Text style={[styles.clock, active && styles.clockActive]}>{fmtClock(clockMs)}</Text>}
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

type OverState = { title: string; win: boolean; gameId: string };

/** Pass & play — two players share one device (You = White, Guest = Black). */
export default function PassPlayScreen() {
  const router = useRouter();
  const { time: timeParam } = useLocalSearchParams<{ time?: string }>();
  const timeMs = parseTimeControl(timeParam);
  const { avatar } = useSettings();
  const { width } = useWindowDimensions();
  const boardSize = Math.min(width - 16, 460);
  const engineRef = useRef(new ChessEngine());
  const gameIdRef = useRef(`p${Date.now()}`);
  const createdAtRef = useRef(Date.now());
  const savedRef = useRef(false);
  const flaggedRef = useRef(false);
  const [fen, setFen] = useState(engineRef.current.fen());
  const [lastMove, setLastMove] = useState<{ from: string; to: string } | null>(null);
  const [over, setOver] = useState<OverState | null>(null);
  const [reflectOpen, setReflectOpen] = useState(false);

  const turn = fen.split(" ")[1] === "b" ? "b" : "w";
  const hasClock = timeMs > 0 && !over;
  const { whiteMs, blackMs } = useChessClock({
    enabled: hasClock,
    whiteMs: timeMs,
    blackMs: timeMs,
    turn,
    onFlag: (loser) => {
      if (flaggedRef.current || over) return;
      flaggedRef.current = true;
      const whiteWins = loser === "b";
      finish(whiteWins ? "win" : "loss", whiteWins ? "Black ran out of time — You win! 🏆" : "You ran out of time ⏱️", whiteWins, "timeout");
    },
  });

  const checkSquare = (() => { const v = new ChessEngine(fen); return v.inCheck() ? v.kingSquare(turn) : null; })();
  const mat = material(fen);

  function reset() {
    engineRef.current = new ChessEngine();
    gameIdRef.current = `p${Date.now()}`;
    createdAtRef.current = Date.now();
    savedRef.current = false;
    flaggedRef.current = false;
    setFen(engineRef.current.fen());
    setLastMove(null);
    setOver(null);
  }

  function saveRecentGame(result: "win" | "loss" | "draw", endReason: EndReason = "checkmate") {
    if (savedRef.current) return;
    savedRef.current = true;
    const winner = winnerFromPlayerResult(result, "w");
    const game = buildSyncGame({
      engine: engineRef.current,
      id: gameIdRef.current,
      mode: "pass",
      createdAt: createdAtRef.current,
      whiteName: "You",
      blackName: "Guest",
      elo: null,
      endReason,
      winner,
      playerResult: result,
    });
    void mutateProgress((snap) => ({
      ...snap,
      recentGames: prependRecentGame((snap.recentGames as unknown[]) ?? [], game),
    }));
  }

  function finish(result: "win" | "loss" | "draw", title: string, win: boolean, endReason: EndReason = "checkmate") {
    saveRecentGame(result, endReason);
    setOver({ title, win, gameId: gameIdRef.current });
  }

  function resign() {
    if (over) return;
    Alert.alert("Resign?", `${turn === "w" ? "You" : "Guest"} will lose if you resign.`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Resign",
        style: "destructive",
        onPress: () => {
          const whiteResigned = turn === "w";
          finish(whiteResigned ? "loss" : "win", `${whiteResigned ? "You" : "Guest"} resigned`, !whiteResigned, "resign");
          haptics.success();
          sfx.play("win");
        },
      },
    ]);
  }

  function handleMove(from: string, to: string, promotion: "q" | "r" | "b" | "n" = "q"): boolean {
    const e = engineRef.current;
    if (over) return false;
    if (!e.move({ from, to, promotion })) return false;
    haptics.tap();
    const h = e.history();
    sfx.play(h[h.length - 1]?.captured ? "capture" : "move");
    setFen(e.fen());
    setLastMove({ from, to });
    if (e.isGameOver()) {
      const st = e.status();
      if (st === "checkmate") {
        const whiteWins = e.turn() === "b";
        finish(whiteWins ? "win" : "loss", `Checkmate — ${whiteWins ? "You" : "Guest"} win${whiteWins ? "" : "s"}! 🏆`, whiteWins, "checkmate");
        haptics.success();
        sfx.play("win");
      } else {
        finish("draw", st === "stalemate" ? "Stalemate — draw" : "Draw", false, endReasonFromStatus(st));
      }
    }
    return true;
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.surface }]} edges={["top"]}>
      <View style={styles.header}>
        <Pressable style={styles.circle} onPress={() => router.back()} hitSlop={8}>
          <View style={{ transform: [{ rotate: "180deg" }] }}><Icon name="chevronRight" size={20} color={colors.ink} /></View>
        </Pressable>
        <Text style={styles.title}>Pass &amp; play</Text>
        {!over && (
          <Pressable style={styles.resign} onPress={resign}><Text style={styles.resignText}>Resign</Text></Pressable>
        )}
      </View>

      {!over && (
        <View style={styles.statusRow}>
          <Text style={styles.status}>{`${turn === "w" ? "Your" : "Guest's"} move`}</Text>
        </View>
      )}

      <View style={{ flex: 1, justifyContent: "center" }}>
        <PlayerBar name="Guest Player" emoji="🙂" active={turn === "b" && !over} captured={Math.max(0, mat.b - mat.w)} clockMs={timeMs > 0 ? blackMs : undefined} />
        <View style={{ alignItems: "center", marginVertical: space[2] }}>
          <ChessBoard fen={fen} size={boardSize} orientation="white" onMove={handleMove} interactive={!over} lastMove={lastMove} checkSquare={checkSquare} />
        </View>
        <PlayerBar name="You" emoji={avatar || "🎓"} active={turn === "w" && !over} captured={Math.max(0, mat.w - mat.b)} clockMs={timeMs > 0 ? whiteMs : undefined} />
      </View>

      <GameOverOverlay
        visible={!!over}
        title={over?.title ?? ""}
        win={over?.win}
        onReflect={() => setReflectOpen(true)}
        onNewGame={reset}
        onExit={() => router.back()}
      />

      <ReflectSheet
        visible={reflectOpen}
        onClose={() => setReflectOpen(false)}
        kind="match"
        title="Pass & play"
        summary={over?.title ?? "Match reflection"}
        refId={over?.gameId ?? null}
      />
    </SafeAreaView>
  );
}

const CIRCLE = 40;
const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", gap: space[2], paddingHorizontal: space[4], paddingTop: 6 },
  circle: { width: CIRCLE, height: CIRCLE, borderRadius: CIRCLE / 2, backgroundColor: colors.surfaceCard, justifyContent: "center", alignItems: "center", borderWidth: 1, borderColor: colors.hairline },
  title: { flex: 1, ...type.xl, fontFamily: font.bold, color: colors.ink },
  resign: { borderRadius: radius.md, backgroundColor: colors.danger, paddingHorizontal: space[3], paddingVertical: 8 },
  resignText: { ...type.xs, fontFamily: font.bold, color: "#fff" },
  statusRow: { alignItems: "center", marginTop: space[2] },
  status: { ...type.base, fontFamily: font.bold, color: colors.ink },
  bar: { flexDirection: "row", alignItems: "center", gap: space[2], marginHorizontal: space[4], paddingHorizontal: space[3], paddingVertical: space[2], borderRadius: radius.md, borderWidth: 1, borderColor: "transparent" },
  barActive: { backgroundColor: colors.surfaceCard, borderColor: colors.brand100, ...shadowCard },
  barEmoji: { fontSize: 22 },
  barName: { flex: 1, ...type.sm, fontFamily: font.bold, color: colors.ink },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.success },
  adv: { ...type.sm, fontFamily: font.bold, color: colors.ink500 },
  clock: { ...type.sm, fontFamily: font.bold, color: colors.ink500, fontVariant: ["tabular-nums"] },
  clockActive: { color: colors.brand },
});

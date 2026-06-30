import { useMemo, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ChessEngine, getBotMove, eloToConfig } from "@chess-school/core";
import { ChessBoard } from "@/ChessBoard";
import { Icon } from "@/Icon";
import { haptics } from "@/haptics";
import { sfx } from "@/sfx";
import { api } from "@/api";
import { mutateProgress } from "@/progressStore";
import { material } from "@/chess-utils";
import { stockfishAvailable, nativeBestMove } from "@/stockfish";
import { applyMatchEnd } from "@/progression";
import { useSettings } from "@/settings";
import { colors, font, radius, shadowCard, space, type } from "@/theme";

const BOTS = [
  { max: 500, name: "Pip", emoji: "🐣", blurb: "Just learning the moves" },
  { max: 800, name: "Cody", emoji: "🙂", blurb: "Casual beginner" },
  { max: 1100, name: "Remi", emoji: "🎯", blurb: "Knows the basics" },
  { max: 1500, name: "Sasha", emoji: "⚔️", blurb: "Sharp club player" },
  { max: 1900, name: "Vera", emoji: "🧠", blurb: "Strong expert" },
  { max: 2300, name: "Magnus Jr.", emoji: "👑", blurb: "Master strength" },
  { max: 9999, name: "Titan", emoji: "🏆", blurb: "Grandmaster engine" },
];
const botProfile = (elo: number) => BOTS.find((b) => elo <= b.max) ?? BOTS[BOTS.length - 1]!;

function buildFrames(moves: string[]): string[] {
  const e = new ChessEngine();
  const frames = [e.fen()];
  for (const mv of moves) {
    const [from, to] = mv.split(":");
    if (!e.move({ from: from!, to: to!, promotion: "q" })) break;
    frames.push(e.fen());
  }
  return frames;
}

async function saveGame(moves: string[], result: "win" | "loss" | "draw", elo: number) {
  try {
    void mutateProgress((snap) => {
      const next = applyMatchEnd(snap, { botElo: elo, result });
      const games = [{ moves, result, elo, at: Date.now() }, ...((snap.recentGames as unknown[]) ?? [])].slice(0, 20);
      return { ...next, recentGames: games };
    });
  } catch {
    /* ignore */
  }
}

function PlayerBar({ name, emoji, advantage, active }: { name: string; emoji: string; advantage: number; active?: boolean }) {
  return (
    <View style={[styles.playerBar, active && styles.playerBarActive]}>
      <Text style={styles.playerEmoji}>{emoji}</Text>
      <Text style={styles.playerName} numberOfLines={1}>{name}</Text>
      {active && <View style={styles.turnDot} />}
      {advantage > 0 && <Text style={styles.advantage}>+{advantage}</Text>}
    </View>
  );
}

export default function GameScreen() {
  const router = useRouter();
  const { elo: eloParam } = useLocalSearchParams<{ elo: string }>();
  const elo = Number(eloParam) || 1000;
  const bot = botProfile(elo);
  const { avatar } = useSettings();
  const { width } = useWindowDimensions();
  const boardSize = Math.min(width - 24, 440);
  const engineRef = useRef(new ChessEngine());
  const [fen, setFen] = useState(engineRef.current.fen());
  const [moves, setMoves] = useState<string[]>([]);
  const [viewPly, setViewPly] = useState<number | null>(null);
  const [lastMove, setLastMove] = useState<{ from: string; to: string } | null>(null);
  const [thinking, setThinking] = useState(false);
  const [over, setOver] = useState<string | null>(null);
  const [flipped, setFlipped] = useState(false);

  const frames = useMemo(() => buildFrames(moves), [moves]);
  const viewing = viewPly !== null;
  const shownFen = viewing ? frames[viewPly]! : fen;
  const mat = material(shownFen);

  function reset() {
    engineRef.current = new ChessEngine();
    setFen(engineRef.current.fen());
    setMoves([]);
    setViewPly(null);
    setLastMove(null);
    setOver(null);
    setThinking(false);
  }

  function checkOver(): boolean {
    const e = engineRef.current;
    if (!e.isGameOver()) return false;
    const status = e.status();
    const mv = e.history().map((m) => `${m.from}:${m.to}`);
    if (status === "checkmate") {
      const youWon = e.turn() === "b";
      setOver(youWon ? "Checkmate — you win! 🏆" : `Checkmate — ${bot.name} wins`);
      youWon ? haptics.success() : haptics.error();
      youWon ? sfx.play("win") : sfx.play("error");
      void saveGame(mv, youWon ? "win" : "loss", elo);
    } else {
      setOver("Draw");
      void saveGame(mv, "draw", elo);
    }
    return true;
  }

  function handleMove(from: string, to: string): boolean {
    const e = engineRef.current;
    if (over || thinking || viewing || e.turn() !== "w") return false;
    if (!e.move({ from, to, promotion: "q" })) return false;
    haptics.tap();
    const h = e.history();
    sfx.play(h[h.length - 1]?.captured ? "capture" : "move");
    setFen(e.fen());
    setMoves((m) => [...m, `${from}:${to}`]);
    setLastMove({ from, to });
    if (checkOver()) return true;

    setThinking(true);
    setTimeout(async () => {
      // Native Stockfish (dev build) for true web-strength; falls back to the JS engine.
      let m = stockfishAvailable() ? await nativeBestMove(e.fen(), elo) : null;
      if (!m) m = await getBotMove(e.fen(), eloToConfig(elo), Math.random());
      if (m) {
        e.move(m as never);
        const bh = e.history();
        sfx.play(bh[bh.length - 1]?.captured ? "capture" : "move");
        setFen(e.fen());
        setMoves((mv) => [...mv, `${m.from}:${m.to}`]);
        setLastMove({ from: m.from, to: m.to });
      }
      setThinking(false);
      checkOver();
    }, 350);
    return true;
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable style={styles.circle} onPress={() => router.back()} hitSlop={8}>
          <View style={{ transform: [{ rotate: "180deg" }] }}><Icon name="chevronRight" size={20} color={colors.ink} /></View>
        </Pressable>
        <Text style={styles.title} numberOfLines={1}>vs {bot.emoji} {bot.name} · {elo}</Text>
        <Pressable style={styles.circle} onPress={() => setFlipped((f) => !f)} hitSlop={8}><Icon name="flip" size={18} color={colors.ink} /></Pressable>
        <Pressable style={styles.resign} onPress={() => { if (!over) { setOver(`Resigned — ${bot.name} wins`); void saveGame(moves, "loss", elo); } }}>
          <Text style={styles.resignText}>Resign</Text>
        </Pressable>
      </View>

      {/* Bot tip bubble */}
      <View style={styles.coach}>
        <Text style={{ fontSize: 30 }}>{bot.emoji}</Text>
        <View style={styles.bubble}>
          <Text style={styles.bubbleText}>
            {bot.name}: {over ?? (thinking ? "Thinking…" : moves.length === 0 ? `Hi! I'm rated ${elo}. Good luck!` : "Your move")}
          </Text>
        </View>
      </View>

      {/* Board + bars, vertically centered in the remaining space */}
      <View style={{ flex: 1, justifyContent: "center" }}>
        <PlayerBar name={`${bot.name} · ${elo}`} emoji={bot.emoji} advantage={Math.max(0, mat.b - mat.w)} active={thinking && !over} />

        <View style={{ alignItems: "center", marginVertical: space[2] }}>
          <ChessBoard
            fen={shownFen}
            size={boardSize}
            orientation={flipped ? "black" : "white"}
            onMove={handleMove}
            interactive={!over && !thinking && !viewing}
            lastMove={viewing ? null : lastMove}
          />
        </View>

        <PlayerBar name="You" emoji={avatar || "🎓"} advantage={Math.max(0, mat.w - mat.b)} active={!thinking && !over && !viewing} />
      </View>

      {/* Rewind / forward scrubber */}
      <View style={styles.scrubber}>
        <Pressable style={styles.scrubBtn} onPress={() => setViewPly((v) => Math.max(0, (v ?? frames.length - 1) - 1))}>
          <Text style={styles.scrubIcon}>⏪</Text>
        </Pressable>
        <Text style={styles.scrubLabel}>{viewing ? `move ${viewPly}/${frames.length - 1}` : "● live"}</Text>
        <Pressable style={styles.scrubBtn} onPress={() => setViewPly((v) => { if (v === null) return null; const n = v + 1; return n >= frames.length - 1 ? null : n; })}>
          <Text style={styles.scrubIcon}>⏩</Text>
        </Pressable>
        {over && (
          <Pressable style={[styles.scrubBtn, { width: "auto", paddingHorizontal: space[4] }]} onPress={reset}>
            <Text style={styles.scrubLabel}>New game</Text>
          </Pressable>
        )}
      </View>
    </SafeAreaView>
  );
}

const CIRCLE = 40;
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface },
  header: { flexDirection: "row", alignItems: "center", gap: space[2], paddingHorizontal: space[4], paddingTop: 6 },
  circle: { width: CIRCLE, height: CIRCLE, borderRadius: CIRCLE / 2, backgroundColor: colors.surfaceCard, justifyContent: "center", alignItems: "center", borderWidth: 1, borderColor: colors.hairline },
  title: { flex: 1, ...type.base, fontFamily: font.bold, color: colors.ink },
  resign: { borderRadius: radius.md, backgroundColor: colors.danger, paddingHorizontal: space[3], paddingVertical: 8 },
  resignText: { ...type.xs, fontFamily: font.bold, color: "#fff" },
  playerBar: { flexDirection: "row", alignItems: "center", gap: space[2], marginHorizontal: space[4], paddingHorizontal: space[3], paddingVertical: space[2], borderRadius: radius.md, borderWidth: 1, borderColor: "transparent" },
  playerBarActive: { backgroundColor: colors.surfaceCard, borderColor: colors.brand100, ...shadowCard },
  turnDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.success },
  playerEmoji: { fontSize: 22 },
  playerName: { flex: 1, ...type.sm, fontFamily: font.bold, color: colors.ink },
  advantage: { ...type.sm, fontFamily: font.bold, color: colors.ink500 },
  coach: { flexDirection: "row", alignItems: "center", gap: space[3], paddingHorizontal: space[4], marginTop: space[2] },
  bubble: { flex: 1, backgroundColor: colors.surfaceCard, borderRadius: radius.card, borderBottomLeftRadius: 4, paddingHorizontal: space[4], paddingVertical: space[3], borderWidth: 1, borderColor: colors.hairline, ...shadowCard },
  bubbleText: { ...type.base, fontFamily: font.semibold, color: colors.ink },
  scrubber: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: space[3], marginTop: space[3] },
  scrubBtn: { minWidth: 56, height: 40, borderRadius: radius.md, backgroundColor: colors.surfaceCard, justifyContent: "center", alignItems: "center", borderWidth: 1, borderColor: colors.hairline },
  scrubIcon: { fontSize: 16, color: colors.ink },
  scrubLabel: { minWidth: 88, textAlign: "center", ...type.xs, fontFamily: font.bold, color: colors.ink500 },
});

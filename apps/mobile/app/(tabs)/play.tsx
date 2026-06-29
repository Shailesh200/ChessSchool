import { useRef, useState } from "react";
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ChessEngine, getBotMove, eloToConfig } from "@chess-school/core";
import { ChessBoard } from "@/ChessBoard";
import { Cody, type CodyExpression } from "@/Cody";
import { Button } from "@/Button";
import { haptics } from "@/haptics";
import { sfx } from "@/sfx";
import { api } from "@/api";
import { colors, font, radius } from "@/theme";

async function saveGame(moves: string[], result: "win" | "loss" | "draw", elo: number) {
  try {
    const cur = await api<Record<string, unknown>>("/api/progress");
    const { user: _u, ...snap } = cur as { user?: unknown } & Record<string, unknown>;
    const games = [{ moves, result, elo, at: Date.now() }, ...((snap.recentGames as unknown[]) ?? [])].slice(0, 20);
    await api("/api/progress", { method: "POST", body: { ...snap, recentGames: games } });
  } catch {
    /* ignore */
  }
}

const ELOS = [600, 1000, 1400, 1800];

export default function PlayScreen() {
  const { width } = useWindowDimensions();
  const boardSize = Math.min(width - 32, 440);
  const engineRef = useRef(new ChessEngine());
  const [fen, setFen] = useState(engineRef.current.fen());
  const [lastMove, setLastMove] = useState<{ from: string; to: string } | null>(null);
  const [thinking, setThinking] = useState(false);
  const [over, setOver] = useState<string | null>(null);
  const [elo, setElo] = useState(1000);
  const [mood, setMood] = useState<CodyExpression>("happy");

  function reset(newElo = elo) {
    engineRef.current = new ChessEngine();
    setFen(engineRef.current.fen());
    setLastMove(null);
    setOver(null);
    setThinking(false);
    setMood("happy");
    setElo(newElo);
  }

  function checkOver(): boolean {
    const e = engineRef.current;
    if (!e.isGameOver()) return false;
    const status = e.status();
    const moves = e.history().map((m) => `${m.from}:${m.to}`);
    if (status === "checkmate") {
      const youWon = e.turn() === "b"; // side to move is mated
      setOver(youWon ? "Checkmate — you win! 🏆" : "Checkmate — bot wins");
      setMood(youWon ? "cheer" : "sad");
      youWon ? haptics.success() : haptics.error();
      youWon ? sfx.play("win") : sfx.play("error");
      void saveGame(moves, youWon ? "win" : "loss", elo);
    } else {
      setOver("Draw");
      setMood("happy");
      void saveGame(moves, "draw", elo);
    }
    return true;
  }

  function handleMove(from: string, to: string): boolean {
    const e = engineRef.current;
    if (over || thinking || e.turn() !== "w") return false;
    const applied = e.move({ from, to, promotion: "q" });
    if (!applied) return false;
    haptics.tap();
    const h = e.history();
    sfx.play(h[h.length - 1]?.captured ? "capture" : "move");
    setFen(e.fen());
    setLastMove({ from, to });
    setMood("think");
    if (checkOver()) return true;

    setThinking(true);
    setTimeout(async () => {
      const mv = await getBotMove(e.fen(), eloToConfig(elo), Math.random());
      if (mv) {
        e.move(mv);
        const bh = e.history();
        sfx.play(bh[bh.length - 1]?.captured ? "capture" : "move");
        setFen(e.fen());
        setLastMove({ from: mv.from, to: mv.to });
      }
      setThinking(false);
      if (!checkOver()) setMood("happy");
    }, 350);
    return true;
  }

  const status = over ?? (thinking ? "Bot is thinking…" : engineRef.current.turn() === "w" ? "Your move" : "");

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <Cody expression={mood} size={56} />
        <View style={{ flex: 1, marginLeft: 8 }}>
          <Text style={styles.title}>Play vs Bot</Text>
          <Text style={styles.status}>{status}</Text>
        </View>
      </View>

      <View style={styles.elos}>
        {ELOS.map((e) => (
          <Pressable key={e} onPress={() => reset(e)} style={[styles.elo, e === elo && styles.eloOn]}>
            <Text style={[styles.eloText, e === elo && styles.eloTextOn]}>{e}</Text>
          </Pressable>
        ))}
      </View>

      <View style={{ alignItems: "center", marginTop: 8 }}>
        <ChessBoard
          fen={fen}
          size={boardSize}
          onMove={handleMove}
          interactive={!over && !thinking}
          lastMove={lastMove}
        />
      </View>

      <View style={{ marginTop: 18, width: 220, alignSelf: "center" }}>
        <Button label={over ? "New game" : "Restart"} onPress={() => reset()} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingTop: 6 },
  title: { fontSize: 20, fontFamily: font.bold, color: colors.ink },
  status: { fontSize: 14, fontFamily: font.semibold, color: colors.ink500, marginTop: 1 },
  elos: { flexDirection: "row", gap: 8, justifyContent: "center", marginTop: 10 },
  elo: { paddingHorizontal: 16, paddingVertical: 7, borderRadius: radius.pill, backgroundColor: colors.surfaceSunken },
  eloOn: { backgroundColor: colors.brand },
  eloText: { fontFamily: font.bold, color: colors.ink500, fontSize: 13 },
  eloTextOn: { color: "#fff" },
});

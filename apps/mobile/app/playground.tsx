import { useCallback, useMemo, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View } from "react-native";
import { useRouter } from "expo-router";
import { ChessEngine } from "@chess-school/core";
import { useAuth } from "@/auth";
import { AppShell } from "@/AppShell";
import { BackButton } from "@/BackButton";
import { Button } from "@/Button";
import { ChessBoard, type Arrow } from "@/ChessBoard";
import { haptics } from "@/haptics";
import { sfx } from "@/sfx";
import { toast } from "@/toast";
import { useAppTheme } from "@/ThemeProvider";
import { font, radius, shadowCard, space, type } from "@/theme";

const START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

function hintArrow(fen: string): Arrow | null {
  const e = new ChessEngine(fen);
  const moves = e.legalMoves();
  if (!moves.length) return null;
  const m = moves[0]!;
  return { startSquare: m.from, endSquare: m.to, color: "#5b5bd6" };
}

export default function PlaygroundScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { colors } = useAppTheme();
  const { width } = useWindowDimensions();
  const boardSize = Math.min(width - 24, 460);
  const engineRef = useRef(new ChessEngine());
  const [fen, setFen] = useState(START_FEN);
  const [flip, setFlip] = useState(false);
  const [lastMove, setLastMove] = useState<{ from: string; to: string } | null>(null);
  const [arrows, setArrows] = useState<Arrow[]>([]);
  const [fenInput, setFenInput] = useState("");
  const [msg, setMsg] = useState("Free play — move any piece, any side.");

  const styles = useMemo(
    () =>
      StyleSheet.create({
        content: { padding: space[5], paddingBottom: 100, gap: space[4] },
        h1: { ...type.xl, fontFamily: font.bold, color: colors.ink },
        sub: { ...type.sm, fontFamily: font.semibold, color: colors.ink500 },
        msg: { ...type.sm, fontFamily: font.bold, color: colors.ink, textAlign: "center" },
        row: { flexDirection: "row", flexWrap: "wrap", gap: space[2] },
        input: {
          borderWidth: 1,
          borderColor: colors.hairline,
          borderRadius: radius.md,
          paddingHorizontal: space[3],
          paddingVertical: space[2],
          fontFamily: font.medium,
          color: colors.ink,
          backgroundColor: colors.surfaceCard,
        },
        fenBox: { backgroundColor: colors.surfaceSunken, borderRadius: radius.md, padding: space[3] },
        fenText: { ...type.xs, fontFamily: font.semibold, color: colors.ink500 },
      }),
    [colors],
  );

  const handleMove = useCallback((from: string, to: string, promotion: "q" | "r" | "b" | "n" = "q"): boolean => {
    const applied = engineRef.current.move({ from, to, promotion });
    if (!applied) return false;
    setFen(engineRef.current.fen());
    setLastMove({ from, to });
    setArrows([]);
    sfx.play(applied.captured ? "capture" : "move");
    haptics.tap();
    setMsg(
      engineRef.current.isGameOver()
        ? "Game over — reset to keep exploring."
        : `${engineRef.current.turn() === "w" ? "White" : "Black"} to move`,
    );
    return true;
  }, []);

  if (user?.role !== "admin") {
    return (
      <AppShell>
        <View style={[styles.content, { flex: 1, justifyContent: "center", alignItems: "center" }]}>
          <Text style={styles.h1}>Admin only</Text>
          <Text style={styles.sub}>The playground is for curriculum admins.</Text>
          <Button label="Back to academy" onPress={() => router.replace("/(tabs)/academy")} />
        </View>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <ScrollView contentContainerStyle={styles.content}>
        <BackButton />
        <Text style={styles.h1}>Playground</Text>
        <Text style={styles.sub}>Free analysis board — load FEN, undo, flip, hint.</Text>
        <Text style={styles.msg}>{msg}</Text>

        <View style={{ alignItems: "center" }}>
          <ChessBoard
            fen={fen}
            size={boardSize}
            orientation={flip ? "black" : "white"}
            onMove={handleMove}
            lastMove={lastMove}
            arrows={arrows}
          />
        </View>

        <View style={styles.row}>
          <Button label="Undo" variant="outline" size="sm" onPress={() => { engineRef.current.undo(); setFen(engineRef.current.fen()); setLastMove(null); setArrows([]); }} />
          <Button label="Flip" variant="outline" size="sm" onPress={() => setFlip((f) => !f)} />
          <Button label="Hint" variant="outline" size="sm" onPress={() => { const a = hintArrow(engineRef.current.fen()); if (a) { setArrows([a]); sfx.play("notify"); } }} />
          <Button label="Reset" variant="outline" size="sm" onPress={() => { engineRef.current = new ChessEngine(); setFen(START_FEN); setLastMove(null); setArrows([]); setMsg("Fresh board."); sfx.play("transition"); }} />
        </View>

        <View style={styles.fenBox}>
          <Text style={styles.fenText} selectable>
            {fen}
          </Text>
        </View>

        <TextInput
          style={styles.input}
          placeholder="Paste FEN to load…"
          placeholderTextColor={colors.ink300}
          value={fenInput}
          onChangeText={setFenInput}
        />
        <View style={styles.row}>
          <Button
            label="Load FEN"
            size="sm"
            onPress={() => {
              try {
                engineRef.current = new ChessEngine(fenInput.trim());
                setFen(engineRef.current.fen());
                setLastMove(null);
                setArrows([]);
                setMsg("FEN loaded.");
                toast("Position loaded", { tone: "success" });
              } catch {
                toast("Invalid FEN", { tone: "danger" });
              }
            }}
          />
          <Button
            label="Copy FEN"
            variant="outline"
            size="sm"
            onPress={() => {
              toast("FEN copied", { description: fen.slice(0, 40) + "…", tone: "success" });
            }}
          />
        </View>
      </ScrollView>
    </AppShell>
  );
}

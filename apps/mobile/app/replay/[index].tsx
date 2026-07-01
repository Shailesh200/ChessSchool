import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ChessEngine } from "@chess-school/core";
import { ChessBoard, type Arrow } from "@/ChessBoard";
import { api } from "@/api";
import { FetchErrorView } from "@/FetchErrorView";
import { movesFromSyncGame, normalizeSyncGame, type SyncGame } from "@/progression";
import { colors, font, radius, shadowCard, space, type } from "@/theme";

type Game = SyncGame;
type Frame = { fen: string; last: { from: string; to: string } | null; check: boolean; mate: boolean };
type Cell = { type: string; color: "w" | "b" } | null;
type MateInfo = {
  kingSquare: string;
  attackers: string[];
  covered: { square: string; reason: "attacked" | "blocked" }[];
  pattern: "back-rank" | "diagonal" | "general";
};

function buildFrames(moves: string[]): Frame[] {
  const e = new ChessEngine();
  const frames: Frame[] = [{ fen: e.fen(), last: null, check: false, mate: false }];
  for (const mv of moves) {
    const [from, to] = mv.split(":");
    if (!e.move({ from: from!, to: to!, promotion: "q" })) break;
    frames.push({ fen: e.fen(), last: { from: from!, to: to! }, check: e.inCheck(), mate: e.status() === "checkmate" });
  }
  return frames;
}

function fenBoard(fen: string): Cell[][] {
  return fen.split(" ")[0]!.split("/").map((row) => {
    const cells: Cell[] = [];
    for (const ch of row) {
      if (/\d/.test(ch)) for (let i = 0; i < Number(ch); i++) cells.push(null);
      else cells.push({ type: ch.toLowerCase(), color: ch === ch.toLowerCase() ? "b" : "w" });
    }
    return cells;
  });
}
const FILES = "abcdefgh";
function toRC(square: string) {
  return { row: 8 - Number(square[1]), col: FILES.indexOf(square[0]!) };
}
function toSq(row: number, col: number) {
  return `${FILES[col]}${8 - row}`;
}
function getCell(board: Cell[][], square: string): Cell {
  const { row, col } = toRC(square);
  return board[row]?.[col] ?? null;
}
function inBounds(row: number, col: number) {
  return row >= 0 && row < 8 && col >= 0 && col < 8;
}
function isAttacked(board: Cell[][], square: string, by: "w" | "b"): boolean {
  return attackersOf(board, square, by).length > 0;
}
function attackersOf(board: Cell[][], square: string, by: "w" | "b"): string[] {
  const { row, col } = toRC(square);
  const out: string[] = [];
  const pawnDir = by === "w" ? 1 : -1;
  for (const dc of [-1, 1]) {
    const r = row + pawnDir;
    const c = col + dc;
    if (inBounds(r, c) && board[r]![c]?.color === by && board[r]![c]?.type === "p") out.push(toSq(r, c));
  }
  for (const [dr, dc] of [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]]) {
    const r = row + dr;
    const c = col + dc;
    if (inBounds(r, c) && board[r]![c]?.color === by && board[r]![c]?.type === "n") out.push(toSq(r, c));
  }
  const rays: Array<[number, number, string[]]> = [[-1, 0, ["r", "q"]], [1, 0, ["r", "q"]], [0, -1, ["r", "q"]], [0, 1, ["r", "q"]], [-1, -1, ["b", "q"]], [-1, 1, ["b", "q"]], [1, -1, ["b", "q"]], [1, 1, ["b", "q"]]];
  for (const [dr, dc, types] of rays) {
    let r = row + dr;
    let c = col + dc;
    while (inBounds(r, c)) {
      const cell = board[r]![c];
      if (cell) {
        if (cell.color === by && types.includes(cell.type)) out.push(toSq(r, c));
        break;
      }
      r += dr;
      c += dc;
    }
  }
  for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
    if (dr === 0 && dc === 0) continue;
    const r = row + dr;
    const c = col + dc;
    if (inBounds(r, c) && board[r]![c]?.color === by && board[r]![c]?.type === "k") out.push(toSq(r, c));
  }
  return out;
}
function analyzeMate(fen: string): MateInfo | null {
  const engine = new ChessEngine(fen);
  if (engine.status() !== "checkmate") return null;
  const mated = engine.turn();
  const enemy = mated === "w" ? "b" : "w";
  const board = fenBoard(fen);
  const kingSquare = engine.kingSquare(mated);
  if (!kingSquare) return null;
  const attackers = attackersOf(board, kingSquare, enemy);
  const { row, col } = toRC(kingSquare);
  const covered: MateInfo["covered"] = [];
  for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
    if (dr === 0 && dc === 0) continue;
    const r = row + dr;
    const c = col + dc;
    if (!inBounds(r, c)) continue;
    const square = toSq(r, c);
    const occupant = getCell(board, square);
    if (occupant?.color === mated) covered.push({ square, reason: "blocked" });
    else if (isAttacked(board, square, enemy)) covered.push({ square, reason: "attacked" });
  }
  const kingRank = Number(kingSquare[1]);
  const ownBackRank = mated === "w" ? 1 : 8;
  let pattern: MateInfo["pattern"] = "general";
  for (const sq of attackers) {
    const piece = getCell(board, sq);
    const sameRank = Number(sq[1]) === kingRank;
    const onDiagonal = Math.abs(FILES.indexOf(sq[0]!) - FILES.indexOf(kingSquare[0]!)) === Math.abs(Number(sq[1]) - kingRank);
    if ((piece?.type === "r" || piece?.type === "q") && sameRank && kingRank === ownBackRank) {
      pattern = "back-rank";
      break;
    }
    if ((piece?.type === "b" || piece?.type === "q") && onDiagonal) pattern = "diagonal";
  }
  return { kingSquare, attackers, covered, pattern };
}

export default function ReplayScreen() {
  const { index } = useLocalSearchParams<{ index: string }>();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const boardSize = Math.min(width - 32, 440);
  const [game, setGame] = useState<Game | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [ply, setPly] = useState(0);

  async function loadGame() {
    setLoadError(false);
    setLoading(true);
    try {
      const d = await api<{ recentGames: unknown[] }>("/api/progress");
      const raw = d.recentGames?.[Number(index)];
      setGame(raw ? normalizeSyncGame(raw) : null);
    } catch {
      setLoadError(true);
      setGame(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadGame();
  }, [index]);

  const frames = useMemo(() => (game ? buildFrames(movesFromSyncGame(game)) : []), [game]);

  if (loadError) {
    return (
      <SafeAreaView style={styles.safe}>
        <FetchErrorView title="Replay couldn't load" onRetry={loadGame} onBack={() => router.back()} />
      </SafeAreaView>
    );
  }

  if (loading || !game) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <ActivityIndicator color={colors.brand} size="large" />
        </View>
      </SafeAreaView>
    );
  }

  const frame = frames[ply] ?? frames[0]!;
  const mate = frame.mate ? analyzeMate(frame.fen) : null;
  const arrows: Arrow[] = mate ? mate.attackers.map((startSquare) => ({ startSquare, endSquare: mate.kingSquare, color: colors.danger })) : [];
  const preventionTip =
    mate?.pattern === "back-rank"
      ? "It's a back-rank mate. Make luft earlier with a quiet pawn move so the king has air."
      : mate?.pattern === "diagonal"
        ? "A diagonal mate. Keep the squares around your king defended before opening pawn lines."
        : "Spot the attacker one move earlier: make an escape square, block the check, or trade the attacker.";

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Text style={styles.close}>✕</Text>
        </Pressable>
        <Text style={styles.h1}>Replay · vs {game.elo}</Text>
      </View>

      <View style={{ alignItems: "center", marginTop: 10 }}>
        <ChessBoard
          fen={frame.fen}
          size={boardSize}
          interactive={false}
          lastMove={frame.last}
          arrows={arrows}
          highlights={mate?.covered.map((c) => c.square)}
          checkSquare={mate?.kingSquare ?? null}
        />
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

      <Text style={styles.moveLabel}>
        {ply === 0 ? "Starting position" : `Move ${Math.ceil(ply / 2)}${frame.check && !frame.mate ? " +" : ""}${frame.mate ? " #" : ""}`}
      </Text>

      {mate && (
        <View style={styles.mateCard}>
          <Text style={styles.mateTitle}>How the checkmate happened</Text>
          <Text style={styles.mateLine}>👑 The king on {mate.kingSquare} is in check and cannot move.</Text>
          <Text style={styles.mateLine}>🎯 Delivered by {mate.attackers.length > 1 ? "pieces on" : "the piece on"} {mate.attackers.join(", ")}.</Text>
          <Text style={styles.mateLine}>🚫 Escape squares are covered or blocked by the outlined squares.</Text>
          <Text style={styles.tip}>💡 {preventionTip}</Text>
        </View>
      )}
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
  moveLabel: { ...type.sm, fontFamily: font.bold, color: colors.ink, textAlign: "center", marginTop: space[3] },
  mateCard: { margin: space[4], borderRadius: radius.card, borderWidth: 1, borderColor: "rgba(244,63,94,0.4)", backgroundColor: "rgba(244,63,94,0.06)", padding: space[4], ...shadowCard },
  mateTitle: { ...type.sm, fontFamily: font.bold, color: colors.danger, marginBottom: space[2] },
  mateLine: { ...type.xs, fontFamily: font.semibold, color: colors.ink700, lineHeight: 18 },
  tip: { ...type.xs, fontFamily: font.bold, color: colors.ink, lineHeight: 18, backgroundColor: colors.surfaceSunken, borderRadius: radius.md, padding: space[2], marginTop: space[2] },
});

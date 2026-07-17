import { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { ChessEngine, getBotMove, eloToConfig } from "@chess-school/core";
import { ChessBoard } from "@/ChessBoard";
import { GameOverOverlay } from "@/GameOverOverlay";
import { Icon } from "@/Icon";
import { haptics } from "@/haptics";
import { sfx } from "@/sfx";
import { mutateProgress } from "@/progressStore";
import { buildSyncGame, endReasonFromStatus } from "@/gameHistory";
import { prependRecentGame, isoDay, type EndReason } from "@/progression";
import { markHomeworkActivity } from "@/homeworkRoutine";
import { opponentMoves, type Color } from "@/shadow";
import {
  clearBotMatch,
  finishBotMatch,
  getActiveMatch,
  hydrateMatchStore,
  setMatchEndSnapshot,
  syncBotMatch,
} from "@/matchStore";
import { useAppTheme } from "@/ThemeProvider";
import { font, radius, shadowCard, space, type } from "@/theme";

export default function ShadowGameScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { colors } = useAppTheme();
  const boardSize = Math.min(width - 16, 470);
  const engineRef = useRef(new ChessEngine());
  const shadowLineRef = useRef<{ from: string; to: string; promotion?: "q" | "r" | "b" | "n" }[]>([]);
  const [ready, setReady] = useState(false);
  const [fen, setFen] = useState(engineRef.current.fen());
  const [lastMove, setLastMove] = useState<{ from: string; to: string } | null>(null);
  const [thinking, setThinking] = useState(false);
  const [coach, setCoach] = useState("");
  const [shadowOffBook, setShadowOffBook] = useState(false);
  const [over, setOver] = useState<{ title: string; win: boolean; gameId: string } | null>(null);
  const gameIdRef = useRef(`g${Date.now()}`);

  const match = getActiveMatch();
  const shadow = match?.shadow;
  const playerColor: Color = shadow?.playerColor ?? "w";

  const styles = useMemo(
    () =>
      StyleSheet.create({
        safe: { flex: 1, backgroundColor: colors.surface },
        header: { flexDirection: "row", alignItems: "center", paddingHorizontal: space[4], paddingTop: 6, gap: space[2] },
        title: { ...type.base, fontFamily: font.bold, color: colors.ink, flex: 1 },
        boardWrap: { alignItems: "center", marginTop: space[2] },
        bubble: {
          marginHorizontal: space[4],
          marginTop: space[3],
          backgroundColor: colors.surfaceCard,
          borderRadius: radius.card,
          padding: space[4],
          borderWidth: 1,
          borderColor: colors.hairline,
          ...shadowCard,
        },
        bubbleLabel: { ...type.caption, fontFamily: font.bold, color: colors.ink500, textTransform: "uppercase" },
        bubbleText: { ...type.sm, fontFamily: font.semibold, color: colors.ink, marginTop: 4, lineHeight: 20 },
      }),
    [colors],
  );

  useEffect(() => {
    void hydrateMatchStore().then(() => {
      const m = getActiveMatch();
      if (!m?.shadow) {
        router.replace("/play/shadow");
        return;
      }
      engineRef.current = new ChessEngine();
      shadowLineRef.current = opponentMoves(m.shadow.pgn, m.shadow.playerColor);
      if (m.moves.length) {
        engineRef.current = new ChessEngine(m.fen);
      }
      setFen(engineRef.current.fen());
      setCoach(
        m.shadow.flipped
          ? `You're in ${m.shadow.opponentName}'s chair — defend against your old attack.`
          : `Shadow rematch vs ${m.shadow.opponentName} — try a fresh idea on the same line.`,
      );
      gameIdRef.current = m.matchId;
      setReady(true);
      if (engineRef.current.turn() !== m.shadow.playerColor) runShadow();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function persistMove(from: string, to: string) {
    const e = engineRef.current;
    const moves = e.history().map((m) => `${m.from}:${m.to}`);
    syncBotMatch({ fen: e.fen(), moves });
    setFen(e.fen());
    setLastMove({ from, to });
  }

  function checkOver(): boolean {
    const e = engineRef.current;
    if (!e.isGameOver()) return false;
    const status = e.status();
    const winner = status === "checkmate" ? (e.turn() === "w" ? "b" : "w") : null;
    const playerWon = winner === playerColor;
    const title =
      status === "checkmate"
        ? playerWon
          ? "Checkmate — you win! 🏆"
          : `Checkmate — ${shadow?.opponentName ?? "Shadow"} wins`
        : "Draw";
    playerWon ? haptics.success() : haptics.error();
    playerWon ? sfx.play("win") : sfx.play("error");
    void endGame(title, playerWon, endReasonFromStatus(status));
    return true;
  }

  async function endGame(title: string, win: boolean, endReason: EndReason) {
    const e = engineRef.current;
    const game = buildSyncGame({
      engine: e,
      id: gameIdRef.current,
      mode: "shadow",
      createdAt: match?.createdAt ?? Date.now(),
      whiteName: playerColor === "w" ? "You" : shadow!.opponentName,
      blackName: playerColor === "b" ? "You" : shadow!.opponentName,
      elo: null,
      endReason,
      winner: win ? playerColor : playerColor === "w" ? "b" : "w",
      playerResult: win ? "win" : endReason === "draw" ? "draw" : "loss",
    });
    try {
      await mutateProgress((snap) => {
        const next = {
          ...snap,
          recentGames: prependRecentGame((snap.recentGames as unknown[]) ?? [], game),
        };
        return markHomeworkActivity(next, "match", isoDay());
      });
    } catch {
      /* guest */
    }
    setMatchEndSnapshot({ title, win, ratingDelta: 0, newRating: 0, gameId: gameIdRef.current });
    finishBotMatch();
    setOver({ title, win, gameId: gameIdRef.current });
  }

  function runBotFallback() {
    setShadowOffBook(true);
    setCoach("You left the book — shadow can't follow. Finishing solo.");
    const e = engineRef.current;
    if (e.isGameOver() || e.turn() === playerColor) {
      setThinking(false);
      return;
    }
    setThinking(true);
    setTimeout(async () => {
      const m = await getBotMove(e.fen(), eloToConfig(1200), Math.random());
      if (m && e.move(m as never)) {
        const h = e.history();
        const botMove = h[h.length - 1]!;
        sfx.play(botMove.captured ? "capture" : "move");
        if (e.inCheck()) sfx.play("check");
        persistMove(m.from, m.to);
        setCoach(`${shadow?.opponentName ?? "Bot"} plays ${botMove.san}.`);
      }
      setThinking(false);
      checkOver();
    }, 400);
  }

  function runShadow() {
    if (!shadow || shadowOffBook) {
      runBotFallback();
      return;
    }
    const e = engineRef.current;
    if (e.isGameOver() || e.turn() === playerColor) return;
    setThinking(true);
    const oppIdx = e.history().filter((m) => m.color !== playerColor).length;
    const move = shadowLineRef.current[oppIdx];
    setTimeout(() => {
      if (!move) {
        runBotFallback();
        return;
      }
      const applied = e.move(move);
      if (!applied) {
        runBotFallback();
        return;
      }
      sfx.play(applied.captured ? "capture" : "move");
      if (e.inCheck()) sfx.play("check");
      persistMove(move.from, move.to);
      setCoach(`${shadow.opponentName} plays ${applied.san} — just like last time.`);
      setThinking(false);
      checkOver();
    }, 650);
  }

  function handleMove(from: string, to: string, promotion: "q" | "r" | "b" | "n" = "q"): boolean {
    if (over || thinking || engineRef.current.turn() !== playerColor) return false;
    const e = engineRef.current;
    const applied = e.move({ from, to, promotion });
    if (!applied) return false;
    haptics.tap();
    sfx.play(applied.captured ? "capture" : "move");
    if (e.inCheck()) sfx.play("check");
    persistMove(from, to);
    if (checkOver()) return true;
    runShadow();
    return true;
  }

  if (!ready || !shadow) return null;

  const orientation = playerColor === "b" ? "black" : "white";
  const checkSquare = (() => {
    const v = new ChessEngine(fen);
    return v.inCheck() ? v.kingSquare(v.turn()) : null;
  })();

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={8} style={{ transform: [{ rotate: "180deg" }] }}>
          <Icon name="chevronRight" size={20} color={colors.ink} />
        </Pressable>
        <Text style={styles.title}>Shadow vs {shadow.opponentName}</Text>
      </View>

      <View style={styles.boardWrap}>
        <ChessBoard
          fen={fen}
          size={boardSize}
          orientation={orientation}
          onMove={handleMove}
          interactive={!over && !thinking}
          lastMove={lastMove}
          checkSquare={checkSquare}
        />
      </View>

      <View style={styles.bubble}>
        <Text style={styles.bubbleLabel}>Coach</Text>
        <Text style={styles.bubbleText}>{thinking ? "Shadow is moving…" : coach}</Text>
      </View>

      {over && (
        <GameOverOverlay
          visible
          title={over.title}
          win={over.win}
          onNewGame={() => {
            clearBotMatch();
            router.push("/play/shadow");
          }}
          onExit={() => {
            clearBotMatch();
            router.replace("/(tabs)/play");
          }}
          exitLabel="Back to play"
        />
      )}
    </SafeAreaView>
  );
}

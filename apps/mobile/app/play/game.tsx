import { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ChessEngine, getBotMove, eloToConfig, type VerboseMove } from "@chess-school/core";
import { ChessBoard } from "@/ChessBoard";
import { ConfirmDialog } from "@/ConfirmDialog";
import { GameOverOverlay } from "@/GameOverOverlay";
import { ReflectSheet } from "@/ReflectSheet";
import { Icon } from "@/Icon";
import { haptics } from "@/haptics";
import { sfx } from "@/sfx";
import { mutateProgress } from "@/progressStore";
import { material, clock as fmtClock } from "@/chess-utils";
import { stockfishAvailable, nativeBestMove } from "@/stockfish";
import { applyMatchEnd, prependRecentGame, isoDay, type EndReason } from "@/progression";
import { markHomeworkActivity } from "@/homeworkRoutine";
import { buildSyncGame, winnerFromPlayerResult, endReasonFromStatus } from "@/gameHistory";
import { useSettings } from "@/settings";
import { parseTimeControl, useChessClock } from "@/useChessClock";
import {
  canResumeBotMatch,
  clearBotMatch,
  finishBotMatch,
  getActiveBotMatch,
  getActiveMatch,
  hydrateMatchStore,
  startBotMatch,
  syncBotMatch,
} from "@/matchStore";
import { completeArenaIfDone, hydrateArenaStore, recordArenaResult } from "@/arenaStore";
import { botProfile } from "@/bots";
import { MateReviewModal } from "@/MateReviewModal";
import { BotAvatar } from "@/BotAvatar";
import { FlatAvatar } from "@/flatAvatars/FlatAvatar";
import { resolveAvatar } from "@/iconMaps";
import { coachGreeting, commentOnMove, normalizeCoachPersonality } from "@/matchCoach";
import { useCoachSpeech } from "@/useCoachSpeech";
import { colors, font, radius, shadowCard, space, type } from "@/theme";

type OverState = {
  title: string;
  subtitle?: string;
  win: boolean;
  ratingDelta: number;
  newRating: number;
  gameId: string;
};

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

function PlayerBar({
  name,
  botElo,
  avatarId,
  advantage,
  active,
  clockMs,
}: {
  name: string;
  botElo?: number;
  avatarId?: string;
  advantage: number;
  active?: boolean;
  clockMs?: number;
}) {
  return (
    <View style={[styles.playerBar, active && styles.playerBarActive]}>
      {botElo !== undefined ? (
        <BotAvatar elo={botElo} size={32} />
      ) : (
        <View style={styles.userAvatar}>
          <FlatAvatar id={resolveAvatar(avatarId)} size={32} />
        </View>
      )}
      <Text style={styles.playerName} numberOfLines={1}>{name}</Text>
      {active && <View style={styles.turnDot} />}
      {advantage > 0 && <Text style={styles.advantage}>+{advantage}</Text>}
      {clockMs !== undefined && <Text style={[styles.clock, active && styles.clockActive]}>{fmtClock(clockMs)}</Text>}
    </View>
  );
}

export default function GameScreen() {
  const router = useRouter();
  const { elo: eloParam, time: timeParam, arena: arenaParam } = useLocalSearchParams<{ elo: string; time?: string; arena?: string }>();
  const elo = Number(eloParam) || 1000;
  const timeMs = parseTimeControl(timeParam);
  const timeControlMin = timeMs > 0 ? Math.round(timeMs / 60_000) : 0;
  const bot = botProfile(elo);
  const { avatar, coachPersonality } = useSettings();
  const personality = normalizeCoachPersonality(coachPersonality);
  const { width } = useWindowDimensions();
  const boardSize = Math.min(width - 24, 440);
  const engineRef = useRef(new ChessEngine());
  const gameIdRef = useRef(`g${Date.now()}`);
  const createdAtRef = useRef(Date.now());
  const [fen, setFen] = useState(engineRef.current.fen());
  const [moves, setMoves] = useState<string[]>([]);
  const [viewPly, setViewPly] = useState<number | null>(null);
  const [lastMove, setLastMove] = useState<{ from: string; to: string } | null>(null);
  const [thinking, setThinking] = useState(false);
  const [over, setOver] = useState<OverState | null>(null);
  const [reflectOpen, setReflectOpen] = useState(false);
  const [resignOpen, setResignOpen] = useState(false);
  const [flipped, setFlipped] = useState(false);
  const [coachText, setCoachText] = useState("");
  const [mateReviewOpen, setMateReviewOpen] = useState(false);
  const [mateReviewHistory, setMateReviewHistory] = useState<VerboseMove[]>([]);
  const [clockSeed, setClockSeed] = useState({ w: timeMs, b: timeMs });
  const flaggedRef = useRef(false);

  useEffect(() => {
    void (async () => {
      await Promise.all([hydrateMatchStore(), hydrateArenaStore()]);
      const saved = getActiveMatch();
      if (saved && !saved.finished && (canResumeBotMatch(elo, timeControlMin) || (arenaParam === "1" && saved.arena))) {
        engineRef.current = new ChessEngine(saved.fen);
        gameIdRef.current = saved.matchId;
        createdAtRef.current = saved.createdAt;
        setFen(saved.fen);
        setMoves(saved.moves);
        setClockSeed({ w: saved.whiteMs, b: saved.blackMs });
        setCoachText(coachGreeting(elo, bot.name, true, personality));
        return;
      }
      if (arenaParam !== "1") startBotMatch(elo, timeControlMin);
      setCoachText(coachGreeting(elo, bot.name, false, personality));
    })();
  }, [arenaParam, elo, timeControlMin, bot.name, personality]);

  const turn = engineRef.current.turn();
  const hasClock = timeMs > 0 && !over;
  const { whiteMs, blackMs, ref: clockRef } = useChessClock({
    enabled: hasClock && !thinking && viewPly === null,
    whiteMs: clockSeed.w,
    blackMs: clockSeed.b,
    turn,
    onFlag: (loser) => {
      if (flaggedRef.current || over) return;
      flaggedRef.current = true;
      const youLost = loser === "w";
      void endGame(
        engineRef.current.history().map((m) => `${m.from}:${m.to}`),
        youLost ? "loss" : "win",
        youLost ? "You ran out of time ⏱️" : "Opponent ran out of time — you win! 🏆",
        !youLost,
        "timeout",
      );
    },
  });

  const frames = useMemo(() => buildFrames(moves), [moves]);
  const viewing = viewPly !== null;
  const shownFen = viewing ? frames[viewPly]! : fen;
  const view = useMemo(() => new ChessEngine(shownFen), [shownFen]);
  const checkSquare = view.inCheck() ? view.kingSquare(view.turn()) : null;
  const mat = material(shownFen);

  function reset() {
    engineRef.current = new ChessEngine();
    gameIdRef.current = `g${Date.now()}`;
    createdAtRef.current = Date.now();
    flaggedRef.current = false;
    clearBotMatch();
    startBotMatch(elo, timeControlMin);
    setFen(engineRef.current.fen());
    setMoves([]);
    setViewPly(null);
    setLastMove(null);
    setOver(null);
    setThinking(false);
    setClockSeed({ w: timeMs, b: timeMs });
    setCoachText(coachGreeting(elo, bot.name, false, personality));
  }

  async function endGame(mv: string[], result: "win" | "loss" | "draw", title: string, win: boolean, endReason: EndReason = "checkmate") {
    let ratingDelta = 0;
    let newRating = 800;
    const winner = winnerFromPlayerResult(result, "w");
    const game = buildSyncGame({
      engine: engineRef.current,
      id: gameIdRef.current,
      mode: "bot",
      createdAt: createdAtRef.current,
      whiteName: "You",
      blackName: `${bot.name} (${elo})`,
      elo,
      endReason: endReason ?? (result === "draw" ? "draw" : "checkmate"),
      winner,
      playerResult: result,
    });
    try {
      await mutateProgress((snap) => {
        const before = (snap.rating as number) ?? 800;
        let next = applyMatchEnd(snap, { botElo: elo, result });
        ratingDelta = ((next.rating as number) ?? before) - before;
        newRating = (next.rating as number) ?? before;
        next = { ...next, recentGames: prependRecentGame((snap.recentGames as unknown[]) ?? [], game) };
        return markHomeworkActivity(next, "match", isoDay());
      });
    } catch {
      /* local-only guest */
    }
    const active = getActiveMatch();
    if (active?.arena) {
      const score = result === "win" ? 1 : result === "draw" ? 0.5 : 0;
      recordArenaResult(active.arena.opponentId, score, gameIdRef.current);
      void hydrateArenaStore().then(() => completeArenaIfDone());
    }
    setOver({ title, win, ratingDelta, newRating, gameId: gameIdRef.current, subtitle: result === "draw" ? "Draw" : undefined });
    finishBotMatch();
  }

  function checkOver(): boolean {
    const e = engineRef.current;
    if (!e.isGameOver()) return false;
    const status = e.status();
    const mv = e.history().map((m) => `${m.from}:${m.to}`);
    if (status === "checkmate") {
      const youWon = e.turn() === "b";
      youWon ? haptics.success() : haptics.error();
      youWon ? sfx.play("win") : sfx.play("error");
      setMateReviewHistory(e.history());
      setMateReviewOpen(true);
      void endGame(mv, youWon ? "win" : "loss", youWon ? "Checkmate — you win! 🏆" : `Checkmate — ${bot.name} wins`, youWon, "checkmate");
    } else {
      void endGame(mv, "draw", status === "stalemate" ? "Stalemate — draw" : "Draw", false, endReasonFromStatus(status));
    }
    return true;
  }

  function handleMove(from: string, to: string, promotion: "q" | "r" | "b" | "n" = "q"): boolean {
    const e = engineRef.current;
    if (over || thinking || viewing || e.turn() !== "w") return false;
    const beforeFen = e.fen();
    if (!e.move({ from, to, promotion })) return false;
    haptics.tap();
    const h = e.history();
    const applied = h[h.length - 1]!;
    sfx.play(applied.captured ? "capture" : "move");
    if (e.inCheck()) sfx.play("check");
    const nextMoves = [...moves, `${from}:${to}`];
    setFen(e.fen());
    setMoves(nextMoves);
    setLastMove({ from, to });
    setCoachText(
      commentOnMove({
        beforeFen,
        move: applied,
        botElo: elo,
        botName: bot.name,
        personality,
        reactingToPlayer: true,
        moveNumber: h.length,
      }),
    );
    syncBotMatch({ fen: e.fen(), moves: nextMoves, whiteMs: clockRef.current.w, blackMs: clockRef.current.b });
    if (checkOver()) return true;

    setThinking(true);
    setTimeout(async () => {
      // Match web/core: undersized Stockfish is not used below 1400 (Pip/Cody stay on the soft JS bot).
      let m: { from: string; to: string; promotion?: string } | null = null;
      if (elo >= 1400 && stockfishAvailable()) {
        m = await nativeBestMove(e.fen(), elo);
      }
      if (!m) m = await getBotMove(e.fen(), eloToConfig(elo), Math.random());
      if (m) {
        const botBefore = e.fen();
        e.move(m as never);
        const bh = e.history();
        const botMove = bh[bh.length - 1]!;
        sfx.play(botMove.captured ? "capture" : "move");
        if (e.inCheck()) sfx.play("check");
        const afterMoves = [...nextMoves, `${m.from}:${m.to}`];
        setFen(e.fen());
        setMoves(afterMoves);
        setLastMove({ from: m.from, to: m.to });
        setCoachText(
          commentOnMove({
            beforeFen: botBefore,
            move: botMove,
            botElo: elo,
            botName: bot.name,
            personality,
            reactingToPlayer: false,
            moveNumber: bh.length,
          }),
        );
        syncBotMatch({ fen: e.fen(), moves: afterMoves, whiteMs: clockRef.current.w, blackMs: clockRef.current.b });
      }
      setThinking(false);
      checkOver();
    }, 350);
    return true;
  }

  const bubbleText = over ? null : thinking ? "Thinking…" : coachText || `Hi! I'm rated ${elo}. Good luck!`;
  useCoachSpeech(bubbleText ?? "", !over && !thinking);

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.surface }]} edges={["top"]}>
      <View style={styles.header}>
        <Pressable style={styles.circle} onPress={() => router.back()} hitSlop={8}>
          <View style={{ transform: [{ rotate: "180deg" }] }}><Icon name="chevronRight" size={20} color={colors.ink} /></View>
        </Pressable>
        <Text style={styles.title} numberOfLines={1}>vs {bot.name} · {elo}</Text>
        <Pressable style={styles.circle} onPress={() => setFlipped((f) => !f)} hitSlop={8}><Icon name="flip" size={18} color={colors.ink} /></Pressable>
        <Pressable
          style={styles.resign}
          accessibilityLabel="Resign game"
          accessibilityRole="button"
          onPress={() => {
            if (over) return;
            setResignOpen(true);
          }}
        >
          <Text style={styles.resignText}>Resign</Text>
        </Pressable>
      </View>

      {bubbleText && (
        <View style={styles.coach}>
          <BotAvatar elo={elo} size={48} />
          <View style={styles.bubble}>
            <Text style={styles.bubbleLabel}>{bot.name}</Text>
            <Text style={styles.bubbleText}>{bubbleText}</Text>
          </View>
        </View>
      )}

      <View style={{ flex: 1, justifyContent: "center" }}>
        <PlayerBar
          name={`${bot.name} · ${elo}`}
          botElo={elo}
          advantage={Math.max(0, mat.b - mat.w)}
          active={thinking && !over}
          clockMs={timeMs > 0 ? blackMs : undefined}
        />

        <View style={{ alignItems: "center", marginVertical: space[2] }}>
          <ChessBoard
            fen={shownFen}
            size={boardSize}
            orientation={flipped ? "black" : "white"}
            onMove={handleMove}
            interactive={!over && !thinking && !viewing}
            lastMove={viewing ? null : lastMove}
            checkSquare={checkSquare}
          />
        </View>

        <PlayerBar
          name="You"
          avatarId={avatar}
          advantage={Math.max(0, mat.w - mat.b)}
          active={!thinking && !over && !viewing && turn === "w"}
          clockMs={timeMs > 0 ? whiteMs : undefined}
        />
      </View>

      <View style={styles.scrubber}>
        <Pressable style={styles.scrubBtn} onPress={() => setViewPly((v) => Math.max(0, (v ?? frames.length - 1) - 1))}>
          <Text style={styles.scrubIcon}>⏪</Text>
        </Pressable>
        <Text style={styles.scrubLabel}>{viewing ? `move ${viewPly}/${frames.length - 1}` : "● live"}</Text>
        <Pressable style={styles.scrubBtn} onPress={() => setViewPly((v) => { if (v === null) return null; const n = v + 1; return n >= frames.length - 1 ? null : n; })}>
          <Text style={styles.scrubIcon}>⏩</Text>
        </Pressable>
      </View>

      <GameOverOverlay
        visible={!!over && !mateReviewOpen}
        title={over?.title ?? ""}
        subtitle={over?.subtitle}
        win={over?.win}
        ratingDelta={over?.ratingDelta}
        newRating={over?.newRating}
        onReflect={() => setReflectOpen(true)}
        onReview={() => router.push({ pathname: "/replay/[index]", params: { index: "0" } })}
        onNewGame={reset}
        onExit={() => router.back()}
      />

      <MateReviewModal
        open={mateReviewOpen}
        history={mateReviewHistory}
        orientation={flipped ? "black" : "white"}
        onClose={() => setMateReviewOpen(false)}
      />

      <ReflectSheet
        visible={reflectOpen}
        onClose={() => setReflectOpen(false)}
        kind="match"
        title={`Bot game vs ${bot.name}`}
        summary={over?.title ?? "Match reflection"}
        refId={over?.gameId ?? null}
      />

      <ConfirmDialog
        open={resignOpen}
        title="Resign?"
        message={`${bot.name} will win if you resign.`}
        confirmLabel="Resign"
        tone="danger"
        onCancel={() => setResignOpen(false)}
        onConfirm={() => {
          setResignOpen(false);
          void endGame(moves, "loss", `Resigned — ${bot.name} wins`, false);
        }}
      />
    </SafeAreaView>
  );
}

const CIRCLE = 40;
const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", gap: space[2], paddingHorizontal: space[4], paddingTop: 6 },
  circle: { width: CIRCLE, height: CIRCLE, borderRadius: CIRCLE / 2, backgroundColor: colors.surfaceCard, justifyContent: "center", alignItems: "center", borderWidth: 1, borderColor: colors.hairline },
  title: { flex: 1, ...type.base, fontFamily: font.bold, color: colors.ink },
  resign: { borderRadius: radius.md, backgroundColor: colors.danger, paddingHorizontal: space[3], paddingVertical: 8 },
  resignText: { ...type.xs, fontFamily: font.bold, color: "#fff" },
  playerBar: { flexDirection: "row", alignItems: "center", gap: space[2], marginHorizontal: space[4], paddingHorizontal: space[3], paddingVertical: space[2], borderRadius: radius.md, borderWidth: 1, borderColor: "transparent" },
  playerBarActive: { backgroundColor: colors.surfaceCard, borderColor: colors.brand100, ...shadowCard },
  turnDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.success },
  userAvatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.brand50, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.brand100 },
  playerName: { flex: 1, ...type.sm, fontFamily: font.bold, color: colors.ink },
  advantage: { ...type.sm, fontFamily: font.bold, color: colors.ink500 },
  clock: { ...type.sm, fontFamily: font.bold, color: colors.ink500, fontVariant: ["tabular-nums"] },
  clockActive: { color: colors.brand },
  coach: { flexDirection: "row", alignItems: "center", gap: space[3], paddingHorizontal: space[4], marginTop: space[2] },
  bubble: { flex: 1, backgroundColor: colors.surfaceCard, borderRadius: radius.card, borderBottomLeftRadius: 4, paddingHorizontal: space[4], paddingVertical: space[3], borderWidth: 1, borderColor: colors.hairline, ...shadowCard },
  bubbleLabel: { ...type.xs, fontFamily: font.bold, color: colors.ink500, textTransform: "uppercase", marginBottom: 2 },
  bubbleText: { ...type.base, fontFamily: font.semibold, color: colors.ink },
  scrubber: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: space[3], marginTop: space[3], marginBottom: space[2] },
  scrubBtn: { minWidth: 56, height: 40, borderRadius: radius.md, backgroundColor: colors.surfaceCard, justifyContent: "center", alignItems: "center", borderWidth: 1, borderColor: colors.hairline },
  scrubIcon: { fontSize: 16, color: colors.ink },
  scrubLabel: { minWidth: 88, textAlign: "center", ...type.xs, fontFamily: font.bold, color: colors.ink500 },
});

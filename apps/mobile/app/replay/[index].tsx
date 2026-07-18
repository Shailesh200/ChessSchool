import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { analyzeMate, matePreventionTip, replayFrames, type Frame } from "@chess-school/core";
import { ChessBoard, type Arrow } from "@/ChessBoard";
import { Slider } from "@/Slider";
import { FetchErrorView } from "@/FetchErrorView";
import { Icon } from "@/Icon";
import { progressStore } from "@/progressStore";
import { movesFromSyncGame, normalizeSyncGame, type SyncGame } from "@/progression";
import { sfx } from "@/sfx";
import { colors, font, radius, shadowCard, space, type } from "@/theme";

type Game = SyncGame;

function buildFramesFromMoves(moves: string[]): Frame[] {
  const pgn = moves.map((m) => {
    const [from, to] = m.split(":");
    return `${from}${to}`;
  }).join(" ");
  if (!pgn) return replayFrames("");
  return replayFrames(`[Event "?"]\n\n${pgn}`);
}

export default function ReplayScreen() {
  const { id } = useLocalSearchParams<{ index: string; id?: string }>();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const boardSize = Math.min(width - 16, 470);

  const [game, setGame] = useState<Game | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [ply, setPly] = useState(0);
  const [playing, setPlaying] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      setError(false);
      try {
        if (id) {
          const snap = progressStore.get();
          const games = ((snap?.recentGames as unknown[]) ?? []).map(normalizeSyncGame).filter(Boolean) as Game[];
          const found = games.find((g) => g.id === id) ?? null;
          setGame(found);
          if (!found) setError(true);
        } else {
          setError(true);
        }
      } catch {
        setError(true);
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  const frames = useMemo(() => {
    if (!game) return [];
    if (game.pgn) return replayFrames(game.pgn);
    return buildFramesFromMoves(movesFromSyncGame(game));
  }, [game]);

  useEffect(() => {
    if (frames.length) setPly(frames.length - 1);
  }, [frames.length]);

  useEffect(() => {
    if (!playing) return;
    timer.current = setInterval(() => {
      setPly((i) => {
        if (i >= frames.length - 1) {
          setPlaying(false);
          return i;
        }
        sfx.play("move");
        return i + 1;
      });
    }, 700);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [playing, frames.length]);

  function goToPly(next: number, playSound = true) {
    setPlaying(false);
    setPly((prev) => {
      if (playSound && next !== prev && next > 0) sfx.play("move");
      return next;
    });
  }

  if (error) {
    return (
      <SafeAreaView style={styles.safe}>
        <FetchErrorView title="Game not found" onRetry={() => router.back()} onBack={() => router.back()} />
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
  const preventionTip = mate ? matePreventionTip(mate.pattern) : "";
  const sanLabel =
    ply === 0
      ? "Starting position"
      : `${Math.ceil(ply / 2)}.${ply % 2 === 0 ? ".." : ""} ${frame.san ?? ""}${frame.check && !frame.mate ? "+" : ""}${frame.mate ? "#" : ""}`;

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Text style={styles.back}>← All games</Text>
        </Pressable>

        <View style={{ alignItems: "center", marginTop: 10 }}>
          <ChessBoard
            fen={frame.fen}
            size={boardSize}
            interactive={false}
            showNotation
            lastMove={frame.from && frame.to ? { from: frame.from, to: frame.to } : null}
            arrows={arrows}
            highlights={mate?.covered.map((c) => c.square)}
            checkSquare={mate?.kingSquare ?? null}
          />
        </View>

        <View style={styles.controls}>
          <Pressable style={styles.ctrl} onPress={() => goToPly(0, false)}>
            <Text style={styles.ctrlText}>⏮</Text>
          </Pressable>
          <Pressable style={styles.ctrl} onPress={() => goToPly(Math.max(0, ply - 1))}>
            <Text style={styles.ctrlText}>◀</Text>
          </Pressable>
          <Pressable style={styles.ctrl} onPress={() => setPlaying((p) => !p)}>
            <Text style={styles.ctrlText}>{playing ? "⏸" : "▶"}</Text>
          </Pressable>
          <Pressable style={styles.ctrl} onPress={() => goToPly(Math.min(frames.length - 1, ply + 1))}>
            <Text style={styles.ctrlText}>▶</Text>
          </Pressable>
          <Pressable style={styles.ctrl} onPress={() => goToPly(frames.length - 1)}>
            <Text style={styles.ctrlText}>⏭</Text>
          </Pressable>
        </View>

        <View style={styles.sliderRow}>
          <Slider value={ply} min={0} max={Math.max(frames.length - 1, 0)} step={1} onChange={(v) => goToPly(v)} />
        </View>

        <Text style={styles.moveLabel}>{sanLabel}</Text>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.moveList}>
          {frames.slice(1).map((f, i) => {
            const idx = i + 1;
            const active = idx === ply;
            return (
              <Pressable key={idx} style={[styles.sanChip, active && styles.sanChipOn]} onPress={() => goToPly(idx)}>
                <Text style={[styles.sanText, active && styles.sanTextOn]}>{f.san}</Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {mate && (
          <View style={styles.mateCard}>
            <Text style={styles.mateTitle}>How the checkmate happened</Text>
            <View style={styles.mateLineRow}>
              <Icon name="crown" size={16} color={colors.gold} />
              <Text style={styles.mateLine}>The king on {mate.kingSquare} is in check and cannot move.</Text>
            </View>
            <View style={styles.mateLineRow}>
              <Icon name="bulb" size={16} color={colors.brand} />
              <Text style={styles.tip}>{preventionTip}</Text>
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface },
  scroll: { paddingBottom: 40 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  back: { ...type.sm, fontFamily: font.bold, color: colors.brand, paddingHorizontal: space[5], paddingTop: 6 },
  controls: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 14, marginTop: 22 },
  ctrl: { width: 52, height: 44, borderRadius: radius.md, backgroundColor: colors.surfaceCard, justifyContent: "center", alignItems: "center", borderWidth: 1, borderColor: colors.hairline },
  ctrlText: { fontSize: 18, color: colors.ink, fontFamily: font.bold },
  sliderRow: { marginHorizontal: space[5], marginTop: space[4] },
  moveLabel: { ...type.sm, fontFamily: font.bold, color: colors.ink, textAlign: "center", marginTop: space[3] },
  moveList: { gap: space[2], paddingHorizontal: space[5], paddingTop: space[3] },
  sanChip: { borderRadius: radius.pill, paddingHorizontal: space[3], paddingVertical: 6, backgroundColor: colors.surfaceSunken },
  sanChipOn: { backgroundColor: colors.brand },
  sanText: { ...type.xs, fontFamily: font.bold, color: colors.ink500 },
  sanTextOn: { color: "#fff" },
  mateCard: { margin: space[4], borderRadius: radius.card, borderWidth: 1, borderColor: "rgba(244,63,94,0.4)", backgroundColor: "rgba(244,63,94,0.06)", padding: space[4], ...shadowCard },
  mateTitle: { ...type.sm, fontFamily: font.bold, color: colors.danger, marginBottom: space[2] },
  mateLine: { ...type.xs, fontFamily: font.semibold, color: colors.ink700, lineHeight: 18, flex: 1 },
  mateLineRow: { flexDirection: "row", alignItems: "flex-start", gap: space[2], marginTop: space[1] },
  tip: { ...type.xs, fontFamily: font.bold, color: colors.ink, lineHeight: 18, backgroundColor: colors.surfaceSunken, borderRadius: radius.md, padding: space[2], marginTop: space[2] },
});

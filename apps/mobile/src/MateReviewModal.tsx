import { useEffect, useMemo, useRef, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import type { VerboseMove } from "@chess-school/core";
import {
  analyzeMate,
  lastMoveFramesFromHistory,
  matePreventionTip,
  type Frame,
} from "@chess-school/core";
import { ChessBoard } from "./ChessBoard";
import { Button } from "./Button";
import { sfx } from "./sfx";
import { colors, font, radius, shadowCard, space, type } from "./theme";

const ANIM_MS = 300;
const PAUSE_MS = 700;
const STEP_MS = ANIM_MS + PAUSE_MS;
const INITIAL_MS = PAUSE_MS;

function moveLabel(frame: Frame, idx: number, total: number): string {
  if (!frame.san) return idx === 0 && total > 1 ? "Before the final attack" : "Starting position";
  const num = Math.ceil(frame.ply / 2);
  const suffix = frame.mate ? " #" : frame.check ? " +" : "";
  if (frame.mate) return `Checkmate — ${num}. ${frame.san}#`;
  return `${num}. ${frame.san}${suffix}`;
}

/** Auto-playing review of the last moves leading to checkmate. */
export function MateReviewModal({
  open,
  history,
  orientation = "white",
  onClose,
}: {
  open: boolean;
  history: VerboseMove[];
  orientation?: "white" | "black";
  onClose: () => void;
}) {
  const { width } = useWindowDimensions();
  const boardSize = Math.min(width - 48, 320);
  const steps = useMemo(() => lastMoveFramesFromHistory(history, 5), [history]);
  const [idx, setIdx] = useState(0);
  const [overlayRevealed, setOverlayRevealed] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!open) {
      setIdx(0);
      setOverlayRevealed(false);
    }
  }, [open, history]);

  const safeIdx = steps.length ? Math.min(idx, steps.length - 1) : 0;
  const frame = steps[safeIdx];
  const atEnd = safeIdx >= steps.length - 1;
  const atMateEnd = atEnd && Boolean(frame?.mate);
  const showMateOverlay = atMateEnd && overlayRevealed;

  useEffect(() => {
    if (!open || steps.length <= 1) return;

    let current = 0;
    let cancelled = false;

    const advance = () => {
      if (cancelled || current >= steps.length - 1) return;
      current += 1;
      if (steps[current]?.san) sfx.play("move");
      setIdx(current);
      timerRef.current = setTimeout(advance, STEP_MS);
    };

    timerRef.current = setTimeout(advance, INITIAL_MS);
    return () => {
      cancelled = true;
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = null;
    };
  }, [open, steps]);

  useEffect(() => {
    if (!atMateEnd) return;
    const t = setTimeout(() => setOverlayRevealed(true), ANIM_MS + 180);
    return () => clearTimeout(t);
  }, [atMateEnd, safeIdx]);

  const mate = useMemo(
    () => (showMateOverlay && frame?.mate ? analyzeMate(frame.fen) : null),
    [showMateOverlay, frame],
  );

  const arrows = mate
    ? mate.attackers.map((a) => ({ startSquare: a, endSquare: mate.kingSquare, color: "#f43f5e" }))
    : undefined;
  const highlights = mate ? mate.covered.map((c) => c.square) : undefined;

  function skipToEnd() {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
    const end = Math.max(0, steps.length - 1);
    setIdx(end);
    if (steps[end]?.mate) setOverlayRevealed(true);
  }

  if (!open || !frame) return null;

  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.card} onPress={(e) => e.stopPropagation()}>
          <Text style={styles.title}>How the checkmate happened</Text>
          <Text style={styles.sub}>
            {atEnd ? `Final move — step ${safeIdx + 1} of ${steps.length}` : `Replaying — step ${safeIdx + 1} of ${steps.length}`}
          </Text>

          <View style={styles.boardWrap}>
            <ChessBoard
              fen={frame.fen}
              size={boardSize}
              orientation={orientation}
              interactive={false}
              showNotation
              lastMove={safeIdx > 0 && frame.from && frame.to ? { from: frame.from, to: frame.to } : null}
              arrows={arrows}
              highlights={highlights}
              checkSquare={mate ? mate.kingSquare : null}
            />
          </View>

          <Text style={styles.moveLabel}>{moveLabel(frame, safeIdx, steps.length)}</Text>

          <View style={styles.dots}>
            {steps.map((_, i) => (
              <View key={i} style={[styles.dot, i === safeIdx && styles.dotOn, i < safeIdx && styles.dotDone]} />
            ))}
          </View>

          <View style={styles.sans}>
            {steps.map((f, i) => (
              <Text key={f.ply} style={[styles.san, safeIdx === i && styles.sanOn]}>
                {f.san ?? "…"}
                {f.mate ? "#" : f.check ? "+" : ""}
              </Text>
            ))}
          </View>

          {mate && showMateOverlay && (
            <View style={styles.mateCard}>
              <Text style={styles.mateTitle}>The mating net</Text>
              <Text style={styles.mateLine}>King on {mate.kingSquare} is in check with no legal move.</Text>
              <Text style={styles.mateLine}>Check from {mate.attackers.join(", ")} (red arrows).</Text>
              <Text style={styles.mateLine}>Every escape square is blocked or attacked (highlighted).</Text>
              <Text style={styles.mateTip}>{matePreventionTip(mate.pattern)}</Text>
            </View>
          )}

          <Button label={atEnd ? "Continue" : "Skip to result"} onPress={atEnd ? onClose : skipToEnd} />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(28,27,46,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: space[5],
  },
  card: {
    width: "100%",
    maxWidth: 400,
    maxHeight: "92%",
    backgroundColor: colors.surfaceCard,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.hairline,
    padding: space[5],
    ...shadowCard,
  },
  title: { ...type.lg, fontFamily: font.bold, color: colors.ink, textAlign: "center" },
  sub: { ...type.xs, fontFamily: font.semibold, color: colors.ink500, textAlign: "center", marginTop: 4, marginBottom: space[3] },
  boardWrap: { alignItems: "center", marginVertical: space[2] },
  moveLabel: { ...type.sm, fontFamily: font.bold, color: colors.ink, textAlign: "center", marginTop: space[2] },
  dots: { flexDirection: "row", justifyContent: "center", gap: 6, marginTop: space[2] },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.surfaceSunken },
  dotOn: { backgroundColor: colors.brand, transform: [{ scale: 1.2 }] },
  dotDone: { backgroundColor: colors.brand100 },
  sans: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 6, marginTop: space[2] },
  san: { ...type.xs, fontFamily: font.bold, color: colors.ink700, backgroundColor: colors.surfaceSunken, borderRadius: radius.md, paddingHorizontal: 8, paddingVertical: 4 },
  sanOn: { backgroundColor: colors.brand, color: "#fff" },
  mateCard: { marginTop: space[4], backgroundColor: "rgba(244,63,94,0.08)", borderRadius: radius.md, borderWidth: 1, borderColor: "rgba(244,63,94,0.35)", padding: space[3] },
  mateTitle: { ...type.sm, fontFamily: font.bold, color: colors.danger },
  mateLine: { ...type.xs, fontFamily: font.semibold, color: colors.ink700, marginTop: 4 },
  mateTip: { ...type.xs, fontFamily: font.bold, color: colors.ink, backgroundColor: colors.surfaceSunken, borderRadius: radius.md, padding: space[3], marginTop: space[2] },
});

import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { Button } from "./Button";
import { Confetti } from "./Confetti";
import { colors, font, radius, shadowCard, space, type } from "./theme";

export function GameOverOverlay({
  visible,
  title,
  subtitle,
  win,
  ratingDelta,
  newRating,
  onHowItHappened,
  onReflect,
  onReview,
  onNewGame,
  onExit,
  exitLabel = "← Back to academy",
}: {
  visible: boolean;
  title: string;
  subtitle?: string;
  win?: boolean;
  ratingDelta?: number;
  newRating?: number;
  onHowItHappened?: () => void;
  onReflect?: () => void;
  onReview?: () => void;
  onNewGame: () => void;
  onExit: () => void;
  exitLabel?: string;
}) {
  if (!visible) return null;

  const showRating = ratingDelta !== undefined && newRating !== undefined && ratingDelta !== 0;

  return (
    <Modal visible transparent animationType="fade">
      {win && <Confetti count={28} />}
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.title}>{title.replace(/\s*[🏆⏱️]\s*$/u, "").trim()}</Text>
          {!!subtitle && <Text style={styles.sub}>{subtitle}</Text>}
          {showRating && (
            <View style={[styles.ratingPill, ratingDelta! < 0 && styles.ratingPillLoss]}>
              <Text style={[styles.ratingText, ratingDelta! < 0 && styles.ratingTextLoss]}>
                Rating {ratingDelta! >= 0 ? "+" : ""}
                {ratingDelta} → {newRating}
              </Text>
            </View>
          )}
          <View style={styles.actions}>
            {onHowItHappened && (
              <Button label="How it happened" variant="outline" size="sm" onPress={onHowItHappened} />
            )}
            {onReflect && <Button label="Reflect" variant="outline" size="sm" onPress={onReflect} />}
            {onReview && <Button label="Review" variant="outline" size="sm" onPress={onReview} />}
            <Button label="New game" variant="success" onPress={onNewGame} />
            <Pressable onPress={onExit} style={styles.exit}>
              <Text style={styles.exitText}>{exitLabel}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(28,27,46,0.55)",
    justifyContent: "center",
    alignItems: "center",
    padding: space[5],
  },
  card: {
    width: "100%",
    maxWidth: 340,
    backgroundColor: colors.surfaceCard,
    borderRadius: radius.card,
    padding: space[5],
    gap: space[3],
    ...shadowCard,
  },
  title: { ...type.xl, fontFamily: font.bold, color: colors.ink, textAlign: "center" },
  sub: { ...type.sm, fontFamily: font.semibold, color: colors.ink500, textAlign: "center" },
  ratingPill: { alignSelf: "center", backgroundColor: colors.brand50, borderRadius: radius.pill, paddingHorizontal: space[4], paddingVertical: space[2] },
  ratingPillLoss: { backgroundColor: "rgba(244,63,94,0.12)" },
  ratingText: { ...type.sm, fontFamily: font.bold, color: colors.brand },
  ratingTextLoss: { color: colors.danger },
  actions: { gap: space[2], marginTop: space[2] },
  exit: { alignItems: "center", paddingVertical: space[2] },
  exitText: { ...type.sm, fontFamily: font.bold, color: colors.ink500 },
});

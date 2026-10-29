import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors, font, radius, space, type } from "@/theme";

/** Visible live/replay label. Unchanged from the scrub bar before the move-count probe. */
export function scrubBarLabel(viewing: boolean, viewPly: number | null, frameCount: number): string {
  return viewing ? `move ${viewPly}/${frameCount - 1}` : "● live";
}

/** Test-only name. Not the accessible name of the rewind, live, or forward controls. */
export function moveCountAccessibilityLabel(moveCount: number): string {
  return `move count ${moveCount}`;
}

/**
 * Scrub bar for a bot game.
 * The move count sits on a zero-size absolute view so it is not in the flex
 * row (no extra gap) and is not a screen-reader stop. The live label stays
 * "● live" / "move i/n".
 */
export function MatchScrubBar({
  viewing,
  viewPly,
  frameCount,
  moveCount,
  onBack,
  onForward,
}: {
  viewing: boolean;
  viewPly: number | null;
  frameCount: number;
  moveCount: number;
  onBack: () => void;
  onForward: () => void;
}) {
  return (
    <View style={styles.scrubber}>
      <Pressable style={styles.scrubBtn} onPress={onBack}>
        <Text style={styles.scrubIcon}>⏪</Text>
      </Pressable>
      <Text style={styles.scrubLabel}>{scrubBarLabel(viewing, viewPly, frameCount)}</Text>
      <View
        testID="play-move-count"
        accessibilityLabel={moveCountAccessibilityLabel(moveCount)}
        accessible={false}
        importantForAccessibility="no"
        focusable={false}
        pointerEvents="none"
        collapsable={false}
        style={styles.moveCountProbe}
      />
      <Pressable style={styles.scrubBtn} onPress={onForward}>
        <Text style={styles.scrubIcon}>⏩</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  scrubber: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: space[3],
    marginTop: space[3],
    marginBottom: space[2],
  },
  scrubBtn: {
    minWidth: 56,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceCard,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  scrubIcon: { fontSize: 16, color: colors.ink },
  scrubLabel: {
    minWidth: 88,
    textAlign: "center",
    ...type.xs,
    fontFamily: font.bold,
    color: colors.ink500,
  },
  // Out of the flex row, so the gap between the live label and the forward
  // button matches the bar before this probe existed.
  moveCountProbe: { position: "absolute", width: 0, height: 0 },
});

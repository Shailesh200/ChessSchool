import { Pressable, StyleSheet, Text, View } from "react-native";
import { Icon } from "@/Icon";
import { KitButton } from "@/components/kit";
import { CoachHead } from "@/nov2/CoachRow";
import { COACH_MATCH_PILL, coachDisplayName, type CoachSlug } from "@/nov2/coachArt";
import { premiumColors, premiumFont, premiumRadius, premiumSpace, premiumType } from "@/nov2/premiumTokens";

/** 12-play-match* — opponent header + coach bubble row (390 layout). */
export function PremiumMatchChrome({
  coachSlug,
  bubbleText,
  thinking,
  dark,
  onResign,
  onReplayLine,
}: {
  coachSlug: CoachSlug;
  bubbleText: string | null;
  thinking: boolean;
  dark?: boolean;
  onResign: () => void;
  onReplayLine?: () => void;
}) {
  const name = coachDisplayName(coachSlug);
  const pill = COACH_MATCH_PILL[coachSlug];
  const mood = thinking ? "thinking" : "happy";
  const palette = dark ? premiumDark : premiumLight;

  return (
    <View style={[styles.wrap, { backgroundColor: palette.bg }]}>
      <View style={styles.head}>
        <CoachHead slug={coachSlug} mood={mood} size={48} />
        <View style={styles.headText}>
          <Text style={[styles.headName, { color: palette.text }]}>{name}</Text>
          <Text style={[styles.headSub, { color: palette.muted }]}>
            {pill} · plays Black
          </Text>
        </View>
        <KitButton label="Resign" variant="outline" size="sm" block={false} onPress={onResign} style={styles.resignBtn} />
      </View>
      {bubbleText ? (
        <View style={styles.coachBlock}>
          <View style={styles.coachRow}>
            <CoachHead slug={coachSlug} mood={mood} size={56} />
            <View style={[styles.bubble, { backgroundColor: palette.bubble, borderColor: palette.line }]}>
              <Text style={[styles.bubbleText, { color: palette.text }]}>{bubbleText}</Text>
              {onReplayLine ? (
                <Pressable
                  style={styles.replay}
                  onPress={onReplayLine}
                  accessibilityLabel="Play coach line again"
                  hitSlop={8}
                >
                  <Icon name="volume" size={18} color={palette.text} />
                </Pressable>
              ) : null}
            </View>
          </View>
        </View>
      ) : null}
    </View>
  );
}

const premiumLight = {
  bg: premiumColors.bg,
  text: premiumColors.text,
  muted: premiumColors.textMuted,
  line: premiumColors.line,
  bubble: premiumColors.coachBubble,
};

const premiumDark = {
  bg: "#0f1419",
  text: "#f4f7f5",
  muted: "#9aa8a0",
  line: "#2a3530",
  bubble: "#1a2220",
};

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: premiumSpace[4], paddingTop: premiumSpace[2], gap: premiumSpace[3] },
  head: { flexDirection: "row", alignItems: "center", gap: premiumSpace[3] },
  headText: { flex: 1, gap: 2 },
  headName: { ...premiumType.body, fontFamily: premiumFont.uiBold, fontSize: 17 },
  headSub: { ...premiumType.caption, fontFamily: premiumFont.ui, fontSize: 13 },
  resignBtn: { minWidth: 88, paddingHorizontal: premiumSpace[2] },
  coachBlock: { marginBottom: premiumSpace[1] },
  coachRow: { flexDirection: "row", alignItems: "flex-start", gap: premiumSpace[3] },
  bubble: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: premiumSpace[2],
    borderWidth: 1.5,
    borderRadius: premiumRadius.lg,
    paddingVertical: 11,
    paddingHorizontal: premiumSpace[4],
  },
  bubbleText: { flex: 1, ...premiumType.body, fontFamily: premiumFont.ui },
  replay: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: premiumColors.surfaceSoft,
  },
});

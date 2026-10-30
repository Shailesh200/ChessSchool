import { Pressable, StyleSheet, Text, View } from "react-native";
import { Confetti } from "@/Confetti";
import { KitButton, KitCard, KitCoachAvatar, KitIcon, KitSheet, usePremiumKitTheme } from "@/components/kit";
import { CoachHead } from "@/nov2/CoachRow";
import { slugToCharacterId, coachMoodToAvatarState } from "@/nov2/coachKit";
import { coachDisplayName, type CoachSlug } from "@/nov2/coachArt";

const LOST_LINES: Partial<Record<CoachSlug, string>> = {
  skye: "Not your best stroke. Try again, darling.",
  kira: "Good fight. Want a rematch?",
  rex: "A rare defeat. We rise again.",
  ash: "You learn more from a loss. Again?",
  otto: "Good fight. Want a rematch?",
};

const WON_LINES: Partial<Record<CoachSlug, string>> = {
  skye: "You played like art today!",
  kira: "Yesss, clean win!",
  rex: "A rare defeat. We rise again.",
  ash: "Well earned.",
  otto: "Nice work out there!",
};

/** 12-play-won / 12-play-lost — KitSheet result (390). */
export function PremiumGameEndSheet({
  visible,
  win,
  opponentName,
  coachSlug,
  xpEarned,
  coachLine,
  onRematch,
  onBack,
  onReplayLine,
}: {
  visible: boolean;
  win: boolean;
  opponentName: string;
  coachSlug: CoachSlug;
  xpEarned?: number;
  coachLine?: string;
  onRematch: () => void;
  onBack: () => void;
  onReplayLine?: () => void;
}) {
  const { colors, space, font, type } = usePremiumKitTheme();
  const xp = xpEarned ?? (win ? 50 : 20);
  const title = win ? `You beat ${opponentName}!` : `${opponentName} won this one`;
  const line =
    coachLine ??
    (win ? WON_LINES[coachSlug] ?? "A rare defeat. We rise again." : LOST_LINES[coachSlug] ?? "Good fight. Want a rematch?");
  const sub = win ? `Great game. You earned ${xp} XP.` : `You earned ${xp} XP for playing.`;
  const mood = win ? "happy" : "encouraging";
  const avatarState = coachMoodToAvatarState(win ? "happy" : "encouraging");

  return (
    <>
      {visible && win ? <Confetti count={24} /> : null}
      <KitSheet open={visible} onClose={onBack} title={title}>
        <View style={{ gap: space["3"], alignItems: "center" }}>
          <KitCoachAvatar character={slugToCharacterId(coachSlug)} state={avatarState} size={112} />
          <KitCard variant="paper" style={{ width: "100%" }}>
            <View style={[styles.coachRow, { gap: space["3"] }]}>
              <CoachHead slug={coachSlug} mood={mood} size={56} />
              <View style={[styles.bubble, { borderColor: colors.hairline, flex: 1 }]}>
                <Text style={{ fontFamily: font.uiRegular, fontSize: type.base.fontSize, color: colors.ink, flex: 1 }}>{line}</Text>
                {onReplayLine ? (
                  <Pressable onPress={onReplayLine} accessibilityLabel="Play coach line again" hitSlop={8}>
                    <KitIcon name="volume2" size={18} color={colors.ink} />
                  </Pressable>
                ) : null}
              </View>
            </View>
          </KitCard>
          <Text style={{ fontFamily: font.uiRegular, fontSize: type.sm.fontSize, color: colors.ink500, textAlign: "center" }}>{sub}</Text>
          <KitButton label="Rematch" variant="accent" onPress={onRematch} />
          <KitButton label="Back to Play" variant="outline" onPress={onBack} />
        </View>
      </KitSheet>
    </>
  );
}

const styles = StyleSheet.create({
  coachRow: { flexDirection: "row", alignItems: "flex-start" },
  bubble: { flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1.5, borderRadius: 16, padding: 12 },
});

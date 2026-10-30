import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { Confetti } from "@/Confetti";
import { CoachHead, CoachRow } from "@/nov2/CoachRow";
import { KitButton } from "@/components/kit";
import { type CoachSlug } from "@/nov2/coachArt";
import { premiumColors, premiumFont, premiumRadius, premiumSpace, premiumType } from "@/nov2/premiumTokens";

/** 12-play-won / 12-play-lost — in-board result card (premium kit). */
export function PremiumGameEndSheet({
  visible,
  win,
  opponentName,
  coachSlug,
  xpEarned = 50,
  coachLine,
  onRematch,
  onBack,
}: {
  visible: boolean;
  win: boolean;
  opponentName: string;
  coachSlug: CoachSlug;
  xpEarned?: number;
  coachLine?: string;
  onRematch: () => void;
  onBack: () => void;
}) {
  if (!visible) return null;

  const title = win ? `You beat ${opponentName}!` : `${opponentName} won this one`;
  const line = coachLine ?? (win ? "A rare defeat. We rise again." : "Good fight. Want a rematch?");
  const sub = win
    ? `Great game. You earned ${xpEarned} XP.`
    : "Every game teaches something. Ready when you are.";

  return (
    <Modal visible transparent animationType="fade">
      {win ? <Confetti count={24} /> : null}
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <CoachHead slug={coachSlug} mood={win ? "happy" : "encouraging"} size={112} />
          <Text style={styles.title}>{title}</Text>
          <CoachRow slug={coachSlug} mood={win ? "happy" : "encouraging"} text={line} size={56} />
          <Text style={styles.sub}>{sub}</Text>
          <KitButton label="Rematch" variant="accent" onPress={onRematch} />
          <KitButton label="Back to Play" variant="outline" onPress={onBack} />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: premiumColors.overlay,
    justifyContent: "center",
    padding: premiumSpace[4],
  },
  card: {
    backgroundColor: premiumColors.surface,
    borderRadius: premiumRadius.xl,
    padding: premiumSpace[5],
    gap: premiumSpace[3],
    alignItems: "center",
    maxWidth: 360,
    width: "100%",
    alignSelf: "center",
  },
  title: { ...premiumType.h2, fontFamily: premiumFont.display, color: premiumColors.text, textAlign: "center" },
  sub: { ...premiumType.body, fontFamily: premiumFont.ui, color: premiumColors.textMuted, textAlign: "center" },
});

import { Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { ChessBoard } from "@/ChessBoard";
import { KitButton, KitIcon, usePremiumKitTheme } from "@/components/kit";
import { CoachRow } from "@/nov2/CoachRow";

/** 02d-onboarding-testout — placement teaser (question 2 of 5). */
const PLACEMENT_FEN = "7k/5ppp/8/8/8/8/6PP/R5K1 w - - 0 1";

export function BoaTestOutScreen() {
  const router = useRouter();
  const { colors, space, radius, font, type } = usePremiumKitTheme();

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.surface }]} edges={["top", "bottom"]} testID="boa-test-out">
      <View style={[styles.lessonHead, { paddingHorizontal: space["4"], paddingTop: space["2"] }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close placement"
          onPress={() => router.back()}
          style={[styles.iconBtn, { borderRadius: radius.md, borderColor: colors.hairline }]}
        >
          <KitIcon name="x" size={20} color={colors.ink} />
        </Pressable>
        <View style={[styles.progress, { backgroundColor: colors.surfaceSunken, borderRadius: radius.pill }]}>
          <View style={[styles.progressFill, { width: "40%", backgroundColor: colors.brand, borderRadius: radius.pill }]} />
        </View>
      </View>

      <View style={{ padding: space["4"], gap: space["4"], flex: 1 }}>
        <Text style={{ fontFamily: font.uiBold, fontSize: type.xs.fontSize, color: colors.ink500, textTransform: "uppercase" }}>
          Placement · question 2 of 5
        </Text>
        <Text style={{ fontFamily: font.displayBold, fontSize: type.xl.fontSize, color: colors.ink }}>Can you spot the checkmate?</Text>

        <CoachRow
          slug="otto"
          mood="thinking"
          text="Look at what the rook can reach. Find the move that ends the game."
          strong
          size={64}
        />

        <View style={{ alignItems: "center", flex: 1, justifyContent: "center" }}>
          <ChessBoard fen={PLACEMENT_FEN} size={320} interactive={false} showNotation orientation="white" />
        </View>

        <View style={[styles.hint, { gap: space["2"] }]}>
          <KitIcon name="sparkles" size={18} color={colors.ink500} />
          <Text style={{ fontFamily: font.uiMedium, fontSize: type.sm.fontSize, color: colors.ink500 }}>Tap a piece, then a square</Text>
        </View>
      </View>

      <View style={[styles.footer, { padding: space["4"], borderTopColor: colors.hairline, gap: space["2"] }]}>
        <KitButton label="Skip this one" variant="ghost" block onPress={() => router.back()} />
        <KitButton label="Check" variant="primary" block disabled onPress={() => undefined} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, maxWidth: 390, width: "100%", alignSelf: "center" },
  lessonHead: { flexDirection: "row", alignItems: "center", gap: 12 },
  iconBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center", borderWidth: 1.5 },
  progress: { flex: 1, height: 8, overflow: "hidden" },
  progressFill: { height: "100%" },
  hint: { flexDirection: "row", alignItems: "center", justifyContent: "center" },
  footer: { borderTopWidth: 1.5 },
});

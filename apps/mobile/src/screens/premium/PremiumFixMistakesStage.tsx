import { Pressable, ScrollView, Text, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ChessBoard, type Arrow } from "@/ChessBoard";
import { KitButton, KitCoachAvatar, KitIcon, usePremiumKitTheme } from "@/components/kit";

export type FixLadderStep = "your-move" | "reply" | "try-again";

type Props = {
  displayIndex: number;
  total: number;
  progressPct: number;
  coachLine: string;
  coachCharacter?: string;
  fen: string;
  highlights?: string[];
  arrows?: Arrow[];
  interactive?: boolean;
  onMove?: (from: string, to: string) => boolean;
  onClose: () => void;
  nextLabel: string;
  onNext?: () => void;
  nextDisabled?: boolean;
  ladder?: FixLadderStep;
};

/** 10b-fix-mistakes: close, progress, coach story, board, three-step ladder, next bar. */
export function PremiumFixMistakesStage({
  displayIndex,
  total,
  progressPct,
  coachLine,
  coachCharacter = "otto",
  fen,
  highlights,
  arrows,
  interactive = false,
  onMove,
  onClose,
  nextLabel,
  onNext,
  nextDisabled = false,
  ladder = "reply",
}: Props) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { colors, space, radius, font, type } = usePremiumKitTheme();
  const board = Math.min(width - 40, 390);
  const pct = Math.min(100, Math.max(0, progressPct));
  const steps: { id: FixLadderStep; n: string; label: string }[] = [
    { id: "your-move", n: "1", label: "Your move" },
    { id: "reply", n: "2", label: "The reply" },
    { id: "try-again", n: "3", label: "Try again" },
  ];
  const order: FixLadderStep[] = ["your-move", "reply", "try-again"];
  const at = order.indexOf(ladder);

  return (
    <View testID="fix-mistakes" style={{ flex: 1, backgroundColor: colors.bg }}>
      <View
        style={{
          paddingTop: Math.max(insets.top, 8),
          paddingHorizontal: space["4"],
          paddingBottom: space["2"],
          flexDirection: "row",
          alignItems: "center",
          gap: 14,
        }}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close lesson"
          onPress={onClose}
          style={{
            width: 44,
            height: 44,
            borderRadius: 22,
            backgroundColor: colors.surfaceCard,
            borderWidth: 1,
            borderColor: colors.hairline,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <KitIcon name="x" size={20} color={colors.ink} />
        </Pressable>
        <View
          accessibilityRole="progressbar"
          accessibilityValue={{ min: 0, max: 100, now: Math.round(pct) }}
          style={{ flex: 1, height: 12, borderRadius: 99, backgroundColor: colors.hairline, overflow: "hidden" }}
        >
          <View style={{ width: `${pct}%`, height: 12, backgroundColor: colors.accent }} />
        </View>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: space["5"], paddingBottom: space["4"], gap: space["3"] }}>
        <View style={{ alignItems: "center", gap: space["2"] }}>
          <View style={{ backgroundColor: colors.brandSoft, borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 4 }}>
            <Text style={{ fontFamily: font.uiBold, color: colors.brandSoftText, fontSize: type.caption.fontSize }}>
              Fix mistakes · {displayIndex} of {total}
            </Text>
          </View>
          <Text style={{ fontFamily: font.displayBold, fontSize: type.h3.fontSize, lineHeight: type.h3.lineHeight, color: colors.ink, textAlign: "center" }}>
            Here is what happened
          </Text>
        </View>
        <View style={{ flexDirection: "row", gap: space["3"], alignItems: "center" }}>
          <KitCoachAvatar character={coachCharacter} state={ladder === "try-again" ? "think" : "success"} size={72} />
          <View style={{ flex: 1, backgroundColor: colors.coachBubble, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.hairline, padding: space["3"] }}>
            <Text style={{ fontFamily: font.uiBold, color: colors.ink, fontSize: type.body.fontSize, lineHeight: type.body.lineHeight }}>{coachLine}</Text>
          </View>
        </View>
        <View style={{ alignItems: "center" }}>
          <ChessBoard
            fen={fen}
            size={board}
            showNotation
            interactive={interactive}
            highlights={highlights}
            arrows={arrows}
            onMove={onMove}
          />
        </View>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, justifyContent: "center" }}>
          {steps.map((step, i) => {
            const done = i < at;
            const current = i === at;
            const bg = current ? colors.accentSoft : done ? colors.successSoft : colors.brandSoft;
            const fg = current ? colors.accentSoftText : done ? colors.successText : colors.brandSoftText;
            return (
              <View key={step.id} style={{ flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: bg, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 6 }}>
                {done ? <KitIcon name="check" size={14} color={fg} /> : null}
                <Text style={{ fontFamily: font.uiBold, color: fg, fontSize: 13 }}>{step.n} {step.label}</Text>
              </View>
            );
          })}
        </View>
      </ScrollView>

      <View style={{ borderTopWidth: 1.5, borderTopColor: colors.hairline, paddingHorizontal: space["5"], paddingTop: 14, paddingBottom: Math.max(insets.bottom, 16) }}>
        <KitButton label={nextLabel} disabled={nextDisabled} onPress={() => onNext?.()} />
      </View>
    </View>
  );
}

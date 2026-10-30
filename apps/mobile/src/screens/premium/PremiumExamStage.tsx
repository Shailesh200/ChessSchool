import { Pressable, ScrollView, Text, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ChessBoard, type Arrow } from "@/ChessBoard";
import { KitButton, KitCoachAvatar, KitIcon, usePremiumKitTheme } from "@/components/kit";
import { examPassMark, examPipState } from "./premiumModel";

type Props = {
  classLabel: string;
  title: string;
  puzzleIndex: number;
  puzzleTotal: number;
  coachLine: string;
  coachCharacter?: string;
  fen: string;
  seedSelection?: string | null;
  highlights?: string[];
  arrows?: Arrow[];
  interactive?: boolean;
  onMove?: (from: string, to: string) => boolean;
  onClose: () => void;
  actionLabel?: string;
  actionDisabled?: boolean;
  onAction?: () => void;
};

/** 09-class-exam: close, title, pips, coach, board, pass-mark chips, lock-in bar. */
export function PremiumExamStage({
  classLabel,
  title,
  puzzleIndex,
  puzzleTotal,
  coachLine,
  coachCharacter = "otto",
  fen,
  seedSelection = null,
  highlights,
  arrows,
  interactive = true,
  onMove,
  onClose,
  actionLabel = "Lock in move",
  actionDisabled = true,
  onAction,
}: Props) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { colors, space, radius, font, type } = usePremiumKitTheme();
  const board = Math.min(width - 40, 390);
  const pass = examPassMark(puzzleTotal);
  const pips = examPipState(puzzleIndex, puzzleTotal);
  const shown = puzzleIndex + 1;

  return (
    <View testID="class-exam" style={{ flex: 1, backgroundColor: colors.bg }}>
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
        <Text style={{ fontFamily: font.displayBold, fontSize: type.h4.fontSize, lineHeight: type.h4.lineHeight, color: colors.ink }}>
          Class exam
        </Text>
        <View
          accessibilityRole="image"
          accessibilityLabel={`Puzzle ${shown} of ${puzzleTotal}`}
          style={{ flex: 1, flexDirection: "row", gap: 6, minWidth: 0 }}
        >
          {pips.map((pip, i) => (
            <View
              key={i}
              style={{
                flex: 1,
                height: 14,
                borderRadius: 99,
                backgroundColor: pip === "done" ? colors.success : pip === "current" ? colors.accent : colors.hairline,
              }}
            />
          ))}
        </View>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: space["5"], paddingBottom: space["4"], gap: space["3"] }}>
        <View style={{ alignItems: "center", gap: space["2"] }}>
          <View style={{ backgroundColor: colors.brandSoft, borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 4 }}>
            <Text style={{ fontFamily: font.uiBold, color: colors.brandSoftText, fontSize: type.caption.fontSize }}>
              {classLabel} · puzzle {shown} of {puzzleTotal}
            </Text>
          </View>
          <Text style={{ fontFamily: font.displayBold, fontSize: type.h3.fontSize, lineHeight: type.h3.lineHeight, color: colors.ink, textAlign: "center" }}>
            {title}
          </Text>
        </View>
        <View style={{ flexDirection: "row", gap: space["3"], alignItems: "center" }}>
          <KitCoachAvatar character={coachCharacter} state="think" size={72} />
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
            seedSelection={seedSelection}
            highlights={highlights}
            arrows={arrows}
            onMove={onMove}
          />
        </View>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, justifyContent: "center" }}>
          <Tag icon="flag" label={`Pass mark ${pass} of ${puzzleTotal}`} bg={colors.accentSoft} fg={colors.accentSoftText} />
          <Tag icon="lock" label="Hints off" bg={colors.warningSoft} fg={colors.warningText} />
        </View>
      </ScrollView>

      <View style={{ borderTopWidth: 1.5, borderTopColor: colors.hairline, paddingHorizontal: space["5"], paddingTop: 14, paddingBottom: Math.max(insets.bottom, 16) }}>
        <KitButton label={actionLabel} disabled={actionDisabled} onPress={() => onAction?.()} />
      </View>
    </View>
  );
}

function Tag({ icon, label, bg, fg }: { icon: "flag" | "lock" | "check"; label: string; bg: string; fg: string }) {
  const { font, radius } = usePremiumKitTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: bg, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 6 }}>
      <KitIcon name={icon} size={14} color={fg} />
      <Text style={{ fontFamily: font.uiBold, color: fg, fontSize: 13 }}>{label}</Text>
    </View>
  );
}

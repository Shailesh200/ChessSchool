import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { ChessBoard } from "@/ChessBoard";
import { KitButton, KitIcon, usePremiumKitTheme } from "@/components/kit";
import { haptics } from "@/haptics";
import { sfx } from "@/sfx";

export type WhyQuizOption = { label: string; emoji?: string };

type Props = {
  fen: string;
  options: WhyQuizOption[];
  correctIndex: number;
  arrows?: { startSquare: string; endSquare: string; color?: string }[];
  highlights?: string[];
  boardSize: number;
  onSubmit: (ok: boolean) => void;
};

export function PremiumWhyQuizPanel({
  fen,
  options,
  correctIndex,
  arrows,
  highlights,
  boardSize,
  onSubmit,
}: Props) {
  const { colors, radius, space, font, type } = usePremiumKitTheme();
  const [picked, setPicked] = useState<number | null>(null);

  return (
    <View style={{ width: "100%", gap: space["3"], paddingHorizontal: space["2"] }}>
      <View style={{ alignItems: "center" }}>
        <ChessBoard fen={fen} size={boardSize} interactive={false} arrows={arrows} highlights={highlights} showNotation />
      </View>
      <View style={{ gap: space["2"] }}>
        {options.map((opt, i) => {
          const selected = picked === i;
          return (
            <Pressable
              key={`${i}-${opt.label}`}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              onPress={() => {
                haptics.tap();
                sfx.play("select");
                setPicked(i);
              }}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: space["3"],
                padding: space["3"],
                borderRadius: radius.lg,
                borderWidth: 2,
                borderColor: selected ? colors.brand : colors.hairline,
                backgroundColor: selected ? colors.coachGlow : colors.surfaceCard,
              }}
            >
              <View
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 18,
                  backgroundColor: colors.surfaceSunken,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Text style={{ fontSize: 18 }}>{opt.emoji ?? "♟"}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: font.uiBold, fontSize: type["body-sm"].fontSize, color: colors.ink }}>
                  {opt.label}
                </Text>
              </View>
              <View
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: 11,
                  borderWidth: 2,
                  borderColor: selected ? colors.brand : colors.ink300,
                  backgroundColor: selected ? colors.brand : "transparent",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {selected ? <KitIcon name="check" size={12} color={colors.surfaceCard} strokeWidth={3} /> : null}
              </View>
            </Pressable>
          );
        })}
      </View>
      <KitButton
        label="Check answer"
        disabled={picked === null}
        onPress={() => {
          const ok = picked === correctIndex;
          if (ok) haptics.success();
          else haptics.error();
          onSubmit(ok);
        }}
      />
    </View>
  );
}

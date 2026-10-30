import { Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Confetti } from "@/Confetti";
import { KitButton, KitCoachAvatar, KitIcon, usePremiumKitTheme } from "@/components/kit";
import type { CoachCharacterId } from "@/coachCharacters";
import { useProgress } from "@/progressStore";
import { lessonDisplayXp, lessonXpSummary } from "./lessonXp";

type Props = {
  lessonTitle: string;
  coachCharacter: CoachCharacterId | string;
  correctPuzzles: number;
  totalPuzzles: number;
  hintsUsed: number;
  elapsedSec: number;
  onContinue: () => void;
  continueLabel?: string;
  loading?: boolean;
};

function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function PremiumLessonCompleteScreen({
  lessonTitle,
  coachCharacter,
  correctPuzzles,
  totalPuzzles,
  hintsUsed,
  elapsedSec,
  onContinue,
  continueLabel = "Continue",
  loading,
}: Props) {
  const { colors, radius, space, font, type } = usePremiumKitTheme();
  const progress = useProgress();
  const streak = (progress?.streak as number) ?? 0;
  const xp = lessonDisplayXp(correctPuzzles);
  const xpLine = lessonXpSummary(correctPuzzles, totalPuzzles);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surfacePaper }} edges={["top", "bottom"]}>
      <Confetti count={32} />
      <View style={{ flex: 1, paddingHorizontal: space["4"], paddingBottom: space["4"], gap: space["4"] }}>
        <View style={{ alignItems: "center", gap: space["2"], marginTop: space["4"] }}>
          <KitCoachAvatar character={coachCharacter} state="success" size={96} />
          <Text
            style={{
              fontFamily: font.displayBold,
              fontSize: type.h1.fontSize,
              lineHeight: type.h1.lineHeight,
              color: colors.ink,
              textAlign: "center",
            }}
          >
            Lesson complete!
          </Text>
          <Text style={{ fontFamily: font.uiBold, fontSize: type["body-sm"].fontSize, color: colors.ink500 }}>
            {lessonTitle}
          </Text>
          <Text
            style={{
              fontFamily: font.uiMedium,
              fontSize: type["body-sm"].fontSize,
              fontStyle: "italic",
              color: colors.ink500,
              textAlign: "center",
            }}
          >
            Lesson done! That&apos;s real progress.
          </Text>
          {xp > 0 ? (
            <>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: space["2"],
                  backgroundColor: colors.gold,
                  paddingHorizontal: space["4"],
                  paddingVertical: space["2"],
                  borderRadius: radius.pill,
                  marginTop: space["2"],
                }}
              >
                <KitIcon name="sparkles" size={18} color={colors.ink} />
                <Text style={{ fontFamily: font.uiBold, fontSize: type.h3.fontSize, color: colors.ink }}>
                  +{xp} XP
                </Text>
              </View>
              {xpLine ? (
                <Text style={{ fontFamily: font.uiMedium, fontSize: type.caption.fontSize, color: colors.ink500 }}>
                  {xpLine}
                </Text>
              ) : null}
            </>
          ) : null}
        </View>

        <View style={{ flexDirection: "row", gap: space["2"] }}>
          {[
            { value: `${correctPuzzles}/${totalPuzzles}`, label: "Puzzles" },
            { value: `${hintsUsed}`, label: hintsUsed === 1 ? "Hint used" : "Hints used" },
            { value: formatDuration(elapsedSec), label: "Time" },
          ].map((stat) => (
            <View
              key={stat.label}
              style={{
                flex: 1,
                backgroundColor: colors.coachGlow,
                borderRadius: radius.lg,
                paddingVertical: space["3"],
                alignItems: "center",
                gap: 4,
              }}
            >
              <Text style={{ fontFamily: font.displayBold, fontSize: type.number.fontSize, color: colors.ink }}>
                {stat.value}
              </Text>
              <Text style={{ fontFamily: font.uiBold, fontSize: type.caption.fontSize, color: colors.brand700 }}>
                {stat.label}
              </Text>
            </View>
          ))}
        </View>

        {streak > 0 ? (
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: space["3"],
              backgroundColor: colors.chipStreakBg,
              borderRadius: radius.xl,
              padding: space["4"],
            }}
          >
            <View
              style={{
                width: 48,
                height: 48,
                borderRadius: 24,
                backgroundColor: colors.surfaceCard,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <KitIcon name="flame" size={24} color={colors.chipStreakInk} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: font.displayBold, fontSize: type.h2.fontSize, color: colors.chipStreakInk }}>
                {streak} day streak
              </Text>
            </View>
            <View
              style={{
                backgroundColor: colors.surfaceCard,
                paddingHorizontal: space["2"],
                paddingVertical: space["1"],
                borderRadius: radius.pill,
              }}
            >
              <Text style={{ fontFamily: font.uiBold, fontSize: type.caption.fontSize, color: colors.chipStreakInk }}>
                +1 today
              </Text>
            </View>
          </View>
        ) : null}

        <View
          style={{
            backgroundColor: colors.coachGlow,
            borderRadius: radius.pill,
            paddingVertical: space["3"],
            paddingHorizontal: space["4"],
            flexDirection: "row",
            alignItems: "center",
            gap: space["2"],
          }}
        >
          <KitIcon name="sparkles" size={18} color={colors.brand700} />
          <Text style={{ fontFamily: font.uiBold, fontSize: type["body-sm"].fontSize, color: colors.brand700, flex: 1 }}>
            Daily goal: 1 of 1 lesson done
          </Text>
        </View>

        <KitButton label={loading ? "Saving…" : continueLabel} disabled={loading} onPress={onContinue} />
      </View>
    </SafeAreaView>
  );
}

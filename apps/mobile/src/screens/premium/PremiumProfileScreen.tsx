import { useMemo } from "react";
import { Image, Pressable, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { ACHIEVEMENTS } from "@chess-school/core";
import { useAuth } from "@/auth";
import { useProgress } from "@/progressStore";
import { useSettings } from "@/settings";
import { TopBar } from "@/TopBar";
import { ThemedSafeArea } from "@/ThemedSafeArea";
import { achievementIcon } from "@/iconMaps";
import { levelForXp, rankForClasses } from "@/progress-utils";
import { KitButton, KitIcon, usePremiumKitTheme } from "@/components/kit";
import { PremiumScreenFrame } from "./PremiumScreenFrame";
import {
  PremiumNavRow,
  PremiumStats3,
  PremiumStreakCard,
  PremiumWeekRow,
} from "./premiumDexParts";

type Progress = {
  xp: number;
  streak: number;
  unlockedAchievements: string[];
  graduatedClasses: string[];
  lessons: Record<string, { mastery: number }>;
  bestStreak?: number;
  puzzlesSolved?: number;
};

export function PremiumProfileScreen() {
  const { user, guest, exitGuest } = useAuth();
  const router = useRouter();
  const s = useSettings();
  const { colors, font, type, space, radius } = usePremiumKitTheme();
  const p = useProgress() as Progress | null;

  const xp = p?.xp ?? 0;
  const streak = p?.streak ?? 0;
  const bestStreak = Math.max(streak, p?.bestStreak ?? 0);
  const graduated = p?.graduatedClasses?.length ?? 0;
  const rank = rankForClasses(graduated);
  const level = levelForXp(xp);
  const lessonCount = Object.keys(p?.lessons ?? {}).length;
  const puzzles = p?.puzzlesSolved ?? 0;
  const unlocked = new Set(p?.unlockedAchievements ?? []);
  const badgeTotal = ACHIEVEMENTS.length;

  const playingSince = useMemo(() => {
    const d = new Date();
    return d.toLocaleString(undefined, { month: "short", year: "numeric" });
  }, []);

  const titleStyle = useMemo(
    () => ({
      fontFamily: font.displayBold,
      fontSize: type.h1.fontSize,
      lineHeight: type.h1.lineHeight,
      color: colors.ink,
      letterSpacing: -0.5,
    }),
    [font, type, colors],
  );

  return (
    <ThemedSafeArea edges={["top"]}>
      <TopBar />
      <PremiumScreenFrame testID="premium-profile">
        <View style={{ flexDirection: "row", alignItems: "center", gap: space["3"], marginTop: space["4"] }}>
          <View
            style={{
              width: 72,
              height: 72,
              borderRadius: 36,
              overflow: "hidden",
              borderWidth: 2,
              borderColor: colors.hairline,
              backgroundColor: colors.surfaceCard,
            }}
          >
            {guest ? (
              <Image source={require("../../../assets/kit/avatars/learner-default.png")} style={{ width: "100%", height: "100%" }} />
            ) : (
              <Image source={require("../../../assets/kit/avatars/dom-d4a03253ab.webp")} style={{ width: "100%", height: "100%" }} />
            )}
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={titleStyle} numberOfLines={1}>
              {guest ? "Guest learner" : user?.name}
            </Text>
            <Text style={{ fontFamily: font.uiMedium, fontSize: type.sm.fontSize, color: colors.ink500, marginTop: 2 }}>
              {guest ? "Browse as guest" : `Playing since ${playingSince}`}
            </Text>
            {!guest ? (
              <View
                style={{
                  alignSelf: "flex-start",
                  marginTop: space["2"],
                  backgroundColor: colors.brand50,
                  borderRadius: radius.pill,
                  paddingHorizontal: space["3"],
                  paddingVertical: space["1"],
                }}
              >
                <Text style={{ fontFamily: font.uiBold, fontSize: type.caption.fontSize, color: colors.brand700 }}>
                  Level {level} · {rank}
                </Text>
              </View>
            ) : null}
          </View>
        </View>

        {guest ? (
          <View style={{ marginTop: space["5"], gap: space["3"] }}>
            <Text style={{ fontFamily: font.uiMedium, fontSize: type.sm.fontSize, color: colors.ink500 }}>
              Enroll to save progress and unlock your Student ID.
            </Text>
            <KitButton
              label="Log in or enroll"
              size="sm"
              block={false}
              testID="profile-enroll-cta"
              onPress={() => {
                exitGuest();
                router.push("/login");
              }}
            />
          </View>
        ) : (
          <View style={{ marginTop: space["5"], gap: space["4"] }}>
            <PremiumStreakCard streak={streak} best={bestStreak} />
            <PremiumWeekRow doneCount={Math.min(streak, 5)} />
            <PremiumStats3 xp={xp} lessons={lessonCount} puzzles={puzzles} />

            <View
              style={{
                backgroundColor: colors.surfaceCard,
                borderRadius: radius.lg,
                padding: space["4"],
                borderWidth: 1,
                borderColor: colors.hairline,
                gap: space["3"],
              }}
            >
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" }}>
                <Text style={{ fontFamily: font.displayBold, fontSize: type.h3.fontSize, color: colors.ink }}>Badges</Text>
                <Text style={{ fontFamily: font.uiMedium, fontSize: type.caption.fontSize, color: colors.ink500 }}>
                  {unlocked.size} of {badgeTotal}
                </Text>
              </View>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space["2"] }}>
                {ACHIEVEMENTS.slice(0, 6).map((a) => {
                  const has = unlocked.has(a.id);
                  return (
                    <View
                      key={a.id}
                      style={{
                        width: "31%",
                        alignItems: "center",
                        paddingVertical: space["2"],
                        opacity: has ? 1 : 0.45,
                      }}
                    >
                      <View
                        style={{
                          width: 40,
                          height: 40,
                          borderRadius: radius.md,
                          backgroundColor: has ? colors.brand50 : colors.surfaceSunken,
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <KitIcon name={achievementIcon(a.id) as never} size={20} color={has ? colors.brand : colors.ink300} />
                      </View>
                      <Text
                        style={{
                          fontFamily: font.uiBold,
                          fontSize: type.caption.fontSize,
                          color: colors.ink,
                          marginTop: 4,
                          textAlign: "center",
                        }}
                        numberOfLines={2}
                      >
                        {a.title}
                      </Text>
                    </View>
                  );
                })}
              </View>
            </View>

            <PremiumNavRow icon="settings" title="Settings" subtitle="Coach, text size, theme" onPress={() => router.push("/settings")} testID="hub-Settings" />
            <PremiumNavRow icon="bell" title="Practice reminders" subtitle="Pick a time that works for you" onPress={() => router.push("/notifications")} />
          </View>
        )}
      </PremiumScreenFrame>
    </ThemedSafeArea>
  );
}

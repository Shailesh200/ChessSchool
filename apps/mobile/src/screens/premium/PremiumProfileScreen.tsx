import { useMemo } from "react";
import { Pressable, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { ACHIEVEMENTS } from "@chess-school/core";
import { useAuth } from "@/auth";
import { useProgress } from "@/progressStore";
import { useSettings } from "@/settings";
import { AnimatedNumber } from "@/AnimatedNumber";
import { achievementIcon } from "@/iconMaps";
import { TopBar } from "@/TopBar";
import { ThemedSafeArea } from "@/ThemedSafeArea";
import { FlatAvatar } from "@/flatAvatars/FlatAvatar";
import { levelForXp, rankForClasses } from "@/progress-utils";
import {
  KitButton,
  KitCard,
  KitIcon,
  type KitIconName,
  usePremiumKitTheme,
} from "@/components/kit";
import { PremiumScreenFrame } from "./PremiumScreenFrame";

type Progress = {
  xp: number;
  rating: number;
  streak: number;
  unlockedAchievements: string[];
  graduatedClasses: string[];
  lessons: Record<string, { mastery: number }>;
  weaknesses: Record<string, number>;
};

const HUB: { icon: KitIconName; label: string; route: string; authOnly?: boolean; adminOnly?: boolean }[] = [
  { icon: "bookOpen", label: "Library", route: "/library", authOnly: true },
  { icon: "userRound", label: "My ID", route: "/account", authOnly: true },
  { icon: "sparkles", label: "Report Card", route: "/dashboard", authOnly: true },
  { icon: "clock", label: "Homework", route: "/homework", authOnly: true },
  { icon: "bookOpen", label: "Journal", route: "/journal", authOnly: true },
  { icon: "gamepad2", label: "Playground", route: "/playground", authOnly: true, adminOnly: true },
  { icon: "palette", label: "Themes", route: "/themes" },
  { icon: "settings", label: "Settings", route: "/settings" },
];

export function PremiumProfileScreen() {
  const { user, guest, exitGuest } = useAuth();
  const router = useRouter();
  const s = useSettings();
  const { colors, font, type, space, radius } = usePremiumKitTheme();
  const p = useProgress() as Progress | null;

  const xp = p?.xp ?? 0;
  const rating = p?.rating ?? 800;
  const graduated = p?.graduatedClasses?.length ?? 0;
  const rank = rankForClasses(graduated);
  const level = levelForXp(xp);
  const mastered = Object.values(p?.lessons ?? {}).filter((l) => l.mastery >= 0.9).length;
  const unlocked = new Set(p?.unlockedAchievements ?? []);
  const weakTags = Object.entries(p?.weaknesses ?? {}).sort((a, b) => b[1] - a[1]).slice(0, 6);
  const hubItems = (guest ? HUB.filter((h) => !h.authOnly) : HUB).filter((h) => !h.adminOnly || user?.role === "admin");

  const titleStyle = useMemo(
    () => ({
      fontFamily: font.displayBold,
      fontSize: type["2xl"].fontSize,
      lineHeight: type["2xl"].lineHeight,
      color: colors.ink,
    }),
    [font, type, colors],
  );

  return (
    <ThemedSafeArea edges={["top"]}>
      <TopBar />
      <PremiumScreenFrame testID="premium-profile">
        <KitCard variant="paper" style={{ marginTop: space["4"], flexDirection: "row", alignItems: "center", gap: space["3"] }}>
          <FlatAvatar id={guest ? "ava-knight" : s.avatar} size={72} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={titleStyle} numberOfLines={2}>
              {guest ? "Guest learner" : user?.name}
            </Text>
            <Text style={{ fontFamily: font.displaySemibold, fontSize: type.sm.fontSize, color: colors.brand, marginTop: 4 }} numberOfLines={2}>
              {guest ? "Enroll to save progress and unlock your Student ID." : `${rank} · Level ${level} · ${xp} XP`}
            </Text>
          </View>
        </KitCard>

        {guest ? (
          <KitCard style={{ marginTop: space["4"], gap: space["2"] }}>
            <Text style={{ fontFamily: font.displayBold, fontSize: type.base.fontSize, color: colors.ink }}>Save your ChessSchool progress</Text>
            <KitButton label="Log in or enroll" size="sm" block={false} testID="profile-enroll-cta" onPress={() => { exitGuest(); router.push("/login"); }} />
          </KitCard>
        ) : null}

        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space["3"], marginTop: space["5"] }}>
          {hubItems.map((h) => (
            <Pressable key={h.label} testID={`hub-${h.label}`} onPress={() => router.push(h.route as never)} style={{ width: "30%", minWidth: 96, flexGrow: 1, alignItems: "center", gap: space["2"], backgroundColor: colors.surfaceCard, borderRadius: radius.lg, paddingVertical: space["4"], borderWidth: 1, borderColor: colors.hairline }}>
              <KitIcon name={h.icon} size={22} color={colors.brand} />
              <Text style={{ fontFamily: font.displayBold, fontSize: type.xs.fontSize, color: colors.ink, textAlign: "center" }}>{h.label}</Text>
            </Pressable>
          ))}
        </View>

        {!guest ? (
          <>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space["3"], marginTop: space["6"] }}>
              <StatTile icon="flame" tint={colors.chipStreakInk} value={p?.streak ?? 0} label="Day streak" />
              <StatTile icon="check" tint={colors.success} value={mastered} label="Mastered" />
              <StatTile icon="sparkles" tint={colors.brand} value={rating} label="Rating" />
              <StatTile icon="sparkles" tint={colors.gold} value={unlocked.size} label="Badges" />
            </View>
            <Pressable onPress={() => router.push("/notifications")} style={{ marginTop: space["4"] }}>
              <KitCard style={{ flexDirection: "row", alignItems: "center", gap: space["3"] }}>
                <KitIcon name="bell" size={22} color={colors.brand} />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: font.displayBold, fontSize: type.sm.fontSize, color: colors.ink }}>Practice reminders</Text>
                  <Text style={{ fontFamily: font.displayMedium, fontSize: type.xs.fontSize, color: colors.ink500 }}>
                    {s.notificationsEnabled ? "Reminder scheduled" : "Pick a time that works for you"}
                  </Text>
                </View>
                <KitIcon name="chevronRight" size={18} color={colors.ink300} />
              </KitCard>
            </Pressable>
            <Pressable onPress={() => router.push("/dashboard")} style={{ marginTop: space["4"] }}>
              <KitCard>
                <Text style={{ fontFamily: font.displayBold, fontSize: type.base.fontSize, color: colors.ink, marginBottom: space["2"] }}>Learning profile</Text>
                {weakTags.length === 0 ? (
                  <Text style={{ fontFamily: font.displayMedium, fontSize: type.sm.fontSize, color: colors.ink500 }}>No weak spots yet.</Text>
                ) : (
                  <Text style={{ fontFamily: font.displayMedium, fontSize: type.sm.fontSize, color: colors.ink500 }} numberOfLines={3}>
                    {weakTags.map(([t]) => t).join(" · ")}
                  </Text>
                )}
              </KitCard>
            </Pressable>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space["2"], marginTop: space["5"] }}>
              {ACHIEVEMENTS.slice(0, 6).map((a) => (
                <View key={a.id} style={{ width: "31%", alignItems: "center", borderRadius: radius.md, paddingVertical: space["3"], backgroundColor: unlocked.has(a.id) ? colors.brand50 : colors.surfaceSunken }}>
                  <KitIcon name="sparkles" size={20} color={unlocked.has(a.id) ? colors.brand : colors.ink300} />
                  <Text style={{ fontFamily: font.displayBold, fontSize: type.caption.fontSize, color: colors.ink }} numberOfLines={1}>{a.title}</Text>
                </View>
              ))}
            </View>
          </>
        ) : null}
      </PremiumScreenFrame>
    </ThemedSafeArea>
  );
}

function StatTile({ icon, tint, value, label }: { icon: KitIconName; tint: string; value: number; label: string }) {
  const { colors, font, type, radius, space } = usePremiumKitTheme();
  return (
    <View style={{ width: "47%", alignItems: "center", backgroundColor: colors.surfaceCard, borderRadius: radius.lg, paddingVertical: space["4"], borderWidth: 1, borderColor: colors.hairline, gap: 4 }}>
      <KitIcon name={icon} size={18} color={tint} />
      <AnimatedNumber value={value} style={{ fontFamily: font.displayBold, fontSize: type["2xl"].fontSize, color: colors.ink }} />
      <Text style={{ fontFamily: font.displaySemibold, fontSize: type.xs.fontSize, color: colors.ink500 }} numberOfLines={2}>{label}</Text>
    </View>
  );
}

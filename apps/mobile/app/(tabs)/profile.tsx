import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useMemo } from "react";
import { ACHIEVEMENTS } from "@chess-school/core";
import { useAuth } from "@/auth";
import { useProgress } from "@/progressStore";
import { Cody } from "@/Cody";
import { Icon, type IconName } from "@/Icon";
import { TopBar } from "@/TopBar";
import { ThemedSafeArea } from "@/ThemedSafeArea";
import { useAppTheme } from "@/ThemeProvider";
import { levelForXp, rankForClasses } from "@/progress-utils";
import { font, radius, shadowCard, space, type } from "@/theme";

type Lesson = { mastery: number };
type Progress = {
  xp: number;
  rating: number;
  streak: number;
  unlockedAchievements: string[];
  graduatedClasses: string[];
  lessons: Record<string, Lesson>;
  weaknesses: Record<string, number>;
};

const HUB: { icon: IconName; label: string; route: string; authOnly?: boolean }[] = [
  { icon: "learn", label: "Library", route: "/library", authOnly: true },
  { icon: "profile", label: "My ID", route: "/account", authOnly: true },
  { icon: "chart", label: "Report Card", route: "/dashboard", authOnly: true },
  { icon: "calendar", label: "Homework", route: "/homework", authOnly: true },
  { icon: "journal", label: "Journal", route: "/journal", authOnly: true },
  { icon: "palette", label: "Themes", route: "/themes" },
  { icon: "gear", label: "Settings", route: "/settings" },
];

export default function ProfileScreen() {
  const { user, guest, exitGuest, logout } = useAuth();
  const router = useRouter();
  const { colors } = useAppTheme();
  const p = useProgress() as Progress | null;

  const styles = useMemo(
    () =>
      StyleSheet.create({
        content: { padding: space[5], gap: space[5], paddingBottom: 40 },
        idCard: { flexDirection: "row", alignItems: "center", backgroundColor: colors.surfaceCard, borderRadius: radius.card, padding: space[4], ...shadowCard },
        name: { ...type.xl, fontFamily: font.bold, color: colors.ink },
        idSub: { ...type.sm, fontFamily: font.semibold, color: colors.brand, marginTop: 2 },
        enrollCard: { backgroundColor: colors.brand50, borderWidth: 1, borderColor: colors.brand100, borderRadius: radius.card, padding: space[4], gap: space[2] },
        enrollTitle: { ...type.base, fontFamily: font.bold, color: colors.ink },
        enrollCopy: { ...type.sm, fontFamily: font.medium, color: colors.ink500, lineHeight: 20 },
        enrollButton: { alignSelf: "flex-start", marginTop: space[1], backgroundColor: colors.brand, borderRadius: radius.pill, paddingHorizontal: space[4], paddingVertical: 10 },
        enrollButtonText: { ...type.sm, fontFamily: font.bold, color: "#fff" },
        hub: { flexDirection: "row", flexWrap: "wrap", gap: space[3] },
        hubCard: { width: "31%", alignItems: "center", gap: space[2], backgroundColor: colors.surfaceCard, borderRadius: radius.card, paddingVertical: space[4], ...shadowCard },
        hubLabel: { ...type.xs, fontFamily: font.bold, color: colors.ink },
        stats: { flexDirection: "row", flexWrap: "wrap", gap: space[3] },
        stat: { width: "47.5%", alignItems: "center", backgroundColor: colors.surfaceCard, borderRadius: radius.card, paddingVertical: space[4], gap: 4, ...shadowCard },
        statValue: { ...type["2xl"], fontFamily: font.bold, color: colors.ink },
        statLabel: { ...type.xs, fontFamily: font.semibold, color: colors.ink500 },
        h2: { ...type.base, fontFamily: font.bold, color: colors.ink },
        card: { backgroundColor: colors.surfaceCard, borderRadius: radius.card, padding: space[4], ...shadowCard },
        muted: { ...type.sm, fontFamily: font.medium, color: colors.ink500, lineHeight: 20 },
        tagRow: { flexDirection: "row", flexWrap: "wrap", gap: space[2] },
        tag: { backgroundColor: colors.surfaceSunken, borderRadius: radius.pill, paddingHorizontal: space[3], paddingVertical: 6 },
        tagText: { ...type.xs, fontFamily: font.bold, color: colors.ink700, textTransform: "capitalize" },
        cardCta: { flexDirection: "row", alignItems: "center", justifyContent: "flex-end", gap: 4, marginTop: space[3] },
        cardCtaText: { ...type.sm, fontFamily: font.bold, color: colors.brand },
        badges: { flexDirection: "row", flexWrap: "wrap", gap: space[2] },
        badge: { width: "31.5%", alignItems: "center", borderRadius: radius.md, paddingVertical: space[3], gap: 4 },
        badgeOn: { backgroundColor: colors.brand50 },
        badgeOff: { backgroundColor: colors.surfaceSunken },
        badgeTitle: { ...type.caption, fontFamily: font.bold, color: colors.ink },
        logout: { alignSelf: "center", borderWidth: 1, borderColor: colors.danger, borderRadius: radius.md, paddingVertical: 13, paddingHorizontal: 44 },
        logoutText: { color: colors.danger, fontFamily: font.bold, fontSize: 15 },
      }),
    [colors],
  );

  const xp = p?.xp ?? 0;
  const rating = p?.rating ?? 800;
  const graduated = p?.graduatedClasses?.length ?? 0;
  const rank = rankForClasses(graduated);
  const level = levelForXp(xp);
  const mastered = Object.values(p?.lessons ?? {}).filter((l) => l.mastery >= 0.9).length;
  const unlocked = new Set(p?.unlockedAchievements ?? []);
  const weakTags = Object.entries(p?.weaknesses ?? {}).sort((a, b) => b[1] - a[1]).slice(0, 6);
  const hubItems = guest ? HUB.filter((h) => !h.authOnly) : HUB;

  return (
    <ThemedSafeArea edges={["top"]}>
      <TopBar />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.idCard}>
          <Cody expression="happy" size={72} />
          <View style={{ flex: 1, marginLeft: space[2] }}>
            <Text style={styles.name} numberOfLines={1}>{guest ? "Playing as guest" : user?.name}</Text>
            <Text style={styles.idSub}>{guest ? "Enroll to save progress, earn badges, and unlock your Student ID." : `${rank} · Level ${level} · ${xp} XP`}</Text>
          </View>
        </View>

        {guest && (
          <View style={styles.enrollCard}>
            <Text style={styles.enrollTitle}>Save your ChessSchool progress</Text>
            <Text style={styles.enrollCopy}>Create an account to keep lessons, ratings, journal entries, homework, and achievements across devices.</Text>
            <Pressable
              style={styles.enrollButton}
              onPress={() => {
                exitGuest();
                router.push("/login");
              }}
            >
              <Text style={styles.enrollButtonText}>Log in or enroll →</Text>
            </Pressable>
          </View>
        )}

        <View style={styles.hub}>
          {hubItems.map((h) => (
            <Pressable key={h.label} style={styles.hubCard} testID={`hub-${h.label}`} onPress={() => router.push(h.route as never)}>
              <Icon name={h.icon} size={22} color={colors.brand} duotone />
              <Text style={styles.hubLabel}>{h.label}</Text>
            </Pressable>
          ))}
        </View>

        {!guest && (
          <>
            <View style={styles.stats}>
              <Stat styles={styles} icon="flame" tint={colors.accent} value={`${p?.streak ?? 0}`} label="Day streak" />
              <Stat styles={styles} icon="check" tint={colors.success} value={`${mastered}`} label="Lessons mastered" />
              <Stat styles={styles} icon="target" tint={colors.brand} value={`${rating}`} label="Rating" />
              <Stat styles={styles} icon="trophy" tint={colors.gold} value={`${unlocked.size}`} label="Badges" />
            </View>

            <Text style={styles.h2}>Learning profile</Text>
            <Pressable style={styles.card} onPress={() => router.push("/dashboard")}>
              {weakTags.length === 0 ? (
                <Text style={styles.muted}>No weak spots yet — keep playing and I'll track what to review.</Text>
              ) : (
                <>
                  <Text style={styles.muted}>Topics to review — tap for your full report card.</Text>
                  <View style={[styles.tagRow, { marginTop: space[2] }]}>
                    {weakTags.map(([tag, n]) => (
                      <View key={tag} style={styles.tag}>
                        <Text style={styles.tagText}>{tag} · {n}</Text>
                      </View>
                    ))}
                  </View>
                </>
              )}
              <View style={styles.cardCta}>
                <Text style={styles.cardCtaText}>View report card</Text>
                <Icon name="chevronRight" size={16} color={colors.brand} />
              </View>
            </Pressable>

            <Text style={styles.h2}>Achievements</Text>
            <View style={styles.badges}>
              {ACHIEVEMENTS.map((a) => {
                const has = unlocked.has(a.id);
                return (
                  <View key={a.id} style={[styles.badge, has ? styles.badgeOn : styles.badgeOff]}>
                    <Text style={{ fontSize: 24, opacity: has ? 1 : 0.4 }}>{a.emoji}</Text>
                    <Text style={styles.badgeTitle} numberOfLines={1}>{a.title}</Text>
                  </View>
                );
              })}
            </View>

            <Pressable style={styles.logout} onPress={logout}>
              <Text style={styles.logoutText}>Log out</Text>
            </Pressable>
          </>
        )}
      </ScrollView>
    </ThemedSafeArea>
  );
}

function Stat({
  styles,
  icon,
  tint,
  value,
  label,
}: {
  styles: ReturnType<typeof StyleSheet.create>;
  icon: IconName;
  tint: string;
  value: string;
  label: string;
}) {
  return (
    <View style={styles.stat}>
      <Icon name={icon} size={18} color={tint} />
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel} numberOfLines={1}>{label}</Text>
    </View>
  );
}

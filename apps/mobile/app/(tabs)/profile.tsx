import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { ACHIEVEMENTS } from "@chess-school/core";
import { useAuth } from "@/auth";
import { useProgress } from "@/progressStore";
import { Cody } from "@/Cody";
import { Icon, type IconName } from "@/Icon";
import { TopBar } from "@/TopBar";
import { levelForXp, rankForClasses } from "@/progress-utils";
import { colors, font, radius, shadowCard, space, type } from "@/theme";

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

const HUB: { icon: IconName; label: string; route: string }[] = [
  { icon: "learn", label: "Library", route: "/library" },
  { icon: "profile", label: "My ID", route: "/account" },
  { icon: "chart", label: "Report Card", route: "/dashboard" },
  { icon: "calendar", label: "Homework", route: "/homework" },
  { icon: "journal", label: "Journal", route: "/journal" },
  { icon: "palette", label: "Themes", route: "/themes" },
  { icon: "gear", label: "Settings", route: "/settings" },
];

export default function ProfileScreen() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const p = useProgress() as Progress | null;

  const xp = p?.xp ?? 0;
  const rating = p?.rating ?? 800;
  const graduated = p?.graduatedClasses?.length ?? 0;
  const rank = rankForClasses(graduated);
  const level = levelForXp(xp);
  const mastered = Object.values(p?.lessons ?? {}).filter((l) => l.mastery >= 0.9).length;
  const unlocked = new Set(p?.unlockedAchievements ?? []);
  const weakTags = Object.entries(p?.weaknesses ?? {}).sort((a, b) => b[1] - a[1]).slice(0, 6);

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <TopBar />
      <ScrollView contentContainerStyle={styles.content}>
        {/* ID card */}
        <View style={styles.idCard}>
          <Cody expression="happy" size={72} />
          <View style={{ flex: 1, marginLeft: space[2] }}>
            <Text style={styles.name} numberOfLines={1}>{user?.name}</Text>
            <Text style={styles.idSub}>{rank} · Level {level} · {xp} XP</Text>
          </View>
        </View>

        {/* Hub grid */}
        <View style={styles.hub}>
          {HUB.map((h) => (
            <Pressable key={h.label} style={styles.hubCard} testID={`hub-${h.label}`} onPress={() => router.push(h.route as never)}>
              <Icon name={h.icon} size={22} color={colors.brand} duotone />
              <Text style={styles.hubLabel}>{h.label}</Text>
            </Pressable>
          ))}
        </View>

        {/* Stat tiles 2x2 */}
        <View style={styles.stats}>
          <Stat icon="flame" tint={colors.accent} value={`${p?.streak ?? 0}`} label="Day streak" />
          <Stat icon="check" tint={colors.success} value={`${mastered}`} label="Lessons mastered" />
          <Stat icon="target" tint={colors.brand} value={`${rating}`} label="Rating" />
          <Stat icon="trophy" tint={colors.gold} value={`${unlocked.size}`} label="Badges" />
        </View>

        {/* Learning profile → full report card */}
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

        {/* Achievements */}
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
      </ScrollView>
    </SafeAreaView>
  );
}

function Stat({ icon, tint, value, label }: { icon: IconName; tint: string; value: string; label: string }) {
  return (
    <View style={styles.stat}>
      <Icon name={icon} size={18} color={tint} />
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel} numberOfLines={1}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface },
  content: { padding: space[5], gap: space[5], paddingBottom: 40 },
  idCard: { flexDirection: "row", alignItems: "center", backgroundColor: colors.surfaceCard, borderRadius: radius.card, padding: space[4], ...shadowCard },
  name: { ...type.xl, fontFamily: font.bold, color: colors.ink },
  idSub: { ...type.sm, fontFamily: font.semibold, color: colors.brand, marginTop: 2 },
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
});

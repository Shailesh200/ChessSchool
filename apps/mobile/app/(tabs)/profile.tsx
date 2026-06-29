import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { ACHIEVEMENTS } from "@chess-school/core";
import { useAuth } from "@/auth";
import { api } from "@/api";
import { Cody } from "@/Cody";
import { Icon, type IconName } from "@/Icon";
import { colors, font, radius, shadowCard } from "@/theme";

type Mistake = { fen: string; played: string; best: string; tag: string };
type Progress = {
  rating: number;
  xp: number;
  streak: number;
  unlockedAchievements: string[];
  mistakeLog: Mistake[];
};

function ratingTitle(r: number): string {
  if (r >= 2000) return "Master";
  if (r >= 1600) return "Expert";
  if (r >= 1300) return "Advanced";
  if (r >= 1000) return "Intermediate";
  if (r >= 700) return "Improver";
  return "Beginner";
}
const fmt = (m: string) => m.replace(":", "→");

export default function ProfileScreen() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [p, setP] = useState<Progress | null>(null);

  useEffect(() => {
    api<Progress>("/api/progress").then(setP).catch(() => void 0);
  }, []);

  const unlocked = new Set(p?.unlockedAchievements ?? []);
  const rating = p?.rating ?? 800;

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.headerRow}>
          <Text style={styles.h1}>Report Card</Text>
          <Pressable testID="open-settings" onPress={() => router.push("/settings")} hitSlop={10}>
            <Icon name="gear" size={24} color={colors.ink500} />
          </Pressable>
        </View>

        {/* ID card */}
        <View style={styles.idCard}>
          <Cody expression="happy" size={76} />
          <View style={{ flex: 1, marginLeft: 8 }}>
            <Text style={styles.name}>{user?.name}</Text>
            <Text style={styles.email}>{user?.email}</Text>
            <View style={styles.pill}>
              <Text style={styles.pillText}>
                {rating} · {ratingTitle(rating)}
              </Text>
            </View>
          </View>
        </View>

        {/* Quick stats */}
        <View style={styles.row}>
          <Stat label="Rating" value={`${rating}`} />
          <Stat label="Streak" value={`${p?.streak ?? 0}`} />
          <Stat label="Badges" value={`${unlocked.size}`} />
        </View>

        {/* Hub menu */}
        <View style={styles.menu}>
          <MenuRow icon="journal" label="Journal" onPress={() => router.push("/journal")} />
          <MenuRow icon="calendar" label="Today's homework" onPress={() => router.push("/homework")} />
          <MenuRow icon="learn" label="Browse all classes" onPress={() => router.push("/classes")} />
          <MenuRow icon="gear" label="Settings & themes" onPress={() => router.push("/settings")} last />
        </View>

        {/* Achievements (shared ACHIEVEMENTS from @chess-school/core) */}
        <Text style={styles.h2}>Achievements</Text>
        <View style={styles.badges}>
          {ACHIEVEMENTS.map((a) => {
            const has = unlocked.has(a.id);
            return (
              <View key={a.id} style={[styles.badge, has ? styles.badgeOn : styles.badgeOff]}>
                <Text style={{ fontSize: 24, opacity: has ? 1 : 0.4 }}>{a.emoji}</Text>
                <Text style={styles.badgeTitle} numberOfLines={1}>
                  {a.title}
                </Text>
              </View>
            );
          })}
        </View>

        {/* Recent mistakes */}
        <Text style={styles.h2}>Recent mistakes</Text>
        {p?.mistakeLog?.length ? (
          p.mistakeLog.slice(0, 6).map((m, i) => (
            <View key={i} style={styles.mistake}>
              <Text style={styles.mistakeTag}>{m.tag || "mistake"}</Text>
              <Text style={styles.mistakeText}>
                you played <Text style={{ color: colors.danger }}>{fmt(m.played)}</Text> · better{" "}
                <Text style={{ color: colors.success }}>{fmt(m.best)}</Text>
              </Text>
            </View>
          ))
        ) : (
          <Text style={styles.empty}>No mistakes logged yet — they’ll show here as you play lessons.</Text>
        )}

        <Pressable style={styles.logout} onPress={logout}>
          <Text style={styles.logoutText}>Log out</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function MenuRow({ icon, label, onPress, last }: { icon: IconName; label: string; onPress: () => void; last?: boolean }) {
  return (
    <Pressable style={[styles.menuRow, !last && styles.menuDivider]} onPress={onPress}>
      <Icon name={icon} size={20} color={colors.brand} duotone />
      <Text style={styles.menuLabel}>{label}</Text>
      <Icon name="chevronRight" size={18} color={colors.ink300} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface },
  content: { padding: 20, paddingBottom: 40 },
  menu: { marginTop: 16, backgroundColor: colors.surfaceCard, borderRadius: radius.card, paddingHorizontal: 16, ...shadowCard },
  menuRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 15 },
  menuDivider: { borderBottomWidth: 1, borderBottomColor: colors.hairline },
  menuLabel: { flex: 1, fontSize: 15, fontFamily: font.bold, color: colors.ink },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 14 },
  h1: { fontSize: 22, fontFamily: font.bold, color: colors.ink },
  h2: { fontSize: 15, fontFamily: font.bold, color: colors.ink, marginTop: 24, marginBottom: 10 },
  idCard: { flexDirection: "row", alignItems: "center", backgroundColor: colors.surfaceCard, borderRadius: radius.card, padding: 16, ...shadowCard },
  name: { fontSize: 20, fontFamily: font.bold, color: colors.ink },
  email: { fontSize: 13, fontFamily: font.medium, color: colors.ink500, marginTop: 1 },
  pill: { alignSelf: "flex-start", marginTop: 8, backgroundColor: colors.brand50, borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 5 },
  pillText: { color: colors.brand, fontFamily: font.bold, fontSize: 13 },
  row: { flexDirection: "row", gap: 10, marginTop: 14 },
  stat: { flex: 1, backgroundColor: colors.surfaceCard, borderRadius: radius.md, paddingVertical: 14, alignItems: "center", ...shadowCard },
  statValue: { fontSize: 20, fontFamily: font.bold, color: colors.ink },
  statLabel: { fontSize: 11, fontFamily: font.medium, color: colors.ink500, marginTop: 2 },
  badges: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  badge: { width: "30.5%", borderRadius: radius.md, paddingVertical: 14, alignItems: "center", borderWidth: 1 },
  badgeOn: { backgroundColor: "#fff7e0", borderColor: colors.gold },
  badgeOff: { backgroundColor: colors.surfaceSunken, borderColor: colors.hairline },
  badgeTitle: { fontSize: 10, fontFamily: font.semibold, color: colors.ink, marginTop: 4, textAlign: "center" },
  mistake: { backgroundColor: colors.surfaceCard, borderRadius: radius.md, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: colors.hairline },
  mistakeTag: { fontSize: 11, fontFamily: font.bold, color: colors.ink, textTransform: "capitalize" },
  mistakeText: { fontSize: 13, fontFamily: font.medium, color: colors.ink500, marginTop: 2 },
  empty: { fontSize: 13, fontFamily: font.medium, color: colors.ink500 },
  logout: { marginTop: 28, alignSelf: "center", borderWidth: 1, borderColor: colors.danger, borderRadius: radius.md, paddingVertical: 13, paddingHorizontal: 44 },
  logoutText: { color: colors.danger, fontFamily: font.bold, fontSize: 15 },
});

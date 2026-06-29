import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useAuth } from "@/auth";
import { api } from "@/api";
import { Cody } from "@/Cody";
import { Icon } from "@/Icon";
import { Button } from "@/Button";
import { CampusMap, type CampusStage } from "@/CampusMap";
import { colors, font, radius, space, type } from "@/theme";

type Progress = { xp: number; streak: number; dailyGoalXp: number; rating: number; lessons: Record<string, unknown> };
type Resume = {
  complete: boolean;
  lessonId?: string;
  lessonTitle?: string;
  className?: string;
  semesterTitle?: string;
  classIndex?: number;
  totalClasses?: number;
  done?: number;
  total?: number;
};

export default function LearnScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [p, setP] = useState<Progress | null>(null);
  const [resume, setResume] = useState<Resume | null>(null);
  const [stages, setStages] = useState<CampusStage[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      const [pr, rs, cp] = await Promise.all([
        api<Progress>("/api/progress"),
        api<Resume>("/api/next-lesson"),
        api<{ stages: CampusStage[] }>("/api/campus"),
      ]);
      setP(pr);
      setResume(rs);
      setStages(cp.stages ?? []);
    } catch {
      /* keep defaults */
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    load();
  }, []);

  const goal = p?.dailyGoalXp ?? 50;
  const todayXp = p?.xp ?? 0;
  const streak = p?.streak ?? 0;
  const rating = p?.rating ?? 800;
  const isNew = !!p && Object.keys(p.lessons ?? {}).length === 0;

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={colors.brand} />}
      >
        {/* Greeting */}
        <View style={styles.greeting}>
          <Cody expression="wave" size={64} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.title} numberOfLines={1}>
              {streak > 0 ? `Day ${streak} at the academy` : "Welcome to ChessSchool!"}
            </Text>
            <Text style={styles.subtitle}>Graduate through classes. Become a stronger player.</Text>
          </View>
          <View style={styles.ratingChip}>
            <Icon name="target" size={16} color={colors.brand} />
            <Text style={styles.ratingText}>{rating}</Text>
          </View>
        </View>

        {loading && !p ? (
          <ActivityIndicator color={colors.brand} style={{ marginTop: 40 }} />
        ) : (
          <>
            {/* Placement (new user) */}
            {isNew && (
              <View style={styles.placement}>
                <Text style={styles.placementTitle}>🎯 New here? Take a quick placement test</Text>
                <Text style={styles.placementSub}>8 puzzles (~2 min) — we'll place you in Elementary, Middle, or High School.</Text>
                <View style={{ marginTop: space[3], alignSelf: "flex-start" }}>
                  <Button label="Start placement test →" size="sm" onPress={() => resume?.lessonId && router.push({ pathname: "/lesson/[id]", params: { id: resume.lessonId } })} />
                </View>
              </View>
            )}

            {/* Resume */}
            {resume && !resume.complete && resume.lessonId && (
              <View style={styles.card}>
                <View style={styles.breadcrumb}>
                  <Text style={styles.crumb}>🎓 {resume.semesterTitle}</Text>
                  <Text style={styles.crumbSep}> › </Text>
                  <Text style={[styles.crumb, { color: colors.brand }]}>{resume.className}</Text>
                  <Text style={styles.crumbSep}> · </Text>
                  <Text style={styles.crumb}>Class {resume.classIndex}/{resume.totalClasses}</Text>
                </View>
                <Text style={styles.cardTitle}>{resume.lessonTitle}</Text>
                <Text style={styles.cardSub}>Next in {resume.className}</Text>
                <View style={styles.track}>
                  <View style={[styles.fill, { backgroundColor: colors.brand, width: `${((resume.done ?? 0) / (resume.total || 1)) * 100}%` }]} />
                </View>
                <View style={{ marginTop: space[3] }}>
                  <Button
                    label={(resume.done ?? 0) > 0 ? "Continue learning" : "Start learning"}
                    onPress={() => router.push({ pathname: "/lesson/[id]", params: { id: resume.lessonId! } })}
                  />
                </View>
              </View>
            )}

            {/* Today's homework */}
            <Pressable testID="homework" style={styles.homework} onPress={() => router.push("/homework")}>
              <View style={{ flex: 1 }}>
                <Text style={styles.homeworkTitle}>📋 Today's homework</Text>
                <Text style={styles.homeworkSub}>Finish today's set to keep your streak</Text>
              </View>
              <Text style={styles.homeworkCta}>Open →</Text>
            </Pressable>

            {/* Daily goal */}
            <View style={styles.card}>
              <View style={styles.rowBetween}>
                <Text style={styles.goalTitle}>Daily goal</Text>
                <Text style={styles.muted}>{Math.min(todayXp, goal)}/{goal} XP</Text>
              </View>
              <View style={[styles.track, { marginTop: space[2] }]}>
                <View style={[styles.fill, { backgroundColor: colors.gold, width: `${Math.min(100, (todayXp / goal) * 100)}%` }]} />
              </View>
            </View>

            {/* Campus */}
            <CampusMap stages={stages} />
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface },
  content: { padding: space[5], paddingBottom: 40, gap: space[5] },
  greeting: { flexDirection: "row", alignItems: "center", gap: space[3] },
  title: { ...type.xl, fontFamily: font.bold, color: colors.ink },
  subtitle: { ...type.sm, fontFamily: font.semibold, color: colors.ink500, marginTop: 1 },
  ratingChip: { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start", borderRadius: radius.pill, borderWidth: 1, borderColor: colors.hairline, backgroundColor: colors.surfaceCard, paddingHorizontal: space[3], paddingVertical: 6, shadowColor: "#1c1b2e", shadowOpacity: 0.08, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 2 },
  ratingText: { ...type.sm, fontFamily: font.bold, color: colors.ink },
  placement: { borderRadius: radius.card, borderWidth: 1, borderColor: colors.brand100, backgroundColor: colors.brand50, padding: space[4] },
  placementTitle: { ...type.sm, fontFamily: font.bold, color: colors.ink },
  placementSub: { ...type.xs, fontFamily: font.semibold, color: colors.ink500, marginTop: space[1] },
  card: { backgroundColor: colors.surfaceCard, borderRadius: radius.card, padding: space[4], shadowColor: "#1c1b2e", shadowOpacity: 0.08, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 2 },
  breadcrumb: { flexDirection: "row", flexWrap: "wrap", alignItems: "center" },
  crumb: { ...type.caption, fontFamily: font.bold, color: colors.ink500 },
  crumbSep: { ...type.caption, color: colors.ink300 },
  cardTitle: { ...type.lg, fontFamily: font.bold, color: colors.ink, marginTop: space[1] },
  cardSub: { ...type.xs, fontFamily: font.semibold, color: colors.ink500, marginTop: 1 },
  rowBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  goalTitle: { ...type.sm, fontFamily: font.bold, color: colors.ink },
  muted: { ...type.xs, fontFamily: font.bold, color: colors.ink500 },
  track: { height: 10, borderRadius: radius.pill, backgroundColor: colors.surfaceSunken, marginTop: space[2], overflow: "hidden" },
  fill: { height: 10, borderRadius: radius.pill },
  homework: { flexDirection: "row", alignItems: "center", backgroundColor: "#fdf6e0", borderWidth: 1, borderColor: "rgba(246,195,67,0.5)", borderRadius: radius.card, paddingHorizontal: space[4], paddingVertical: space[3] },
  homeworkTitle: { ...type.sm, fontFamily: font.bold, color: colors.ink },
  homeworkSub: { ...type.xs, fontFamily: font.semibold, color: colors.ink500, marginTop: 2 },
  homeworkCta: { ...type.sm, fontFamily: font.bold, color: colors.brand },
});

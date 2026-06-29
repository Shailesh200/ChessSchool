import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useAuth } from "@/auth";
import { api } from "@/api";
import { Cody } from "@/Cody";
import { Icon } from "@/Icon";
import { Button } from "@/Button";
import { colors, font, radius, shadowCard } from "@/theme";

type Progress = { xp: number; streak: number; dailyGoalXp: number };
type Stage = { id: string; name: string; emoji: string; blurb: string; doneClasses: number; totalClasses: number; locked: boolean };
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
  const [stages, setStages] = useState<Stage[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      const [pr, rs, cp] = await Promise.all([
        api<Progress>("/api/progress"),
        api<Resume>("/api/next-lesson"),
        api<{ stages: Stage[] }>("/api/campus"),
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

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={colors.brand} />}
      >
        {/* Greeting */}
        <View style={styles.header}>
          <Cody expression="wave" size={64} />
          <View style={{ flex: 1, marginLeft: 8 }}>
            <Text style={styles.hi}>
              {streak > 0 ? `Day ${streak} at the academy` : `Welcome, ${user?.name?.split(" ")[0] ?? "Student"}!`}
            </Text>
            <Text style={styles.sub}>Graduate through classes. Become a stronger player.</Text>
          </View>
        </View>

        {loading && !p ? (
          <ActivityIndicator color={colors.brand} style={{ marginTop: 40 }} />
        ) : (
          <>
            {/* Resume card */}
            {resume && !resume.complete && resume.lessonId && (
              <View style={styles.card}>
                <View style={styles.breadcrumb}>
                  <Text style={styles.crumb}>🎓 {resume.semesterTitle}</Text>
                  <Text style={styles.crumbSep}> › </Text>
                  <Text style={[styles.crumb, { color: colors.brand }]}>{resume.className}</Text>
                  <Text style={styles.crumbSep}> › </Text>
                  <Text style={styles.crumb}>
                    Class {resume.classIndex}/{resume.totalClasses}
                  </Text>
                </View>
                <Text style={styles.cardTitle}>{resume.lessonTitle}</Text>
                <Text style={styles.cardSub}>Next in {resume.className}</Text>
                <View style={styles.track}>
                  <View style={[styles.fill, { backgroundColor: colors.brand, width: `${((resume.done ?? 0) / (resume.total || 1)) * 100}%` }]} />
                </View>
                <View style={{ marginTop: 14 }}>
                  <Button
                    label={(resume.done ?? 0) > 0 ? "Continue learning" : "Start learning"}
                    onPress={() => router.push({ pathname: "/lesson/[id]", params: { id: resume.lessonId! } })}
                  />
                </View>
              </View>
            )}

            {/* Today's homework — gold banner (matches web; before the daily goal) */}
            <Pressable testID="homework" style={styles.banner} onPress={() => router.push("/homework")}>
              <View style={{ flex: 1 }}>
                <Text style={styles.bannerTitle}>📋 Today's homework</Text>
                <Text style={styles.bannerSub}>Finish today's set to keep your streak</Text>
              </View>
              <Text style={styles.bannerCta}>Open →</Text>
            </Pressable>

            {/* Daily goal */}
            <View style={styles.card}>
              <View style={styles.rowBetween}>
                <Text style={styles.goalTitle}>🎯 Daily goal</Text>
                <Text style={styles.muted}>
                  {Math.min(todayXp, goal)}/{goal} XP
                </Text>
              </View>
              <View style={[styles.track, { marginTop: 12 }]}>
                <View style={[styles.fill, { backgroundColor: colors.gold, width: `${Math.min(100, (todayXp / goal) * 100)}%` }]} />
              </View>
            </View>

            {/* Campus */}
            <Text style={styles.campusHead}>Your campus</Text>
            {stages.map((s) => {
              const pct = s.totalClasses ? (s.doneClasses / s.totalClasses) * 100 : 0;
              return (
                <Pressable
                  key={s.id}
                  testID={`stage-${s.id}`}
                  disabled={s.locked}
                  style={[styles.stage, s.locked && { opacity: 0.55 }]}
                  onPress={() => router.push({ pathname: "/stage/[id]", params: { id: s.id } })}
                >
                  <Text style={styles.stageEmoji}>{s.emoji}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.stageName}>{s.name}</Text>
                    <Text style={styles.stageBlurb}>
                      {s.locked ? "Finish the previous school to unlock" : `${s.doneClasses}/${s.totalClasses} classes · ${s.blurb}`}
                    </Text>
                    {!s.locked && (
                      <View style={[styles.track, { marginTop: 8 }]}>
                        <View style={[styles.fill, { backgroundColor: colors.brand, width: `${pct}%` }]} />
                      </View>
                    )}
                  </View>
                  <Icon name={s.locked ? "lock" : "chevronRight"} size={18} color={colors.ink300} />
                </Pressable>
              );
            })}

            {/* Browse */}
            <Pressable testID="classes" style={styles.navCard} onPress={() => router.push("/classes")}>
              <Icon name="learn" size={22} color={colors.brand} duotone />
              <Text style={styles.navText}>Browse all classes</Text>
              <Icon name="chevronRight" size={20} color={colors.ink300} />
            </Pressable>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface },
  content: { padding: 20, paddingBottom: 40 },
  header: { flexDirection: "row", alignItems: "center" },
  hi: { fontSize: 22, fontFamily: font.bold, color: colors.ink },
  sub: { fontSize: 13.5, fontFamily: font.medium, color: colors.ink500, marginTop: 2 },
  card: { marginTop: 16, backgroundColor: colors.surfaceCard, borderRadius: radius.card, padding: 18, ...shadowCard },
  breadcrumb: { flexDirection: "row", flexWrap: "wrap", alignItems: "center" },
  crumb: { fontSize: 11, fontFamily: font.bold, color: colors.ink500 },
  crumbSep: { fontSize: 11, color: colors.ink300 },
  cardTitle: { fontSize: 19, fontFamily: font.bold, color: colors.ink, marginTop: 4 },
  cardSub: { fontSize: 12.5, fontFamily: font.medium, color: colors.ink500, marginTop: 1 },
  rowBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  goalTitle: { fontSize: 15, fontFamily: font.bold, color: colors.ink },
  muted: { fontSize: 12, fontFamily: font.bold, color: colors.ink500 },
  track: { height: 10, borderRadius: radius.pill, backgroundColor: colors.surfaceSunken, marginTop: 10, overflow: "hidden" },
  fill: { height: 10, borderRadius: radius.pill },
  navCard: { marginTop: 12, flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: colors.surfaceCard, borderRadius: radius.card, padding: 16, ...shadowCard },
  navText: { flex: 1, fontSize: 15, fontFamily: font.bold, color: colors.ink },
  campusHead: { fontSize: 13, fontFamily: font.bold, color: colors.ink500, textTransform: "uppercase", marginTop: 24, marginBottom: 4 },
  stage: { marginTop: 12, flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: colors.surfaceCard, borderRadius: radius.card, padding: 16, ...shadowCard },
  stageEmoji: { fontSize: 28 },
  stageName: { fontSize: 15, fontFamily: font.bold, color: colors.ink },
  stageBlurb: { fontSize: 12, fontFamily: font.medium, color: colors.ink500, marginTop: 1 },
  banner: { marginTop: 16, flexDirection: "row", alignItems: "center", backgroundColor: "#fdf6e0", borderWidth: 1, borderColor: "rgba(246,195,67,0.5)", borderRadius: radius.card, paddingHorizontal: 16, paddingVertical: 14 },
  bannerTitle: { fontSize: 14, fontFamily: font.bold, color: colors.ink },
  bannerSub: { fontSize: 12, fontFamily: font.medium, color: colors.ink500, marginTop: 2 },
  bannerCta: { fontSize: 14, fontFamily: font.bold, color: colors.brand },
});

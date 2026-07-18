import { useMemo, useEffect, useSyncExternalStore } from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "@/auth";
import { Cody } from "@/Cody";
import { Icon } from "@/Icon";
import { emojiToIcon } from "@/iconMaps";
import { Button } from "@/Button";
import { CampusMap } from "@/CampusMap";
import { TopBar } from "@/TopBar";
import { FetchErrorView } from "@/FetchErrorView";
import { ThemedSafeArea } from "@/ThemedSafeArea";
import { LearnScreenSkeleton } from "@/Shimmer";
import { useAppTheme } from "@/ThemeProvider";
import { useType } from "@/typography";
import { useProgress } from "@/progressStore";
import { useLearnData } from "@/useLearnData";
import { useSettings } from "@/settings";
import { dueLessonIds, isDailyPuzzleDone, isoDay, needsPlacementTest, shouldRecommendPreschool } from "@/progression";
import { allRoutineDoneToday, routineDoneToday, ROUTINE_STEP_IDS } from "@/homeworkRoutine";
import { getActiveBotMatch, hydrateMatchStore, subscribeMatchStore } from "@/matchStore";
import { font, radius, shadowCard, space } from "@/theme";

type Progress = {
  xp: number;
  streak: number;
  dailyGoalXp: number;
  rating: number;
  placementDone?: boolean;
  lessons: Record<string, { dueAt: number; mastery: number }>;
  activityDays: Record<string, number>;
  dailyPuzzleDay?: string | null;
};

export default function AcademyScreen() {
  const { guest } = useAuth();
  const router = useRouter();
  const { colors, isDark } = useAppTheme();
  const type = useType();
  const p = useProgress() as Progress | null;
  const { targetElo } = useSettings();
  const { data, initialLoading, pullRefreshing, error, refresh } = useLearnData();

  const resume = data?.resume ?? null;
  const stages = data?.stages ?? [];
  const daily = data?.daily ?? null;

  const styles = useMemo(
    () =>
      StyleSheet.create({
        content: { padding: space[5], paddingBottom: 40, gap: space[5] },
        greeting: { flexDirection: "row", alignItems: "center", gap: space[3] },
        title: { ...type.xl, fontFamily: font.bold, color: colors.ink },
        subtitle: { ...type.sm, fontFamily: font.semibold, color: colors.ink500, marginTop: 1 },
        ratingChip: {
          flexDirection: "row",
          alignItems: "center",
          gap: 6,
          alignSelf: "flex-start",
          borderRadius: radius.pill,
          borderWidth: 1,
          borderColor: colors.hairline,
          backgroundColor: colors.surfaceCard,
          paddingHorizontal: space[3],
          paddingVertical: 6,
          shadowColor: "#1c1b2e",
          shadowOpacity: 0.08,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: 4 },
          elevation: 2,
        },
        ratingText: { ...type.sm, fontFamily: font.bold, color: colors.ink },
        placementOptional: { borderRadius: radius.card, borderWidth: 1, borderColor: colors.hairline, backgroundColor: colors.surfaceSunken, padding: space[4] },
        placement: { borderRadius: radius.card, borderWidth: 1, borderColor: colors.brand100, backgroundColor: colors.brand50, padding: space[4] },
        placementTitle: { ...type.sm, fontFamily: font.bold, color: colors.ink },
        placementSub: { ...type.xs, fontFamily: font.semibold, color: colors.ink500, marginTop: space[1] },
        card: {
          backgroundColor: colors.surfaceCard,
          borderRadius: radius.card,
          borderWidth: 1,
          borderColor: colors.hairline,
          padding: space[5],
          ...shadowCard,
        },
        breadcrumb: { flexDirection: "row", flexWrap: "wrap", alignItems: "center" },
        crumb: { ...type.caption, fontFamily: font.bold, color: colors.ink500 },
        crumbSep: { ...type.caption, color: colors.ink300 },
        cardTitle: { ...type.lg, fontFamily: font.bold, color: colors.ink, marginTop: space[1] },
        cardTitleRow: { flexDirection: "row", alignItems: "center", gap: space[2] },
        cardSub: { ...type.xs, fontFamily: font.semibold, color: colors.ink500, marginTop: 1 },
        rowBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
        goalTitle: { ...type.sm, fontFamily: font.bold, color: colors.ink },
        muted: { ...type.xs, fontFamily: font.bold, color: colors.ink500 },
        track: { height: 12, borderRadius: radius.pill, backgroundColor: colors.surfaceSunken, marginTop: space[2], overflow: "hidden" },
        fill: { height: 12, borderRadius: radius.pill },
        homework: {
          flexDirection: "row",
          alignItems: "center",
          backgroundColor: isDark ? colors.surfaceSunken : "#fdf6e0",
          borderWidth: 1,
          borderColor: isDark ? colors.hairline : "rgba(246,195,67,0.5)",
          borderRadius: radius.card,
          paddingHorizontal: space[4],
          paddingVertical: space[3],
        },
        homeworkTitle: { ...type.sm, fontFamily: font.bold, color: colors.ink },
        homeworkSub: { ...type.xs, fontFamily: font.semibold, color: colors.ink500, marginTop: 2 },
        homeworkCta: { ...type.sm, fontFamily: font.bold, color: colors.brand },
        reviewCard: {
          flexDirection: "row",
          alignItems: "center",
          backgroundColor: colors.brand50,
          borderWidth: 1,
          borderColor: colors.brand100,
          borderRadius: radius.card,
          paddingHorizontal: space[4],
          paddingVertical: space[3],
        },
        dailyCard: {
          flexDirection: "row",
          alignItems: "center",
          backgroundColor: isDark ? colors.surfaceCard : "#eef8ff",
          borderWidth: 1,
          borderColor: isDark ? colors.hairline : "rgba(91,91,214,0.35)",
          borderRadius: radius.card,
          paddingHorizontal: space[4],
          paddingVertical: space[3],
        },
      }),
    [colors, isDark, type],
  );

  const goal = p?.dailyGoalXp ?? 50;
  const today = isoDay();
  const todayXp = (p?.activityDays ?? {})[today] ?? 0;
  const streak = p?.streak ?? 0;
  const rating = p?.rating ?? 800;
  const showPlacement = !guest && !!p && needsPlacementTest(p);
  const recommendPreschool =
    !guest &&
    shouldRecommendPreschool(targetElo, {
      lessons: (p?.lessons ?? {}) as Record<string, { mastery?: number; attempts?: number }>,
      graduatedClasses: (p as { graduatedClasses?: string[] } | null)?.graduatedClasses,
    });
  const dueIds = dueLessonIds((p?.lessons ?? {}) as Record<string, { mastery: number; attempts: number; lastSeen: number; dueAt: number }>);
  const dailyDone = daily ? isDailyPuzzleDone(daily.day, p?.dailyPuzzleDay) : false;
  const homeworkDoneCount = routineDoneToday(p as Record<string, unknown> | null, today).length;
  const homeworkAllDone = allRoutineDoneToday(p as Record<string, unknown> | null, today);
  const showSkeleton = initialLoading && !data;

  useEffect(() => {
    void hydrateMatchStore();
  }, []);
  const activeMatch = useSyncExternalStore(subscribeMatchStore, getActiveBotMatch, () => null);

  return (
    <ThemedSafeArea edges={["top"]}>
      <TopBar />
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={pullRefreshing}
            onRefresh={refresh}
            tintColor={colors.brand}
            title={pullRefreshing ? "Updating…" : undefined}
          />
        }
      >
        <View style={styles.greeting}>
          <Cody expression="wave" size={64} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.title} numberOfLines={1}>
              {guest ? "Welcome to ChessSchool!" : streak > 0 ? `Day ${streak} at the academy` : "Welcome to ChessSchool!"}
            </Text>
            <Text style={styles.subtitle}>
              {guest
                ? "Enroll to the academy to track your progress."
                : "Graduate through classes. Become a stronger player."}
            </Text>
          </View>
          <Pressable
            onPress={() => router.push("/search")}
            accessibilityLabel="Search"
            hitSlop={8}
            style={{
              width: 40,
              height: 40,
              borderRadius: radius.pill,
              borderWidth: 1,
              borderColor: colors.hairline,
              backgroundColor: colors.surfaceCard,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Icon name="search" size={20} color={colors.ink500} />
          </Pressable>
        </View>

        {error && !data ? (
          <FetchErrorView title="Couldn't load campus" message={error} onRetry={refresh} />
        ) : showSkeleton ? (
          <LearnScreenSkeleton />
        ) : (
          <>
            {recommendPreschool && (
              <View style={styles.placementOptional}>
                <View style={styles.cardTitleRow}>
                  <Icon name="seedling" size={18} color={colors.brand} duotone />
                  <Text style={styles.placementTitle}>Optional: Pre-School for complete beginners</Text>
                </View>
                <Text style={styles.placementSub}>
                  Learn the board, pieces, and notation (d6, Nf3, Qd5) — skip anytime if you know the rules.
                </Text>
                <View style={{ marginTop: space[3], alignSelf: "flex-start" }}>
                  <Button label="Start Pre-School →" size="sm" variant="outline" onPress={() => router.push("/class/class-pre-board")} />
                </View>
              </View>
            )}

            {showPlacement && (
              <View style={styles.placement}>
                <View style={styles.cardTitleRow}>
                  <Icon name="target" size={18} color={colors.brand} duotone />
                  <Text style={styles.placementTitle}>New here? Take a quick placement test</Text>
                </View>
                <Text style={styles.placementSub}>8 puzzles (~2 min) — we'll place you in Elementary, Middle, or High School.</Text>
                <View style={{ marginTop: space[3], alignSelf: "flex-start" }}>
                  <Button label="Start placement test →" size="sm" onPress={() => router.push("/placement")} />
                </View>
              </View>
            )}

            {activeMatch && (
              <View style={styles.card}>
                <View style={styles.cardTitleRow}>
                  <Icon name="pawn" size={18} color={colors.brand} duotone />
                  <Text style={styles.cardTitle}>Bot match in progress</Text>
                </View>
                <Text style={styles.cardSub}>Rated {activeMatch.targetElo} · {activeMatch.moves.length} moves played</Text>
                <View style={{ marginTop: space[3] }}>
                  <Button
                    label="Resume match →"
                    onPress={() =>
                      router.push({
                        pathname: "/play/game",
                        params: {
                          elo: String(activeMatch.targetElo),
                          time: activeMatch.timeControlMin > 0 ? String(activeMatch.timeControlMin) : "none",
                        },
                      })
                    }
                  />
                </View>
              </View>
            )}

            {resume?.complete && (
              <View style={styles.card}>
                <View style={styles.cardTitleRow}>
                  <Icon name="trophy" size={18} color={colors.gold} duotone />
                  <Text style={styles.cardTitle}>You&apos;ve graduated!</Text>
                </View>
                <Text style={styles.cardSub}>Replay classes or sharpen up with a match.</Text>
                <View style={{ marginTop: space[3], flexDirection: "row", gap: space[2] }}>
                  <Button label="Review a class" size="sm" onPress={() => router.push("/classes")} />
                  <Button label="Play a match" size="sm" variant="outline" onPress={() => router.push("/(tabs)/play")} />
                </View>
              </View>
            )}

            {resume && !resume.complete && resume.lessonId && (
              <View style={styles.card}>
                <View style={styles.breadcrumb}>
                  <Icon name="cap" size={14} color={colors.ink500} />
                  <Text style={styles.crumb}>{resume.semesterTitle}</Text>
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

            {!guest && dueIds.length > 0 && (
              <Pressable style={styles.reviewCard} onPress={() => router.push({ pathname: "/lesson/[id]", params: { id: dueIds[0]! } })}>
                <View style={{ flex: 1 }}>
                  <View style={styles.cardTitleRow}>
                    <Icon name="review" size={18} color={colors.brand} duotone />
                    <Text style={styles.homeworkTitle}>Review due</Text>
                  </View>
                  <Text style={styles.homeworkSub}>
                    {dueIds.length} lesson{dueIds.length === 1 ? "" : "s"} ready to strengthen your memory
                  </Text>
                </View>
                <Text style={styles.homeworkCta}>Start →</Text>
              </Pressable>
            )}

            {!guest && daily?.lessonId && (
              <Pressable
                style={styles.dailyCard}
                onPress={() => router.push({ pathname: "/lesson/[id]", params: { id: daily.lessonId!, daily: "1" } })}
              >
                <View style={{ flex: 1 }}>
                  <View style={styles.cardTitleRow}>
                    {dailyDone ? (
                      <Icon name="check" size={18} color={colors.success} />
                    ) : (
                      <Icon name={emojiToIcon(daily.emoji ?? "🧩")} size={18} color={colors.brand} duotone />
                    )}
                    <Text style={styles.homeworkTitle}>{dailyDone ? "Daily puzzle done" : "Daily puzzle"}</Text>
                  </View>
                  <Text style={styles.homeworkSub}>
                    {dailyDone ? "Come back tomorrow for a fresh position." : daily.title ?? "One rated puzzle for everyone today"}
                  </Text>
                </View>
                {!dailyDone && <Text style={styles.homeworkCta}>Play →</Text>}
              </Pressable>
            )}

            {!guest && (
              <Pressable style={styles.dailyCard} onPress={() => router.push("/practice/mistakes")}>
                <View style={{ flex: 1 }}>
                  <View style={styles.cardTitleRow}>
                    <Icon name="dna" size={18} color={colors.brand} duotone />
                    <Text style={styles.homeworkTitle}>Puzzles for you</Text>
                  </View>
                  <Text style={styles.homeworkSub}>Re-solve positions from your own mistakes</Text>
                </View>
                <Text style={styles.homeworkCta}>Practice →</Text>
              </Pressable>
            )}

            {!guest && (
              <Pressable testID="homework" style={styles.homework} onPress={() => router.push("/homework")}>
                <View style={{ flex: 1 }}>
                  <View style={styles.cardTitleRow}>
                    {homeworkAllDone ? (
                      <Icon name="check" size={18} color={colors.success} />
                    ) : (
                      <Icon name="journal" size={18} color={colors.brand} duotone />
                    )}
                    <Text style={styles.homeworkTitle}>{homeworkAllDone ? "Homework done for today!" : "Today's homework"}</Text>
                  </View>
                  <Text style={styles.homeworkSub}>
                    {homeworkAllDone
                      ? "Great work — come back tomorrow for a fresh set."
                      : `${homeworkDoneCount}/${ROUTINE_STEP_IDS.length} done — finish today's set to keep your streak`}
                  </Text>
                </View>
                {!homeworkAllDone && <Text style={styles.homeworkCta}>Open →</Text>}
              </Pressable>
            )}

            <View style={styles.card}>
              <View style={styles.rowBetween}>
                <Text style={styles.goalTitle}>Daily goal</Text>
                <Text style={styles.muted}>{Math.min(todayXp, goal)}/{goal} XP</Text>
              </View>
              <View style={[styles.track, { marginTop: space[2] }]}>
                <View style={[styles.fill, { backgroundColor: colors.gold, width: `${Math.min(100, (todayXp / goal) * 100)}%` }]} />
              </View>
            </View>

            <CampusMap stages={stages} />
          </>
        )}
      </ScrollView>
    </ThemedSafeArea>
  );
}

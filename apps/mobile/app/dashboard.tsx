import { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import Svg, { Circle, Line, Polygon, Text as SvgText } from "react-native-svg";
import { api } from "@/api";
import { useProgress } from "@/progressStore";
import { graduationForecast, gameStatsFromRecent, mistakeDNA } from "@/analytics";
import { Icon } from "@/Icon";
import { emojiToIcon } from "@/iconMaps";
import { AppShell } from "@/AppShell";
import { useType } from "@/typography";
import { colors, font, radius, shadowCard, space } from "@/theme";

const SKILL_AREAS = ["Openings", "Tactics", "Strategy", "Endgames", "Calculation"];
const TAG_AREA: Record<string, string> = {
  openings: "Openings", opening: "Openings",
  fork: "Tactics", tactics: "Tactics", capture: "Tactics",
  checkmate: "Calculation", checks: "Calculation", check: "Calculation", mate: "Calculation", famous: "Calculation",
  endgame: "Endgames", opposition: "Endgames", promotion: "Endgames",
  basics: "Strategy", pawns: "Strategy", rooks: "Strategy", knights: "Strategy", drill: "Strategy",
};
function ratingTitle(r: number): string {
  if (r >= 2000) return "Master";
  if (r >= 1600) return "Expert";
  if (r >= 1300) return "Advanced";
  if (r >= 1000) return "Intermediate";
  if (r >= 700) return "Improver";
  return "Beginner";
}

function SkillRadar({ data }: { data: { area: string; mastery: number }[] }) {
  const size = 220, cx = 110, cy = 110, R = 70, n = data.length || 1;
  const angle = (i: number) => (Math.PI * 2 * i) / n - Math.PI / 2;
  const point = (i: number, r: number): [number, number] => [cx + Math.cos(angle(i)) * r, cy + Math.sin(angle(i)) * r];
  const poly = (pts: [number, number][]) => pts.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ");
  return (
    <Svg viewBox={`0 0 ${size} ${size}`} width="100%" height={size}>
      {[0.25, 0.5, 0.75, 1].map((lv) => (
        <Polygon key={lv} points={poly(data.map((_, i) => point(i, R * lv)))} fill="none" stroke={colors.hairline} strokeWidth={1} />
      ))}
      {data.map((_, i) => { const [x, y] = point(i, R); return <Line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke={colors.hairline} strokeWidth={1} />; })}
      <Polygon points={poly(data.map((d, i) => point(i, R * Math.max(0.05, d.mastery))))} fill="rgba(91,91,214,0.25)" stroke={colors.brand} strokeWidth={2} strokeLinejoin="round" />
      {data.map((d, i) => { const [x, y] = point(i, R * Math.max(0.05, d.mastery)); return <Circle key={i} cx={x} cy={y} r={2.6} fill={colors.brand} />; })}
      {data.map((d, i) => { const [x, y] = point(i, R + 16); return <SvgText key={i} x={x} y={y} fontSize={9} fontWeight="800" textAnchor="middle" fill={colors.ink500}>{d.area}</SvgText>; })}
    </Svg>
  );
}

const HEAT = [colors.surfaceSunken, "#c7d2fe", "#a5b4fc", "#818cf8", "#5b5bd6"];
const heatLevel = (xp: number) => (xp === 0 ? 0 : xp < 20 ? 1 : xp < 50 ? 2 : xp < 100 ? 3 : 4);
function StreakHeatmap({ activityDays }: { activityDays: Record<string, number> }) {
  const WEEKS = 13;
  const cells: number[] = [];
  const today = new Date();
  const start = new Date(today);
  start.setDate(today.getDate() - (WEEKS * 7 - 1));
  for (let i = 0; i < WEEKS * 7; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    cells.push(activityDays[d.toISOString().slice(0, 10)] ?? 0);
  }
  return (
    <View style={{ flexDirection: "row", gap: 3 }}>
      {Array.from({ length: WEEKS }, (_, w) => (
        <View key={w} style={{ gap: 3 }}>
          {Array.from({ length: 7 }, (_, d) => (
            <View key={d} style={{ width: 12, height: 12, borderRadius: 3, backgroundColor: HEAT[heatLevel(cells[w * 7 + d]!)] }} />
          ))}
        </View>
      ))}
    </View>
  );
}

type Progress = {
  rating: number;
  streak: number;
  lessons: Record<string, { mastery: number }>;
  activityDays: Record<string, number>;
  weaknesses?: Record<string, number>;
  graduatedClasses?: string[];
  unlockedAchievements?: string[];
  recentGames?: { result?: string; mode?: string }[];
};
type LessonRecord = { mastery: number; incorrect?: number };
type ReportClass = { id: string; title: string; emoji: string; semesterTitle: string; stage: string; lessonIds: string[] };
type ClassReport = {
  id: string;
  title: string;
  emoji: string;
  completed: number;
  total: number;
  attempted: number;
  avgStars: number;
  accuracy: number;
  grade: string;
  passed: boolean;
};

function lessonStars(rec?: LessonRecord): 0 | 1 | 2 | 3 {
  if (!rec || rec.mastery <= 0) return 0;
  const inc = rec.incorrect ?? 0;
  if (rec.mastery >= 0.85 && inc === 0) return 3;
  if (rec.mastery >= 0.6 && inc <= 2) return 2;
  return 1;
}
function gradeFor(avgStars: number): string {
  if (avgStars >= 2.6) return "A+";
  if (avgStars >= 2.2) return "A";
  if (avgStars >= 1.7) return "B";
  if (avgStars >= 1.2) return "C";
  if (avgStars > 0) return "D";
  return "—";
}
function gradeTone(grade: string): { bg: string; fg: string } {
  if (grade === "A+" || grade === "A") return { bg: "rgba(16,185,129,0.15)", fg: colors.success };
  if (grade === "B") return { bg: colors.brand50, fg: colors.brand };
  if (grade === "C") return { bg: "rgba(245,158,11,0.2)", fg: colors.warning };
  if (grade === "D") return { bg: "rgba(244,63,94,0.15)", fg: colors.danger };
  return { bg: colors.surfaceSunken, fg: colors.ink500 };
}
function classReport(cls: ReportClass, records: Record<string, LessonRecord>, graduated: string[]): ClassReport {
  const attempted = cls.lessonIds.filter((id) => (records[id]?.mastery ?? 0) > 0);
  const completed = cls.lessonIds.filter((id) => (records[id]?.mastery ?? 0) >= 0.9).length;
  const avgStars = attempted.length ? attempted.reduce((a, id) => a + lessonStars(records[id]), 0) / attempted.length : 0;
  const accuracy = attempted.length ? attempted.reduce((a, id) => a + (records[id]?.mastery ?? 0), 0) / attempted.length : 0;
  return { id: cls.id, title: cls.title, emoji: cls.emoji, completed, total: cls.lessonIds.length, attempted: attempted.length, avgStars, accuracy, grade: gradeFor(avgStars), passed: graduated.includes(cls.id) };
}
function overallGpa(reports: ClassReport[]): number {
  const graded = reports.filter((r) => r.attempted > 0);
  if (!graded.length) return 0;
  return graded.reduce((a, r) => a + (r.avgStars / 3) * 4, 0) / graded.length;
}

function Trophy({
  label,
  value,
  styles,
}: {
  label: string;
  value: number;
  styles: ReturnType<typeof makeStyles>;
}) {
  return (
    <View style={styles.trophy}>
      <Text style={styles.trophyValue}>{value}</Text>
      <Text style={styles.trophyLabel}>{label}</Text>
    </View>
  );
}

export default function DashboardScreen() {
  const router = useRouter();
  const type = useType();
  const styles = useMemo(() => makeStyles(type), [type]);
  const p = useProgress() as Progress | null;
  const [byTag, setByTag] = useState<Record<string, string[]>>({});
  const [reportClasses, setReportClasses] = useState<ReportClass[]>([]);

  useEffect(() => {
    api<{ lessonsByTag: Record<string, string[]> }>("/api/curriculum-stats").then((d) => setByTag(d.lessonsByTag ?? {})).catch(() => void 0);
    api<{ classes: ReportClass[] }>("/api/report-classes").then((d) => setReportClasses(d.classes ?? [])).catch(() => void 0);
  }, []);

  const tree = useMemo(() => {
    const records = p?.lessons ?? {};
    return SKILL_AREAS.map((area) => {
      const ids: string[] = [];
      for (const [tag, list] of Object.entries(byTag)) if (TAG_AREA[tag] === area) ids.push(...list);
      const masteries = ids.map((id) => records[id]?.mastery ?? 0);
      const sum = masteries.reduce((a, b) => a + b, 0);
      return { area, mastery: ids.length ? sum / ids.length : 0, done: masteries.filter((m) => m >= 0.9).length, lessons: ids.length };
    });
  }, [p, byTag]);

  const rating = p?.rating ?? 800;
  const reports = useMemo(() => {
    const records = ((p?.lessons ?? {}) as Record<string, LessonRecord>);
    const graduated = ((p as { graduatedClasses?: string[] } | null)?.graduatedClasses ?? []);
    return reportClasses.map((c) => classReport(c, records, graduated)).filter((r) => r.attempted > 0).slice(0, 12);
  }, [p, reportClasses]);
  const gpa = overallGpa(reports);
  const graduated = (p as Progress | null)?.graduatedClasses ?? [];
  const unlocked = (p as Progress | null)?.unlockedAchievements ?? [];
  const weaknesses = (p as Progress | null)?.weaknesses ?? {};
  const recentGames = (p as Progress | null)?.recentGames ?? [];
  const stats = gameStatsFromRecent(recentGames);
  const forecast = graduationForecast(graduated.length, p?.streak ?? 0);
  const findings = mistakeDNA(weaknesses, stats);

  return (
    <AppShell>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: 100 }]}>
        <Pressable style={styles.back} onPress={() => router.back()} hitSlop={8}>
          <View style={{ transform: [{ rotate: "180deg" }] }}><Icon name="chevronRight" size={18} color={colors.ink} /></View>
          <Text style={styles.backText}>Back</Text>
        </Pressable>
        <Text style={styles.h1}>Report Card</Text>

        {/* Rating */}
        <View style={styles.ratingCard}>
          <View style={{ alignItems: "center" }}>
            <Text style={styles.rating}>{rating}</Text>
            <Text style={styles.ratingSub}>your rating (ELO)</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.identity}>Your chess identity</Text>
            <View style={styles.pill}><Text style={styles.pillText}>{ratingTitle(rating)}</Text></View>
            <Text style={styles.statsLine}>{stats.total} games · {Math.round(stats.winRate * 100)}% win rate</Text>
          </View>
        </View>

        {/* Report card */}
        <Text style={styles.h2}>Class grades</Text>
        <View style={styles.card}>
          {reports.length === 0 ? (
            <View style={styles.titleRow}>
              <Icon name="journal" size={16} color={colors.ink500} />
              <Text style={styles.emptyReport}>Complete a lesson to start your report card.</Text>
            </View>
          ) : (
            <>
              <View style={styles.reportHead}>
                <View>
                  <Text style={styles.reportKicker}>Report Card</Text>
                  <Text style={styles.gpa}>GPA {gpa.toFixed(2)} <Text style={styles.gpaSub}>/ 4.0</Text></Text>
                </View>
                <Icon name="cap" size={32} color={colors.brand} duotone />
              </View>
              <View style={{ gap: space[2], marginTop: space[3] }}>
                {reports.map((r) => {
                  const tone = gradeTone(r.grade);
                  return (
                    <View key={r.id} style={styles.reportRow}>
                      <Icon name={emojiToIcon(r.emoji)} size={22} color={colors.brand} duotone />
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={styles.reportTitle} numberOfLines={1}>{r.title}</Text>
                        <Text style={styles.reportMeta} numberOfLines={1}>
                          {r.completed}/{r.total} done · {Math.round(r.accuracy * 100)}% accuracy{r.passed ? " · ✓ passed" : ""}
                        </Text>
                        <View style={styles.starsRow}>
                          {[1, 2, 3].map((s) => (
                            <Icon
                              key={s}
                              name="star"
                              size={12}
                              color={r.avgStars >= s - 0.4 ? colors.gold : colors.ink300}
                            />
                          ))}
                        </View>
                      </View>
                      <View style={[styles.grade, { backgroundColor: tone.bg }]}>
                        <Text style={[styles.gradeText, { color: tone.fg }]}>{r.grade}</Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            </>
          )}
        </View>

        {/* Skill tree */}
        <Text style={styles.h2}>Skill tree</Text>
        <View style={styles.card}>
          <SkillRadar data={tree.map((n) => ({ area: n.area, mastery: n.mastery }))} />
          <View style={{ gap: space[2], marginTop: space[2] }}>
            {tree.map((n) => {
              const pct = Math.round(n.mastery * 100);
              const tone = pct >= 90 ? colors.gold : colors.brand;
              return (
                <View key={n.area}>
                  <View style={styles.skillRow}>
                    <Text style={styles.skillArea}>{n.area}</Text>
                    <Text style={styles.skillPct}>{pct}%</Text>
                  </View>
                  <View style={styles.skillTrack}>
                    <View style={[styles.skillFill, { width: `${pct}%`, backgroundColor: tone }]} />
                  </View>
                </View>
              );
            })}
          </View>
        </View>

        {/* Graduation forecast */}
        <View style={styles.rowH2}>
          <Icon name="cap" size={18} color={colors.brand} duotone />
          <Text style={styles.h2}>Graduation forecast</Text>
        </View>
        <View style={styles.card}>
          <View style={styles.track}>
            <View style={[styles.trackFill, { width: `${forecast.totalClasses ? (forecast.graduatedClasses / forecast.totalClasses) * 100 : 0}%`, backgroundColor: colors.gold }]} />
          </View>
          <View style={styles.forecastRow}>
            <Text style={styles.forecastText}>
              {forecast.graduatedClasses}/{forecast.totalClasses} classes graduated ·{" "}
              {forecast.remaining === 0 ? "All classes complete!" : `~${forecast.estDays} active days to graduation`}
            </Text>
            {forecast.remaining === 0 && <Icon name="trophy" size={16} color={colors.gold} />}
          </View>
        </View>

        {/* Activity heatmap */}
        <View style={styles.rowH2}>
          <Icon name="flame" size={18} color={colors.accent} />
          <Text style={styles.h2}>Activity · </Text>
          <Text style={[styles.h2, { color: colors.ink500 }]}>{p?.streak ?? 0}-day streak</Text>
        </View>
        <View style={styles.card}>
          <StreakHeatmap activityDays={p?.activityDays ?? {}} />
        </View>

        {/* Mistake DNA */}
        <View style={styles.rowH2}>
          <Icon name="dna" size={18} color={colors.brand} duotone />
          <Text style={styles.h2}>Mistake DNA</Text>
        </View>
        <View style={{ gap: space[2] }}>
          {findings.map((f, i) => (
            <View key={i} style={styles.dnaCard}>
              <Text style={[styles.dnaSeverity, f.severity === "high" && styles.dnaHigh, f.severity === "medium" && styles.dnaMed]}>{f.severity}</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.dnaLabel}>{f.label}</Text>
                <Text style={styles.dnaRec}>{f.recommendation}</Text>
              </View>
            </View>
          ))}
        </View>
        <Pressable style={styles.practiceLink} onPress={() => router.push("/practice/mistakes")}>
          <View style={styles.titleRow}>
            <Icon name="target" size={16} color={colors.brand} />
            <Text style={styles.practiceLinkText}>Practice mistake positions →</Text>
          </View>
        </Pressable>

        <View style={styles.rowH2}>
          <Icon name="trophy" size={18} color={colors.gold} duotone />
          <Text style={styles.h2}>Trophy room</Text>
        </View>
        <View style={styles.card}>
          <View style={styles.trophyRow}>
            <Trophy label="Graduations" value={graduated.length} styles={styles} />
            <Trophy label="Badges" value={unlocked.length} styles={styles} />
            <Trophy label="Wins" value={stats.wins} styles={styles} />
          </View>
        </View>
      </ScrollView>
    </AppShell>
  );
}

function makeStyles(type: ReturnType<typeof useType>) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.surface },
    content: { padding: space[5], gap: space[4], paddingBottom: 40 },
    back: { flexDirection: "row", alignItems: "center", alignSelf: "flex-start", gap: 4, backgroundColor: colors.surfaceCard, borderRadius: radius.pill, paddingHorizontal: space[3], paddingVertical: space[1.5], ...shadowCard },
    backText: { ...type.sm, fontFamily: font.bold, color: colors.ink },
    h1: { ...type.xl, fontFamily: font.bold, color: colors.ink },
    h2: { ...type.sm, fontFamily: font.bold, color: colors.ink },
    rowH2: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: space[1] },
    titleRow: { flexDirection: "row", alignItems: "center", gap: space[2] },
    starsRow: { flexDirection: "row", gap: 2, marginTop: 2 },
    forecastRow: { flexDirection: "row", alignItems: "center", gap: space[2], flexWrap: "wrap" },
    ratingCard: { flexDirection: "row", alignItems: "center", gap: space[4], backgroundColor: colors.surfaceCard, borderRadius: radius.card, padding: space[4], ...shadowCard },
    rating: { fontSize: 36, lineHeight: 40, fontFamily: font.bold, color: colors.brand },
    ratingSub: { ...type.caption, fontFamily: font.semibold, color: colors.ink500 },
    identity: { ...type.sm, fontFamily: font.bold, color: colors.ink },
    pill: { alignSelf: "flex-start", backgroundColor: colors.brand50, borderRadius: radius.pill, paddingHorizontal: space[3], paddingVertical: space[1], marginTop: space[1] },
    pillText: { ...type.xs, fontFamily: font.bold, color: colors.brand },
    statsLine: { ...type.xs, fontFamily: font.semibold, color: colors.ink500, marginTop: space[1] },
    track: { height: 10, borderRadius: radius.pill, backgroundColor: colors.surfaceSunken, overflow: "hidden" },
    trackFill: { height: 10, borderRadius: radius.pill },
    forecastText: { ...type.xs, fontFamily: font.semibold, color: colors.ink500, marginTop: space[2] },
    dnaCard: { flexDirection: "row", gap: space[2], backgroundColor: colors.surfaceCard, borderRadius: radius.card, padding: space[3], ...shadowCard },
    dnaSeverity: { ...type.caption, fontFamily: font.bold, color: colors.ink500, textTransform: "uppercase", alignSelf: "flex-start", backgroundColor: colors.surfaceSunken, borderRadius: radius.pill, paddingHorizontal: space[2], paddingVertical: 2 },
    dnaHigh: { backgroundColor: "rgba(244,63,94,0.15)", color: colors.danger },
    dnaMed: { backgroundColor: "rgba(245,158,11,0.15)", color: colors.warning },
    dnaLabel: { ...type.sm, fontFamily: font.bold, color: colors.ink },
    dnaRec: { ...type.xs, fontFamily: font.semibold, color: colors.ink500, marginTop: 2 },
    practiceLink: { alignSelf: "flex-start", marginTop: -space[2] },
    practiceLinkText: { ...type.sm, fontFamily: font.bold, color: colors.brand },
    trophyRow: { flexDirection: "row", gap: space[2] },
    trophy: { flex: 1, alignItems: "center", backgroundColor: colors.surfaceSunken, borderRadius: radius.card, paddingVertical: space[3] },
    trophyValue: { ...type.xl, fontFamily: font.bold, color: colors.ink },
    trophyLabel: { ...type.caption, fontFamily: font.semibold, color: colors.ink500, marginTop: 2 },
    card: { backgroundColor: colors.surfaceCard, borderRadius: radius.card, padding: space[4], ...shadowCard },
    emptyReport: { ...type.sm, fontFamily: font.semibold, color: colors.ink500, textAlign: "center", paddingVertical: space[3] },
    reportHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderBottomWidth: 1, borderStyle: "dashed", borderColor: colors.hairline, paddingBottom: space[2] },
    reportKicker: { ...type.caption, fontFamily: font.bold, color: colors.ink500, textTransform: "uppercase", letterSpacing: 0.5 },
    gpa: { ...type["2xl"], fontFamily: font.bold, color: colors.ink },
    gpaSub: { ...type.sm, fontFamily: font.bold, color: colors.ink500 },
    reportRow: { flexDirection: "row", alignItems: "center", gap: space[3], borderRadius: radius.card, borderWidth: 1, borderColor: colors.hairline, backgroundColor: "rgba(255,255,255,0.6)", padding: space[2.5] },
    reportTitle: { ...type.sm, fontFamily: font.bold, color: colors.ink },
    reportMeta: { ...type.caption, fontFamily: font.semibold, color: colors.ink500, marginTop: 1 },
    stars: { fontSize: 11, lineHeight: 14, marginTop: 2 },
    grade: { borderRadius: radius.md, paddingHorizontal: space[2.5], paddingVertical: space[1] },
    gradeText: { ...type.base, fontFamily: font.bold },
    skillRow: { flexDirection: "row", justifyContent: "space-between" },
    skillArea: { ...type.xs, fontFamily: font.bold, color: colors.ink },
    skillPct: { ...type.xs, fontFamily: font.bold, color: colors.ink500 },
    skillTrack: { height: 8, borderRadius: radius.pill, backgroundColor: colors.surfaceSunken, overflow: "hidden", marginTop: 4 },
    skillFill: { height: 8, borderRadius: radius.pill },
  });
}

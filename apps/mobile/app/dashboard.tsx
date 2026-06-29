import { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import Svg, { Circle, Line, Polygon, Text as SvgText } from "react-native-svg";
import { api } from "@/api";
import { Icon } from "@/Icon";
import { TopBar } from "@/TopBar";
import { colors, font, radius, shadowCard, space, type } from "@/theme";

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

type Progress = { rating: number; streak: number; lessons: Record<string, { mastery: number }>; activityDays: Record<string, number> };

export default function DashboardScreen() {
  const router = useRouter();
  const [p, setP] = useState<Progress | null>(null);
  const [byTag, setByTag] = useState<Record<string, string[]>>({});

  useEffect(() => {
    api<Progress>("/api/progress").then(setP).catch(() => void 0);
    api<{ lessonsByTag: Record<string, string[]> }>("/api/curriculum-stats").then((d) => setByTag(d.lessonsByTag ?? {})).catch(() => void 0);
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

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <TopBar />
      <ScrollView contentContainerStyle={styles.content}>
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
          </View>
        </View>

        {/* Skill tree */}
        <Text style={styles.h2}>Skill tree</Text>
        <View style={styles.card}>
          <SkillRadar data={tree.map((n) => ({ area: n.area, mastery: n.mastery }))} />
          <View style={{ gap: space[1], marginTop: space[2] }}>
            {tree.map((n) => (
              <View key={n.area} style={styles.skillRow}>
                <Text style={styles.skillArea}>{n.area}</Text>
                <Text style={styles.skillPct}>{Math.round(n.mastery * 100)}%</Text>
              </View>
            ))}
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
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface },
  content: { padding: space[5], gap: space[4], paddingBottom: 40 },
  back: { flexDirection: "row", alignItems: "center", alignSelf: "flex-start", gap: 4, backgroundColor: colors.surfaceCard, borderRadius: radius.pill, paddingHorizontal: space[3], paddingVertical: space[1.5], ...shadowCard },
  backText: { ...type.sm, fontFamily: font.bold, color: colors.ink },
  h1: { ...type.xl, fontFamily: font.bold, color: colors.ink },
  h2: { ...type.sm, fontFamily: font.bold, color: colors.ink },
  rowH2: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: space[1] },
  ratingCard: { flexDirection: "row", alignItems: "center", gap: space[4], backgroundColor: colors.surfaceCard, borderRadius: radius.card, padding: space[4], ...shadowCard },
  rating: { fontSize: 36, lineHeight: 40, fontFamily: font.bold, color: colors.brand },
  ratingSub: { ...type.caption, fontFamily: font.semibold, color: colors.ink500 },
  identity: { ...type.sm, fontFamily: font.bold, color: colors.ink },
  pill: { alignSelf: "flex-start", backgroundColor: colors.brand50, borderRadius: radius.pill, paddingHorizontal: space[3], paddingVertical: space[1], marginTop: space[1] },
  pillText: { ...type.xs, fontFamily: font.bold, color: colors.brand },
  card: { backgroundColor: colors.surfaceCard, borderRadius: radius.card, padding: space[4], ...shadowCard },
  skillRow: { flexDirection: "row", justifyContent: "space-between" },
  skillArea: { ...type.xs, fontFamily: font.bold, color: colors.ink },
  skillPct: { ...type.xs, fontFamily: font.bold, color: colors.ink500 },
});

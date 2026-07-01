import { useEffect, useMemo, useState, useCallback } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import Svg, { Circle, G } from "react-native-svg";
import { api } from "@/api";
import { Button } from "@/Button";
import { FetchErrorView } from "@/FetchErrorView";
import { TopBar } from "@/TopBar";
import { haptics } from "@/haptics";
import { fetchProgress, lessonRecordsFromCache, progressStore } from "@/progressStore";
import { colors, font, radius, shadowCard, space, type } from "@/theme";

type LessonLite = { id: string; title: string; subtitle: string; emoji: string };
type ClassData = { class: { id: string; title: string; emoji: string; blurb: string; examId: string | null }; lessons: LessonLite[]; exam: { id: string; title: string } | null };
type NodeStatus = "completed" | "active" | "locked" | "exam";
type JNode = { id: string; title: string; subtitle: string; emoji: string; mastery: number; status: NodeStatus };

function JourneyNode({ node, index, onPress }: { node: JNode; index: number; onPress: () => void }) {
  const offset = index % 2 === 0 ? 0 : index % 4 === 1 ? 48 : -48;
  const r = 30;
  const circ = 2 * Math.PI * r;
  const isExam = node.status === "exam";
  const ring = node.status === "completed" ? colors.gold : isExam ? colors.warning : colors.brand;
  const prog = node.status === "locked" ? 0 : node.status === "completed" ? 1 : Math.max(node.mastery, 0.06);
  const bg = node.status === "locked" ? colors.surfaceSunken : isExam ? "#fff7e6" : "#fff";
  const locked = node.status === "locked";

  return (
    <View style={{ width: "100%", alignItems: "center" }}>
      {index > 0 && <View style={styles.connector} />}
      <Pressable onPress={onPress} style={{ alignItems: "center", gap: 4, transform: [{ translateX: offset }], opacity: locked ? 0.6 : 1 }}>
        <View style={{ width: 76, height: 76, justifyContent: "center", alignItems: "center" }}>
          {node.status === "active" && <View style={styles.halo} />}
          <Svg width={76} height={76} style={{ position: "absolute" }}>
            <G rotation={-90} origin="38, 38">
              <Circle cx={38} cy={38} r={r} fill="none" stroke={colors.surfaceSunken} strokeWidth={6} />
              <Circle cx={38} cy={38} r={r} fill="none" stroke={ring} strokeWidth={6} strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={circ * (1 - prog)} />
            </G>
          </Svg>
          <View style={[styles.nodeCircle, { backgroundColor: bg }]}>
            <Text style={{ fontSize: 20 }}>{locked ? "🔒" : node.status === "completed" ? "✓" : node.emoji}</Text>
          </View>
        </View>
        <Text style={styles.nodeTitle} numberOfLines={1}>{node.title}</Text>
        <Text style={styles.nodeSub} numberOfLines={1}>{node.subtitle}</Text>
      </Pressable>
    </View>
  );
}

export default function ClassJourneyScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [data, setData] = useState<ClassData | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [records, setRecords] = useState<Record<string, { mastery: number }>>({});
  const [shown, setShown] = useState(6);

  async function loadProgressRecords() {
    await fetchProgress(false);
    setRecords(lessonRecordsFromCache());
  }

  async function loadClass() {
    setLoadError(false);
    setData(null);
    try {
      const classData = await api<ClassData>(`/api/class/${id}`);
      setData(classData);
      await loadProgressRecords();
    } catch {
      setLoadError(true);
    }
  }

  useEffect(() => {
    void loadClass();
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      void loadProgressRecords();
    }, []),
  );

  useEffect(() => {
    const unsub = progressStore.subscribe(() => {
      setRecords(lessonRecordsFromCache());
    });
    return () => {
      unsub();
    };
  }, []);

  const { nodes, done, activeIndex, minutes } = useMemo(() => {
    const lessons = data?.lessons ?? [];
    const masteryOf = (lid: string) => records[lid]?.mastery ?? 0;
    const doneN = lessons.filter((l) => masteryOf(l.id) >= 0.9).length;
    const active = lessons.findIndex((l) => masteryOf(l.id) < 0.9);
    const ns: JNode[] = lessons.map((l, i) => {
      const m = masteryOf(l.id);
      const status: NodeStatus = m >= 0.9 ? "completed" : i === active ? "active" : "locked";
      return { id: l.id, title: l.title, subtitle: l.subtitle, emoji: l.emoji, mastery: m, status };
    });
    return { nodes: ns, done: doneN, activeIndex: active, minutes: (lessons.length + (data?.exam ? 1 : 0)) * 3 };
  }, [data, records]);

  if (loadError) {
    return (
      <SafeAreaView style={styles.safe}>
        <FetchErrorView title="Class couldn't load" onRetry={loadClass} onBack={() => router.back()} />
      </SafeAreaView>
    );
  }

  if (!data) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}><ActivityIndicator color={colors.brand} size="large" /></View>
      </SafeAreaView>
    );
  }

  const cls = data.class;
  const total = data.lessons.length;
  const firstActionable = nodes.find((n) => n.status === "active") ?? nodes.find((n) => n.status === "completed");
  const canTestOut = total > 0 && done / total >= 0.5 && done < total;
  const visibleCount = Math.min(nodes.length, Math.max(shown, activeIndex + 1));
  const go = (lid: string, status: NodeStatus) => {
    if (status === "locked") { haptics.error(); return; }
    haptics.tap();
    router.push({ pathname: "/lesson/[id]", params: { id: lid } });
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <TopBar />
      <ScrollView contentContainerStyle={styles.content}>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <Text style={styles.back}>← Campus</Text>
        </Pressable>

        {/* Subject header */}
        <View style={styles.header}>
          <View style={styles.headerRow}>
            <View style={styles.emojiTile}><Text style={{ fontSize: 28 }}>{cls.emoji}</Text></View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.title} numberOfLines={1}>{cls.title}</Text>
              <Text style={styles.blurb} numberOfLines={1}>{cls.blurb}</Text>
            </View>
          </View>
          <View style={styles.chips}>
            <Text style={styles.chip}>📚 {total} lessons</Text>
            <Text style={styles.chip}>⏱️ ~{minutes} min</Text>
            <Text style={styles.chip}>⭐ {done}/{total} mastered</Text>
          </View>
          {firstActionable && (
            <View style={{ marginTop: space[3] }}>
              <Button label={done > 0 ? "Continue journey" : "Start journey"} onPress={() => go(firstActionable.id, firstActionable.status)} />
            </View>
          )}
          {canTestOut && (
            <View style={{ marginTop: space[2] }}>
              <Button label="Test out of this class →" variant="outline" onPress={() => router.push({ pathname: "/class/[id]/exam", params: { id } })} />
            </View>
          )}
        </View>

        {/* Milestone path */}
        <View style={styles.path}>
          {nodes.slice(0, visibleCount).map((n, i) => (
            <JourneyNode key={n.id} node={n} index={i} onPress={() => go(n.id, n.status)} />
          ))}
          {visibleCount < nodes.length && (
            <Pressable style={styles.showMore} onPress={() => setShown((s) => s + 8)}>
              <Text style={styles.showMoreText}>Show {Math.min(8, nodes.length - visibleCount)} more lessons ▾</Text>
            </Pressable>
          )}
          {data.exam && visibleCount >= nodes.length && (
            <JourneyNode
              node={{ id: data.exam.id, title: data.exam.title, subtitle: "Pass to graduate", emoji: "📝", mastery: 0, status: "exam" }}
              index={nodes.length}
              onPress={() => go(data.exam!.id, "exam")}
            />
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  content: { padding: space[5], gap: space[5], paddingBottom: 40 },
  back: { ...type.sm, fontFamily: font.bold, color: colors.brand },
  showMore: { width: "100%", marginTop: space[3], paddingVertical: space[3], alignItems: "center" },
  showMoreText: { ...type.sm, fontFamily: font.bold, color: colors.brand },
  header: { borderRadius: radius.card, borderWidth: 1, borderColor: colors.hairline, backgroundColor: colors.surfaceCard, padding: space[4], ...shadowCard },
  headerRow: { flexDirection: "row", alignItems: "center", gap: space[3] },
  emojiTile: { width: 56, height: 56, borderRadius: 16, backgroundColor: colors.brand50, justifyContent: "center", alignItems: "center" },
  title: { ...type.lg, fontFamily: font.bold, color: colors.ink },
  blurb: { ...type.xs, fontFamily: font.semibold, color: colors.ink500, marginTop: 1 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: space[2], marginTop: space[3] },
  chip: { ...type.caption, fontFamily: font.bold, color: colors.ink700, backgroundColor: colors.surfaceSunken, borderRadius: radius.pill, paddingHorizontal: space[2], paddingVertical: space[1], overflow: "hidden" },
  path: { width: "100%", maxWidth: 320, alignSelf: "center", alignItems: "center" },
  connector: { width: 6, height: 24, borderRadius: radius.pill, backgroundColor: colors.hairline, marginVertical: 4 },
  halo: { position: "absolute", width: 76, height: 76, borderRadius: 38, backgroundColor: "rgba(91,91,214,0.22)" },
  nodeCircle: { position: "absolute", width: 48, height: 48, borderRadius: 24, justifyContent: "center", alignItems: "center", borderBottomWidth: 3, borderBottomColor: "rgba(0,0,0,0.12)" },
  nodeTitle: { ...type.sm, fontFamily: font.bold, color: colors.ink, maxWidth: 150 },
  nodeSub: { ...type.caption, fontFamily: font.semibold, color: colors.ink500, maxWidth: 150 },
});

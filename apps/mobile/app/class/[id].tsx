import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { Animated, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import Svg, { Circle, G } from "react-native-svg";
import { api } from "@/api";
import { Button } from "@/Button";
import { FetchErrorView } from "@/FetchErrorView";
import { AppShell } from "@/AppShell";
import { Icon } from "@/Icon";
import { emojiToIcon } from "@/iconMaps";
import { haptics } from "@/haptics";
import { isLessonUnlocked } from "@/lessonUnlock";
import { fetchProgress, lessonRecordsFromCache, progressStore } from "@/progressStore";
import { ScreenLoader } from "@/ScreenLoader";
import { useSettings } from "@/settings";
import { useAppTheme, type ThemeColors } from "@/ThemeProvider";
import { font, radius, shadowCard, space, type } from "@/theme";

type LessonLite = {
  id: string;
  title: string;
  subtitle: string;
  emoji: string;
  prerequisites?: string[];
};
type ClassData = {
  class: { id: string; title: string; emoji: string; blurb: string; examId: string | null };
  lessons: LessonLite[];
  exam: { id: string; title: string } | null;
  unlocked?: boolean;
};
type NodeStatus = "completed" | "active" | "locked" | "exam";
type JNode = { id: string; title: string; subtitle: string; emoji: string; mastery: number; status: NodeStatus };

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.surface },
    center: { flex: 1, justifyContent: "center", alignItems: "center" },
    content: { padding: space[5], gap: space[5], paddingBottom: 40 },
    back: { ...type.sm, fontFamily: font.bold, color: colors.brand },
    lockBanner: {
      borderRadius: radius.card,
      borderWidth: 1,
      borderColor: colors.warning,
      backgroundColor: colors.surfaceCard,
      padding: space[4],
    },
    lockTitle: { ...type.sm, fontFamily: font.bold, color: colors.ink },
    lockSub: { ...type.xs, fontFamily: font.semibold, color: colors.ink500, marginTop: space[1] },
    showMore: { width: "100%", marginTop: space[3], paddingVertical: space[3], alignItems: "center" },
    showMoreText: { ...type.sm, fontFamily: font.bold, color: colors.brand },
    header: { borderRadius: radius.card, borderWidth: 1, borderColor: colors.hairline, backgroundColor: colors.surfaceCard, padding: space[4], ...shadowCard },
    headerRow: { flexDirection: "row", alignItems: "center", gap: space[3] },
    emojiTile: { width: 56, height: 56, borderRadius: 16, backgroundColor: colors.brand50, justifyContent: "center", alignItems: "center" },
    title: { ...type.lg, fontFamily: font.bold, color: colors.ink },
    blurb: { ...type.xs, fontFamily: font.semibold, color: colors.ink500, marginTop: 1 },
    chips: { flexDirection: "row", flexWrap: "wrap", gap: space[2], marginTop: space[3] },
    chipRow: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: colors.surfaceSunken, borderRadius: radius.pill, paddingHorizontal: space[2], paddingVertical: space[1] },
    chip: { ...type.caption, fontFamily: font.bold, color: colors.ink700, overflow: "hidden" },
    path: { width: "100%", maxWidth: 320, alignSelf: "center", alignItems: "center" },
    connector: { width: 6, height: 24, borderRadius: radius.pill, backgroundColor: colors.hairline, marginVertical: 4 },
    halo: { position: "absolute", width: 76, height: 76, borderRadius: 38, backgroundColor: "rgba(91,91,214,0.22)" },
    nodeCircle: { position: "absolute", width: 48, height: 48, borderRadius: 24, justifyContent: "center", alignItems: "center", borderBottomWidth: 3, borderBottomColor: "rgba(0,0,0,0.12)" },
    nodeTitle: { ...type.sm, fontFamily: font.bold, color: colors.ink, maxWidth: 150 },
    nodeSub: { ...type.caption, fontFamily: font.semibold, color: colors.ink500, maxWidth: 150 },
  });
}

function JourneyNode({
  node,
  index,
  onPress,
  styles,
  colors,
}: {
  node: JNode;
  index: number;
  onPress: () => void;
  styles: ReturnType<typeof makeStyles>;
  colors: ThemeColors;
}) {
  const { reducedMotion } = useSettings();
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (node.status !== "active" || reducedMotion) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 900, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 900, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [node.status, pulse, reducedMotion]);

  const offset = index % 2 === 0 ? 0 : index % 4 === 1 ? 48 : -48;
  const r = 30;
  const circ = 2 * Math.PI * r;
  const isExam = node.status === "exam";
  const ring = node.status === "completed" ? colors.gold : isExam ? colors.warning : colors.brand;
  const prog = node.status === "locked" ? 0 : node.status === "completed" ? 1 : Math.max(node.mastery, 0.06);
  const bg = node.status === "locked" ? colors.surfaceSunken : isExam ? colors.brand50 : colors.surfaceCard;
  const locked = node.status === "locked";

  return (
    <View style={{ width: "100%", alignItems: "center" }}>
      {index > 0 && <View style={styles.connector} />}
      <Pressable onPress={onPress} style={{ alignItems: "center", gap: 4, transform: [{ translateX: offset }], opacity: locked ? 0.6 : 1 }}>
        <View style={{ width: 76, height: 76, justifyContent: "center", alignItems: "center" }}>
          {node.status === "active" && (
            <Animated.View
              style={[
                styles.halo,
                {
                  opacity: reducedMotion ? 0.35 : pulse.interpolate({ inputRange: [0, 1], outputRange: [0.2, 0.55] }),
                  transform: [{ scale: reducedMotion ? 1 : pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] }) }],
                },
              ]}
            />
          )}
          <Svg width={76} height={76} style={{ position: "absolute" }}>
            <G rotation={-90} origin="38, 38">
              <Circle cx={38} cy={38} r={r} fill="none" stroke={colors.surfaceSunken} strokeWidth={6} />
              <Circle cx={38} cy={38} r={r} fill="none" stroke={ring} strokeWidth={6} strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={circ * (1 - prog)} />
            </G>
          </Svg>
          <View style={[styles.nodeCircle, { backgroundColor: bg }]}>
            {locked ? (
              <Icon name="lock" size={20} color={colors.ink500} />
            ) : node.status === "completed" ? (
              <Icon name="check" size={20} color={colors.gold} />
            ) : (
              <Icon name={emojiToIcon(node.emoji)} size={20} color={colors.brand} duotone />
            )}
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
  const { colors: theme } = useAppTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
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

  const classUnlocked = data?.unlocked !== false;

  const { nodes, done, activeIndex, minutes } = useMemo(() => {
    const lessons = data?.lessons ?? [];
    const masteryOf = (lid: string) => records[lid]?.mastery ?? 0;
    const doneN = lessons.filter((l) => masteryOf(l.id) >= 0.9).length;
    let active = -1;
    let foundActive = false;
    const ns: JNode[] = lessons.map((l, i) => {
      const m = masteryOf(l.id);
      const prereqOk = isLessonUnlocked(l.id, l.prerequisites ?? [], records);
      if (!classUnlocked || !prereqOk) {
        return { id: l.id, title: l.title, subtitle: l.subtitle, emoji: l.emoji, mastery: m, status: "locked" as const };
      }
      if (m >= 0.9) {
        return { id: l.id, title: l.title, subtitle: l.subtitle, emoji: l.emoji, mastery: m, status: "completed" as const };
      }
      if (!foundActive) {
        foundActive = true;
        active = i;
        return { id: l.id, title: l.title, subtitle: l.subtitle, emoji: l.emoji, mastery: m, status: "active" as const };
      }
      return { id: l.id, title: l.title, subtitle: l.subtitle, emoji: l.emoji, mastery: m, status: "locked" as const };
    });
    return { nodes: ns, done: doneN, activeIndex: active, minutes: (lessons.length + (data?.exam ? 1 : 0)) * 3 };
  }, [data, records, classUnlocked]);

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
        <ScreenLoader variant="fullscreen" label="Loading class…" />
      </SafeAreaView>
    );
  }

  const cls = data.class;
  const total = data.lessons.length;
  const firstActionable = nodes.find((n) => n.status === "active") ?? nodes.find((n) => n.status === "completed");
  const canTestOut = classUnlocked && total > 0 && done / total >= 0.5 && done < total;
  const visibleCount = Math.min(nodes.length, Math.max(shown, activeIndex + 1));
  const go = (lid: string, status: NodeStatus) => {
    if (status === "locked") { haptics.error(); return; }
    haptics.tap();
    router.push({ pathname: "/lesson/[id]", params: { id: lid } });
  };

  return (
    <AppShell>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: 100 }]}>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <Text style={styles.back}>← Campus</Text>
        </Pressable>

        {!classUnlocked && (
          <View style={styles.lockBanner}>
            <Text style={styles.lockTitle}>Class locked</Text>
            <Text style={styles.lockSub}>Graduate the previous class on Campus to unlock this journey.</Text>
          </View>
        )}

        <View style={styles.header}>
          <View style={styles.headerRow}>
            <View style={styles.emojiTile}>
              <Icon name={emojiToIcon(cls.emoji)} size={28} color={theme.brand} duotone />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text testID="class-title" style={styles.title} numberOfLines={1}>{cls.title}</Text>
              <Text style={styles.blurb} numberOfLines={1}>{cls.blurb}</Text>
            </View>
          </View>
          <View style={styles.chips}>
            <View style={styles.chipRow}>
              <Icon name="book" size={12} color={theme.ink700} />
              <Text style={styles.chip}>{total} lessons</Text>
            </View>
            <View style={styles.chipRow}>
              <Icon name="calendar" size={12} color={theme.ink700} />
              <Text style={styles.chip}>~{minutes} min</Text>
            </View>
            <View style={styles.chipRow}>
              <Icon name="star" size={12} color={theme.ink700} />
              <Text style={styles.chip}>{done}/{total} mastered</Text>
            </View>
          </View>
          {classUnlocked && firstActionable && (
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

        <View style={styles.path}>
          {nodes.slice(0, visibleCount).map((n, i) => (
            <JourneyNode key={n.id} node={n} index={i} styles={styles} colors={theme} onPress={() => go(n.id, n.status)} />
          ))}
          {visibleCount < nodes.length && (
            <Pressable style={styles.showMore} onPress={() => setShown((s) => s + 8)}>
              <Text style={styles.showMoreText}>Show {Math.min(8, nodes.length - visibleCount)} more lessons ▾</Text>
            </Pressable>
          )}
          {data.exam && visibleCount >= nodes.length && classUnlocked && (
            <JourneyNode
              node={{ id: data.exam.id, title: data.exam.title, subtitle: "Pass to graduate", emoji: "📝", mastery: 0, status: "exam" }}
              index={nodes.length}
              styles={styles}
              colors={theme}
              onPress={() => go(data.exam!.id, "exam")}
            />
          )}
        </View>
      </ScrollView>
    </AppShell>
  );
}

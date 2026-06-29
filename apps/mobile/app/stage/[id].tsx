import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { api } from "@/api";
import { Icon } from "@/Icon";
import { TopBar } from "@/TopBar";
import { BackButton } from "@/BackButton";
import { colors, font, radius, shadowCard, space } from "@/theme";

type Cls = { id: string; title: string; emoji: string; blurb: string; done: number; total: number };
type Stage = { id: string; name: string; emoji: string; classes: Cls[] };

export default function StageScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [stage, setStage] = useState<Stage | null>(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    api<{ stages: Stage[] }>("/api/campus")
      .then((d) => {
        const s = d.stages.find((x) => x.id === id) ?? null;
        setStage(s);
        setMissing(!s);
      })
      .catch(() => setMissing(true));
  }, [id]);

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <TopBar />
      <View style={styles.header}>
        <BackButton />
        <Text style={styles.h1}>{stage ? `${stage.emoji} ${stage.name}` : "School"}</Text>
      </View>

      {!stage ? (
        <View style={styles.center}>{missing ? <Text style={styles.muted}>Not found</Text> : <ActivityIndicator color={colors.brand} size="large" />}</View>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          {stage.classes.map((c) => {
            const pct = c.total ? (c.done / c.total) * 100 : 0;
            const complete = c.total > 0 && c.done >= c.total;
            return (
              <Pressable
                key={c.id}
                testID={`class-${c.id}`}
                style={styles.card}
                onPress={() => router.push({ pathname: "/class/[id]", params: { id: c.id } })}
              >
                <Text style={styles.emoji}>{c.emoji}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.title}>{c.title}</Text>
                  <Text style={styles.sub}>
                    {complete ? "✓ Complete" : `${c.done}/${c.total} lessons`}
                    {c.blurb ? ` · ${c.blurb}` : ""}
                  </Text>
                  <View style={[styles.track, { marginTop: 8 }]}>
                    <View style={[styles.fill, { backgroundColor: complete ? colors.success : colors.brand, width: `${pct}%` }]} />
                  </View>
                </View>
                <Icon name="chevronRight" size={18} color={colors.ink300} />
              </Pressable>
            );
          })}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  muted: { fontFamily: font.medium, color: colors.ink500 },
  header: { paddingHorizontal: 20, paddingTop: space[2], paddingBottom: space[2], gap: space[2] },
  h1: { fontSize: 20, fontFamily: font.bold, color: colors.ink },
  content: { paddingHorizontal: 20, paddingBottom: 30 },
  card: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: colors.surfaceCard, borderRadius: radius.card, padding: 14, marginBottom: 10, ...shadowCard },
  emoji: { fontSize: 26 },
  title: { fontSize: 15, fontFamily: font.bold, color: colors.ink },
  sub: { fontSize: 12, fontFamily: font.medium, color: colors.ink500, marginTop: 1 },
  track: { height: 8, borderRadius: radius.pill, backgroundColor: colors.surfaceSunken, overflow: "hidden" },
  fill: { height: 8, borderRadius: radius.pill },
});

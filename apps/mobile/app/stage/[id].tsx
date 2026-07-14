import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { api } from "@/api";
import { Icon } from "@/Icon";
import { emojiToIcon } from "@/iconMaps";
import { AppShell } from "@/AppShell";
import { BackButton } from "@/BackButton";
import { useAppTheme } from "@/ThemeProvider";
import { font, radius, shadowCard, space } from "@/theme";

type Cls = { id: string; title: string; emoji: string; blurb: string; done: number; total: number };
type Stage = { id: string; name: string; emoji: string; classes: Cls[] };

export default function StageScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { colors } = useAppTheme();
  const [stage, setStage] = useState<Stage | null>(null);
  const [missing, setMissing] = useState(false);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        center: { flex: 1, justifyContent: "center", alignItems: "center" },
        muted: { fontFamily: font.medium, color: colors.ink500 },
        header: { paddingHorizontal: space[5], paddingTop: space[2], paddingBottom: space[2], gap: space[2] },
        titleRow: { flexDirection: "row", alignItems: "center", gap: space[2] },
        h1: { fontSize: 20, fontFamily: font.bold, color: colors.ink },
        content: { paddingHorizontal: space[5], paddingBottom: 100 },
        card: {
          flexDirection: "row",
          alignItems: "center",
          gap: 12,
          backgroundColor: colors.surfaceCard,
          borderRadius: radius.card,
          padding: 14,
          marginBottom: 10,
          ...shadowCard,
        },
        emoji: { width: 32, alignItems: "center" },
        title: { fontSize: 15, fontFamily: font.bold, color: colors.ink },
        sub: { fontSize: 12, fontFamily: font.medium, color: colors.ink500, marginTop: 1 },
        track: { height: 8, borderRadius: radius.pill, backgroundColor: colors.surfaceSunken, overflow: "hidden" },
        fill: { height: 8, borderRadius: radius.pill },
      }),
    [colors],
  );

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
    <AppShell>
      <View style={styles.header}>
        <BackButton />
        <View style={styles.titleRow}>
          {stage && <Icon name={emojiToIcon(stage.emoji)} size={20} color={colors.brand} duotone />}
          <Text style={styles.h1}>{stage ? stage.name : "School"}</Text>
        </View>
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
                <View style={styles.emoji}>
                  <Icon name={emojiToIcon(c.emoji)} size={26} color={colors.brand} duotone />
                </View>
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
    </AppShell>
  );
}

import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, SectionList, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { api } from "@/api";
import { Icon } from "@/Icon";
import { emojiToIcon } from "@/iconMaps";
import { Button } from "@/Button";
import { AppShell } from "@/AppShell";
import { BackButton } from "@/BackButton";
import { useAppTheme } from "@/ThemeProvider";
import { useType } from "@/typography";
import { font, radius, shadowCard, space } from "@/theme";

type Lesson = { id: string; title: string; emoji: string };
type Group = { semester: string; lessons: Lesson[] };
type Section = { title: string; data: Lesson[] };

export default function LibraryScreen() {
  const router = useRouter();
  const { colors } = useAppTheme();
  const type = useType();
  const [groups, setGroups] = useState<Group[] | null>(null);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        content: { padding: space[5], gap: space[4], paddingBottom: 100 },
        header: { gap: space[2] },
        h1: { ...type.xl, fontFamily: font.bold, color: colors.ink },
        sub: { ...type.sm, fontFamily: font.semibold, color: colors.ink500, marginTop: -space[1] },
        semTitle: { ...type.xs, fontFamily: font.bold, color: colors.ink500, textTransform: "uppercase", marginBottom: space[2] },
        row: {
          flexDirection: "row",
          alignItems: "center",
          gap: space[3],
          backgroundColor: colors.surfaceCard,
          borderRadius: radius.md,
          padding: space[3],
          marginBottom: space[2],
          ...shadowCard,
        },
        rowTitle: { flex: 1, ...type.sm, fontFamily: font.bold, color: colors.ink },
        emptyCard: { backgroundColor: colors.surfaceCard, borderRadius: radius.card, padding: space[5], alignItems: "center", ...shadowCard },
        emptyText: { textAlign: "center", marginTop: space[2], ...type.sm, fontFamily: font.semibold, color: colors.ink500, lineHeight: 20 },
      }),
    [colors, type],
  );

  const sections = useMemo<Section[]>(
    () => (groups ?? []).map((g) => ({ title: g.semester, data: g.lessons })),
    [groups],
  );

  useEffect(() => {
    api<{ groups: Group[] }>("/api/library")
      .then((d) => setGroups(d.groups ?? []))
      .catch(() => setGroups([]));
  }, []);

  return (
    <AppShell>
      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        stickySectionHeadersEnabled={false}
        contentContainerStyle={styles.content}
        ListHeaderComponent={
          <View style={styles.header}>
            <BackButton />
            <Text style={styles.h1}>Lesson Library</Text>
            <Text style={styles.sub}>Revisit any lesson you've completed.</Text>
          </View>
        }
        ListEmptyComponent={
          !groups ? (
            <ActivityIndicator color={colors.brand} style={{ marginTop: 40 }} />
          ) : (
            <View style={styles.emptyCard}>
              <Icon name="cap" size={30} color={colors.brand} duotone />
              <Text style={styles.emptyText}>No completed lessons yet — finish lessons in the campus and they'll collect here.</Text>
              <View style={{ marginTop: space[3], width: 200 }}>
                <Button label="Go to campus →" onPress={() => router.back()} />
              </View>
            </View>
          )
        }
        renderSectionHeader={({ section }) => <Text style={styles.semTitle}>{section.title}</Text>}
        renderItem={({ item }) => (
          <Pressable style={styles.row} onPress={() => router.push({ pathname: "/lesson/[id]", params: { id: item.id } })}>
            <Icon name={emojiToIcon(item.emoji)} size={20} color={colors.brand} duotone />
            <Text style={styles.rowTitle} numberOfLines={1}>
              {item.title}
            </Text>
            <Icon name="chevronRight" size={18} color={colors.ink300} />
          </Pressable>
        )}
      />
    </AppShell>
  );
}

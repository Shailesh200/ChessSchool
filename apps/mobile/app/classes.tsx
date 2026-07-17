import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, SectionList, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { api } from "@/api";
import { FetchErrorView } from "@/FetchErrorView";
import { Icon } from "@/Icon";
import { emojiToIcon } from "@/iconMaps";
import { AppShell } from "@/AppShell";
import { BackButton } from "@/BackButton";
import { useAppTheme } from "@/ThemeProvider";
import { useType } from "@/typography";
import { font, radius, space } from "@/theme";

type Sem = { id: string; title: string; stage: string };
type Cls = { id: string; title: string; emoji: string; blurb: string; semesterId: string };
type Section = { title: string; data: Cls[] };

export default function ClassesScreen() {
  const router = useRouter();
  const { colors } = useAppTheme();
  const type = useType();
  const [data, setData] = useState<{ semesters: Sem[]; classes: Cls[] } | null>(null);
  const [loadError, setLoadError] = useState(false);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        center: { flex: 1, justifyContent: "center", alignItems: "center" },
        header: { paddingHorizontal: space[5], paddingTop: space[2], paddingBottom: space[2], gap: space[2] },
        h1: { ...type.xl, fontFamily: font.bold, color: colors.ink },
        content: { paddingHorizontal: space[5], paddingBottom: 100 },
        semTitle: { ...type.xs, fontFamily: font.bold, color: colors.ink500, textTransform: "uppercase", marginBottom: 8, marginTop: 10 },
        card: {
          flexDirection: "row",
          alignItems: "center",
          gap: 12,
          backgroundColor: colors.surfaceCard,
          borderRadius: radius.md,
          padding: 14,
          marginBottom: 8,
          borderWidth: 1,
          borderColor: colors.hairline,
        },
        emoji: { width: 28, alignItems: "center" },
        cardTitle: { ...type.sm, fontFamily: font.bold, color: colors.ink },
        cardSub: { ...type.xs, fontFamily: font.medium, color: colors.ink500, marginTop: 1 },
      }),
    [colors, type],
  );

  async function loadCatalog() {
    setLoadError(false);
    setData(null);
    try {
      setData(await api<{ semesters: Sem[]; classes: Cls[] }>("/api/catalog"));
    } catch {
      setLoadError(true);
    }
  }

  useEffect(() => {
    void loadCatalog();
  }, []);

  const sections = useMemo<Section[]>(() => {
    if (!data) return [];
    return data.semesters
      .map((s) => ({ title: s.title, data: data.classes.filter((c) => c.semesterId === s.id) }))
      .filter((g) => g.data.length > 0);
  }, [data]);

  return (
    <AppShell>
      <View style={styles.header}>
        <BackButton />
        <Text style={styles.h1}>All classes</Text>
      </View>

      {loadError ? (
        <FetchErrorView title="Catalog couldn't load" onRetry={loadCatalog} onBack={() => router.back()} />
      ) : !data ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.brand} size="large" />
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.id}
          stickySectionHeadersEnabled={false}
          contentContainerStyle={styles.content}
          renderSectionHeader={({ section }) => <Text style={styles.semTitle}>{section.title}</Text>}
          renderItem={({ item: c }) => (
            <Pressable
              testID={`class-${c.id}`}
              style={styles.card}
              onPress={() => router.push({ pathname: "/class/[id]", params: { id: c.id } })}
            >
              <View style={styles.emoji}>
                <Icon name={emojiToIcon(c.emoji)} size={24} color={colors.brand} duotone />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>{c.title}</Text>
                {!!c.blurb && <Text style={styles.cardSub}>{c.blurb}</Text>}
              </View>
              <Icon name="chevronRight" size={18} color={colors.ink300} />
            </Pressable>
          )}
        />
      )}
    </AppShell>
  );
}

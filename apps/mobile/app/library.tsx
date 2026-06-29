import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { api } from "@/api";
import { Icon } from "@/Icon";
import { Button } from "@/Button";
import { TopBar } from "@/TopBar";
import { BackButton } from "@/BackButton";
import { colors, font, radius, shadowCard, space, type } from "@/theme";

type Group = { semester: string; lessons: { id: string; title: string; emoji: string }[] };

export default function LibraryScreen() {
  const router = useRouter();
  const [groups, setGroups] = useState<Group[] | null>(null);

  useEffect(() => {
    api<{ groups: Group[] }>("/api/library")
      .then((d) => setGroups(d.groups ?? []))
      .catch(() => setGroups([]));
  }, []);

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <TopBar />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <BackButton />
          <Text style={styles.h1}>Lesson Library</Text>
          <Text style={styles.sub}>Revisit any lesson you've completed.</Text>
        </View>

        {!groups ? (
          <ActivityIndicator color={colors.brand} style={{ marginTop: 40 }} />
        ) : groups.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={{ fontSize: 30 }}>🎓</Text>
            <Text style={styles.emptyText}>No completed lessons yet — finish lessons in the campus and they'll collect here.</Text>
            <View style={{ marginTop: space[3], width: 200 }}>
              <Button label="Go to campus →" onPress={() => router.back()} />
            </View>
          </View>
        ) : (
          groups.map((g) => (
            <View key={g.semester} style={{ gap: space[2] }}>
              <Text style={styles.semTitle}>{g.semester}</Text>
              {g.lessons.map((l) => (
                <Pressable key={l.id} style={styles.row} onPress={() => router.push({ pathname: "/lesson/[id]", params: { id: l.id } })}>
                  <Text style={{ fontSize: 20 }}>{l.emoji}</Text>
                  <Text style={styles.rowTitle} numberOfLines={1}>{l.title}</Text>
                  <Icon name="chevronRight" size={18} color={colors.ink300} />
                </Pressable>
              ))}
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface },
  content: { padding: space[5], gap: space[4], paddingBottom: 40 },
  header: { gap: space[2] },
  h1: { ...type.xl, fontFamily: font.bold, color: colors.ink },
  sub: { ...type.sm, fontFamily: font.semibold, color: colors.ink500, marginTop: -space[1] },
  semTitle: { ...type.xs, fontFamily: font.bold, color: colors.ink500, textTransform: "uppercase" },
  row: { flexDirection: "row", alignItems: "center", gap: space[3], backgroundColor: colors.surfaceCard, borderRadius: radius.md, padding: space[3], ...shadowCard },
  rowTitle: { flex: 1, ...type.sm, fontFamily: font.bold, color: colors.ink },
  emptyCard: { backgroundColor: colors.surfaceCard, borderRadius: radius.card, padding: space[5], alignItems: "center", ...shadowCard },
  emptyText: { textAlign: "center", marginTop: space[2], ...type.sm, fontFamily: font.semibold, color: colors.ink500, lineHeight: 20 },
});

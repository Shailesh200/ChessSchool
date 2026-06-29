import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { api } from "@/api";
import { Icon } from "@/Icon";
import { colors, font, radius, shadowCard } from "@/theme";

type Sem = { id: string; title: string; stage: string };
type Cls = { id: string; title: string; emoji: string; blurb: string; semesterId: string };

export default function ClassesScreen() {
  const router = useRouter();
  const [data, setData] = useState<{ semesters: Sem[]; classes: Cls[] } | null>(null);

  useEffect(() => {
    api<{ semesters: Sem[]; classes: Cls[] }>("/api/catalog").then(setData).catch(() => void 0);
  }, []);

  const grouped = useMemo(() => {
    if (!data) return [];
    return data.semesters
      .map((s) => ({ sem: s, classes: data.classes.filter((c) => c.semesterId === s.id) }))
      .filter((g) => g.classes.length > 0);
  }, [data]);

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Text style={styles.close}>✕</Text>
        </Pressable>
        <Text style={styles.h1}>All classes</Text>
      </View>

      {!data ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.brand} size="large" />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          {grouped.map(({ sem, classes }) => (
            <View key={sem.id} style={{ marginBottom: 18 }}>
              <Text style={styles.semTitle}>{sem.title}</Text>
              {classes.map((c) => (
                <Pressable
                  key={c.id}
                  testID={`class-${c.id}`}
                  style={styles.card}
                  onPress={() => router.push({ pathname: "/class/[id]", params: { id: c.id } })}
                >
                  <Text style={styles.emoji}>{c.emoji}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardTitle}>{c.title}</Text>
                    {!!c.blurb && <Text style={styles.cardSub}>{c.blurb}</Text>}
                  </View>
                  <Icon name="chevronRight" size={18} color={colors.ink300} />
                </Pressable>
              ))}
            </View>
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  header: { flexDirection: "row", alignItems: "center", gap: 14, paddingHorizontal: 20, paddingTop: 6, paddingBottom: 8 },
  close: { fontSize: 20, color: colors.ink500, fontFamily: font.bold },
  h1: { fontSize: 22, fontFamily: font.bold, color: colors.ink },
  content: { paddingHorizontal: 20, paddingBottom: 30 },
  semTitle: { fontSize: 13, fontFamily: font.bold, color: colors.ink500, textTransform: "uppercase", marginBottom: 8 },
  card: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: colors.surfaceCard, borderRadius: radius.md, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: colors.hairline },
  emoji: { fontSize: 24 },
  cardTitle: { fontSize: 15, fontFamily: font.bold, color: colors.ink },
  cardSub: { fontSize: 12, fontFamily: font.medium, color: colors.ink500, marginTop: 1 },
});

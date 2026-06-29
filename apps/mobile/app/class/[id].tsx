import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { api } from "@/api";
import { Icon } from "@/Icon";
import { colors, font, radius } from "@/theme";

type Lesson = { id: string; title: string; subtitle: string; emoji: string };

export default function ClassScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [lessons, setLessons] = useState<Lesson[] | null>(null);

  useEffect(() => {
    api<{ lessons: Lesson[] }>(`/api/class/${id}`)
      .then((d) => setLessons(d.lessons))
      .catch(() => setLessons([]));
  }, [id]);

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Text style={styles.close}>✕</Text>
        </Pressable>
        <Text style={styles.h1}>Lessons</Text>
      </View>

      {!lessons ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.brand} size="large" />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          {lessons.map((l, i) => (
            <Pressable
              key={l.id}
              testID={`lesson-${l.id}`}
              style={styles.row}
              onPress={() => router.push({ pathname: "/lesson/[id]", params: { id: l.id } })}
            >
              <View style={styles.num}>
                <Text style={styles.numText}>{i + 1}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.title}>{l.title}</Text>
                {!!l.subtitle && <Text style={styles.sub}>{l.subtitle}</Text>}
              </View>
              <Icon name="chevronRight" size={18} color={colors.ink300} />
            </Pressable>
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
  row: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: colors.surfaceCard, borderRadius: radius.md, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: colors.hairline },
  num: { width: 30, height: 30, borderRadius: 15, backgroundColor: colors.brand50, justifyContent: "center", alignItems: "center" },
  numText: { fontFamily: font.bold, color: colors.brand, fontSize: 13 },
  title: { fontSize: 15, fontFamily: font.bold, color: colors.ink },
  sub: { fontSize: 12, fontFamily: font.medium, color: colors.ink500, marginTop: 1 },
});

import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { api } from "@/api";
import { Icon, type IconName } from "@/Icon";
import { Cody } from "@/Cody";
import { colors, font, radius, shadowCard } from "@/theme";

type Hw = { id: string; title: string; tag: string };
const TYPES: { id: string; label: string; icon: IconName; tint: string }[] = [
  { id: "warmup", label: "Warmup", icon: "flame", tint: colors.accent },
  { id: "practice", label: "Tactics practice", icon: "target", tint: colors.brand },
  { id: "review", label: "Checkmate review", icon: "review", tint: colors.success },
  { id: "reflection", label: "Reflection", icon: "journal", tint: colors.gold },
];

export default function HomeworkScreen() {
  const router = useRouter();
  const [byType, setByType] = useState<Record<string, Hw[]>>({});

  useEffect(() => {
    api<{ byType: Record<string, Hw[]> }>("/api/homework")
      .then((d) => setByType(d.byType ?? {}))
      .catch(() => void 0);
  }, []);

  const dayIndex = Math.floor(Date.now() / 86400000);
  const pick = (type: string): Hw | null => {
    const pool = byType[type] ?? [];
    return pool.length ? pool[dayIndex % pool.length]! : null;
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <Text style={styles.close}>✕</Text>
          </Pressable>
          <Text style={styles.h1}>Today's homework</Text>
        </View>

        <View style={styles.intro}>
          <Cody expression="happy" size={64} />
          <Text style={styles.introText}>A fresh set each day — from topics you've learned.</Text>
        </View>

        {TYPES.map((t) => {
          const hw = pick(t.id);
          return (
            <Pressable
              key={t.id}
              testID={`hw-${t.id}`}
              disabled={!hw}
              style={[styles.card, !hw && { opacity: 0.5 }]}
              onPress={() => hw && router.push({ pathname: "/lesson/[id]", params: { id: hw.id } })}
            >
              <View style={[styles.iconWrap, { backgroundColor: t.tint + "22" }]}>
                <Icon name={t.icon} size={22} color={t.tint} duotone />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardLabel}>{t.label}</Text>
                <Text style={styles.cardSub}>{hw ? hw.title : "No session available"}</Text>
              </View>
              <Icon name="chevronRight" size={20} color={colors.ink300} />
            </Pressable>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface },
  content: { padding: 20 },
  header: { flexDirection: "row", alignItems: "center", gap: 14 },
  close: { fontSize: 20, color: colors.ink500, fontFamily: font.bold },
  h1: { fontSize: 22, fontFamily: font.bold, color: colors.ink },
  intro: { flexDirection: "row", alignItems: "center", gap: 8, marginVertical: 16 },
  introText: { flex: 1, fontSize: 14, fontFamily: font.medium, color: colors.ink500, lineHeight: 19 },
  card: { flexDirection: "row", alignItems: "center", gap: 14, backgroundColor: colors.surfaceCard, borderRadius: radius.card, padding: 16, marginBottom: 12, ...shadowCard },
  iconWrap: { width: 44, height: 44, borderRadius: 12, justifyContent: "center", alignItems: "center" },
  cardLabel: { fontSize: 16, fontFamily: font.bold, color: colors.ink },
  cardSub: { fontSize: 12.5, fontFamily: font.medium, color: colors.ink500, marginTop: 2 },
});

import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { api } from "@/api";
import { ChessBoard } from "@/ChessBoard";
import { Icon } from "@/Icon";
import { TopBar } from "@/TopBar";
import { BackButton } from "@/BackButton";
import { colors, font, radius, shadowCard, space } from "@/theme";

type Mistake = { fen: string; played: string; best: string; tag: string };

export default function JournalScreen() {
  const [mistakes, setMistakes] = useState<Mistake[]>([]);

  useEffect(() => {
    api<{ mistakeLog: Mistake[] }>("/api/progress")
      .then((d) => setMistakes((d.mistakeLog ?? []).slice(0, 25)))
      .catch(() => void 0);
  }, []);

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <TopBar />
      <View style={styles.header}>
        <BackButton />
        <Text style={styles.h1}>Journal</Text>
      </View>

      {mistakes.length === 0 ? (
        <View style={styles.empty}>
          <Icon name="journal" size={42} color={colors.ink300} />
          <Text style={styles.emptyText}>No mistakes logged yet. Positions you miss in lessons land here to revisit.</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.intro}>Positions you missed — study the better move.</Text>
          {mistakes.map((m, i) => (
            <View key={i} style={styles.card}>
              <ChessBoard fen={m.fen} size={108} interactive={false} />
              <View style={{ flex: 1 }}>
                <Text style={styles.tag}>{m.tag || "Tactic"}</Text>
                <Text style={styles.line}>
                  You: <Text style={{ color: colors.danger }}>{m.played?.replace(":", "→")}</Text>
                </Text>
                <Text style={styles.line}>
                  Best: <Text style={{ color: colors.success }}>{m.best?.replace(":", "→")}</Text>
                </Text>
              </View>
            </View>
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface },
  header: { paddingHorizontal: 20, paddingTop: space[2], gap: space[2] },
  h1: { fontSize: 22, fontFamily: font.bold, color: colors.ink },
  empty: { alignItems: "center", marginTop: 60, paddingHorizontal: 30 },
  emptyText: { textAlign: "center", marginTop: 12, fontSize: 14, fontFamily: font.medium, color: colors.ink500, lineHeight: 20 },
  content: { padding: 20 },
  intro: { fontSize: 13, fontFamily: font.medium, color: colors.ink500, marginBottom: 12 },
  card: { flexDirection: "row", alignItems: "center", gap: 14, backgroundColor: colors.surfaceCard, borderRadius: radius.card, padding: 12, marginBottom: 12, ...shadowCard },
  tag: { fontSize: 14, fontFamily: font.bold, color: colors.ink, textTransform: "capitalize" },
  line: { fontSize: 13, fontFamily: font.semibold, color: colors.ink500, marginTop: 4 },
});

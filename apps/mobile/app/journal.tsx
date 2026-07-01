import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { ChessBoard } from "@/ChessBoard";
import { Icon } from "@/Icon";
import { TopBar } from "@/TopBar";
import { BackButton } from "@/BackButton";
import { mutateProgress, useProgress } from "@/progressStore";
import { colors, font, radius, shadowCard, space, type } from "@/theme";

type Mistake = { fen: string; played: string; best: string; tag: string };
type JournalEntry = {
  id: string;
  day: string;
  date: number;
  kind: "lesson" | "match" | "review" | "exam" | "reflection";
  title: string;
  confidence: number;
  note: string;
  summary: string;
  ref: string | null;
};

const CONF = ["😣", "😕", "😐", "🙂", "😄"];
const KIND_EMOJI: Record<string, string> = {
  lesson: "📖",
  match: "♟️",
  review: "🔍",
  exam: "📝",
  reflection: "🧠",
};
function isoDay() {
  return new Date().toISOString().slice(0, 10);
}

export default function JournalScreen() {
  const router = useRouter();
  const progress = useProgress(true) as { mistakeLog?: Mistake[]; journalEntries?: JournalEntry[]; weaknesses?: Record<string, number> } | null;
  const mistakes = (progress?.mistakeLog ?? []).slice(0, 25);
  const entries = progress?.journalEntries ?? [];
  const weaknesses = progress?.weaknesses ?? {};
  const [confidence, setConfidence] = useState(3);
  const [note, setNote] = useState("");
  const [saved, setSaved] = useState(false);

  async function saveReflection() {
    const trimmed = note.trim();
    if (!trimmed) return;
    const entry: JournalEntry = {
      id: `j${Date.now()}`,
      day: isoDay(),
      date: Date.now(),
      kind: "reflection",
      title: "Quick reflection",
      confidence,
      note: trimmed,
      summary: "Self-reflection from mobile journal.",
      ref: null,
    };
    await mutateProgress((snap) => ({
      ...snap,
      journalEntries: [entry, ...((snap.journalEntries as JournalEntry[] | undefined) ?? [])].slice(0, 100),
    }));
    setSaved(true);
    setNote("");
    setTimeout(() => setSaved(false), 900);
  }
  async function deleteEntry(id: string) {
    await mutateProgress((snap) => ({
      ...snap,
      journalEntries: ((snap.journalEntries as JournalEntry[] | undefined) ?? []).filter((e) => e.id !== id),
    }));
  }

  const avgConf = entries.length ? entries.reduce((a, b) => a + b.confidence, 0) / entries.length : 0;
  const topMistakes = Object.entries(weaknesses).sort((a, b) => b[1] - a[1]).slice(0, 3);

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <TopBar />
      <View style={styles.header}>
        <BackButton />
        <Text style={styles.h1}>Journal</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryKicker}>Growth summary</Text>
          <View style={styles.miniRow}>
            <Mini label="Entries" value={`${entries.length}`} />
            <Mini label="Avg confidence" value={avgConf ? CONF[Math.round(avgConf) - 1] ?? "—" : "—"} />
            <Mini label="Recurring" value={`${topMistakes.length}`} />
          </View>
          {topMistakes.length > 0 && (
            <View style={styles.tags}>
              {topMistakes.map(([tag, n]) => (
                <Text key={tag} style={styles.weakTag}>{tag} ×{n}</Text>
              ))}
            </View>
          )}
        </View>

        <View style={styles.summaryCard}>
          <Text style={styles.formTitle}>Add a reflection</Text>
          <Text style={styles.intro}>How confident do you feel?</Text>
          <View style={styles.confRow}>
            {CONF.map((emoji, i) => (
              <Pressable key={emoji} style={[styles.confBtn, confidence === i + 1 && styles.confBtnOn]} onPress={() => setConfidence(i + 1)}>
                <Text style={{ fontSize: 22 }}>{emoji}</Text>
              </Pressable>
            ))}
          </View>
          <TextInput
            value={note}
            onChangeText={setNote}
            placeholder="A line or two for future-you..."
            placeholderTextColor={colors.ink300}
            multiline
            style={styles.input}
          />
          <Pressable style={[styles.practiceBtn, !note.trim() && { opacity: 0.5 }]} disabled={!note.trim()} onPress={saveReflection}>
            <Text style={styles.practiceText}>{saved ? "✓ Saved" : "Save entry"}</Text>
          </Pressable>
        </View>

        {entries.length === 0 ? (
          <View style={styles.empty}>
            <Icon name="journal" size={42} color={colors.ink300} />
            <Text style={styles.emptyText}>No entries yet. Finish a lesson or match, or add a quick reflection here.</Text>
          </View>
        ) : (
          entries.map((e) => (
            <View key={e.id} style={styles.entryCard}>
              <Text style={{ fontSize: 20 }}>{KIND_EMOJI[e.kind] ?? "📔"}</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.entryTitle}>{e.title}</Text>
                {!!e.summary && <Text style={styles.entrySummary}>{e.summary}</Text>}
                {!!e.note && <Text style={styles.entryNote}>“{e.note}”</Text>}
              </View>
              <Text style={{ fontSize: 18 }}>{CONF[e.confidence - 1]}</Text>
              <Pressable onPress={() => deleteEntry(e.id)} hitSlop={8}>
                <Text style={styles.delete}>✕</Text>
              </Pressable>
            </View>
          ))
        )}

        {mistakes.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>No mistakes logged yet. Positions you miss in lessons land here to revisit.</Text>
          </View>
        ) : (
          <>
            <Text style={styles.intro}>Positions you missed — study the better move.</Text>
          <Pressable style={styles.practiceBtn} onPress={() => router.push("/practice/mistakes")}>
            <Text style={styles.practiceText}>🎯 Practice these positions →</Text>
          </Pressable>
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
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.mini}>
      <Text style={styles.miniValue}>{value}</Text>
      <Text style={styles.miniLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface },
  header: { paddingHorizontal: 20, paddingTop: space[2], gap: space[2] },
  h1: { fontSize: 22, fontFamily: font.bold, color: colors.ink },
  empty: { alignItems: "center", marginTop: 60, paddingHorizontal: 30 },
  emptyText: { textAlign: "center", marginTop: 12, fontSize: 14, fontFamily: font.medium, color: colors.ink500, lineHeight: 20 },
  content: { padding: 20, paddingBottom: 40 },
  intro: { fontSize: 13, fontFamily: font.medium, color: colors.ink500, marginBottom: 12 },
  practiceBtn: { borderRadius: radius.pill, backgroundColor: colors.brand, paddingVertical: space[3], alignItems: "center", marginBottom: 12 },
  practiceText: { fontSize: 14, fontFamily: font.bold, color: "#fff" },
  card: { flexDirection: "row", alignItems: "center", gap: 14, backgroundColor: colors.surfaceCard, borderRadius: radius.card, padding: 12, marginBottom: 12, ...shadowCard },
  tag: { fontSize: 14, fontFamily: font.bold, color: colors.ink, textTransform: "capitalize" },
  line: { fontSize: 13, fontFamily: font.semibold, color: colors.ink500, marginTop: 4 },
  summaryCard: { backgroundColor: colors.surfaceCard, borderRadius: radius.card, padding: space[4], marginBottom: space[3], ...shadowCard },
  summaryKicker: { ...type.caption, fontFamily: font.bold, color: colors.ink500, textTransform: "uppercase", letterSpacing: 0.5 },
  miniRow: { flexDirection: "row", gap: space[2], marginTop: space[2] },
  mini: { flex: 1, borderRadius: radius.card, backgroundColor: colors.surfaceSunken, paddingVertical: space[2], alignItems: "center" },
  miniValue: { ...type.base, fontFamily: font.bold, color: colors.ink },
  miniLabel: { ...type.caption, fontFamily: font.semibold, color: colors.ink500 },
  tags: { flexDirection: "row", flexWrap: "wrap", gap: space[1.5], marginTop: space[3] },
  weakTag: { ...type.xs, fontFamily: font.bold, color: colors.danger, backgroundColor: "rgba(244,63,94,0.1)", borderRadius: radius.pill, paddingHorizontal: space[2], paddingVertical: 3 },
  formTitle: { ...type.base, fontFamily: font.bold, color: colors.ink, marginBottom: space[2] },
  confRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: space[3] },
  confBtn: { width: 44, height: 44, borderRadius: radius.pill, justifyContent: "center", alignItems: "center", backgroundColor: colors.surfaceSunken },
  confBtnOn: { backgroundColor: colors.brand50, borderWidth: 2, borderColor: colors.brand, transform: [{ scale: 1.08 }] },
  input: { minHeight: 92, borderWidth: 1, borderColor: colors.hairline, borderRadius: radius.card, backgroundColor: colors.surface, padding: space[3], fontFamily: font.semibold, color: colors.ink, textAlignVertical: "top", marginBottom: space[3] },
  entryCard: { flexDirection: "row", alignItems: "center", gap: space[2], backgroundColor: colors.surfaceCard, borderRadius: radius.card, padding: space[3], marginBottom: space[2], ...shadowCard },
  entryTitle: { ...type.sm, fontFamily: font.bold, color: colors.ink },
  entrySummary: { ...type.caption, fontFamily: font.semibold, color: colors.ink500, marginTop: 2 },
  entryNote: { ...type.sm, fontFamily: font.semibold, color: colors.ink700, marginTop: 2 },
  delete: { color: colors.ink300, fontFamily: font.bold, fontSize: 16 },
});

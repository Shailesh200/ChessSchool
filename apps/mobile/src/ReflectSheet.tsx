import { useState } from "react";
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Button } from "./Button";
import { mutateProgress } from "./progressStore";
import { haptics } from "./haptics";
import { sfx } from "./sfx";
import { colors, font, radius, space, type } from "./theme";

export type JournalKind = "lesson" | "match" | "review" | "exam" | "reflection";

export type JournalEntry = {
  id: string;
  day: string;
  date: number;
  kind: JournalKind;
  title: string;
  confidence: number;
  note: string;
  summary: string;
  ref: string | null;
};

const CONFIDENCE = ["😣", "😕", "😐", "🙂", "😄"];

function isoDay() {
  return new Date().toISOString().slice(0, 10);
}

/** Post-activity reflection — confidence + note, synced via progress API. */
export function ReflectSheet({
  visible,
  onClose,
  kind,
  title,
  summary,
  refId,
}: {
  visible: boolean;
  onClose: () => void;
  kind: JournalKind;
  title: string;
  summary: string;
  refId: string | null;
}) {
  const [confidence, setConfidence] = useState(3);
  const [note, setNote] = useState("");
  const [saved, setSaved] = useState(false);

  async function save() {
    const entry: JournalEntry = {
      id: `j${Date.now()}`,
      day: isoDay(),
      date: Date.now(),
      kind,
      title,
      confidence,
      note: note.trim(),
      summary,
      ref: refId,
    };
    await mutateProgress((snap) => ({
      ...snap,
      journalEntries: [entry, ...((snap.journalEntries as JournalEntry[] | undefined) ?? [])].slice(0, 100),
    }));
    setSaved(true);
    haptics.success();
    sfx.play("success");
    setTimeout(() => {
      setSaved(false);
      setNote("");
      onClose();
    }, 700);
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <Text style={styles.sheetTitle}>Add to your journal</Text>
          <Text style={styles.entryTitle}>{title}</Text>
          <Text style={styles.summary}>{summary}</Text>

          <Text style={styles.label}>How confident do you feel?</Text>
          <View style={styles.confRow}>
            {CONFIDENCE.map((emoji, i) => (
              <Pressable
                key={emoji}
                style={[styles.confBtn, confidence === i + 1 && styles.confBtnOn]}
                onPress={() => setConfidence(i + 1)}
              >
                <Text style={{ fontSize: 22 }}>{emoji}</Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.label}>What did you learn? Biggest mistake? Plan?</Text>
          <TextInput
            value={note}
            onChangeText={setNote}
            placeholder="A line or two for future-you…"
            placeholderTextColor={colors.ink300}
            multiline
            style={styles.input}
          />

          <View style={styles.actions}>
            <View style={{ flex: 1 }}>
              <Button label="Skip" variant="outline" onPress={onClose} />
            </View>
            <View style={{ flex: 1 }}>
              <Button label={saved ? "✓ Saved" : "Save entry"} onPress={() => void save()} />
            </View>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(28,27,46,0.45)", justifyContent: "flex-end" },
  sheet: { backgroundColor: colors.surfaceCard, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: space[5], paddingBottom: space[8] },
  sheetTitle: { ...type.lg, fontFamily: font.bold, color: colors.ink, marginBottom: space[2] },
  entryTitle: { ...type.sm, fontFamily: font.bold, color: colors.ink },
  summary: { ...type.xs, fontFamily: font.semibold, color: colors.ink500, marginBottom: space[4] },
  label: { ...type.xs, fontFamily: font.bold, color: colors.ink700, marginBottom: space[2] },
  confRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: space[4] },
  confBtn: { width: 44, height: 44, borderRadius: radius.pill, justifyContent: "center", alignItems: "center", backgroundColor: colors.surfaceSunken },
  confBtnOn: { backgroundColor: colors.brand50, borderWidth: 2, borderColor: colors.brand, transform: [{ scale: 1.08 }] },
  input: { minHeight: 88, borderWidth: 1, borderColor: colors.hairline, borderRadius: radius.card, backgroundColor: colors.surface, padding: space[3], fontFamily: font.semibold, color: colors.ink, textAlignVertical: "top", marginBottom: space[4] },
  actions: { flexDirection: "row", gap: space[2] },
});

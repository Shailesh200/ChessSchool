import { copy, type ReportReason } from "@chessschool/design";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Pressable, View } from "react-native";
import { Icon } from "@/components/Icon";
import { Button, Page, SwitchRow, T, TextField, useToast } from "@/components/ui";
import { api, errorMessage } from "@/lib/api";
import { useApp } from "@/lib/state";
import { useTheme } from "@/lib/theme";

const REASONS: ReportReason[] = ["name", "behaviour", "other"];

/** Report a classmate (class screen → member card → Report). */
export default function ReportScreen() {
  const { classId = "", memberId = "", name = "" } = useLocalSearchParams<{ classId?: string; memberId?: string; name?: string }>();
  const { cue } = useApp();
  const { c } = useTheme();
  const toast = useToast();
  const t = copy.classroom;
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [note, setNote] = useState("");
  const [block, setBlock] = useState(true);
  const [busy, setBusy] = useState(false);

  const send = async () => {
    if (!reason) return;
    setBusy(true);
    try {
      await api.reportMember(classId, memberId, { reason, note: note.trim(), block });
      cue("success");
      toast(t.reported);
      router.back();
    } catch (err) {
      cue("gentle-no");
      toast(errorMessage(err) || copy.auth.errors.generic);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Page title={t.reportTitle(name)} banner={false} footer={<Button title={t.sendReport} disabled={!reason} loading={busy} onPress={() => void send()} />}>
      <T role="body" color="textMuted">
        {t.reportSub}
      </T>
      <T role="label">{t.reportWhat}</T>
      <View accessibilityRole="radiogroup" accessibilityLabel={t.reportWhat} style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {REASONS.map((r) => {
          const on = reason === r;
          return (
            <Pressable
              key={r}
              accessibilityRole="radio"
              accessibilityState={{ checked: on }}
              accessibilityLabel={t.reasons[r]}
              onPress={() => setReason(r)}
              style={({ pressed }) => ({
                minHeight: 44,
                paddingHorizontal: 16,
                flexDirection: "row",
                alignItems: "center",
                gap: 6,
                borderRadius: 999,
                borderWidth: on ? 2 : 1,
                borderColor: on ? c.brand : c.line,
                backgroundColor: on ? c.brandSoft : c.card,
                transform: [{ scale: pressed ? 0.97 : 1 }],
              })}
            >
              {on ? <Icon name="check" size={18} color={c.brandText} /> : null}
              <T role="label" style={{ color: on ? c.brandText : c.text }}>
                {t.reasons[r]}
              </T>
            </Pressable>
          );
        })}
      </View>
      <TextField label={t.reportMore} placeholder={t.reportPlaceholder} value={note} onChangeText={setNote} maxLength={500} multiline style={{ minHeight: 96, textAlignVertical: "top" }} />
      <SwitchRow icon="block" label={t.alsoBlock(name)} hint={t.alsoBlockHint} value={block} onChange={setBlock} />
    </Page>
  );
}

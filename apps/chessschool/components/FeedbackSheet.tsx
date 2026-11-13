import { copy } from "@chessschool/design";
import Constants from "expo-constants";
import { useState } from "react";
import { Platform, TextInput, View } from "react-native";
import { api } from "@/lib/api";
import { useApp } from "@/lib/state";
import { fonts, useTheme } from "@/lib/theme";
import { Button, Segmented, Sheet, T, useToast } from "./ui";

type Mood = "love" | "ok" | "stuck";

export function FeedbackSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { state, cue } = useApp();
  const { c } = useTheme();
  const toast = useToast();
  const [mood, setMood] = useState<Mood>("love");
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  const send = async () => {
    if (message.trim().length < 3) return setError(copy.feedback.tooShort);
    setSending(true);
    try {
      await api.feedback({
        mood,
        message,
        guestId: state.guestId,
        context: { platform: Platform.OS, os: String(Platform.Version), theme: state.prefs.theme, pieces: state.prefs.pieceSet, version: Constants.expoConfig?.version ?? "0.4.0" },
      });
      cue("success");
      toast(copy.feedback.sent);
      setMessage("");
      onClose();
    } catch {
      setError(copy.feedback.offline);
    } finally {
      setSending(false);
    }
  };

  return (
    <Sheet visible={visible} onClose={onClose}>
      <T role="heading" header center>
        {copy.feedback.title}
      </T>
      <T role="body" color="textMuted" center>
        {copy.feedback.body}
      </T>
      <View style={{ alignSelf: "stretch" }}>
        <Segmented<Mood> label={copy.feedback.title} value={mood} onChange={setMood} options={(Object.keys(copy.feedback.moods) as Mood[]).map((m) => ({ value: m, label: copy.feedback.moods[m] }))} />
      </View>
      <TextInput
        accessibilityLabel={copy.feedback.title}
        multiline
        maxLength={2000}
        value={message}
        placeholder={copy.feedback.placeholder}
        placeholderTextColor={c.textSubtle}
        onChangeText={(t) => {
          setMessage(t);
          setError(null);
        }}
        style={{ alignSelf: "stretch", minHeight: 110, padding: 12, borderRadius: 16, borderWidth: 2, borderColor: error ? c.danger : c.line, backgroundColor: c.card, color: c.text, fontFamily: fonts.regular, fontSize: 16, textAlignVertical: "top" }}
      />
      {error ? (
        <T role="small" color="dangerText">
          {error}
        </T>
      ) : null}
      <Button title={copy.feedback.send} icon="chat" loading={sending} onPress={send} />
    </Sheet>
  );
}

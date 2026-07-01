import { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { api } from "@/api";
import { Button } from "@/Button";
import { BackButton } from "@/BackButton";
import { Cody } from "@/Cody";
import { colors, font, radius, shadowCard, space, type } from "@/theme";

/** Online lobby — create a shareable game or join one by code. */
export default function OnlineLobbyScreen() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState<"create" | "join" | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function create() {
    setBusy("create");
    setErr(null);
    try {
      const { id, seatToken } = await api<{ id: string; seatToken: string }>("/api/session", { method: "POST" });
      router.replace({ pathname: "/play/online/[id]", params: { id, color: "w", seatToken } });
    } catch {
      setErr("Couldn't create a game. Check your connection.");
      setBusy(null);
    }
  }

  async function join() {
    const c = code.trim().toLowerCase();
    if (!c) return;
    setBusy("join");
    setErr(null);
    try {
      const s = await api<{ error?: string; claimed?: boolean; seatToken?: string }>(`/api/session/${c}?join=1`);
      if (s.error || !s.claimed || !s.seatToken) throw new Error(s.error ?? "seat unavailable");
      router.replace({ pathname: "/play/online/[id]", params: { id: c, color: "b", seatToken: s.seatToken } });
    } catch {
      setErr("That game code wasn't found, or the game already has two players.");
      setBusy(null);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <BackButton />
        <Text style={styles.h1}>Play online</Text>
      </View>

      <View style={styles.body}>
        <Cody expression="wave" size={96} />
        <Text style={styles.lead}>Play a friend on another device — create a game and share the code, or enter theirs.</Text>

        <View style={{ width: "100%", marginTop: space[5], gap: space[3] }}>
          <Button label={busy === "create" ? "Creating…" : "🎮 Create a game"} variant="success" onPress={create} />

          <View style={styles.or}><View style={styles.line} /><Text style={styles.orText}>or</Text><View style={styles.line} /></View>

          <View style={styles.joinRow}>
            <TextInput
              style={styles.input}
              placeholder="Enter game code"
              placeholderTextColor={colors.ink300}
              autoCapitalize="none"
              autoCorrect={false}
              value={code}
              onChangeText={setCode}
              onSubmitEditing={join}
            />
            <Pressable style={[styles.joinBtn, !code.trim() && { opacity: 0.4 }]} onPress={join} disabled={!code.trim() || busy === "join"}>
              {busy === "join" ? <ActivityIndicator color="#fff" /> : <Text style={styles.joinBtnText}>Join</Text>}
            </Pressable>
          </View>
          {err && <Text style={styles.err}>{err}</Text>}
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface },
  header: { flexDirection: "row", alignItems: "center", gap: space[2], paddingHorizontal: space[4], paddingTop: 6 },
  h1: { ...type.xl, fontFamily: font.bold, color: colors.ink },
  body: { flex: 1, alignItems: "center", paddingHorizontal: space[5], paddingTop: space[6] },
  lead: { textAlign: "center", marginTop: space[3], ...type.base, fontFamily: font.semibold, color: colors.ink500, lineHeight: 24 },
  or: { flexDirection: "row", alignItems: "center", gap: space[3] },
  line: { flex: 1, height: 1, backgroundColor: colors.hairline },
  orText: { ...type.sm, fontFamily: font.bold, color: colors.ink300 },
  joinRow: { flexDirection: "row", gap: space[2] },
  input: { flex: 1, backgroundColor: colors.surfaceCard, borderRadius: radius.md, borderWidth: 1, borderColor: colors.hairline, paddingHorizontal: space[4], paddingVertical: space[3], ...type.base, fontFamily: font.bold, color: colors.ink, ...shadowCard },
  joinBtn: { backgroundColor: colors.brand, borderRadius: radius.md, paddingHorizontal: space[5], justifyContent: "center", alignItems: "center" },
  joinBtnText: { ...type.base, fontFamily: font.bold, color: "#fff" },
  err: { ...type.sm, fontFamily: font.semibold, color: colors.danger, textAlign: "center" },
});

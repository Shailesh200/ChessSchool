import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { api } from "@/api";
import { Button } from "@/Button";
import { TopBar } from "@/TopBar";
import { colors, font, radius, space, type } from "@/theme";

const ELOS = [300, 600, 900, 1200, 1600, 2000];
const TIMES = [
  { id: "none", label: "No clock" },
  { id: "5", label: "5 min" },
  { id: "10", label: "10 min" },
  { id: "20", label: "20 min" },
  { id: "30", label: "30 min" },
];

function personality(elo: number): string {
  if (elo < 800) return "🙂 Cody · Casual beginner";
  if (elo < 1100) return "🤔 Cody · Steady improver";
  if (elo < 1500) return "😏 Cody · Sharp tactician";
  return "😎 Cody · Seasoned master";
}

export default function PlaySetupScreen() {
  const router = useRouter();
  const [rating, setRating] = useState(800);
  const [mode, setMode] = useState<"bot" | "human">("bot");
  const [adaptive, setAdaptive] = useState(false);
  const [elo, setElo] = useState(600);
  const [time, setTime] = useState("none");

  useEffect(() => {
    api<{ rating: number }>("/api/progress").then((d) => setRating(d.rating ?? 800)).catch(() => void 0);
  }, []);

  const effectiveElo = adaptive ? rating : elo;

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <TopBar />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.h1}>New match</Text>

        {/* Mode cards */}
        <View style={styles.modeRow}>
          <Pressable style={[styles.mode, mode === "bot" && styles.modeOn]} onPress={() => setMode("bot")}>
            <Text style={styles.modeEmoji}>🤖</Text>
            <Text style={styles.modeTitle}>vs Bot</Text>
            <Text style={styles.modeSub}>Adaptive AI 300–2000</Text>
          </Pressable>
          <Pressable style={[styles.mode, mode === "human" && styles.modeOn]} onPress={() => setMode("human")}>
            <Text style={styles.modeEmoji}>👥</Text>
            <Text style={styles.modeTitle}>vs Human</Text>
            <Text style={styles.modeSub}>Two players, one device · or play online</Text>
          </Pressable>
        </View>

        {/* Opponent strength */}
        {mode === "bot" ? (
          <View style={styles.card}>
            <Text style={styles.cardLabel}>Opponent strength</Text>
            <Pressable style={styles.adaptive} onPress={() => setAdaptive(true)}>
              <View style={{ flex: 1 }}>
                <Text style={styles.adaptiveTitle}>🎯 Adaptive bot</Text>
                <Text style={styles.adaptiveSub}>Matches your level (~{rating}) & adjusts as you play</Text>
              </View>
              <View style={[styles.radio, adaptive && styles.radioOn]}>{adaptive && <View style={styles.radioDot} />}</View>
            </Pressable>
            <View style={styles.pills}>
              {ELOS.map((e) => {
                const on = !adaptive && e === elo;
                return (
                  <Pressable key={e} style={[styles.pill, on && styles.pillOn]} onPress={() => { setAdaptive(false); setElo(e); }}>
                    <Text style={[styles.pillText, on && styles.pillTextOn]}>{e}</Text>
                  </Pressable>
                );
              })}
            </View>
            <Text style={styles.persona}>{personality(effectiveElo)}</Text>
          </View>
        ) : (
          <View style={styles.card}>
            <Text style={styles.cardLabel}>How to play</Text>
            <Pressable style={styles.adaptive}>
              <View style={{ flex: 1 }}>
                <Text style={styles.adaptiveTitle}>👥 Pass & play</Text>
                <Text style={styles.adaptiveSub}>Two players take turns on this device</Text>
              </View>
              <View style={[styles.radio, styles.radioOn]}><View style={styles.radioDot} /></View>
            </Pressable>
            <Pressable style={[styles.adaptive, { marginBottom: 0 }]} onPress={() => router.push("/play/online")}>
              <View style={{ flex: 1 }}>
                <Text style={styles.adaptiveTitle}>🌐 Play online</Text>
                <Text style={styles.adaptiveSub}>Create a game & share the code with a friend</Text>
              </View>
              <Text style={{ fontSize: 18, color: colors.ink300 }}>›</Text>
            </Pressable>
          </View>
        )}

        {/* Time control */}
        <View style={styles.card}>
          <Text style={styles.cardLabel}>Time control</Text>
          <View style={styles.pills}>
            {TIMES.map((t) => {
              const on = t.id === time;
              return (
                <Pressable key={t.id} style={[styles.pill, on && styles.pillOn]} onPress={() => setTime(t.id)}>
                  <Text style={[styles.pillText, on && styles.pillTextOn]}>{t.label}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={{ marginTop: space[2] }}>
          <Button
            label="Start match"
            onPress={() => (mode === "human" ? router.push({ pathname: "/play/pass", params: { time } }) : router.push({ pathname: "/play/game", params: { elo: String(effectiveElo), time } }))}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface },
  content: { padding: space[5], gap: space[4], paddingBottom: 40 },
  h1: { ...type.xl, fontFamily: font.bold, color: colors.ink },
  modeRow: { flexDirection: "row", gap: space[3] },
  mode: { flex: 1, borderRadius: radius.card, borderWidth: 1, borderColor: colors.hairline, backgroundColor: colors.surfaceCard, padding: space[4] },
  modeOn: { borderColor: colors.brand, backgroundColor: colors.brand50 },
  modeEmoji: { fontSize: 26 },
  modeTitle: { ...type.base, fontFamily: font.bold, color: colors.ink, marginTop: space[3] },
  modeSub: { ...type.xs, fontFamily: font.semibold, color: colors.ink500, marginTop: 2 },
  card: { backgroundColor: colors.surfaceCard, borderRadius: radius.card, padding: space[4], shadowColor: "#1c1b2e", shadowOpacity: 0.08, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 2 },
  cardLabel: { ...type.sm, fontFamily: font.bold, color: colors.ink, marginBottom: space[3] },
  adaptive: { flexDirection: "row", alignItems: "center", gap: space[3], borderRadius: radius.md, borderWidth: 1, borderColor: colors.hairline, padding: space[3], marginBottom: space[3] },
  adaptiveTitle: { ...type.sm, fontFamily: font.bold, color: colors.ink },
  adaptiveSub: { ...type.xs, fontFamily: font.semibold, color: colors.ink500, marginTop: 2 },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: colors.ink300, justifyContent: "center", alignItems: "center" },
  radioOn: { borderColor: colors.brand },
  radioDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: colors.brand },
  pills: { flexDirection: "row", flexWrap: "wrap", gap: space[2] },
  pill: { paddingHorizontal: space[4], paddingVertical: 8, borderRadius: radius.pill, backgroundColor: colors.surfaceSunken },
  pillOn: { backgroundColor: colors.brand },
  pillText: { ...type.sm, fontFamily: font.bold, color: colors.ink500 },
  pillTextOn: { color: "#fff" },
  persona: { ...type.sm, fontFamily: font.bold, color: colors.ink, marginTop: space[3] },
});

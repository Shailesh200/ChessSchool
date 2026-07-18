import { useEffect, useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { api } from "@/api";
import { useAuth } from "@/auth";
import { Button } from "@/Button";
import { Icon } from "@/Icon";
import { TopBar } from "@/TopBar";
import { haptics } from "@/haptics";
import { sfx } from "@/sfx";
import { botProfile, BOT_ELO_PRESETS } from "@/bots";
import { BotAvatar } from "@/BotAvatar";
import { emojiToIcon } from "@/iconMaps";
import { useSettings, settings } from "@/settings";
import { canResumeAnyMatch, getActiveMatch, hydrateMatchStore, subscribeMatchStore } from "@/matchStore";
import { useAppTheme } from "@/ThemeProvider";
import { useType } from "@/typography";
import { font, radius, space } from "@/theme";

const ELOS = [...BOT_ELO_PRESETS];
const TIMES = [
  { id: "none", label: "No clock" },
  { id: "5", label: "5 min" },
  { id: "10", label: "10 min" },
  { id: "20", label: "20 min" },
  { id: "30", label: "30 min" },
];

type ChooserMode = "bot" | "human" | "training";
type TrainingMode = "shadow" | "arena" | "assisted" | "lesson";
type AssistedVariant = "full" | "puzzle";

const TRAINING_OPTIONS: {
  id: TrainingMode;
  title: string;
  subtitle: string;
  emoji: string;
  enrolledOnly: boolean;
}[] = [
  {
    id: "shadow",
    title: "Shadow opponent",
    subtitle: "Rematch a saved game — opponent replays from PGN",
    emoji: "👥",
    enrolledOnly: true,
  },
  {
    id: "arena",
    title: "Arena tournament",
    subtitle: "4-bot round robin — standings and bonus XP",
    emoji: "🏆",
    enrolledOnly: true,
  },
  {
    id: "assisted",
    title: "Assisted play",
    subtitle: "Coach explains your moves — pick full game or puzzle drill below",
    emoji: "🧠",
    enrolledOnly: true,
  },
  {
    id: "lesson",
    title: "Lesson trainer",
    subtitle: "One position — calculate, confirm, or reveal the answer",
    emoji: "🎯",
    enrolledOnly: true,
  },
];

const ASSISTED_VARIANTS: { id: AssistedVariant; title: string; subtitle: string }[] = [
  {
    id: "full",
    title: "Full game",
    subtitle: "Coached bot match at your rating",
  },
  {
    id: "puzzle",
    title: "Puzzle drill",
    subtitle: "Single positions with coach feedback",
  },
];

export default function PlaySetupScreen() {
  const { colors } = useAppTheme();
  const type = useType();
  const styles = useMemo(() => makeStyles(colors, type), [colors, type]);
  const router = useRouter();
  const { guest } = useAuth();
  const { targetElo } = useSettings();
  const [rating, setRating] = useState(800);
  const [mode, setMode] = useState<ChooserMode>("bot");
  const [trainingMode, setTrainingMode] = useState<TrainingMode>("shadow");
  const [assistedVariant, setAssistedVariant] = useState<AssistedVariant>("full");
  const [adaptive, setAdaptive] = useState(false);
  const [time, setTime] = useState("none");
  const [creating, setCreating] = useState(false);
  const [resumeMatch, setResumeMatch] = useState(getActiveMatch());

  useEffect(() => {
    void hydrateMatchStore().then(() => setResumeMatch(getActiveMatch()));
    return subscribeMatchStore(() => setResumeMatch(getActiveMatch()));
  }, []);

  useEffect(() => {
    api<{ rating: number }>("/api/progress").then((d) => setRating(d.rating ?? 800)).catch(() => void 0);
  }, []);

  const effectiveElo = adaptive ? rating : targetElo;
  const selectedTraining = TRAINING_OPTIONS.find((t) => t.id === trainingMode)!;

  function guardEnrolled(action: () => void) {
    if (guest) {
      Alert.alert("Enroll to unlock", "Create a free student account to use training modes and online play.", [
        { text: "Not now", style: "cancel" },
        { text: "Enroll", onPress: () => router.push("/login") },
      ]);
      return;
    }
    action();
  }

  function beginBot() {
    haptics.success();
    sfx.play("unlock");
    router.push({ pathname: "/play/game", params: { elo: String(effectiveElo), time } });
  }

  function beginTraining() {
    guardEnrolled(() => {
      haptics.success();
      sfx.play("select");
      if (trainingMode === "shadow") router.push("/play/shadow");
      else if (trainingMode === "arena") router.push("/play/arena");
      else if (trainingMode === "assisted")
        router.push({ pathname: "/play/assisted", params: { mode: assistedVariant } });
      else router.push("/play/think");
    });
  }

  async function playOnline() {
    guardEnrolled(async () => {
      setCreating(true);
      haptics.success();
      try {
        const { id, seatToken } = await api<{ id: string; seatToken: string }>("/api/session", {
          method: "POST",
        });
        router.push({
          pathname: "/play/online/[id]",
          params: { id, color: "w", seatToken },
        });
      } catch {
        Alert.alert("Could not create game", "Check your connection and try again.");
      } finally {
        setCreating(false);
      }
    });
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <TopBar />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.h1}>New match</Text>

        {canResumeAnyMatch() && resumeMatch && (
          <View style={styles.resumeCard}>
            <Text style={styles.resumeTitle}>Resume in-progress game</Text>
            <Text style={styles.resumeSub}>
              {resumeMatch.mode === "shadow"
                ? `Shadow vs ${resumeMatch.shadow?.opponentName ?? "opponent"}`
                : resumeMatch.mode === "arena"
                  ? `Arena vs ${resumeMatch.arena?.opponentName ?? "bot"}`
                  : `Bot game · ${resumeMatch.targetElo} ELO`}
              {" · "}
              {resumeMatch.moves.length} moves played
            </Text>
            <Button
              label="Continue match →"
              size="sm"
              onPress={() => {
                if (resumeMatch.mode === "shadow") router.push("/play/shadow-game");
                else
                  router.push({
                    pathname: "/play/game",
                    params: {
                      elo: String(resumeMatch.targetElo),
                      time: resumeMatch.timeControlMin ? String(resumeMatch.timeControlMin) : "none",
                      arena: resumeMatch.arena ? "1" : undefined,
                    },
                  });
              }}
            />
          </View>
        )}

        <View style={styles.modeRow}>
          <Pressable
            style={[styles.mode, mode === "bot" && styles.modeOn]}
            onPress={() => {
              setMode("bot");
              haptics.tap();
            }}
          >
            <Icon name="robot" size={28} color={mode === "bot" ? colors.brand : colors.ink} duotone />
            <Text style={styles.modeTitle}>vs Bot</Text>
            <Text style={styles.modeSub}>Adaptive AI 300–2000</Text>
          </Pressable>
          <Pressable
            style={[styles.mode, mode === "human" && styles.modeOn]}
            onPress={() => {
              setMode("human");
              haptics.tap();
            }}
          >
            <Icon name="users" size={28} color={mode === "human" ? colors.brand : colors.ink} duotone />
            <Text style={styles.modeTitle}>vs Human</Text>
            <Text style={styles.modeSub}>Pass & play or online</Text>
          </Pressable>
        </View>

        <Pressable
          style={[styles.modeWide, mode === "training" && styles.modeOn]}
          onPress={() => {
            setMode("training");
            haptics.tap();
          }}
        >
          <Icon name="target" size={28} color={mode === "training" ? colors.brand : colors.ink} duotone />
          <Text style={styles.modeTitle}>Training</Text>
          <Text style={styles.modeSub}>Shadow, arena, assisted play & drills</Text>
        </Pressable>

        {mode === "bot" && (
          <>
            <View style={styles.card}>
              <Text style={styles.cardLabel}>Opponent strength</Text>
              <Pressable
                style={[styles.adaptive, adaptive && styles.adaptiveOn]}
                onPress={() => {
                  setAdaptive(true);
                  haptics.tap();
                }}
              >
                <View style={{ flex: 1 }}>
                  <View style={styles.adaptiveTitleRow}>
                    <Icon name="target" size={18} color={colors.ink} duotone />
                    <Text style={styles.adaptiveTitle}>Adaptive bot</Text>
                  </View>
                  <Text style={styles.adaptiveSub}>
                    Matches your level (~{rating}) & adjusts as you play
                  </Text>
                </View>
                <View style={[styles.radio, adaptive && styles.radioOn]}>
                  {adaptive && <View style={styles.radioDot} />}
                </View>
              </Pressable>
              <View style={[styles.pills, adaptive && styles.pillsDim]}>
                {ELOS.map((e) => {
                  const on = !adaptive && e === targetElo;
                  return (
                    <Pressable
                      key={e}
                      style={[styles.pill, on && styles.pillOn, styles.pillWithAvatar]}
                      onPress={() => {
                        setAdaptive(false);
                        settings.set("targetElo", e);
                        haptics.tap();
                      }}
                      disabled={adaptive}
                    >
                      <BotAvatar elo={e} size={24} />
                      <Text style={[styles.pillText, on && styles.pillTextOn]}>{e}</Text>
                    </Pressable>
                  );
                })}
              </View>
              <View style={styles.personaRow}>
                <BotAvatar elo={effectiveElo} size={40} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.personaName}>{botProfile(effectiveElo).name}</Text>
                  <Text style={styles.persona}>{botProfile(effectiveElo).blurb}</Text>
                </View>
              </View>
            </View>

            <View style={styles.card}>
              <Text style={styles.cardLabel}>Time control</Text>
              <View style={styles.pills}>
                {TIMES.map((t) => {
                  const on = t.id === time;
                  return (
                    <Pressable
                      key={t.id}
                      style={[styles.pill, on && styles.pillOn]}
                      onPress={() => {
                        setTime(t.id);
                        haptics.tap();
                      }}
                    >
                      <Text style={[styles.pillText, on && styles.pillTextOn]}>{t.label}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <Button testID="play-start-match" label="Start match" onPress={beginBot} />
          </>
        )}

        {mode === "human" && (
          <>
            <View style={styles.card}>
              <Text style={styles.cardLabel}>How to play</Text>
              <Pressable
                style={styles.adaptive}
                onPress={() => router.push({ pathname: "/play/pass", params: { time } })}
              >
                <View style={{ flex: 1 }}>
                  <View style={styles.adaptiveTitleRow}>
                    <Icon name="users" size={18} color={colors.ink} duotone />
                    <Text style={styles.adaptiveTitle}>Pass & play</Text>
                  </View>
                  <Text style={styles.adaptiveSub}>Two players take turns on this device</Text>
                </View>
                <Text style={styles.chevron}>›</Text>
              </Pressable>
            </View>

            <View style={styles.card}>
              <Text style={styles.cardLabel}>Time control</Text>
              <View style={styles.pills}>
                {TIMES.map((t) => {
                  const on = t.id === time;
                  return (
                    <Pressable
                      key={t.id}
                      style={[styles.pill, on && styles.pillOn]}
                      onPress={() => setTime(t.id)}
                    >
                      <Text style={[styles.pillText, on && styles.pillTextOn]}>{t.label}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <View style={{ gap: space[2] }}>
              <Button
                label="Start (one device)"
                onPress={() => router.push({ pathname: "/play/pass", params: { time } })}
              />
              <Button
                label={creating ? "Creating game…" : guest ? "Enroll to play online" : "Play a friend online (share link)"}
                variant="outline"
                onPress={creating ? () => void 0 : playOnline}
              />
            </View>
          </>
        )}

        {mode === "training" && (
          <>
            <View style={styles.card}>
              <Text style={styles.cardLabel}>Training mode</Text>
              {TRAINING_OPTIONS.map((opt) => {
                const active = trainingMode === opt.id;
                return (
                  <Pressable
                    key={opt.id}
                    style={[styles.trainingRow, active && styles.trainingRowOn]}
                    onPress={() => {
                      setTrainingMode(opt.id);
                      haptics.tap();
                    }}
                  >
                    <View style={[styles.radio, active && styles.radioOn]}>
                      {active && <View style={styles.radioDot} />}
                    </View>
                    <Icon name={emojiToIcon(opt.emoji)} size={22} color={active ? colors.brand : colors.ink} duotone />
                    <View style={{ flex: 1 }}>
                      <View style={styles.adaptiveTitleRow}>
                        <Text style={styles.trainingTitle}>{opt.title}</Text>
                        {guest && opt.enrolledOnly && <Icon name="lock" size={14} color={colors.ink500} />}
                      </View>
                      <Text style={styles.trainingSub}>{opt.subtitle}</Text>
                    </View>
                  </Pressable>
                );
              })}
              {guest && (
                <Text style={styles.enrollNote}>
                  Training modes need a free student account.{" "}
                  <Text style={styles.enrollLink} onPress={() => router.push("/login")}>
                    Enroll →
                  </Text>
                </Text>
              )}
            </View>

            {trainingMode === "assisted" && (
              <View style={styles.card}>
                <Text style={styles.cardLabel}>Assisted format</Text>
                {ASSISTED_VARIANTS.map((opt) => {
                  const active = assistedVariant === opt.id;
                  return (
                    <Pressable
                      key={opt.id}
                      style={[styles.trainingRow, active && styles.trainingRowOn]}
                      onPress={() => {
                        setAssistedVariant(opt.id);
                        haptics.tap();
                      }}
                    >
                      <View style={[styles.radio, active && styles.radioOn]}>
                        {active && <View style={styles.radioDot} />}
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.trainingTitle}>{opt.title}</Text>
                        <Text style={styles.trainingSub}>{opt.subtitle}</Text>
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            )}

            <View style={[styles.card, styles.summaryCard]}>
              <Text style={styles.trainingTitle}>{selectedTraining.title}</Text>
              <Text style={styles.trainingSub}>
                {trainingMode === "assisted"
                  ? ASSISTED_VARIANTS.find((v) => v.id === assistedVariant)?.subtitle
                  : selectedTraining.subtitle}
              </Text>
            </View>

            <Button
              label={
                guest
                  ? "Enroll to start"
                  : trainingMode === "assisted"
                    ? `Start ${ASSISTED_VARIANTS.find((v) => v.id === assistedVariant)?.title.toLowerCase() ?? "assisted play"}`
                    : `Start ${selectedTraining.title.toLowerCase()}`
              }
              onPress={beginTraining}
            />
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function makeStyles(colors: Record<string, string>, type: ReturnType<typeof useType>) {
  return StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface },
  content: { padding: space[5], gap: space[4], paddingBottom: 40 },
  h1: { ...type.xl, fontFamily: font.bold, color: colors.ink },
  modeRow: { flexDirection: "row", gap: space[3] },
  mode: {
    flex: 1,
    borderRadius: radius.card,
    borderWidth: 2,
    borderColor: colors.hairline,
    backgroundColor: colors.surfaceCard,
    padding: space[4],
  },
  modeWide: {
    borderRadius: radius.card,
    borderWidth: 2,
    borderColor: colors.hairline,
    backgroundColor: colors.surfaceCard,
    padding: space[4],
  },
  modeOn: { borderColor: colors.brand, backgroundColor: colors.brand50 },
  modeEmoji: { fontSize: 26 },
  modeTitle: { ...type.base, fontFamily: font.bold, color: colors.ink, marginTop: space[3] },
  modeSub: { ...type.xs, fontFamily: font.semibold, color: colors.ink500, marginTop: 2 },
  card: {
    backgroundColor: colors.surfaceCard,
    borderRadius: radius.card,
    padding: space[4],
    shadowColor: "#1c1b2e",
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  resumeCard: {
    backgroundColor: colors.brand50,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.brand100,
    padding: space[4],
    gap: space[2],
    marginBottom: space[2],
  },
  resumeTitle: { ...type.sm, fontFamily: font.bold, color: colors.ink },
  resumeSub: { ...type.xs, fontFamily: font.semibold, color: colors.ink500 },
  summaryCard: { backgroundColor: colors.surfaceSunken },
  cardLabel: { ...type.sm, fontFamily: font.bold, color: colors.ink, marginBottom: space[3] },
  adaptive: {
    flexDirection: "row",
    alignItems: "center",
    gap: space[3],
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.hairline,
    padding: space[3],
    marginBottom: space[3],
  },
  adaptiveOn: { borderColor: colors.brand, backgroundColor: colors.brand50 },
  adaptiveTitle: { ...type.sm, fontFamily: font.bold, color: colors.ink },
  adaptiveTitleRow: { flexDirection: "row", alignItems: "center", gap: space[2] },
  adaptiveSub: { ...type.xs, fontFamily: font.semibold, color: colors.ink500, marginTop: 2 },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: colors.ink300,
    justifyContent: "center",
    alignItems: "center",
  },
  radioOn: { borderColor: colors.brand },
  radioDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: colors.brand },
  pills: { flexDirection: "row", flexWrap: "wrap", gap: space[2] },
  pillsDim: { opacity: 0.4 },
  pill: {
    paddingHorizontal: space[3],
    paddingVertical: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceSunken,
  },
  pillWithAvatar: { flexDirection: "row", alignItems: "center", gap: 6 },
  pillOn: { backgroundColor: colors.brand },
  pillText: { ...type.sm, fontFamily: font.bold, color: colors.ink500 },
  pillTextOn: { color: "#fff" },
  personaRow: { flexDirection: "row", alignItems: "center", gap: space[3], marginTop: space[3] },
  personaName: { ...type.sm, fontFamily: font.bold, color: colors.ink },
  persona: { ...type.xs, fontFamily: font.semibold, color: colors.ink500, marginTop: 2 },
  chevron: { fontSize: 18, color: colors.ink300 },
  trainingRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: space[3],
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: colors.hairline,
    padding: space[3],
    marginBottom: space[2],
  },
  trainingRowOn: { borderColor: colors.brand, backgroundColor: colors.brand50 },
  trainingEmoji: { fontSize: 22, marginTop: 2 },
  trainingTitle: { ...type.sm, fontFamily: font.bold, color: colors.ink },
  trainingSub: { ...type.xs, fontFamily: font.semibold, color: colors.ink500, marginTop: 2 },
  enrollNote: { ...type.xs, fontFamily: font.semibold, color: colors.ink500, marginTop: space[2] },
  enrollLink: { color: colors.brand, fontFamily: font.bold },
  });
}

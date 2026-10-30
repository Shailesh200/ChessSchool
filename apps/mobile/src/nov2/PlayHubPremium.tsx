import { useMemo, useState } from "react";
import { Image, Pressable, ScrollView, StyleSheet, Text, useColorScheme, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Icon } from "@/Icon";
import { coachCharacterIdFromPremiumSlug } from "@/coachCharacters";
import { settings, useSettings } from "@/settings";
import { resolvePremiumColorMode } from "@/themeMode";
import { CoachHead } from "@/nov2/CoachRow";
import { KitButton, KitTopBar } from "@/components/kit";
import { usePremiumKitTheme } from "@/components/kit";
import { coachStill, type CoachSlug } from "@/nov2/coachArt";
import { premiumColors, premiumFont, premiumRadius, premiumSpace, premiumType } from "@/nov2/premiumTokens";

type PlayMode = "coach" | "bot" | "friend";
type OpponentId = "skye" | "kira" | "rex" | "ash";

const MODES: { id: PlayMode; title: string; subtitle: string; icon: "cap" | "robot" | "users" }[] = [
  { id: "coach", title: "Coach", subtitle: "Otto gives tips as you go", icon: "cap" },
  { id: "bot", title: "Bot", subtitle: "Play a computer, no hints", icon: "robot" },
  { id: "friend", title: "Friend", subtitle: "Pass and play on one device", icon: "users" },
];

const OPPONENTS: {
  id: OpponentId;
  slug: CoachSlug;
  name: string;
  pill: string;
  pillTone: "easy" | "medium" | "hard";
  desc: string;
  elo: number;
}[] = [
  { id: "skye", slug: "skye", name: "Skye", pill: "Easy", pillTone: "easy", desc: "Playful and dramatic. Plays like art.", elo: 800 },
  { id: "kira", slug: "kira", name: "Kira", pill: "Medium", pillTone: "medium", desc: "Sporty and fast. Treats it like training.", elo: 1200 },
  { id: "rex", slug: "rex", name: "Rex", pill: "Hard", pillTone: "hard", desc: "A proud grandmaster. Plays by the book.", elo: 1600 },
  { id: "ash", slug: "ash", name: "Ash", pill: "Strict", pillTone: "hard", desc: "Strict and has no hints.", elo: 1800 },
];

/** 12-play-hub — premium Play tab (390 layout). */
export function PlayHubPremium() {
  const router = useRouter();
  const { themeMode } = useSettings();
  const scheme = useColorScheme();
  const { colors } = usePremiumKitTheme();
  const [mode, setMode] = useState<PlayMode>("coach");
  const [opp, setOpp] = useState<OpponentId>("kira");
  const [ashOn, setAshOn] = useState(false);

  const selected = OPPONENTS.find((o) => o.id === opp) ?? OPPONENTS[1]!;
  const heroCoach = selected.slug;

  const startLabel = useMemo(() => {
    const help = mode === "coach" ? "Otto helps" : mode === "bot" ? "No hints" : "Pass & play";
    return { title: `Game vs ${selected.name}`, sub: `${selected.pill} · ${help}` };
  }, [mode, selected.name, selected.pill]);

  function startGame() {
    const characterId = coachCharacterIdFromPremiumSlug(heroCoach);
    settings.set("coachCharacter", characterId);
    settings.set("coachPersonality", characterId);
    if (mode === "friend") {
      router.push("/play/pass");
      return;
    }
    const dark = resolvePremiumColorMode(themeMode, scheme) === "dark" || ashOn;
    router.push({
      pathname: "/play/game",
      params: { elo: String(selected.elo), coach: heroCoach, mode, dark: dark ? "1" : "0" },
    });
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.surface, maxWidth: 390 }]} edges={["top"]} testID="play-hub-premium">
      <KitTopBar />

      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Text style={styles.pageTitle}>Play</Text>

        <View style={styles.hero}>
          <View style={styles.heroCopy}>
            <Text style={styles.heroKicker}>Quick game</Text>
            <Text style={styles.heroTitle}>Play {selected.name}</Text>
            <Text style={styles.heroSub}>Warm-up time. Let&apos;s go!</Text>
          </View>
          <View style={styles.heroArt}>
            <Image source={coachStill(heroCoach, "neutral")} style={styles.bust} accessibilityIgnoresInvertColors />
          </View>
        </View>

        <Text style={styles.section}>How do you want to play?</Text>
        <View style={styles.modes}>
          {MODES.map((m) => {
            const on = mode === m.id;
            return (
              <Pressable
                key={m.id}
                style={[styles.mode, on && styles.modeOn]}
                onPress={() => setMode(m.id)}
                accessibilityRole="radio"
                accessibilityState={{ selected: on }}
              >
                <View style={styles.modeIcon}>
                  <Icon name={m.icon} size={22} color={on ? premiumColors.brand : premiumColors.textMuted} duotone />
                </View>
                <View style={styles.modeText}>
                  <Text style={styles.modeTitle}>{m.title}</Text>
                  <Text style={styles.modeSub}>{m.subtitle}</Text>
                </View>
                {on ? <Icon name="check" size={18} color={premiumColors.brand} /> : null}
              </Pressable>
            );
          })}
        </View>

        <Text style={[styles.section, { marginTop: premiumSpace[4] }]}>Pick who to play</Text>
        <View style={styles.oppoList}>
          {OPPONENTS.filter((o) => o.id !== "ash" || ashOn).map((o) => {
            const on = opp === o.id;
            return (
              <Pressable
                key={o.id}
                style={[styles.opp, on && styles.oppOn]}
                onPress={() => setOpp(o.id)}
                accessibilityRole="radio"
                accessibilityState={{ selected: on }}
              >
                <CoachHead slug={o.slug} mood="neutral" size={48} />
                <View style={styles.oppText}>
                  <Text style={styles.oppName}>{o.name}</Text>
                  <Text style={styles.oppDesc}>{o.desc}</Text>
                </View>
                <View style={[styles.pill, styles[`pill_${o.pillTone}`]]}>
                  <Text style={styles.pillText}>{o.pill}</Text>
                </View>
              </Pressable>
            );
          })}
        </View>

        <Pressable style={styles.ashRow} onPress={() => setAshOn((v) => !v)} accessibilityRole="switch" accessibilityState={{ checked: ashOn }}>
          <CoachHead slug="ash" mood="neutral" size={48} />
          <View style={styles.oppText}>
            <Text style={styles.oppName}>Add Ash</Text>
            <Text style={styles.oppDesc}>Off by default. Ash is strict and has no hints.</Text>
          </View>
          <View style={[styles.toggle, ashOn && styles.toggleOn]}>
            <View style={[styles.knob, ashOn && styles.knobOn]} />
          </View>
        </Pressable>
      </ScrollView>

      <View style={styles.startBar}>
        <View style={styles.startCopy}>
          <Text style={styles.startTitle}>{startLabel.title}</Text>
          <Text style={styles.startSub}>{startLabel.sub}</Text>
        </View>
        <KitButton label="Start game" variant="accent" onPress={startGame} style={styles.startBtn} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: premiumColors.bg, maxWidth: 390, width: "100%", alignSelf: "center" },
  topbar: { flexDirection: "row", flexWrap: "wrap", gap: premiumSpace[2], paddingHorizontal: premiumSpace[4], paddingTop: premiumSpace[2] },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: premiumColors.surface,
    borderRadius: premiumRadius.pill,
    borderWidth: 1.5,
    borderColor: premiumColors.line,
    paddingHorizontal: premiumSpace[3],
    paddingVertical: 6,
  },
  chipBold: { fontFamily: premiumFont.uiBold, color: premiumColors.text, fontSize: 14 },
  chipText: { fontFamily: premiumFont.ui, color: premiumColors.textMuted, fontSize: 13 },
  scroll: { padding: premiumSpace[4], paddingBottom: 120, gap: premiumSpace[3] },
  pageTitle: { ...premiumType.h1, fontFamily: premiumFont.display, color: premiumColors.text },
  hero: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: premiumColors.surfaceSoft,
    borderRadius: premiumRadius.xl,
    padding: premiumSpace[4],
    gap: premiumSpace[3],
  },
  heroCopy: { flex: 1, gap: 4 },
  heroKicker: { fontSize: 12, fontFamily: premiumFont.uiBold, color: premiumColors.textMuted, textTransform: "uppercase" },
  heroTitle: { fontSize: 22, fontFamily: premiumFont.display, color: premiumColors.text },
  heroSub: { fontSize: 14, fontFamily: premiumFont.ui, color: premiumColors.textMuted },
  heroArt: {
    width: 88,
    height: 88,
    borderRadius: premiumRadius.lg,
    backgroundColor: premiumColors.brandSoft,
    alignItems: "center",
    justifyContent: "flex-end",
    overflow: "hidden",
  },
  bust: { width: 80, height: 80, resizeMode: "contain" },
  section: { fontSize: 20, fontFamily: premiumFont.display, color: premiumColors.text },
  modes: { gap: premiumSpace[2] },
  mode: {
    flexDirection: "row",
    alignItems: "center",
    gap: premiumSpace[3],
    padding: premiumSpace[3],
    borderRadius: premiumRadius.lg,
    borderWidth: 1.5,
    borderColor: premiumColors.line,
    backgroundColor: premiumColors.surface,
  },
  modeOn: { borderColor: premiumColors.brand, backgroundColor: premiumColors.brandSoft },
  modeIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: premiumColors.surfaceSoft, alignItems: "center", justifyContent: "center" },
  modeText: { flex: 1 },
  modeTitle: { fontFamily: premiumFont.uiBold, fontSize: 16, color: premiumColors.text },
  modeSub: { fontFamily: premiumFont.ui, fontSize: 13, color: premiumColors.textMuted, marginTop: 2 },
  oppoList: { gap: premiumSpace[2] },
  opp: {
    flexDirection: "row",
    alignItems: "center",
    gap: premiumSpace[3],
    padding: premiumSpace[3],
    borderRadius: premiumRadius.lg,
    borderWidth: 1.5,
    borderColor: premiumColors.line,
    backgroundColor: premiumColors.surface,
  },
  oppOn: { borderColor: premiumColors.brand, borderWidth: 2 },
  oppText: { flex: 1 },
  oppName: { fontFamily: premiumFont.uiBold, fontSize: 16, color: premiumColors.text },
  oppDesc: { fontFamily: premiumFont.ui, fontSize: 13, color: premiumColors.textMuted, marginTop: 2 },
  pill: { borderRadius: premiumRadius.pill, paddingHorizontal: 10, paddingVertical: 4 },
  pill_easy: { backgroundColor: premiumColors.successSoft },
  pill_medium: { backgroundColor: premiumColors.warningSoft },
  pill_hard: { backgroundColor: premiumColors.errorSoft },
  pillText: { fontFamily: premiumFont.uiBold, fontSize: 12, color: premiumColors.text },
  ashRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: premiumSpace[3],
    padding: premiumSpace[3],
    borderRadius: premiumRadius.lg,
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderColor: premiumColors.lineStrong,
  },
  toggle: { width: 48, height: 28, borderRadius: 14, backgroundColor: premiumColors.line, padding: 3 },
  toggleOn: { backgroundColor: premiumColors.brand },
  knob: { width: 22, height: 22, borderRadius: 11, backgroundColor: premiumColors.surface },
  knobOn: { alignSelf: "flex-end" },
  startBar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: premiumSpace[3],
    padding: premiumSpace[4],
    paddingBottom: premiumSpace[5],
    backgroundColor: premiumColors.surface,
    borderTopWidth: 1.5,
    borderTopColor: premiumColors.line,
  },
  startCopy: { flex: 1 },
  startTitle: { fontFamily: premiumFont.uiBold, fontSize: 15, color: premiumColors.text },
  startSub: { fontFamily: premiumFont.ui, fontSize: 13, color: premiumColors.textMuted },
  startBtn: { minWidth: 130 },
});

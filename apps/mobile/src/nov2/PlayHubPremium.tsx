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
import { createPlayHubStyles } from "@/nov2/boaKitStyles";
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
  const kit = usePremiumKitTheme();
  const styles = useMemo(() => createPlayHubStyles(kit), [kit]);
  const { themeMode } = useSettings();
  const scheme = useColorScheme();
  const { colors } = kit;
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
                  <Icon name={m.icon} size={22} color={on ? colors.brand : colors.ink500} duotone />
                </View>
                <View style={styles.modeText}>
                  <Text style={styles.modeTitle}>{m.title}</Text>
                  <Text style={styles.modeSub}>{m.subtitle}</Text>
                </View>
                {on ? <Icon name="check" size={18} color={colors.brand} /> : null}
              </Pressable>
            );
          })}
        </View>

        <Text style={[styles.section, { marginTop: kit.space["4"] }]}>Pick who to play</Text>
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


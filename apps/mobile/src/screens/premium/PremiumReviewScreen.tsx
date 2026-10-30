import { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { KitButton, KitCard, KitCoachAvatar, KitIcon, type KitIconName, usePremiumKitTheme } from "@/components/kit";
import { TopBar } from "@/TopBar";
import { ThemedSafeArea } from "@/ThemedSafeArea";
import { api } from "@/api";
import { useSettings } from "@/settings";
import { fetchProgress, useProgress } from "@/progressStore";
import { movesFromSyncGame, normalizeSyncGame, playerResultOf } from "@/progression";
import { reviewSkills, reviewSummary, startReviewTarget, type ReviewSkill } from "./premiumModel";

const ICONS: KitIconName[] = ["target", "lock", "play", "trophy", "shield", "crown"];

type Fixture = { skills?: ReviewSkill[]; mistakeCount?: number };

export function PremiumReviewScreen({ mode = "tab", fixture }: { mode?: "tab" | "queue"; fixture?: Fixture }) {
  const router = useRouter();
  const { colors, font, type, space, radius } = usePremiumKitTheme();
  const settings = useSettings();
  const progress = useProgress();
  const [titles, setTitles] = useState<Record<string, string>>({});

  useEffect(() => {
    if (fixture?.skills) return;
    void api<{ groups: { lessons: { id: string; title: string }[] }[] }>("/api/library")
      .then((data) => {
        const next: Record<string, string> = {};
        for (const group of data.groups ?? []) {
          for (const lesson of group.lessons ?? []) next[lesson.id] = lesson.title;
        }
        setTitles(next);
      })
      .catch(() => setTitles({}));
  }, [fixture?.skills]);

  const skills = fixture?.skills ?? reviewSkills(progress?.lessons, titles);
  const summary = reviewSummary(skills);
  const mistakes = ((progress?.mistakeLog as unknown[]) ?? []).length;
  const mistakeCount = fixture?.mistakeCount ?? mistakes;
  const target = startReviewTarget({ mistakeCount, firstDueId: skills[0]?.id ?? null });
  const games = useMemo(
    () => ((progress?.recentGames as unknown[]) ?? []).map(normalizeSyncGame).filter((game) => game !== null),
    [progress],
  );

  function begin() {
    if (!target) return;
    if (target.pathname === "/practice/mistakes") router.push("/practice/mistakes");
    else if (target.id) router.push({ pathname: "/lesson/[id]", params: { id: target.id } });
  }

  return (
    <ThemedSafeArea edges={["top"]}>
      <TopBar />
      <ScrollView testID={mode === "queue" ? "review-queue" : "review-tab"} contentContainerStyle={{ padding: space["4"], paddingBottom: space["10"], gap: space["4"] }}>
        <Text style={{ fontFamily: font.uiBold, color: colors.ink500, letterSpacing: 1.1, textTransform: "uppercase", fontSize: type.overline.fontSize }}>
          {mode === "queue" ? "Review queue" : "Review"}
        </Text>
        <Text style={{ fontFamily: font.displayBold, color: colors.ink, fontSize: type.h1.fontSize, lineHeight: type.h1.lineHeight }}>
          {summary.due} skill{summary.due === 1 ? "" : "s"} are due
        </Text>
        <Text style={{ fontFamily: font.uiMedium, color: colors.ink500, fontSize: type.body.fontSize }}>
          A quick refresher keeps them fresh. 10 steps or fewer.
        </Text>
        {mode === "tab" ? (
          <View style={{ flexDirection: "row", gap: space["3"], alignItems: "center" }}>
            <KitCoachAvatar character={settings.coachCharacter} state="idle" size={56} />
            <View style={{ flex: 1, backgroundColor: colors.coachBubble, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.hairline, padding: space["3"] }}>
              <Text style={{ fontFamily: font.uiMedium, color: colors.ink }}>
                {summary.needsPractice > 0 ? "Ten minutes now saves hours later. Start with the low ones." : "You're caught up. A short review still helps."}
              </Text>
            </View>
          </View>
        ) : null}
        {skills.length === 0 ? (
          <Text style={{ color: colors.ink500, fontFamily: font.uiMedium }}>Nothing is due right now.</Text>
        ) : (
          skills.map((skill, index) => <SkillRow key={skill.id} skill={skill} icon={ICONS[index % ICONS.length]!} />)
        )}
        <KitCard testID="review-summary">
          <Text style={{ fontFamily: font.uiBold, color: colors.ink500, letterSpacing: 1, textTransform: "uppercase" }}>Summary</Text>
          <Text style={{ fontFamily: font.displayBold, color: colors.ink, marginTop: 8 }}>On track · {summary.onTrack}</Text>
          <Text style={{ color: colors.ink500, fontFamily: font.uiMedium }}>60% or more</Text>
          <Text style={{ fontFamily: font.displayBold, color: colors.ink, marginTop: 8 }}>Needs practice · {summary.needsPractice}</Text>
          <Text style={{ color: colors.ink500, fontFamily: font.uiMedium }}>Under 60%, review these first</Text>
        </KitCard>
        <KitButton
          label={summary.due > 0 ? "Start review · 10 steps" : "Review is clear"}
          variant="accent"
          disabled={!target}
          onPress={begin}
          testID="start-review"
        />
        <Pressable
          testID="fix-mistakes"
          onPress={() => router.push("/practice/mistakes")}
          style={{ flexDirection: "row", alignItems: "center", gap: space["3"], padding: space["3"], borderRadius: radius.lg, borderWidth: 1, borderColor: colors.hairline, backgroundColor: colors.surfaceCard }}
        >
          <KitIcon name="rotateCcw" size={22} color={colors.brand} />
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: font.displayBold, color: colors.ink }}>Fix my mistakes</Text>
            <Text style={{ fontFamily: font.uiMedium, color: colors.ink500 }}>{mistakeCount} move{mistakeCount === 1 ? "" : "s"} to replay</Text>
          </View>
          <KitIcon name="chevronRight" size={18} color={colors.ink300} />
        </Pressable>
        {mode === "tab" ? (
          <Pressable onPress={() => router.push("/gym")} style={{ flexDirection: "row", alignItems: "center", gap: space["3"], padding: space["3"], borderRadius: radius.lg, borderWidth: 1, borderColor: colors.hairline }}>
            <KitIcon name="dumbbell" size={22} color={colors.brand} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: font.displayBold, color: colors.ink }}>Gym</Text>
              <Text style={{ color: colors.ink500 }}>Drills and puzzle practice</Text>
            </View>
            <KitIcon name="chevronRight" size={18} color={colors.ink300} />
          </Pressable>
        ) : null}
        {mode === "tab" ? <MatchHistory games={games} onOpen={(id) => router.push({ pathname: "/replay/[index]", params: { index: "0", id } })} onPlay={() => router.push("/play")} /> : null}
        <Pressable onPress={() => void fetchProgress(true)} accessibilityLabel="Refresh review">
          <Text style={{ color: colors.textLink, fontFamily: font.uiBold, textAlign: "center" }}>Refresh</Text>
        </Pressable>
      </ScrollView>
    </ThemedSafeArea>
  );
}

function SkillRow({ skill, icon }: { skill: ReviewSkill; icon: KitIconName }) {
  const { colors, font, type, space, radius } = usePremiumKitTheme();
  const pct = Math.round(skill.mastery * 100);
  return (
    <View style={{ flexDirection: "row", gap: space["3"], alignItems: "flex-start" }}>
      <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: colors.brandSoft, alignItems: "center", justifyContent: "center" }}>
        <KitIcon name={icon} size={20} color={colors.brand} />
      </View>
      <View style={{ flex: 1, gap: 6 }}>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
          <Text style={{ fontFamily: font.displayBold, color: colors.ink, fontSize: type.sm.fontSize }}>{skill.title}</Text>
          {skill.needsPractice ? (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: colors.accentSoft, borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 2 }}>
              <KitIcon name="triangleAlert" size={12} color={colors.accent} />
              <Text style={{ color: colors.accentSoftText, fontFamily: font.uiBold, fontSize: 11 }}>Needs practice</Text>
            </View>
          ) : null}
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <View style={{ flex: 1, height: 6, borderRadius: 99, backgroundColor: colors.surfaceSunken, overflow: "hidden" }}>
            <View style={{ width: `${pct}%`, height: 6, backgroundColor: skill.needsPractice ? colors.accent : colors.brand }} />
          </View>
          <Text style={{ fontFamily: font.uiBold, color: colors.ink500, width: 36 }}>{pct}%</Text>
        </View>
      </View>
    </View>
  );
}

function MatchHistory({
  games,
  onOpen,
  onPlay,
}: {
  games: NonNullable<ReturnType<typeof normalizeSyncGame>>[];
  onOpen: (id: string) => void;
  onPlay: () => void;
}) {
  const { colors, font, type, space } = usePremiumKitTheme();
  return (
    <View style={{ gap: space["2"] }}>
      <Text style={{ fontFamily: font.displayBold, color: colors.ink, fontSize: type.h3.fontSize }}>Match history</Text>
      {games.length === 0 ? (
        <View>
          <Text style={{ color: colors.ink500, fontFamily: font.uiMedium }}>Play a match and it will appear here with a full replay.</Text>
          <View style={{ marginTop: space["2"] }}>
            <KitButton label="Play a match" onPress={onPlay} />
          </View>
        </View>
      ) : (
        games.map((game) => {
          const title = game.mode === "pass" ? "vs Human" : game.mode === "online" ? "vs Friend (online)" : `vs Bot · ${game.elo ?? "?"}`;
          const result = game.endReason === "resign" && game.mode === "bot" ? "Resigned" : playerResultOf(game, "w");
          return (
            <Pressable key={game.id} testID={`game-${game.id}`} onPress={() => onOpen(game.id)} style={{ paddingVertical: 8 }}>
              <Text style={{ fontFamily: font.displayBold, color: colors.ink }}>{title}</Text>
              <Text style={{ color: colors.ink500 }}>{String(result)} · {game.moveCount || movesFromSyncGame(game).length} moves</Text>
            </Pressable>
          );
        })
      )}
    </View>
  );
}

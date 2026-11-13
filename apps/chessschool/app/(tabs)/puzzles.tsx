import { allPuzzles, PUZZLE_THEMES, themeCount } from "@chessschool/chess";
import { copy } from "@chessschool/design";
import { router } from "expo-router";
import { Pressable, View } from "react-native";
import { DailyCountdown, useDailyPuzzle } from "@/components/DailyCountdown";
import { Icon } from "@/components/Icon";
import { Cody } from "@/components/Lottie";
import { Button, Card, Chip, Page, T } from "@/components/ui";
import { usePuzzlePackVersion } from "@/lib/puzzlePack";
import { useApp } from "@/lib/state";
import { fonts, useTheme } from "@/lib/theme";

export default function Puzzles() {
  const { state } = useApp();
  usePuzzlePackVersion();
  const { c } = useTheme();
  const pz = state.progress.puzzles;
  const { puzzle: daily, done } = useDailyPuzzle();
  return (
    <Page title={copy.puzzles.title} large>
      <T role="bodyLg" color="textMuted" style={{ marginTop: -8 }}>
        {`${copy.puzzles.body} ${copy.puzzles.themeCount(allPuzzles().length)}`}
      </T>

      <Card tone="hero" style={{ flexDirection: "row", alignItems: "center", gap: 12, borderWidth: 1, borderColor: c.line }}>
        <View style={{ flex: 1, gap: 6 }}>
          <T role="label" color="brandText">
            {copy.puzzles.rating}
          </T>
          <T role="hero" style={{ fontFamily: fonts.bold }}>
            {String(pz.rating)}
          </T>
          <T role="small" color="textMuted">
            {copy.puzzles.solvedCount(pz.solved)}
          </T>
          <Button block={false} title={copy.puzzles.play} icon="puzzle" onPress={() => router.push("/puzzle")} />
        </View>
        <Cody animation="thinking" size={100} />
      </Card>

      <Card style={{ gap: 8 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Icon name="sun" color={c.text} />
          <T role="heading">{copy.puzzles.daily}</T>
        </View>
        <T role="body" color="textMuted">
          {done ? copy.puzzles.dailyDone : `${copy.puzzles.dailyBody} · ${daily.rating}`}
        </T>
        {done ? <DailyCountdown /> : null}
        <View style={{ alignSelf: "flex-start" }}>
          <Chip tone="accent">{copy.puzzles.dailyStreak(pz.daily.count)}</Chip>
        </View>
        {done ? null : <Button title={copy.puzzles.daily} icon="play" variant="gold" onPress={() => router.push("/puzzle?daily=1")} />}
      </Card>

      <Card style={{ gap: 8 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Icon name="clock" color={c.text} />
          <T role="heading">{copy.puzzles.sprint}</T>
        </View>
        <T role="body" color="textMuted">
          {copy.puzzles.sprintBody}
        </T>
        <View style={{ alignSelf: "flex-start" }}>
          <Chip tone="gold">{copy.puzzles.sprintBest(pz.sprintBest)}</Chip>
        </View>
        <Button title={copy.puzzles.sprint} icon="bolt" variant="accent" onPress={() => router.push("/sprint")} />
      </Card>

      <T role="heading" header>
        {copy.puzzles.themes}
      </T>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
        {PUZZLE_THEMES.map((t) => (
          <Pressable
            key={t.id}
            accessibilityRole="button"
            accessibilityLabel={`${t.name}. ${t.blurb}`}
            onPress={() => router.push(`/puzzle?theme=${t.id}`)}
            style={({ pressed }) => ({ flexGrow: 1, flexBasis: "45%", gap: 4, padding: 14, borderRadius: 20, borderWidth: 1, borderBottomWidth: 4, borderColor: c.brand, backgroundColor: pressed ? c.brandSoft : c.card })}
          >
            <T role="label">{t.name}</T>
            <T role="small" color="textMuted">
              {t.blurb}
            </T>
            <T role="micro" color="textMuted">
              {copy.puzzles.themeCount(themeCount(t.id))}
            </T>
          </Pressable>
        ))}
      </View>
    </Page>
  );
}

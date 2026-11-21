import { botInfo, isBotId } from "@chessschool/chess";
import { closeRecap, copy, showRecapCard, visibleDailyStreak, weeklyRecap, type WeeklyRecap } from "@chessschool/design";
import { router } from "expo-router";
import { View } from "react-native";
import { DailyCountdown, useDailyPuzzle } from "@/components/DailyCountdown";
import { Icon } from "@/components/Icon";
import { Button, Card, Chip, IconButton, T } from "@/components/ui";
import { useApp } from "@/lib/state";
import { fonts, useTheme } from "@/lib/theme";

const botRating = (id: string) => (isBotId(id) ? botInfo(id).rating : 0);
export const botName = (id: string) => (isBotId(id) ? botInfo(id).name : id);

/** The shared daily puzzle: how many solved it today, the puzzle streak and its freezes. */
export function DailyCard({ today }: { today: string }) {
  const { state } = useApp();
  const { c } = useTheme();
  const { puzzle, done, solved } = useDailyPuzzle();
  const streak = visibleDailyStreak(state.progress, today);
  const freezes = state.progress.puzzles.daily.freezes ?? 0;
  return (
    <Card style={{ gap: 8 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <Icon name={done ? "check" : "sun"} color={done ? c.successText : c.text} />
        <T role="heading" header style={{ flex: 1 }}>
          {copy.dailyPuzzle.title}
        </T>
      </View>
      <T role="body" color="textMuted">
        {done ? copy.dailyPuzzle.doneToday : puzzle ? `${copy.dailyPuzzle.body} · ${puzzle.rating}` : copy.dailyPuzzle.body}
      </T>
      {solved !== null ? (
        <T role="small" color="textMuted">
          {solved ? copy.dailyPuzzle.solvedBy(solved) : copy.dailyPuzzle.beFirst}
        </T>
      ) : null}
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        <Chip icon="spark" tone={streak ? "accent" : "neutral"} label={copy.dailyPuzzle.streak(streak)}>
          {copy.dailyPuzzle.streak(streak)}
        </Chip>
        {freezes ? (
          <Chip icon="snow" tone="brand" label={copy.dailyPuzzle.freezesLabel(freezes)}>
            {copy.dailyPuzzle.freezes(freezes)}
          </Chip>
        ) : null}
      </View>
      {done ? <DailyCountdown /> : <Button title={copy.dailyPuzzle.solve} icon="puzzle" variant="gold" onPress={() => router.push("/puzzle?daily=1")} />}
    </Card>
  );
}

const fmt = (day: string) => new Date(`${day}T12:00:00`).toLocaleDateString(undefined, { day: "numeric", month: "short" });

/** Last week's numbers in a grid, and the best moment. Used by the Monday card and the recap screen. */
export function RecapSummary({ recap }: { recap: WeeklyRecap }) {
  const { c } = useTheme();
  const stats: [string, string][] = [
    [copy.recap.xp, String(recap.xp)],
    [copy.recap.lessons, String(recap.lessons)],
    [copy.recap.puzzles, String(recap.puzzles)],
    [copy.recap.games, String(recap.games)],
    [copy.recap.rating, copy.recap.change(recap.ratingChange)],
  ];
  const b = recap.best;
  const best = !b ? copy.recap.noBest : b.kind === "win" ? copy.recap.bestWin(botName(b.bot)) : b.kind === "daily" ? copy.recap.bestDaily(b.days) : copy.recap.bestLessons(b.count);
  return (
    <View style={{ gap: 10 }}>
      <T role="small" color="textMuted">
        {copy.recap.range(fmt(recap.week), fmt(recap.to))}
      </T>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {stats.map(([label, value]) => (
          <View key={label} accessible accessibilityLabel={`${label}: ${value}`} style={{ flexGrow: 1, flexBasis: "28%", padding: 10, borderRadius: 14, backgroundColor: c.sunken, alignItems: "center", gap: 2 }}>
            <T role="heading" style={{ fontFamily: fonts.bold, fontVariant: ["tabular-nums"] }}>
              {value}
            </T>
            <T role="micro" color="textMuted">
              {label}
            </T>
          </View>
        ))}
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <Icon name="star" color={c.goldText} />
        <T role="label" style={{ flex: 1 }}>
          {`${copy.recap.best}: ${best}`}
        </T>
      </View>
    </View>
  );
}

export const useRecap = (today: string) => {
  const { state } = useApp();
  return weeklyRecap(state, today, botRating);
};

/** Monday to Wednesday on Today: last week's recap, until it is closed. */
export function RecapCard({ today }: { today: string }) {
  const { state, update } = useApp();
  const recap = useRecap(today);
  if (!recap || !showRecapCard(state, recap, today)) return null;
  return (
    <Card tone="hero" style={{ gap: 10 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <T role="heading" header style={{ flex: 1 }}>
          {copy.recap.cardTitle}
        </T>
        <IconButton icon="close" label={copy.recap.close} onPress={() => update((s) => closeRecap(s, recap.week))} />
      </View>
      <RecapSummary recap={recap} />
      <Button title={copy.recap.see} icon="chevron" variant="secondary" onPress={() => router.push("/recap")} />
    </Card>
  );
}

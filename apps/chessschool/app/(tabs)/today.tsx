import { dailyPuzzle } from "@chessschool/chess";
import { copy, dailyDone, dayKey, greetingFor, minutesToday, rankFor, visibleStreak, type Placement } from "@chessschool/design";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { View } from "react-native";
import { Cody, Fx } from "@/components/Lottie";
import { PathList } from "@/components/PathList";
import { Button, Card, Chip, Choice, GoalRing, IconButton, RankCurve, SaveBanner, Screen, Sheet, T } from "@/components/ui";
import { requestNotifications } from "@/lib/notifications";
import { useApp } from "@/lib/state";
import { useTheme } from "@/lib/theme";

export default function Today() {
  const { state, setPrefs, clearCeremony, clearArrival, markNotificationOffered, place, cue } = useApp();
  const { c } = useTheme();
  const now = new Date();
  const today = dayKey(now);
  const { progress, profile } = state;
  const name = profile.name.trim() || copy.today.friend;
  const rank = rankFor(progress.xp);
  const streak = visibleStreak(progress.streak, today);
  const minutes = minutesToday(progress, today);
  const done = Boolean(progress.completed.meet);
  const saved = state.pendingCeremony === "saved";
  const arrival = saved ? null : state.arrival;

  // "You came back" greets the first open of a new day, once.
  useEffect(() => {
    if (arrival) cue(arrival === "kept" ? "success" : "tap");
  }, [arrival, cue]);

  // "Your progress is saved" plays once after sign-up / log-in.
  useEffect(() => {
    if (!saved) return;
    cue("stamp");
    const t = setTimeout(clearCeremony, 4200);
    return () => clearTimeout(t);
  }, [saved, cue, clearCeremony]);

  // The reminder sheet is offered once, after the first lesson.
  const [notifOpen, setNotifOpen] = useState(false);
  const eligible = done && !state.notificationOffered && state.prefs.notifications === "unknown" && !saved;
  // Only while Today is in front, so it never covers the orientation celebration.
  useFocusEffect(
    useCallback(() => {
      if (!eligible) return;
      const t = setTimeout(() => setNotifOpen(true), 900);
      return () => clearTimeout(t);
    }, [eligible]),
  );
  const closeNotif = () => {
    setNotifOpen(false);
    markNotificationOffered();
  };

  return (
    <Screen>
      {saved ? (
        <View accessibilityLiveRegion="polite" style={{ flexDirection: "row", alignItems: "center", gap: 12, padding: 12, borderRadius: 20, backgroundColor: c.successSoft }}>
          <View style={{ width: 80, height: 80 }}>
            <Fx name="stamp" size={80} style={{ position: "absolute" }} />
            <Cody animation="celebrate" size={80} style={{ position: "absolute" }} />
          </View>
          <View style={{ flex: 1 }}>
            <T role="label" color="successText">
              {copy.ceremony.saved}
            </T>
            <T role="small">{copy.ceremony.savedBody}</T>
          </View>
          <IconButton icon="close" label={copy.a11y.dismiss} onPress={clearCeremony} />
        </View>
      ) : null}

      {arrival ? (
        <View accessibilityLiveRegion="polite" style={{ flexDirection: "row", alignItems: "center", gap: 12, padding: 12, borderRadius: 22, backgroundColor: c.dangerSoft, borderWidth: 1, borderColor: c.line }}>
          <View style={{ width: 80, height: 80 }}>
            {arrival === "kept" ? <Fx name="streak-spark" size={80} style={{ position: "absolute" }} /> : null}
            <Cody animation="wave" size={80} style={{ position: "absolute" }} />
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <T role="label">{arrival === "kept" ? copy.today.arrival.keptTitle : copy.today.arrival.freshTitle}</T>
            <T role="small" color="textMuted">
              {arrival === "kept" ? copy.today.arrival.keptBody(streak) : copy.today.arrival.freshBody}
            </T>
          </View>
          <IconButton icon="close" label={copy.a11y.dismiss} onPress={clearArrival} />
        </View>
      ) : null}

      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <Cody animation={done ? "happy" : "idle"} size={68} />
        <View style={{ flex: 1 }}>
          <T role="title" header>
            {`${greetingFor(now)}, ${name}`}
          </T>
          <T role="small" color="textMuted">
            {copy.today.level(copy.ranks[rank.rank], rank.level)}
          </T>
        </View>
      </View>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: -6 }}>
        <Chip icon="spark" tone={streak ? "accent" : "neutral"} label={copy.a11y.streak(streak)}>
          {streak ? copy.today.streak(streak) : copy.today.streakZero}
        </Chip>
        <Chip icon="bolt" tone="gold" label={copy.a11y.xp(progress.xp)}>
          {copy.today.xp(progress.xp)}
        </Chip>
      </View>

      {!state.placementDone && !progress.completed.board ? (
        <Card style={{ gap: 10 }}>
          <T role="heading" header>
            {copy.placement.title}
          </T>
          <T role="body" color="textMuted">
            {copy.placement.body}
          </T>
          {(["new", "moves", "player"] as Placement[]).map((p) => (
            <Choice
              key={p}
              label={copy.placement.options[p]}
              selected={false}
              onPress={() => {
                cue("tap");
                place(p);
              }}
            />
          ))}
        </Card>
      ) : null}

      <Card>
        <T role="heading" header style={{ marginBottom: 8 }}>
          {copy.today.pathTitle}
        </T>
        <PathList progress={progress} />
      </Card>

      <Card style={{ gap: 8 }}>
        <T role="heading" header>
          {copy.puzzles.daily}
        </T>
        <T role="body" color="textMuted">
          {dailyDone(progress, today) ? copy.puzzles.dailyDone : `${copy.puzzles.dailyBody} · ${dailyPuzzle(today).rating}`}
        </T>
        {dailyDone(progress, today) ? null : <Button title={copy.puzzles.daily} icon="puzzle" variant="secondary" onPress={() => router.push("/puzzle?daily=1")} />}
      </Card>

      <Card>
        <T role="heading" header style={{ marginBottom: 8 }}>
          {copy.today.rankTitle}
        </T>
        <RankCurve xp={progress.xp} />
      </Card>

      <Card style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
        <View style={{ flex: 1, gap: 4 }}>
          <T role="heading" header>
            {copy.today.goalTitle}
          </T>
          <T role="bodyLg">{copy.today.goalValue(minutes, profile.dailyMinutes)}</T>
          {minutes >= profile.dailyMinutes ? (
            <T role="small" color="textMuted">
              {copy.today.goalDone}
            </T>
          ) : null}
        </View>
        <GoalRing done={minutes} goal={profile.dailyMinutes} />
      </Card>

      {!state.account && done ? (
        <SaveBanner title={copy.today.saveCard.title} body={copy.today.saveCard.body} />
      ) : null}

      <Sheet visible={notifOpen} onClose={closeNotif}>
        <Cody animation="sleepy" size={110} />
        <T role="heading" header center>
          {copy.notificationsPrompt.title}
        </T>
        <T role="body" color="textMuted" center>
          {copy.notificationsPrompt.body}
        </T>
        <Button
          title={copy.notificationsPrompt.allow}
          icon="bell"
          onPress={async () => {
            setPrefs({ notifications: await requestNotifications() });
            closeNotif();
          }}
        />
        <Button
          title={copy.notificationsPrompt.later}
          variant="ghost"
          onPress={() => {
            setPrefs({ notifications: "dismissed" });
            closeNotif();
          }}
        />
      </Sheet>
    </Screen>
  );
}

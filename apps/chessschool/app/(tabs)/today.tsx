import { copy, dayKey, focusCourse, greetingFor, minutesToday, rankFor, visibleStreak, type Course, type Placement } from "@chessschool/design";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useRef, useEffect, useState } from "react";
import { ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { DailyCountdown, useDailyPuzzle } from "@/components/DailyCountdown";
import { Cody, Fx } from "@/components/Lottie";
import { guestClassLocked, openLesson, PathList } from "@/components/PathList";
import { Banner, Button, Card, Chip, Choice, GoalRing, IconButton, RankCurve, SaveBanner, Sheet, T } from "@/components/ui";
import { api } from "@/lib/api";
import { useCourse } from "@/lib/course";
import { requestNotifications } from "@/lib/notifications";
import { useApp } from "@/lib/state";
import { fonts, useTheme } from "@/lib/theme";

const GOAL_SEEN_KEY = "chessschool.v2.goalSeen";

export default function Today() {
  const { state, setPrefs, clearCeremony, clearArrival, markNotificationOffered, place, cue } = useApp();
  const { c } = useTheme();
  const now = new Date();
  const today = dayKey(now);
  const { puzzle: dailyPick, done: dailyIsDone } = useDailyPuzzle();
  const { progress, profile } = state;
  const name = profile.name.trim() || copy.today.friend;
  const rank = rankFor(progress.xp);
  const streak = visibleStreak(progress.streak, today);
  const minutes = minutesToday(progress, today);
  const done = Boolean(progress.completed.meet);
  const [goalSeen, setGoalSeen] = useState<boolean | null>(null);
  useEffect(() => {
    let live = true;
    AsyncStorage.getItem(GOAL_SEEN_KEY)
      .then((v) => {
        if (live) setGoalSeen(v === "1");
      })
      .catch(() => {
        if (live) setGoalSeen(false);
      });
    return () => {
      live = false;
    };
  }, []);
  useEffect(() => {
    if (goalSeen !== false) return;
    const t = setTimeout(() => void AsyncStorage.setItem(GOAL_SEEN_KEY, "1"), 800);
    return () => clearTimeout(t);
  }, [goalSeen]);
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
  const [gate, setGate] = useState(false);
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

  const cachedCourse = useCourse();
  const [freshCourse, setFreshCourse] = useState<Course | null>(null);
  const course = freshCourse ?? cachedCourse;
  const current = course ? focusCourse(course, progress.completed).current : null;
  const currentLocked = Boolean(course && current && guestClassLocked(course, current, Boolean(state.account), progress));
  const currentId = current?.id ?? null;
  const scroller = useRef<ScrollView>(null);
  const content = useRef<View>(null);
  const currentAnchor = useRef<View>(null);
  const viewH = useRef(0);
  const scrollToCurrent = useCallback(() => {
    const anchor = currentAnchor.current;
    const host = content.current;
    const visible = viewH.current;
    if (!anchor || !host || !visible) return;
    anchor.measureLayout(
      host,
      (_x, y, _w, height) => scroller.current?.scrollTo({ y: Math.max(0, y - (visible - height) / 2), animated: true }),
      () => {},
    );
  }, []);
  useFocusEffect(
    useCallback(() => {
      if (!currentId) return;
      const t = setTimeout(scrollToCurrent, 80);
      return () => clearTimeout(t);
    }, [currentId, scrollToCurrent]),
  );
  useFocusEffect(
    useCallback(() => {
      let live = true;
      api
        .course()
        .then((next) => {
          if (live) setFreshCourse(next);
        })
        .catch(() => {});
      return () => {
        live = false;
      };
    }, []),
  );

  return (
    <SafeAreaView edges={["top", "left", "right"]} style={{ flex: 1, backgroundColor: c.bg }}>
      <Banner />
      <ScrollView ref={scroller} onLayout={(e) => { viewH.current = e.nativeEvent.layout.height; }} contentContainerStyle={{ padding: 16, paddingBottom: current ? 128 : 40, gap: 16, maxWidth: 720, width: "100%", alignSelf: "center" }} keyboardShouldPersistTaps="handled">
        <View ref={content} collapsable={false} style={{ gap: 16 }}>
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
            {arrival === "kept" ? (
              <T role="small" color="textMuted" style={{ fontFamily: fonts.bold }}>
                {streak}
              </T>
            ) : (
              <T role="small" color="textMuted">
                {copy.today.arrival.freshBody}
              </T>
            )}
          </View>
          <IconButton icon="close" label={copy.a11y.dismiss} onPress={clearArrival} />
        </View>
      ) : null}

      {course && !current ? (
        <T role="bodyLg">{copy.today.heroAllBody}</T>
      ) : current ? (
        <T role="bodyLg">{copy.today.coachNext(current.title)}</T>
      ) : null}

      {goalSeen === false ? (
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
          {String(streak)}
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
        <PathList progress={progress} currentAnchor={currentAnchor} course={course} onGuestLock={() => setGate(true)} />
      </Card>

      <Card style={{ gap: 8 }}>
        <T role="heading" header>
          {copy.puzzles.daily}
        </T>
        <T role="body" color="textMuted">
          {dailyIsDone ? copy.puzzles.dailyDone : dailyPick ? `${copy.puzzles.dailyBody} · ${dailyPick.rating}` : copy.puzzles.dailyBody}
        </T>
        {dailyIsDone ? <DailyCountdown /> : <Button title={copy.puzzles.daily} icon="puzzle" variant="secondary" onPress={() => router.push("/puzzle?daily=1")} />}
      </Card>

      <Card>
        <T role="heading" header style={{ marginBottom: 8 }}>
          {copy.today.rankTitle}
        </T>
        <RankCurve xp={progress.xp} />
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
      <Sheet visible={gate} onClose={() => setGate(false)}>
        <T role="heading" header center>
          {copy.today.guestGate.title}
        </T>
        <T role="body" color="textMuted" center>
          {copy.today.guestGate.body}
        </T>
        <Button
          title={copy.today.guestGate.signup}
          onPress={() => {
            setGate(false);
            router.push("/signup");
          }}
        />
        <Button
          title={copy.today.guestGate.login}
          variant="secondary"
          onPress={() => {
            setGate(false);
            router.push("/login");
          }}
        />
      </Sheet>
        </View>
      </ScrollView>
      {current ? (
        <View style={{ position: "absolute", left: 0, right: 0, bottom: 0, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12, backgroundColor: c.bg, borderTopWidth: 1, borderTopColor: c.line }}>
          <View style={{ maxWidth: 688, width: "100%", alignSelf: "center", gap: 4 }}>
            <T role="small" color="textMuted" numberOfLines={1}>
              {current.title}
            </T>
            <Button
              title={currentLocked ? copy.today.guestGate.signup : current.id === "meet" ? copy.today.heroCta : copy.today.heroCtaLesson}
              icon={currentLocked ? "lock" : "play"}
              onPress={() => (currentLocked ? setGate(true) : openLesson(current.id))}
            />
          </View>
        </View>
      ) : null}
    </SafeAreaView>
  );
}

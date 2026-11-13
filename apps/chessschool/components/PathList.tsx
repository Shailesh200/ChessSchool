import { copy, focusCourse, type Course, type CourseLesson, type Progress } from "@chessschool/design";
import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Animated, Easing, Pressable, View } from "react-native";
import { CourseSkeleton } from "./Skeleton";
import { useReducedMotion } from "@/lib/hooks";
import { useCourse } from "@/lib/course";
import { useApp } from "@/lib/state";
import { fonts, useTheme } from "@/lib/theme";
import { Icon } from "./Icon";
import { T } from "./ui";

export const openLesson = (id: string) => router.push(id === "meet" ? "/orientation" : `/lesson/${id}`);

/** A class is locked when that lesson has `guestLocked: true`. Signed-in learners, and a missing flag, stay open. */
export function guestClassLocked(course: Course, lesson: { id: string; unit: string }, signedIn: boolean, _progress?: Progress): boolean {
  if (signedIn) return false;
  const row = course.lessons.find((l) => l.id === lesson.id) as (CourseLesson & { guestLocked?: boolean }) | undefined;
  return row?.guestLocked === true;
}

export function PathList({
  progress,
  currentAnchor,
  course: courseProp,
  onGuestLock,
}: {
  progress: Progress;
  currentAnchor?: React.RefObject<View | null>;
  /** When set, Learn owns the course (including a focus refresh). */
  course?: Course | null;
  onGuestLock?: () => void;
}) {
  const cached = useCourse();
  const course = courseProp !== undefined ? courseProp : cached;
  const { state } = useApp();
  const signedIn = Boolean(state.account);
  const { c } = useTheme();
  const [review, setReview] = useState(false);
  const [all, setAll] = useState(false);
  const seenIds = useRef<Set<string> | null>(null);
  const [freshId, setFreshId] = useState<string | null>(null);
  useEffect(() => {
    if (!course) return;
    const ids = course.lessons.map((l) => l.id);
    if (seenIds.current) {
      const added = ids.find((id) => !seenIds.current?.has(id));
      if (added) setFreshId(added);
    }
    seenIds.current = new Set(ids);
  }, [course]);
  if (!course) return <CourseSkeleton />;
  const f = focusCourse(course, progress.completed);
  const unitName = (id: string) => course.units.find((u) => u.id === id)?.title ?? "";
  const isLocked = (lesson: CourseLesson) => guestClassLocked(course, lesson, signedIn, progress);
  const go = (lesson: CourseLesson) => {
    if (isLocked(lesson)) {
      onGuestLock?.();
      return;
    }
    openLesson(lesson.id);
  };
  const classOpened = Boolean(f.justFinished && f.current && f.justFinished.unit !== f.current.unit && f.unitsDone.some((u) => u.id === f.justFinished?.unit));
  return (
    <View style={{ gap: 12 }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <T role="small" color="textMuted" style={{ flex: 1 }}>
          {copy.today.focus.progress(f.unitsDone.length, f.unitCount, f.doneCount)}
        </T>
        {f.currentUnit ? (
          <T role="small" style={{ color: c.brandText, backgroundColor: c.brandSoft, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, overflow: "hidden" }}>
            {copy.today.focus.active(f.currentUnit.title)}
          </T>
        ) : null}
      </View>
      {f.doneCount > 1 ? (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12, padding: 12, borderRadius: 16, borderWidth: 1, borderColor: c.line }}>
          <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: c.success, alignItems: "center", justifyContent: "center" }}>
            <Icon name="check" size={16} color="#fff" />
          </View>
          <View style={{ flex: 1 }}>
            <T role="label">{copy.today.focus.earlier(f.doneCount)}</T>
            <T role="small" color="textMuted">
              {f.unitsDone.map((u) => u.title.replace(/^Unit \d+ · /, "")).join(", ")}
            </T>
          </View>
          <Pressable accessibilityRole="button" onPress={() => setReview((v) => !v)}>
            <T role="small" style={{ color: c.brandText }}>
              {review ? copy.today.focus.hide : copy.today.focus.review}
            </T>
          </Pressable>
        </View>
      ) : null}
      {review
        ? f.done.map((l) => (
            <Pressable key={l.id} accessibilityRole="button" onPress={() => go(l)} style={{ minHeight: 44, justifyContent: "center", borderTopWidth: 1, borderTopColor: c.line }}>
              <T role="label">{l.title}</T>
            </Pressable>
          ))
        : null}
      {f.justFinished ? <Stop kind="done" lesson={f.justFinished} unit={unitName(f.justFinished.unit)} kicker={copy.today.focus.justFinished} /> : null}
      {f.current ? (
        <Stop
          kind="current"
          lesson={f.current}
          unit={unitName(f.current.unit)}
          kicker={isLocked(f.current) ? copy.today.guestGate.locked : classOpened || freshId === f.current.id ? copy.today.focus.unlocked : copy.today.focus.current}
          anchor={currentAnchor}
          locked={isLocked(f.current)}
          onOpen={() => go(f.current!)}
        />
      ) : null}
      {f.upcoming.map((l, i) => (
        <Stop key={l.id} kind="next" lesson={l} unit={unitName(l.unit)} kicker={isLocked(l) ? copy.today.guestGate.locked : i === 0 ? copy.today.focus.upNext : undefined} locked={isLocked(l)} onOpen={() => go(l)} />
      ))}
      {f.rest.length ? (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12, padding: 12, borderRadius: 16, borderWidth: 1, borderStyle: "dashed", borderColor: c.line }}>
          <View style={{ flex: 1 }}>
            <T role="label">{copy.today.focus.more(f.rest.length)}</T>
            <T role="small" color="textMuted">
              {[...new Set(f.rest.map((l) => unitName(l.unit).replace(/^Unit \d+ · /, "")))].join(", ")}
            </T>
          </View>
          <Pressable accessibilityRole="button" onPress={() => setAll((v) => !v)}>
            <T role="small" style={{ color: c.brandText }}>
              {all ? copy.today.focus.showLess : copy.today.focus.viewAll}
            </T>
          </Pressable>
        </View>
      ) : null}
      {all
        ? f.rest.map((l) => (
            <Pressable key={l.id} accessibilityRole="button" onPress={() => go(l)} style={{ minHeight: 44, justifyContent: "center", borderTopWidth: 1, borderTopColor: c.line }}>
              <T role="label">{l.title}</T>
              <T role="small" color="textMuted">
                {isLocked(l) ? copy.today.guestGate.locked : copy.today.open(l.minutes)}
              </T>
            </Pressable>
          ))
        : null}
      {!f.current ? <T color="textMuted">{copy.today.heroAllBody}</T> : null}
    </View>
  );
}

function StartMark() {
  const { c } = useTheme();
  const reduced = useReducedMotion();
  const y = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (reduced) {
      y.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(y, { toValue: -6, duration: 900, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(y, { toValue: 0, duration: 900, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [reduced, y]);
  return (
    <Animated.View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ position: "absolute", top: -22, alignSelf: "center", transform: [{ translateY: y }] }}>
      <View style={{ backgroundColor: c.brand, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 }}>
        <T role="micro" style={{ color: c.onBrand, fontFamily: fonts.bold }}>
          {copy.today.start}
        </T>
      </View>
    </Animated.View>
  );
}

function Stop({
  kind,
  lesson,
  unit,
  kicker,
  anchor,
  locked = false,
  onOpen,
}: {
  kind: "done" | "current" | "next";
  lesson: CourseLesson;
  unit: string;
  kicker?: string;
  anchor?: React.RefObject<View | null>;
  locked?: boolean;
  onOpen?: () => void;
}) {
  const { c } = useTheme();
  const card = (
    <View style={{ flex: 1, gap: 2, padding: 14, borderRadius: 18, borderWidth: kind === "current" ? 2 : 1, borderStyle: locked ? "dashed" : "solid", borderColor: kind === "current" && !locked ? c.brand : c.line, backgroundColor: locked ? c.sunken : c.card }}>
      {kicker ? (
        <T role="small" style={{ color: kind === "done" ? c.successText : c.brandText, fontWeight: "700", textTransform: "uppercase" }}>
          {kicker}
        </T>
      ) : null}
      <T role="small" color="textMuted">
        {unit}
      </T>
      <T role="label">{lesson.title}</T>
      <T role="small" color="textMuted">
        {locked ? copy.today.guestGate.locked : kind === "done" ? `${copy.today.done} · +${lesson.xp} XP` : `${lesson.sub} · ${lesson.minutes} min`}
      </T>
    </View>
  );
  const dot = locked ? c.sunken : kind === "done" ? c.success : kind === "current" ? c.brand : c.card;
  const tappable = kind === "next" || kind === "current";
  return (
    <View ref={kind === "current" ? anchor : undefined} collapsable={false} style={{ flexDirection: "row", gap: 12, alignItems: "flex-start", marginTop: kind === "current" ? 18 : 0 }}>
      <View style={{ width: 28, alignItems: "center", marginTop: 14 }}>
        {kind === "current" && !locked ? <StartMark /> : null}
        <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: dot, borderWidth: 2, borderColor: locked || kind === "next" ? c.line : dot, alignItems: "center", justifyContent: "center" }}>
          {locked ? <Icon name="lock" size={14} color={c.textMuted} /> : kind === "done" ? <Icon name="check" size={16} color="#fff" /> : kind === "current" ? <Icon name="play" size={14} color={c.onBrand} /> : null}
        </View>
      </View>
      {tappable ? (
        <Pressable accessibilityRole="button" onPress={onOpen} style={{ flex: 1 }}>
          {card}
        </Pressable>
      ) : (
        card
      )}
    </View>
  );
}

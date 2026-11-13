import { copy, focusCourse, radius, space, type Course, type CourseLesson, type Progress } from "@chessschool/design";
import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Pressable, View } from "react-native";
import { CourseSkeleton } from "./Skeleton";
import { useCourse } from "@/lib/course";
import { useApp } from "@/lib/state";
import { useTheme } from "@/lib/theme";
import { Icon } from "./Icon";
import { Badge, ProgressBar, T, type BadgeTone } from "./ui";

const RAIL = 44;
const DOT = 28;
const DOT_CURRENT = 44;

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
  const otherUnit = (id: string) => (id === f.currentUnit?.id ? undefined : unitName(id));
  const isLocked = (lesson: CourseLesson) => guestClassLocked(course, lesson, signedIn, progress);
  const go = (lesson: CourseLesson) => {
    if (isLocked(lesson)) {
      onGuestLock?.();
      return;
    }
    openLesson(lesson.id);
  };
  const share = f.doneCount / Math.max(1, course.lessons.length);
  const classOpened = Boolean(f.justFinished && f.current && f.justFinished.unit !== f.current.unit && f.unitsDone.some((u) => u.id === f.justFinished?.unit));
  return (
    <View style={{ gap: 12 }}>
      <View style={{ gap: space[2] }}>
        <View style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: space[2] }}>
          <T role="label" numberOfLines={1} style={{ flex: 1 }}>
            {f.currentUnit ? f.currentUnit.title : copy.today.heroLabelAll}
          </T>
          <T role="label" style={{ color: c.brandText }}>{`${Math.round(share * 100)}%`}</T>
        </View>
        <ProgressBar value={share} label={copy.today.focus.progress(f.unitsDone.length, f.unitCount, f.doneCount)} />
        <T role="small" color="textMuted">
          {copy.today.focus.progress(f.unitsDone.length, f.unitCount, f.doneCount)}
        </T>
      </View>
      {f.doneCount > 1 ? (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12, padding: 12, borderRadius: 16, borderWidth: 1, borderColor: c.line }}>
          <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: c.success, alignItems: "center", justifyContent: "center" }}>
            <Icon name="check" size={16} color="#fff" />
          </View>
          <View style={{ flex: 1 }}>
            <T role="label">{copy.today.focus.earlier(f.doneCount)}</T>
            <T role="small" color="textMuted">
              {copy.today.focus.units(f.unitsDone.map((u) => u.title))}
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
      {f.justFinished ? <Stop kind="done" lesson={f.justFinished} unit={otherUnit(f.justFinished.unit)} kicker={copy.today.focus.justFinished} /> : null}
      {f.current ? (
        <Stop
          kind="current"
          lesson={f.current}
          unit={otherUnit(f.current.unit)}
          kicker={isLocked(f.current) ? copy.today.guestGate.locked : classOpened || freshId === f.current.id ? copy.today.focus.unlocked : copy.today.focus.current}
          anchor={currentAnchor}
          locked={isLocked(f.current)}
          onOpen={() => go(f.current!)}
        />
      ) : null}
      {f.upcoming.map((l, i) => (
        <Stop key={l.id} kind="next" lesson={l} unit={otherUnit(l.unit)} kicker={isLocked(l) ? copy.today.guestGate.locked : i === 0 ? copy.today.focus.upNext : undefined} locked={isLocked(l)} onOpen={() => go(l)} />
      ))}
      {f.rest.length ? (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12, padding: 12, borderRadius: 16, borderWidth: 1, borderStyle: "dashed", borderColor: c.line }}>
          <View style={{ flex: 1 }}>
            <T role="label">{copy.today.focus.more(f.rest.length)}</T>
            <T role="small" color="textMuted">
              {copy.today.focus.units(f.rest.map((l) => unitName(l.unit)))}
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
      <View style={{ gap: space[3], padding: space[4], borderRadius: radius.lg, borderWidth: 1, borderStyle: "dashed", borderColor: c.line }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: space[2] }}>
          <Icon name="sparkles" size={20} color={c.brandText} />
          <T role="label">{copy.today.comingSoonTitle}</T>
        </View>
        <T role="small" color="textMuted">
          {copy.today.comingSoonBody}
        </T>
        {(course.comingSoon ?? copy.comingSoon).map((item) => (
          <View key={item.id} style={{ flexDirection: "row", alignItems: "center", gap: space[3], paddingVertical: space[2], paddingHorizontal: space[3], borderRadius: radius.md, backgroundColor: c.sunken }}>
            <Icon name="clock" size={18} color={c.textMuted} />
            <View style={{ flex: 1 }}>
              <T role="label">{item.title}</T>
              <T role="small" color="textMuted">
                {item.sub}
              </T>
            </View>
          </View>
        ))}
      </View>
      {!f.current ? <T color="textMuted">{copy.today.heroAllBody}</T> : null}
    </View>
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
  /** Omitted when it is the unit already named above the list. */
  unit?: string;
  kicker?: string;
  anchor?: React.RefObject<View | null>;
  locked?: boolean;
  onOpen?: () => void;
}) {
  const { c } = useTheme();
  const active = kind === "current" && !locked;
  const tone: BadgeTone = locked ? "neutral" : kind === "done" ? "success" : kind === "current" ? "brand" : "neutral";
  const card = (
    <View
      style={{
        flex: 1,
        gap: space[1],
        padding: space[4],
        borderRadius: radius.lg,
        borderWidth: active ? 2 : 1,
        borderStyle: locked ? "dashed" : "solid",
        borderColor: active ? c.brand : c.line,
        backgroundColor: locked ? c.sunken : c.card,
      }}
    >
      {kicker ? <Badge tone={tone}>{kicker}</Badge> : null}
      {unit ? (
        <T role="small" color="textMuted">
          {unit}
        </T>
      ) : null}
      <T role="label">{lesson.title}</T>
      <T role="small" color="textMuted">
        {locked ? copy.today.guestGate.locked : kind === "done" ? `${copy.today.done} · +${lesson.xp} XP` : `${lesson.sub} · ${lesson.minutes} min`}
      </T>
    </View>
  );
  const fill = locked ? c.sunken : kind === "done" ? c.success : active ? c.brand : c.card;
  const dot = active ? DOT_CURRENT : DOT;
  const tappable = kind === "next" || kind === "current";
  return (
    <View ref={kind === "current" ? anchor : undefined} collapsable={false} style={{ flexDirection: "row", gap: space[3], alignItems: "stretch" }}>
      <View style={{ width: RAIL, alignItems: "center", paddingTop: space[4] }}>
        <View style={{ position: "absolute", top: 0, bottom: -space[3], width: 2, borderRadius: 1, backgroundColor: kind === "done" ? c.success : c.line }} />
        <View style={{ width: dot, height: dot, borderRadius: dot / 2, backgroundColor: fill, borderWidth: 2, borderColor: locked || kind === "next" ? c.line : fill, alignItems: "center", justifyContent: "center" }}>
          {locked ? <Icon name="lock" size={14} color={c.textMuted} /> : kind === "done" ? <Icon name="check" size={16} color={c.onBrand} /> : active ? <Icon name="play" size={22} color={c.onBrand} /> : null}
        </View>
      </View>
      {tappable ? (
        <Pressable accessibilityRole="button" onPress={onOpen} style={({ pressed }) => ({ flex: 1, opacity: pressed ? 0.85 : 1 })}>
          {card}
        </Pressable>
      ) : (
        card
      )}
    </View>
  );
}

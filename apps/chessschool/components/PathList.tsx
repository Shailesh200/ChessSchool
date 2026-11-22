import { CARD_BACKDROPS, copy, focusCourse, radius, space, type Course, type CourseLesson, type Progress } from "@chessschool/design";
import { router } from "expo-router";
import { View } from "react-native";
import { CourseSkeleton } from "./Skeleton";
import { useCourse } from "@/lib/course";
import { useApp } from "@/lib/state";
import { fonts, useTheme } from "@/lib/theme";
import { Backdrop } from "./Backdrop";
import { PieceArt } from "./Board";
import { Cody } from "./Lottie";
import { Icon } from "./Icon";
import { CourseMap } from "./CourseMap";
import { Button, Card, T } from "./ui";

export const openLesson = (id: string) => router.push(id === "meet" ? "/orientation" : `/lesson/${id}`);

/** A class is locked when that lesson has `guestLocked: true`. Signed-in learners, and a missing flag, stay open. */
export function guestClassLocked(course: Course, lesson: { id: string; unit: string }, signedIn: boolean, _progress?: Progress): boolean {
  if (signedIn) return false;
  const row = course.lessons.find((l) => l.id === lesson.id) as (CourseLesson & { guestLocked?: boolean }) | undefined;
  return row?.guestLocked === true;
}

/** Learn's course: progress, the trail map, and what's coming next. */
export function PathList({
  progress,
  course: courseProp,
  onGuestLock,
}: {
  progress: Progress;
  /** When set, Learn owns the course (including a focus refresh). */
  course?: Course | null;
  onGuestLock?: () => void;
}) {
  const cached = useCourse();
  const course = courseProp !== undefined ? courseProp : cached;
  const { state } = useApp();
  const signedIn = Boolean(state.account);
  const { c } = useTheme();
  if (!course) return <CourseSkeleton />;
  const f = focusCourse(course, progress.completed);
  const isLocked = (lesson: CourseLesson) => guestClassLocked(course, lesson, signedIn, progress);
  const go = (lesson: CourseLesson) => {
    if (isLocked(lesson)) {
      onGuestLock?.();
      return;
    }
    openLesson(lesson.id);
  };
  const share = f.doneCount / Math.max(1, course.lessons.length);
  const unitIndex = f.currentUnit ? course.units.findIndex((u) => u.id === f.currentUnit!.id) : -1;
  const unitLessons = f.currentUnit ? course.lessons.filter((l) => l.unit === f.currentUnit!.id) : [];
  const nextUnits = unitIndex >= 0 ? course.units.slice(unitIndex + 1, unitIndex + 3) : [];
  const UNIT_PIECES = ["b", "r", "q", "k", "n", "p"] as const;
  return (
    <View style={{ gap: 14 }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <T role="eyebrow" color="textMuted" header>
          {copy.today.pathTitle}
        </T>
        <T role="small" style={{ color: c.brandText, fontFamily: fonts.bold }}>{copy.today.through(Math.round(share * 100))}</T>
      </View>

      {f.current && f.currentUnit ? (
        <Card style={{ padding: 0, overflow: "hidden" }}>
          <View style={{ height: 150, backgroundColor: c.heroFrom, justifyContent: "flex-end", padding: 16 }}>
            <Backdrop art={CARD_BACKDROPS.course} under={c.heroFrom} />
            <View style={{ position: "absolute", right: 6, bottom: -4 }}>
              <Cody animation="idle" size={128} />
            </View>
            <View style={{ gap: 6, maxWidth: "62%" }}>
              <View style={{ alignSelf: "flex-start", backgroundColor: c.brand, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 }}>
                <T role="micro" style={{ color: c.onBrand, fontFamily: fonts.bold }}>
                  {copy.today.unitLabel(unitIndex + 1)}
                </T>
              </View>
              <T role="title" numberOfLines={2} style={{ fontSize: 24, lineHeight: 28 }}>
                {f.currentUnit.title.replace(/^Unit \d+ · /, "")}
              </T>
            </View>
          </View>
          <View style={{ padding: 16, gap: 14 }}>
            <View accessible accessibilityLabel={copy.today.unitDots(unitLessons.filter((l) => progress.completed[l.id]).length, unitLessons.length)} style={{ flexDirection: "row", alignItems: "center" }}>
              {unitLessons.map((l, i) => {
                const done = Boolean(progress.completed[l.id]);
                const now = l.id === f.current!.id;
                return (
                  <View key={l.id} style={{ flexDirection: "row", alignItems: "center", flex: i === unitLessons.length - 1 ? 0 : 1 }}>
                    <View style={{ width: now ? 36 : 28, height: now ? 36 : 28, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: done ? c.success : now ? c.gold : c.sunken, borderWidth: now ? 4 : 0, borderColor: c.goldSoft }}>
                      {done ? <Icon name="check" size={16} color="#fff" /> : now ? <Icon name="play" size={14} color={c.onGold} /> : null}
                    </View>
                    {i < unitLessons.length - 1 ? <View style={{ flex: 1, height: 4, borderRadius: 2, marginHorizontal: 4, backgroundColor: done ? c.success : c.sunken }} /> : null}
                  </View>
                );
              })}
            </View>
            <View style={{ gap: 2 }}>
              <T role="small" color="textMuted">
                {copy.today.upNext}
              </T>
              <T role="heading">{f.current.title}</T>
            </View>
            <Button title={copy.today.continueLesson} icon="play" onPress={() => go(f.current!)} />
          </View>
        </Card>
      ) : null}

      {nextUnits.length ? (
        <View style={{ gap: 10 }}>
          <T role="label">{copy.today.nextUnits}</T>
          <View style={{ flexDirection: "row", gap: 10 }}>
            {nextUnits.map((u, i) => (
              <View key={u.id} style={{ flex: 1, backgroundColor: c.card, borderRadius: 18, borderWidth: 1, borderColor: c.line, padding: 12, gap: 6 }}>
                <PieceArt piece={{ type: UNIT_PIECES[(unitIndex + i) % UNIT_PIECES.length], color: "b" }} size={26} />
                <T role="label" numberOfLines={2} style={{ fontSize: 14, lineHeight: 18 }}>
                  {u.title.replace(/^Unit \d+ · /, "")}
                </T>
                <T role="micro" color="textMuted">
                  {copy.today.unitLabel(unitIndex + i + 2)}
                </T>
              </View>
            ))}
          </View>
        </View>
      ) : null}

      <T role="label">{copy.today.courseMap}</T>
      <CourseMap
        course={course}
        progress={progress}
        onOpen={(id) => {
          const lesson = course.lessons.find((l) => l.id === id);
          if (lesson) go(lesson);
        }}
      />
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


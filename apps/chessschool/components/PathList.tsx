import { copy, focusCourse, radius, space, type Course, type CourseLesson, type Progress } from "@chessschool/design";
import { router } from "expo-router";
import { View } from "react-native";
import { CourseSkeleton } from "./Skeleton";
import { useCourse } from "@/lib/course";
import { useApp } from "@/lib/state";
import { useTheme } from "@/lib/theme";
import { Icon } from "./Icon";
import { CourseMap } from "./CourseMap";
import { ProgressBar, T } from "./ui";

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
      </View>
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


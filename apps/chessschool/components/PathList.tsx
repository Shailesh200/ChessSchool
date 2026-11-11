import { copy, focusCourse, type CourseLesson, type Progress } from "@chessschool/design";
import { router } from "expo-router";
import { useState } from "react";
import { Pressable, View } from "react-native";
import { CourseSkeleton } from "./Skeleton";
import { useCourse } from "@/lib/course";
import { useTheme } from "@/lib/theme";
import { Icon } from "./Icon";
import { Button, T } from "./ui";

const open = (id: string) => router.push(id === "meet" ? "/orientation" : `/lesson/${id}`);

export function PathList({ progress }: { progress: Progress }) {
  const course = useCourse();
  const { c } = useTheme();
  const [review, setReview] = useState(false);
  const [all, setAll] = useState(false);
  if (!course) return <CourseSkeleton />;
  const f = focusCourse(course, progress.completed);
  const unitName = (id: string) => course.units.find((u) => u.id === id)?.title ?? "";
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
            <Pressable key={l.id} accessibilityRole="button" onPress={() => open(l.id)} style={{ minHeight: 44, justifyContent: "center", borderTopWidth: 1, borderTopColor: c.line }}>
              <T role="label">{l.title}</T>
            </Pressable>
          ))
        : null}
      {f.justFinished ? <Stop kind="done" lesson={f.justFinished} unit={unitName(f.justFinished.unit)} kicker={copy.today.focus.justFinished} /> : null}
      {f.current ? <Stop kind="current" lesson={f.current} unit={unitName(f.current.unit)} kicker={copy.today.focus.current} /> : null}
      {f.upcoming.map((l, i) => (
        <Stop key={l.id} kind="next" lesson={l} unit={unitName(l.unit)} kicker={i === 0 ? copy.today.focus.upNext : undefined} />
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
            <Pressable key={l.id} accessibilityRole="button" onPress={() => open(l.id)} style={{ minHeight: 44, justifyContent: "center", borderTopWidth: 1, borderTopColor: c.line }}>
              <T role="label">{l.title}</T>
              <T role="small" color="textMuted">
                {copy.today.open(l.minutes)}
              </T>
            </Pressable>
          ))
        : null}
      {!f.current ? <T color="textMuted">{copy.today.heroAllBody}</T> : null}
    </View>
  );
}

function Stop({ kind, lesson, unit, kicker }: { kind: "done" | "current" | "next"; lesson: CourseLesson; unit: string; kicker?: string }) {
  const { c } = useTheme();
  const card = (
    <View style={{ flex: 1, gap: 2, padding: 14, borderRadius: 18, borderWidth: kind === "current" ? 2 : 1, borderColor: kind === "current" ? c.brand : c.line, backgroundColor: c.card }}>
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
        {kind === "done" ? `${copy.today.done} · +${lesson.xp} XP` : `${lesson.sub} · ${lesson.minutes} min`}
      </T>
      {kind === "current" ? (
        <View style={{ marginTop: 10 }}>
          <Button title={lesson.id === "meet" ? copy.today.heroCta : copy.today.heroCtaLesson} icon="play" onPress={() => open(lesson.id)} />
        </View>
      ) : null}
    </View>
  );
  const dot = kind === "done" ? c.success : kind === "current" ? c.brand : c.card;
  return (
    <View style={{ flexDirection: "row", gap: 12, alignItems: "flex-start" }}>
      <View style={{ width: 28, height: 28, marginTop: 14, borderRadius: 14, backgroundColor: dot, borderWidth: 2, borderColor: kind === "next" ? c.line : dot, alignItems: "center", justifyContent: "center" }}>
        {kind === "done" ? <Icon name="check" size={16} color="#fff" /> : kind === "current" ? <Icon name="play" size={14} color={c.onBrand} /> : null}
      </View>
      {kind === "next" ? (
        <Pressable accessibilityRole="button" onPress={() => open(lesson.id)} style={{ flex: 1 }}>
          {card}
        </Pressable>
      ) : (
        card
      )}
    </View>
  );
}

import { copy, type CodyAnimation } from "@chessschool/design";
import { useState } from "react";
import { View } from "react-native";
import { fonts, useTheme } from "@/lib/theme";
import { Cody, Fx } from "./Lottie";
import { T } from "./ui";

export type LessonSummary = { xp: number; accuracy: number; seconds: number; perfectBonus?: number; best: number };

/** The end-of-lesson moment: stamp, Cody, earned XP and streak, the lesson summary, then what's next. */
export function LessonDone({ title, body, recap, xp, streak, goalMet, summary, children }: { title: string; body: string; recap?: string; xp?: number; streak?: number; goalMet?: boolean; summary?: LessonSummary; children: React.ReactNode }) {
  const { c } = useTheme();
  // Lesson finished, then (when today's streak or goal just landed) the streak-saved beat.
  const [pose, setPose] = useState<CodyAnimation>("lesson-complete");
  return (
    <>
      <View style={{ width: 260, height: 220, alignItems: "center", justifyContent: "center", borderRadius: 130, backgroundColor: c.brandSoft }}>
        <Fx name="stamp" size={170} style={{ position: "absolute", left: 0, top: 0 }} />
        <Cody animation={pose} onFinish={() => (streak || goalMet) && setPose("streak-saved")} size={150} label={copy.a11y.mascot} style={{ position: "absolute", right: 0, bottom: 0 }} />
      </View>
      <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 8 }}>
        {xp ? (
          <View accessible accessibilityLabel={copy.a11y.xp(xp)} style={{ flexDirection: "row", alignItems: "center", gap: 4, paddingLeft: 6, paddingRight: 16, paddingVertical: 4, borderRadius: 999, backgroundColor: c.goldSoft }}>
            <Fx name="xp-pop" size={40} />
            <T role="heading" style={{ color: c.goldText, fontFamily: fonts.bold }}>
              {copy.orientation.xp(xp)}
            </T>
          </View>
        ) : null}
        {streak ? (
          <View accessible accessibilityLabel={copy.lesson.streakUp(streak)} style={{ flexDirection: "row", alignItems: "center", gap: 2, paddingLeft: 4, paddingRight: 16, paddingVertical: 4, borderRadius: 999, backgroundColor: c.dangerSoft }}>
            <Fx name="streak-spark" size={40} />
            <T role="label">{streak}</T>
          </View>
        ) : null}
      </View>
      <T role="title" header center>
        {title}
      </T>
      <T role="bodyLg" color="textMuted" center style={{ maxWidth: 360 }}>
        {body}
      </T>
      {summary ? (
        <View style={{ maxWidth: 360, alignSelf: "stretch", gap: 8 }}>
          <View accessible accessibilityLabel={copy.lesson.summaryA11y(summary.xp, summary.accuracy, copy.lesson.timeValue(summary.seconds))} style={{ flexDirection: "row", gap: 8 }}>
            {[
              [copy.lesson.summaryXp, String(summary.xp)],
              [copy.lesson.summaryAccuracy, copy.lesson.accuracyValue(summary.accuracy)],
              [copy.lesson.summaryTime, copy.lesson.timeValue(summary.seconds)],
            ].map(([label, value]) => (
              <View key={label} style={{ flex: 1, alignItems: "center", paddingVertical: 10, borderRadius: 14, backgroundColor: c.sunken }}>
                <T role="small" color="textMuted">
                  {label}
                </T>
                <T role="heading">{value}</T>
              </View>
            ))}
          </View>
          {summary.perfectBonus ? (
            <T role="label" color="goldText" center>
              {copy.lesson.perfect(summary.perfectBonus)}
            </T>
          ) : null}
          {summary.best >= 3 ? (
            <T role="small" color="textMuted" center>
              {copy.lesson.bestCombo(summary.best)}
            </T>
          ) : null}
        </View>
      ) : null}
      {recap ? (
        <View style={{ maxWidth: 360, alignSelf: "stretch", gap: 4, padding: 14, borderRadius: 16, backgroundColor: c.sunken }}>
          <T role="label">{copy.lesson.recapTitle}</T>
          <T role="body" color="textMuted">
            {recap}
          </T>
        </View>
      ) : null}
      {goalMet ? (
        <View style={{ paddingHorizontal: 12, paddingVertical: 4, borderRadius: 999, backgroundColor: c.brandSoft }}>
          <T role="small" color="brandText" style={{ fontFamily: fonts.semibold }}>
            {copy.lesson.goalMet}
          </T>
        </View>
      ) : null}
      <View style={{ alignSelf: "stretch", gap: 8, marginTop: 8 }}>{children}</View>
    </>
  );
}

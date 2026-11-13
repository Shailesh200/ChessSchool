import { copy } from "@chessschool/design";
import { View } from "react-native";
import { fonts, useTheme } from "@/lib/theme";
import { Cody, Fx } from "./Lottie";
import { T } from "./ui";

/** The end-of-lesson moment: stamp, Cody, earned XP and streak, then what's next. */
export function LessonDone({ title, body, recap, xp, streak, goalMet, children }: { title: string; body: string; recap?: string; xp?: number; streak?: number; goalMet?: boolean; children: React.ReactNode }) {
  const { c } = useTheme();
  return (
    <>
      <View style={{ width: 260, height: 220, alignItems: "center", justifyContent: "center", borderRadius: 130, backgroundColor: c.brandSoft }}>
        <Fx name="stamp" size={170} style={{ position: "absolute", left: 0, top: 0 }} />
        <Cody animation="celebrate" size={150} label={copy.a11y.mascot} style={{ position: "absolute", right: 0, bottom: 0 }} />
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
            <T role="label">{copy.lesson.streakUp(streak)}</T>
          </View>
        ) : null}
      </View>
      <T role="title" header center>
        {title}
      </T>
      <T role="bodyLg" color="textMuted" center style={{ maxWidth: 360 }}>
        {body}
      </T>
      {recap ? (
        <T role="body" center style={{ maxWidth: 360 }}>
          {recap}
        </T>
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

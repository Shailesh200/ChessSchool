import { copy, type CodyAnimation, type DailyMinutes, type Who } from "@chessschool/design";
import { router } from "expo-router";
import { useState } from "react";
import { Pressable, View } from "react-native";
import { Cody } from "@/components/Lottie";
import { Button, Choice, Flow, IconButton, Steps, T } from "@/components/ui";
import { useApp } from "@/lib/state";
import { useTheme } from "@/lib/theme";

const POSES: CodyAnimation[] = ["wave", "thinking", "happy", "celebrate"];
const STEPS = 4;

export default function Welcome() {
  const { state, setProfile, setSeenWelcome, cue } = useApp();
  const { c } = useTheme();
  const [step, setStep] = useState(0);
  const w = copy.welcome.steps;
  const tints = [c.brandSoft, c.dangerSoft, c.successSoft];

  const finish = (to: "/today" | "/login") => {
    setSeenWelcome();
    if (to === "/today") cue("success");
    router.replace(to);
  };

  return (
    <Flow
      top={
        <>
          {step > 0 ? <IconButton icon="back" label={copy.welcome.back} onPress={() => setStep(step - 1)} /> : <View style={{ width: 48 }} />}
          <Steps count={STEPS} current={step} label={copy.orientation.progress(step + 1, STEPS)} />
          <Pressable accessibilityRole="button" onPress={() => finish("/today")} hitSlop={10} style={{ minHeight: 48, justifyContent: "center", paddingHorizontal: 8 }}>
            <T role="label" color="brandText">
              {copy.welcome.skip}
            </T>
          </Pressable>
        </>
      }
      footer={
        step < STEPS - 1 ? (
          <Button
            title={copy.welcome.next}
            onPress={() => {
              cue("tap");
              setStep(step + 1);
            }}
          />
        ) : (
          <>
            <Button title={w.start.guest} onPress={() => finish("/today")} />
            <Button title={w.start.account} variant="ghost" onPress={() => finish("/login")} />
          </>
        )
      }
    >
      <Cody key={step} animation={POSES[step]} size={step === 0 ? 200 : 150} label={copy.a11y.mascot} />
      {step === 0 ? (
        <>
          <T role="title" header center>
            {w.intro.title}
          </T>
          <T role="bodyLg" color="textMuted" center style={{ maxWidth: 340 }}>
            {w.intro.body}
          </T>
        </>
      ) : null}
      {step === 1 ? (
        <>
          <T role="title" header center>
            {w.who.title}
          </T>
          <T role="body" color="textMuted" center>
            {w.who.body}
          </T>
          <View accessibilityRole="radiogroup" style={{ gap: 10, alignSelf: "stretch" }}>
            {(Object.keys(w.who.options) as Who[]).map((id) => (
              <Choice key={id} label={w.who.options[id]} selected={state.profile.who === id} onPress={() => (setProfile({ who: id }), cue("tap"))} />
            ))}
          </View>
        </>
      ) : null}
      {step === 2 ? (
        <>
          <T role="title" header center>
            {w.minutes.title}
          </T>
          <T role="body" color="textMuted" center>
            {w.minutes.body}
          </T>
          <View accessibilityRole="radiogroup" style={{ gap: 10, alignSelf: "stretch" }}>
            {([5, 10, 15] as DailyMinutes[]).map((m, i) => (
              <Choice key={m} tint={tints[i]} label={`${m} min · ${w.minutes.options[m]}`} selected={state.profile.dailyMinutes === m} onPress={() => (setProfile({ dailyMinutes: m }), cue("tap"))} />
            ))}
          </View>
        </>
      ) : null}
      {step === 3 ? (
        <>
          <T role="title" header center>
            {w.start.title}
          </T>
          <T role="bodyLg" color="textMuted" center style={{ maxWidth: 340 }}>
            {w.start.body}
          </T>
        </>
      ) : null}
    </Flow>
  );
}

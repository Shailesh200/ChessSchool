import { copy } from "@chessschool/design";
import { router } from "expo-router";
import { useState } from "react";
import { Pressable, View } from "react-native";
import { CoachPicker } from "@/components/CoachPicker";
import { Cody } from "@/components/Lottie";
import { Button, Flow, IconButton, Steps, T } from "@/components/ui";
import { useApp } from "@/lib/state";
import { track as pulse } from "@/lib/analytics";

/** After the first lesson: coach, then the account offer (guests only). The language is chosen on the start screen. */
export default function Welcome() {
  const { state, setPrefs, setSeenWelcome, cue } = useApp();
  const [step, setStep] = useState(1);
  const w = copy.welcome.steps;
  const steps = state.account ? 2 : 3;

  const finish = (to: "/today" | "/signup", skipped = false) => {
    pulse(skipped ? "onboarding_skip" : "onboarding_step", { step, done: true, to: to.slice(1) });
    setSeenWelcome();
    if (to === "/today") cue("success");
    router.replace(to);
  };
  const next = () => {
    cue("tap");
    if (step + 1 >= steps) finish("/today");
    else (setStep(step + 1), pulse("onboarding_step", { step: step + 1 }));
  };

  return (
    <Flow
      top={
        <>
          {step > 1 ? <IconButton icon="back" label={copy.welcome.back} onPress={() => setStep(step - 1)} /> : <View style={{ width: 48 }} />}
          <Steps count={steps - 1} current={step - 1} label={copy.orientation.progress(step, steps - 1)} />
          <Pressable accessibilityRole="button" onPress={() => finish("/today", true)} hitSlop={10} style={{ minHeight: 48, justifyContent: "center", paddingHorizontal: 8 }}>
            <T role="label" color="brandText">
              {copy.welcome.skip}
            </T>
          </Pressable>
        </>
      }
      footer={
        step < 2 ? (
          <Button title={copy.welcome.next} onPress={next} />
        ) : (
          <>
            <Button title={w.start.account} icon="shield" onPress={() => finish("/signup")} />
            <Button title={w.start.guest} variant="ghost" onPress={() => finish("/today")} />
          </>
        )
      }
    >
      {step === 1 ? (
        <>
          <T role="title" header center>
            {w.coach.title}
          </T>
          <T role="body" color="textMuted" center>
            {w.coach.body}
          </T>
          <CoachPicker value={state.prefs.coach} onChange={(id) => (setPrefs({ coach: id }), cue("tap"))} />
        </>
      ) : null}
      {step === 2 ? (
        <>
          <Cody animation="celebrate" size={170} label={copy.a11y.mascot} />
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

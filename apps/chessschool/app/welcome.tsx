import { copy, LANG_NAMES, LANGS, language } from "@chessschool/design";
import { router } from "expo-router";
import { useState } from "react";
import { Pressable, View } from "react-native";
import { CoachPicker } from "@/components/CoachPicker";
import { Cody } from "@/components/Lottie";
import { Button, Choice, Flow, IconButton, Steps, T } from "@/components/ui";
import { useApp } from "@/lib/state";

/**
 * After the first lesson: language, coach, then the account offer (guests only).
 * Language is the first step because changing it remounts the screen at step 0.
 */
export default function Welcome() {
  const { state, setPrefs, setSeenWelcome, cue } = useApp();
  const [step, setStep] = useState(0);
  const w = copy.welcome.steps;
  const steps = state.account ? 2 : 3;

  const finish = (to: "/today" | "/signup") => {
    setSeenWelcome();
    if (to === "/today") cue("success");
    router.replace(to);
  };
  const next = () => {
    cue("tap");
    if (step + 1 >= steps) finish("/today");
    else setStep(step + 1);
  };

  return (
    <Flow
      top={
        <>
          {step > 0 ? <IconButton icon="back" label={copy.welcome.back} onPress={() => setStep(step - 1)} /> : <View style={{ width: 48 }} />}
          <Steps count={steps} current={step} label={copy.orientation.progress(step + 1, steps)} />
          <Pressable accessibilityRole="button" onPress={() => finish("/today")} hitSlop={10} style={{ minHeight: 48, justifyContent: "center", paddingHorizontal: 8 }}>
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
      {step === 0 ? (
        <>
          <Cody animation="wave" size={150} label={copy.a11y.mascot} />
          <T role="title" header center>
            {w.lang.title}
          </T>
          <T role="body" color="textMuted" center>
            {w.lang.body}
          </T>
          <View accessibilityRole="radiogroup" style={{ gap: 10, alignSelf: "stretch" }}>
            {LANGS.map((l) => (
              <Choice key={l} label={LANG_NAMES[l]} selected={language() === l} onPress={() => (setPrefs({ lang: l }), cue("tap"))} />
            ))}
          </View>
        </>
      ) : null}
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

import { copy, type AvatarId, type CodyAnimation, type DailyMinutes } from "@chessschool/design";
import { router } from "expo-router";
import { useState } from "react";
import { Pressable, View } from "react-native";
import { AvatarPicker } from "@/components/AvatarFace";
import { Cody } from "@/components/Lottie";
import { Button, Choice, Flow, IconButton, Steps, T } from "@/components/ui";
import { useApp } from "@/lib/state";
import { useTheme } from "@/lib/theme";

/** Keep Continue readable if the brand fill and its label colour are too close. */
function labelOn(bg: string, preferred: string): string {
  const lum = (hex: string) => {
    const h = hex.replace("#", "");
    if (h.length < 6) return 0;
    const chan = (i: number) => parseInt(h.slice(i, i + 2), 16) / 255;
    const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
    return 0.2126 * lin(chan(0)) + 0.7152 * lin(chan(2)) + 0.0722 * lin(chan(4));
  };
  if (!bg.startsWith("#") || !preferred.startsWith("#")) return preferred;
  const a = lum(bg);
  const b = lum(preferred);
  const ratio = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
  if (ratio >= 3) return preferred;
  return a > 0.55 ? "#1C1B2E" : "#FFFFFF";
}

const POSES: CodyAnimation[] = ["wave", "happy", "proud", "celebrate"];
const STEPS = 4;

export default function Welcome() {
  const { state, setProfile, setSeenWelcome, cue } = useApp();
  const { c } = useTheme();
  const [step, setStep] = useState(0);
  const w = copy.welcome.steps;
  const tints = [c.card, c.card, c.card];

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
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={copy.welcome.next}
            onPress={() => {
              cue("tap");
              setStep(step + 1);
            }}
            style={{ alignSelf: "stretch" }}
          >
            <View style={{ minHeight: 56, borderRadius: 999, backgroundColor: c.brand, alignItems: "center", justifyContent: "center", paddingHorizontal: 16 }}>
              <T role="label" center numberOfLines={1} style={{ color: labelOn(c.brand, c.onBrand), textAlign: "center", width: "100%" }}>
                {copy.welcome.next}
              </T>
            </View>
          </Pressable>
        ) : (
          <>
            <Button title={w.start.guest} onPress={() => finish("/today")} />
            <Button title={w.start.account} variant="ghost" onPress={() => finish("/login")} />
          </>
        )
      }
    >
      {step === 1 ? null : <Cody key={step} animation={POSES[step]} size={step === 0 ? 200 : 150} label={copy.a11y.mascot} />}
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
            {copy.you.avatar}
          </T>
          <T role="body" color="textMuted" center>
            {copy.you.avatarHint}
          </T>
          <AvatarPicker value={state.profile.avatar} onChange={(id: AvatarId) => (setProfile({ avatar: id }), cue("tap"))} />
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

import { useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { DEFAULT_COACH_CHARACTER } from "@/coachCharacters";
import { haptics } from "@/haptics";
import { settings } from "@/settings";
import { useAuth } from "@/auth";
import { setOrientationSeen } from "@/orientationSeen";
import { CoachRow } from "@/nov2/CoachRow";
import { KitButton } from "@/components/kit";
import { OptionList } from "@/nov2/OptionList";
import { StepDots } from "@/nov2/StepDots";
import { BOA_GOAL_OPTIONS, BOA_LEVEL_OPTIONS, mapBoaGoalToSettings } from "@/nov2/onboardingData";
import { premiumColors, premiumFont, premiumSpace, premiumType } from "@/nov2/premiumTokens";

/** Premium onboarding 02a→02b (coach step 02c skipped; Otto default). */
export default function BoaOnboardingScreen() {
  const router = useRouter();
  const { enterGuestBrowse, markOrientationDone } = useAuth();
  const [step, setStep] = useState(0);
  const [goal, setGoal] = useState(BOA_GOAL_OPTIONS[0]!.id);
  const [level, setLevel] = useState(BOA_LEVEL_OPTIONS[0]!.id);

  async function finishEntry() {
    settings.set("goal", mapBoaGoalToSettings(goal));
    settings.set("targetElo", Number(level) || 600);
    settings.set("coachCharacter", DEFAULT_COACH_CHARACTER);
    settings.set("coachPersonality", DEFAULT_COACH_CHARACTER);
    await setOrientationSeen();
    markOrientationDone();
    enterGuestBrowse();
    haptics.success();
    router.replace("/(tabs)/academy");
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <ScrollView contentContainerStyle={styles.wrap} keyboardShouldPersistTaps="handled">
        <StepDots step={step} total={4} />
        {step === 0 && (
          <>
            <CoachRow slug="otto" text="Hi, I'm Otto! What would you like from chess?" strong size={72} />
            <Text style={styles.h2}>What brings you here?</Text>
            <OptionList options={BOA_GOAL_OPTIONS} value={goal} onChange={setGoal} accessibilityLabel="Your goal" />
            <KitButton label="Continue" onPress={() => setStep(1)} />
          </>
        )}
        {step === 1 && (
          <>
            <CoachRow slug="otto" text="No wrong answer. I'll fit the lessons to you." strong size={72} />
            <Text style={styles.h2}>How much chess do you know?</Text>
            <OptionList options={BOA_LEVEL_OPTIONS} value={level} onChange={setLevel} accessibilityLabel="Your level" />
            <KitButton
              label="Test out instead"
              variant="ghost"
              onPress={() => router.push("/boa/test-out")}
              style={{ marginTop: premiumSpace[2] }}
            />
            <KitButton
              label="Continue"
              onPress={() => {
                void finishEntry();
              }}
            />
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: premiumColors.bg },
  wrap: { padding: premiumSpace[5], gap: premiumSpace[4], flexGrow: 1 },
  h2: {
    ...premiumType.h2,
    fontFamily: premiumFont.display,
    color: premiumColors.text,
    textAlign: "center",
  },
});

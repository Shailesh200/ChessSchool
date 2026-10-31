import { useMemo } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { CoachRow } from "@/nov2/CoachRow";
import { KitButton } from "@/components/kit";
import { OptionList, type OptionItem } from "@/nov2/OptionList";
import { premiumColors, premiumFont, premiumSpace, premiumType } from "@/nov2/premiumTokens";
import { coachCharacterOf, type CoachCharacterId } from "@/coachCharacters";

const COACH_OPTIONS: OptionItem[] = [
  { id: "anxious_nerd", title: "Otto", subtitle: "Careful nerd — default coach", icon: "cap" },
  { id: "genz", title: "Kira", subtitle: "Sporty Gen Z energy", icon: "sparkle" },
  { id: "sassy", title: "Skye", subtitle: "Playful and dramatic", icon: "star" },
  { id: "sarcastic", title: "Ash", subtitle: "Strict, no hints", icon: "target" },
  { id: "egoistic", title: "Rex", subtitle: "Proud grandmaster", icon: "trophy" },
];

/** Onboarding coach picker (02c) — kept for design parity; hidden in default flow. */
export function OnboardingCoachesStep({
  value,
  onChange,
}: {
  value: CoachCharacterId;
  onChange: (id: CoachCharacterId) => void;
}) {
  const selected = coachCharacterOf(value);
  const styles = useMemo(() => makeStyles(), []);

  return (
    <ScrollView contentContainerStyle={styles.wrap}>
      <CoachRow slug="otto" text="Pick the voice that feels right — you can change this anytime." strong />
      <Text style={styles.h2}>Choose your coach</Text>
      <OptionList
        options={COACH_OPTIONS}
        value={value}
        onChange={(id) => onChange(id as CoachCharacterId)}
        accessibilityLabel="Coach"
      />
      <Text style={styles.note}>Selected: {selected.name}</Text>
      <KitButton label="Continue" onPress={() => onChange(value)} />
    </ScrollView>
  );
}

function makeStyles() {
  return StyleSheet.create({
    wrap: { padding: premiumSpace[5], gap: premiumSpace[4] },
    h2: { ...premiumType.h2, fontFamily: premiumFont.display, color: premiumColors.text, textAlign: "center" },
    note: { ...premiumType.caption, fontFamily: premiumFont.ui, color: premiumColors.textMuted, textAlign: "center" },
  });
}

export function OnboardingCoachesPreviewLink({ onPress }: { onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button">
      <Text style={{ color: premiumColors.textLink, fontFamily: premiumFont.uiBold, textAlign: "center" }}>
        Preview coach picker (hidden step)
      </Text>
    </Pressable>
  );
}

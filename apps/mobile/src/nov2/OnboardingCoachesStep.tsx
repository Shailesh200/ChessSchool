import { useMemo } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { CoachRow } from "@/nov2/CoachRow";
import { KitButton, usePremiumKitTheme } from "@/components/kit";
import { OptionList, type OptionItem } from "@/nov2/OptionList";
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
  const kit = usePremiumKitTheme();
  const styles = useMemo(() => makeStyles(kit), [kit]);

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

function makeStyles(kit: ReturnType<typeof usePremiumKitTheme>) {
  const { colors, space, type, font } = kit;
  return StyleSheet.create({
    wrap: { padding: space["5"], gap: space["4"] },
    h2: {
      fontSize: type.h2.fontSize,
      lineHeight: type.h2.lineHeight,
      fontFamily: font.displayBold,
      color: colors.ink,
      textAlign: "center",
    },
    note: {
      fontSize: type.caption.fontSize,
      lineHeight: type.caption.lineHeight,
      fontFamily: font.uiMedium,
      color: colors.ink500,
      textAlign: "center",
    },
  });
}

export function OnboardingCoachesPreviewLink({ onPress }: { onPress: () => void }) {
  const kit = usePremiumKitTheme();
  return (
    <Pressable onPress={onPress}>
      <Text style={{ color: kit.colors.textLink, fontFamily: kit.font.uiBold, textAlign: "center" }}>
        Preview coach step (design)
      </Text>
    </Pressable>
  );
}

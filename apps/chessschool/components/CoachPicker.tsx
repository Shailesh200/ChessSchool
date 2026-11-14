import { COACHES, copy, type CoachId } from "@chessschool/design";
import { Pressable, View } from "react-native";
import { Icon } from "@/components/Icon";
import { Badge, T } from "@/components/ui";
import { playClip, useClips } from "@/lib/voice";
import { useTheme } from "@/lib/theme";

/** The four coaches as radio rows. Recorded coaches play a sample line when picked. */
export function CoachPicker({ value, onChange }: { value: CoachId | null; onChange: (id: CoachId) => void }) {
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={copy.coach.title} style={{ gap: 10, alignSelf: "stretch" }}>
      {COACHES.map((coach) => (
        <CoachRow key={coach.id} id={coach.id} name={coach.name} blurb={coach.blurb} selected={value === coach.id} onPick={() => onChange(coach.id)} />
      ))}
    </View>
  );
}

function CoachRow({ id, name, blurb, selected, onPick }: { id: CoachId; name: string; blurb: string; selected: boolean; onPick: () => void }) {
  const { c } = useTheme();
  // A line from the second lesson doubles as the sample.
  const clips = useClips(id, "board");
  const sample = clips ? Object.values(clips)[0] : undefined;
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={`${name}. ${blurb}`}
      onPress={() => {
        onPick();
        if (sample) playClip(sample);
      }}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        minHeight: 64,
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderRadius: 16,
        borderWidth: 2,
        borderColor: selected ? c.brand : c.line,
        backgroundColor: selected ? c.brandSoft : c.card,
        transform: [{ scale: pressed ? 0.98 : 1 }],
      })}
    >
      <View style={{ flex: 1, gap: 2 }}>
        <T role="label">{name}</T>
        <T role="small" color="textMuted">
          {blurb}
        </T>
      </View>
      {clips && !sample ? <Badge tone="neutral">{copy.coach.soon}</Badge> : <Icon name={selected ? "check" : "sound"} color={selected ? c.brandText : c.textMuted} />}
    </Pressable>
  );
}

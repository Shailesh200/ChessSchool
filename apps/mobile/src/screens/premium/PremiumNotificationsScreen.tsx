import { useMemo, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { AppShell } from "@/AppShell";
import { useSettings, settings } from "@/settings";
import { KitButton, KitCard, KitIcon, usePremiumKitTheme } from "@/components/kit";
import { PremiumScreenFrame } from "./PremiumScreenFrame";

const TIME_CHIPS = [
  { label: "7:30 AM", hour: 7, minute: 30 },
  { label: "12:00 PM", hour: 12, minute: 0 },
  { label: "6:00 PM", hour: 18, minute: 0 },
  { label: "8:30 PM", hour: 20, minute: 30 },
] as const;

const DAY_OPTIONS = [
  { id: "daily" as const, label: "Every day" },
  { id: "weekdays" as const, label: "Weekdays" },
  { id: "weekends" as const, label: "Weekends" },
];

export function PremiumNotificationsScreen() {
  const router = useRouter();
  const s = useSettings();
  const { colors, font, type, space, radius } = usePremiumKitTheme();
  const [hour, setHour] = useState(s.notificationHour);
  const [minute, setMinute] = useState(s.notificationMinute);

  const selectedChip = useMemo(() => TIME_CHIPS.find((t) => t.hour === hour && t.minute === minute)?.label, [hour, minute]);

  function save() {
    settings.set("notificationHour", hour);
    settings.set("notificationMinute", minute);
    settings.set("notificationsEnabled", true);
    router.replace("/notifications/saved");
  }

  return (
    <AppShell showBottomNav={false}>
      <PremiumScreenFrame testID="premium-notifications">
        <Pressable onPress={() => router.back()} style={{ flexDirection: "row", alignItems: "center", gap: space["1"], marginTop: space["2"] }}>
          <KitIcon name="chevronLeft" size={22} color={colors.ink} />
          <Text style={{ fontFamily: font.displaySemibold, fontSize: type.sm.fontSize, color: colors.ink }}>Back</Text>
        </Pressable>
        <Text style={{ fontFamily: font.displayBold, fontSize: type["2xl"].fontSize, color: colors.ink, marginTop: space["3"] }}>Stay on track</Text>
        <Text style={{ fontFamily: font.displayMedium, fontSize: type.sm.fontSize, color: colors.ink500, marginTop: space["2"] }}>
          Pick a gentle nudge to practice.
        </Text>

        <Text style={{ fontFamily: font.displayBold, fontSize: type.xs.fontSize, color: colors.ink500, marginTop: space["5"], marginBottom: space["2"] }}>TIME</Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space["2"] }}>
          {TIME_CHIPS.map((chip) => {
            const on = chip.hour === hour && chip.minute === minute;
            return (
              <Pressable key={chip.label} testID={`time-chip-${chip.label}`} onPress={() => { setHour(chip.hour); setMinute(chip.minute); }} style={{ paddingHorizontal: space["4"], paddingVertical: space["2"], borderRadius: radius.pill, borderWidth: 2, borderColor: on ? colors.brand : colors.hairline, backgroundColor: on ? colors.brand50 : colors.surfaceCard }}>
                <Text style={{ fontFamily: font.displayBold, fontSize: type.sm.fontSize, color: on ? colors.brand : colors.ink }}>{chip.label}</Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={{ fontFamily: font.displayBold, fontSize: type.xs.fontSize, color: colors.ink500, marginTop: space["5"], marginBottom: space["2"] }}>SCHEDULE</Text>
        <KitCard style={{ paddingVertical: 0 }}>
          {DAY_OPTIONS.map((opt, i) => {
            const on = s.schedule === opt.id;
            return (
              <View key={opt.id}>
                {i > 0 ? <View style={{ height: 1, backgroundColor: colors.hairline }} /> : null}
                <Pressable testID={`schedule-${opt.id}`} onPress={() => settings.set("schedule", opt.id)} style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: space["3"] }}>
                  <Text style={{ fontFamily: font.displaySemibold, fontSize: type.sm.fontSize, color: colors.ink }}>{opt.label}</Text>
                  {on ? <KitIcon name="check" size={18} color={colors.brand} /> : null}
                </Pressable>
              </View>
            );
          })}
        </KitCard>

        <View style={{ marginTop: space["6"], gap: space["3"] }}>
          <KitButton label="Save reminder" testID="notifications-save" onPress={save} />
          <KitButton label="Not now" variant="ghost" testID="notifications-not-now" onPress={() => { settings.set("notificationsEnabled", false); router.back(); }} />
        </View>
        {selectedChip ? <Text style={{ fontFamily: font.displayMedium, fontSize: type.xs.fontSize, color: colors.ink300, textAlign: "center", marginTop: space["2"] }}>Selected {selectedChip}</Text> : null}
      </PremiumScreenFrame>
    </AppShell>
  );
}

export function PremiumNotificationsSavedScreen() {
  const router = useRouter();
  const s = useSettings();
  const { colors, font, type, space } = usePremiumKitTheme();
  const time = formatTime(s.notificationHour, s.notificationMinute);

  return (
    <AppShell showBottomNav={false}>
      <PremiumScreenFrame testID="premium-notifications-saved">
        <View style={{ alignItems: "center", marginTop: space["10"], gap: space["4"] }}>
          <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: colors.brand50, alignItems: "center", justifyContent: "center" }}>
            <KitIcon name="check" size={36} color={colors.brand} />
          </View>
          <Text style={{ fontFamily: font.displayBold, fontSize: type["2xl"].fontSize, color: colors.ink, textAlign: "center" }}>Reminder saved</Text>
          <Text style={{ fontFamily: font.displayMedium, fontSize: type.base.fontSize, color: colors.ink500, textAlign: "center" }}>
            We will nudge you around {time} on your {scheduleLabel(s.schedule)} schedule.
          </Text>
          <KitButton label="Done" testID="notifications-done" onPress={() => router.replace("/(tabs)/profile")} />
        </View>
      </PremiumScreenFrame>
    </AppShell>
  );
}

function formatTime(h: number, m: number) {
  const hr = ((h % 24) + 24) % 24;
  const min = ((m % 60) + 60) % 60;
  const am = hr < 12;
  const h12 = hr % 12 || 12;
  return `${h12}:${min.toString().padStart(2, "0")} ${am ? "AM" : "PM"}`;
}

function scheduleLabel(id: string) {
  if (id === "weekdays") return "weekday";
  if (id === "weekends") return "weekend";
  return "daily";
}

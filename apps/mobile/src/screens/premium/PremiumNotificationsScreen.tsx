import { useMemo, useState } from "react";
import { Image, Pressable, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { AppShell } from "@/AppShell";
import { useSettings, settings } from "@/settings";
import { KitButton, usePremiumKitTheme } from "@/components/kit";
import { PremiumScreenFrame } from "./PremiumScreenFrame";
import {
  PremiumCoachBubble,
  PremiumNotifyPreview,
  PremiumTimeChip,
} from "./premiumDexParts";

const TIME_CHIPS = [
  { label: "8:00 AM", hour: 8, minute: 0 },
  { label: "12:30 PM", hour: 12, minute: 30 },
  { label: "7:30 PM", hour: 19, minute: 30 },
] as const;

const HOURS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const;
const MINUTES = [0, 15, 30, 45] as const;

export function PremiumNotificationsScreen() {
  const router = useRouter();
  const s = useSettings();
  const { colors, font, type, space, radius } = usePremiumKitTheme();
  const [hour24, setHour24] = useState(s.notificationHour);
  const [minute, setMinute] = useState(s.notificationMinute);

  const { hour12, ampm } = useMemo(() => to12(hour24), [hour24]);
  const timeLabel = useMemo(() => formatTime(hour24, minute), [hour24, minute]);

  function applyChip(h: number, m: number) {
    setHour24(h);
    setMinute(m);
  }

  function set12(h12: number, am: boolean) {
    let h = h12 % 12;
    if (am) {
      setHour24(h === 12 ? 0 : h);
    } else {
      setHour24(h === 12 ? 12 : h + 12);
    }
  }

  function save() {
    settings.set("notificationHour", hour24);
    settings.set("notificationMinute", minute);
    settings.set("notificationsEnabled", true);
    router.replace("/notifications/saved");
  }

  return (
    <AppShell showBottomNav={false}>
      <PremiumScreenFrame testID="premium-notifications" scroll>
        <View style={{ alignItems: "center", marginTop: space["2"] }}>
          <Image
            source={require("../../../assets/kit/logo/logo-h-light.png")}
            style={{ width: 200, height: 48, resizeMode: "contain" }}
            accessibilityLabel="ChessSchool"
          />
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: space["1"],
              marginTop: space["3"],
              backgroundColor: colors.brand50,
              paddingHorizontal: space["3"],
              paddingVertical: space["1"],
              borderRadius: radius.pill,
            }}
          >
            <Text style={{ fontFamily: font.uiBold, fontSize: type.caption.fontSize, color: colors.brand700 }}>First lesson done</Text>
          </View>
        </View>

        <PremiumCoachBubble message="Great first lesson! Want a small daily reminder to keep your streak going?" />

        <View
          style={{
            backgroundColor: colors.surfaceCard,
            borderRadius: radius.lg,
            padding: space["4"],
            borderWidth: 1,
            borderColor: colors.hairline,
            gap: space["3"],
          }}
        >
          <Text style={{ fontFamily: font.displayBold, fontSize: type.h3.fontSize, color: colors.ink }}>Remind me at</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space["2"] }}>
            {TIME_CHIPS.map((chip) => {
              const on = chip.hour === hour24 && chip.minute === minute;
              return (
                <PremiumTimeChip
                  key={chip.label}
                  label={chip.label}
                  selected={on}
                  testID={`time-chip-${chip.label}`}
                  onPress={() => applyChip(chip.hour, chip.minute)}
                />
              );
            })}
          </View>
          <View style={{ flexDirection: "row", gap: space["2"] }}>
            <TimeSelect label="Hour" value={String(hour12)} options={HOURS.map(String)} onChange={(v) => set12(Number(v), ampm === "AM")} />
            <TimeSelect
              label="Minute"
              value={minute.toString().padStart(2, "0")}
              options={MINUTES.map((m) => m.toString().padStart(2, "0"))}
              onChange={(v) => setMinute(Number(v))}
            />
            <TimeSelect label="AM or PM" value={ampm} options={["AM", "PM"]} onChange={(v) => set12(hour12, v === "AM")} />
          </View>
        </View>

        <PremiumNotifyPreview timeLabel={timeLabel} />

        <View style={{ marginTop: space["6"], gap: space["2"] }}>
          <KitButton label="Turn on reminders" variant="accent" testID="notifications-save" onPress={save} />
          <KitButton
            label="Not now"
            variant="ghost"
            testID="notifications-not-now"
            onPress={() => {
              settings.set("notificationsEnabled", false);
              router.back();
            }}
          />
          <Text style={{ fontFamily: font.uiMedium, fontSize: type.caption.fontSize, color: colors.ink500, textAlign: "center", marginTop: space["1"] }}>
            You can change this any time in Settings.
          </Text>
        </View>
      </PremiumScreenFrame>
    </AppShell>
  );
}

function TimeSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (v: string) => void;
}) {
  const { colors, font, type, space, radius } = usePremiumKitTheme();
  const idx = Math.max(0, options.indexOf(value));
  return (
    <View style={{ flex: 1, gap: space["1"] }}>
      <Text style={{ fontFamily: font.uiBold, fontSize: type.caption.fontSize, color: colors.ink500 }}>{label}</Text>
      <Pressable
        onPress={() => onChange(options[(idx + 1) % options.length]!)}
        style={{
          borderWidth: 1,
          borderColor: colors.hairline,
          borderRadius: radius.sm,
          paddingVertical: space["2"],
          paddingHorizontal: space["2"],
          backgroundColor: colors.surfaceCard,
        }}
      >
        <Text style={{ fontFamily: font.uiBold, fontSize: type.sm.fontSize, color: colors.ink, textAlign: "center" }}>{value}</Text>
      </Pressable>
    </View>
  );
}

export function PremiumNotificationsSavedScreen() {
  const router = useRouter();
  const s = useSettings();
  const { colors, font, type, space, radius } = usePremiumKitTheme();
  const time = formatTime(s.notificationHour, s.notificationMinute);

  return (
    <AppShell showBottomNav={false}>
      <PremiumScreenFrame testID="premium-notifications-saved">
        <View style={{ alignItems: "center", marginTop: space["6"], gap: space["4"] }}>
          <Image
            source={require("../../../assets/kit/accents/acc-celebrate.webp")}
            style={{ width: 160, height: 160, resizeMode: "contain" }}
            accessibilityLabel="Celebration"
          />
          <View
            style={{
              width: "100%",
              backgroundColor: colors.surfaceCard,
              borderRadius: radius.lg,
              padding: space["5"],
              borderWidth: 1,
              borderColor: colors.hairline,
              alignItems: "center",
              gap: space["3"],
            }}
          >
            <Text style={{ fontFamily: font.displayBold, fontSize: type.h2.fontSize, color: colors.ink, textAlign: "center" }}>
              Reminder set for {time}
            </Text>
            <Text style={{ fontFamily: font.uiMedium, fontSize: type.sm.fontSize, color: colors.ink500, textAlign: "center" }}>
              I'll send one small nudge a day. You can change or turn it off in Settings.
            </Text>
            <KitButton label="Back to Learn" testID="notifications-done" onPress={() => router.replace("/(tabs)/academy")} />
          </View>
        </View>
      </PremiumScreenFrame>
    </AppShell>
  );
}

function to12(h24: number) {
  const hr = ((h24 % 24) + 24) % 24;
  const am = hr < 12;
  const hour12 = hr % 12 || 12;
  return { hour12, ampm: am ? "AM" : "PM" } as const;
}

function formatTime(h: number, m: number) {
  const { hour12, ampm } = to12(h);
  const min = ((m % 60) + 60) % 60;
  return `${hour12}:${min.toString().padStart(2, "0")} ${ampm}`;
}

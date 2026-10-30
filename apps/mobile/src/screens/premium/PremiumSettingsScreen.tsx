import { useEffect, useMemo } from "react";
import { Linking, Pressable, Text, View } from "react-native";
import Constants from "expo-constants";
import { useRouter } from "expo-router";
import { useAuth } from "@/auth";
import { PRIVACY_URL } from "@/constants";
import { useSettings, settings } from "@/settings";
import { AppShell } from "@/AppShell";
import { stopCoachSpeech } from "@/coachSpeech";
import { KitButton, KitCoachAvatar, KitIcon, usePremiumKitTheme } from "@/components/kit";
import { COACH_CHARACTER_LIST, type CoachCharacterId } from "@/coachCharacters";
import { PremiumScreenFrame } from "./PremiumScreenFrame";
import {
  PremiumGroupLabel,
  PremiumNavRow,
  PremiumPageHead,
  PremiumSegment,
  PremiumToggleRow,
} from "./premiumDexParts";

function formatNotifyTime(h: number, m: number) {
  const hr = ((h % 24) + 24) % 24;
  const min = ((m % 60) + 60) % 60;
  const am = hr < 12;
  const h12 = hr % 12 || 12;
  return `${h12}:${min.toString().padStart(2, "0")} ${am ? "AM" : "PM"}`;
}

export function PremiumSettingsScreen() {
  const router = useRouter();
  const { guest, exitGuest, user } = useAuth();
  const s = useSettings();
  const { colors, font, type, space, radius } = usePremiumKitTheme();
  const coach = COACH_CHARACTER_LIST.find((c) => c.id === s.coachCharacter) ?? COACH_CHARACTER_LIST[0];

  useEffect(() => () => stopCoachSpeech(), []);

  const textScalePct = useMemo(() => {
    const pct = Math.round(s.textScale * 100);
    if (pct <= 100) return "100";
    if (pct <= 125) return "125";
    if (pct <= 150) return "150";
    return "200";
  }, [s.textScale]);

  return (
    <AppShell showBottomNav={false}>
      <PremiumScreenFrame testID="premium-settings">
        <PremiumPageHead title="Settings" onBack={() => { stopCoachSpeech(); router.back(); }} backLabel="Profile" />

        <PremiumGroupLabel>Coach</PremiumGroupLabel>
        <View
          style={{
            backgroundColor: colors.surfaceCard,
            borderRadius: radius.lg,
            padding: space["4"],
            borderWidth: 1,
            borderColor: colors.hairline,
            gap: space["4"],
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: space["3"] }}>
            <KitCoachAvatar character={coach.id} size={48} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: font.uiBold, fontSize: type.sm.fontSize, color: colors.ink }}>{coach.name}</Text>
              <Text style={{ fontFamily: font.uiMedium, fontSize: type.caption.fontSize, color: colors.ink500 }}>Your coach</Text>
            </View>
          </View>
          <View style={{ gap: space["2"] }}>
            <Text style={{ fontFamily: font.uiBold, fontSize: type.sm.fontSize, color: colors.ink }}>Coach voice</Text>
            <Text style={{ fontFamily: font.uiMedium, fontSize: type.caption.fontSize, color: colors.ink500 }}>
              {coach.name} can read tips out loud.
            </Text>
            <PremiumSegment
              testPrefix="coach-voice"
              options={[
                { id: "on", label: "On" },
                { id: "off", label: "Off" },
                { id: "cap", label: "Captions only" },
              ]}
              value={!s.coachSpeech ? "off" : s.coachVoice === "captions-only" ? "cap" : "on"}
              onChange={(id) => {
                if (id === "off") settings.set("coachSpeech", false);
                else {
                  settings.set("coachSpeech", true);
                  if (id === "cap") settings.set("coachVoice", "captions-only");
                  else settings.set("coachVoice", "auto");
                }
              }}
            />
          </View>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space["2"] }}>
            {COACH_CHARACTER_LIST.map((c) => {
              const on = s.coachCharacter === c.id;
              return (
                <Pressable
                  key={c.id}
                  onPress={() => settings.set("coachCharacter", c.id as CoachCharacterId)}
                  style={{
                    width: "47%",
                    flexGrow: 1,
                    flexDirection: "row",
                    alignItems: "center",
                    gap: space["2"],
                    padding: space["2"],
                    borderRadius: radius.md,
                    borderWidth: 2,
                    borderColor: on ? colors.brand : colors.hairline,
                    backgroundColor: on ? colors.brand50 : colors.surfaceCard,
                  }}
                >
                  <KitCoachAvatar character={c.id} size={36} />
                  <Text style={{ fontFamily: font.uiBold, fontSize: type.caption.fontSize, color: on ? colors.brand : colors.ink }} numberOfLines={1}>
                    {c.name}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <PremiumGroupLabel>Reminders</PremiumGroupLabel>
        <View
          style={{
            backgroundColor: colors.surfaceCard,
            borderRadius: radius.lg,
            borderWidth: 1,
            borderColor: colors.hairline,
            paddingHorizontal: space["4"],
          }}
        >
          <PremiumToggleRow
            label="Daily reminder"
            hint="A small nudge to practise"
            value={s.notificationsEnabled}
            onValueChange={(v) => settings.set("notificationsEnabled", v)}
            testID="settings-notifications-toggle"
          />
          <View style={{ height: 1, backgroundColor: colors.hairline }} />
          <Pressable onPress={() => router.push("/notifications")} style={{ paddingVertical: space["3"] }}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <View>
                <Text style={{ fontFamily: font.uiBold, fontSize: type.sm.fontSize, color: colors.ink }}>Reminder time</Text>
                <Text style={{ fontFamily: font.uiMedium, fontSize: type.caption.fontSize, color: colors.ink500, marginTop: 2 }}>
                  {formatNotifyTime(s.notificationHour, s.notificationMinute)}
                </Text>
              </View>
              <KitIcon name="chevronRight" size={18} color={colors.ink300} />
            </View>
          </Pressable>
        </View>

        <PremiumGroupLabel>Display</PremiumGroupLabel>
        <View
          style={{
            backgroundColor: colors.surfaceCard,
            borderRadius: radius.lg,
            borderWidth: 1,
            borderColor: colors.hairline,
            padding: space["4"],
            gap: space["4"],
          }}
        >
          <View style={{ gap: space["2"] }}>
            <Text style={{ fontFamily: font.uiBold, fontSize: type.sm.fontSize, color: colors.ink }}>Text size</Text>
            <PremiumSegment
              testPrefix="text-scale"
              options={[
                { id: "100", label: "100%" },
                { id: "125", label: "125%" },
                { id: "150", label: "150%" },
                { id: "200", label: "200%" },
              ]}
              value={textScalePct}
              onChange={(id) => settings.set("textScale", Number(id) / 100)}
            />
          </View>
          <PremiumToggleRow
            label="Reduce motion"
            hint="Calmer animations"
            value={s.reducedMotion}
            onValueChange={(v) => settings.set("reducedMotion", v)}
          />
          <PremiumNavRow icon="palette" title="Board & app themes" subtitle="Includes Midnight dark" onPress={() => router.push("/themes")} />
        </View>

        <PremiumGroupLabel>App</PremiumGroupLabel>
        <View style={{ gap: space["2"] }}>
          <PremiumToggleRow
            label="Premium illustrated UI"
            hint="Dex kit chrome (default)"
            value={s.uiKit !== "classic"}
            onValueChange={(v) => settings.set("uiKit", v ? "premium" : "classic")}
          />
          <PremiumToggleRow label="Sound effects" hint="Moves and wins" value={s.sound} onValueChange={(v) => settings.set("sound", v)} />
        </View>

        {guest ? (
          <KitButton label="Log in or enroll" size="sm" block={false} style={{ marginTop: space["5"] }} onPress={() => { exitGuest(); router.push("/login"); }} />
        ) : (
          <>
            {user?.email ? (
              <Text style={{ fontFamily: font.uiMedium, fontSize: type.sm.fontSize, color: colors.ink500, marginTop: space["5"] }}>
                Signed in as {user.email}
              </Text>
            ) : null}
            <Pressable onPress={() => void Linking.openURL(PRIVACY_URL)} style={{ marginTop: space["3"] }}>
              <Text style={{ fontFamily: font.uiBold, fontSize: type.sm.fontSize, color: colors.textLink }}>Privacy policy</Text>
            </Pressable>
          </>
        )}

        <Text style={{ fontFamily: font.uiMedium, fontSize: type.caption.fontSize, color: colors.ink300, textAlign: "center", marginTop: space["6"] }}>
          ChessSchool v{Constants.expoConfig?.version ?? "0.2.0"}
        </Text>
      </PremiumScreenFrame>
    </AppShell>
  );
}

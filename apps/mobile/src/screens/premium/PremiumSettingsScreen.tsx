import { useEffect, useMemo, type ReactNode } from "react";
import { Linking, Pressable, Switch, Text, View } from "react-native";
import Constants from "expo-constants";
import { useRouter } from "expo-router";
import { useAuth } from "@/auth";
import { PRIVACY_URL } from "@/constants";
import { useSettings, settings } from "@/settings";
import { AppShell } from "@/AppShell";
import { Slider } from "@/Slider";
import { stopCoachSpeech } from "@/coachSpeech";
import { KitButton, KitCard, KitCoachAvatar, KitIcon, usePremiumKitTheme } from "@/components/kit";
import { COACH_CHARACTER_LIST, type CoachCharacterId } from "@/coachCharacters";
import { PremiumScreenFrame } from "./PremiumScreenFrame";

export function PremiumSettingsScreen() {
  const router = useRouter();
  const { guest, exitGuest } = useAuth();
  const s = useSettings();
  const { colors, font, type, space } = usePremiumKitTheme();
  const track = useMemo(() => ({ true: colors.brand, false: colors.surfaceSunken }), [colors]);

  useEffect(() => () => stopCoachSpeech(), []);

  const section = {
    fontFamily: font.displayBold,
    fontSize: type.xs.fontSize,
    color: colors.ink500,
    textTransform: "uppercase" as const,
    marginTop: space["5"],
    marginBottom: space["2"],
  };

  return (
    <AppShell showBottomNav={false}>
      <PremiumScreenFrame testID="premium-settings">
        <Pressable onPress={() => { stopCoachSpeech(); router.back(); }} style={{ flexDirection: "row", alignItems: "center", gap: space["1"], marginTop: space["2"] }}>
          <KitIcon name="chevronLeft" size={22} color={colors.ink} />
          <Text style={{ fontFamily: font.displaySemibold, fontSize: type.sm.fontSize, color: colors.ink }}>Back</Text>
        </Pressable>
        <Text style={{ fontFamily: font.displayBold, fontSize: type["2xl"].fontSize, color: colors.ink, marginTop: space["3"] }}>Settings</Text>

        <Text style={section}>Appearance</Text>
        <KitCard style={{ paddingVertical: 0 }}>
          <KitRow label="Premium illustrated UI" hint="Dex kit chrome (default)">
            <Switch value={s.uiKit !== "classic"} onValueChange={(v) => settings.set("uiKit", v ? "premium" : "classic")} trackColor={track} />
          </KitRow>
          <Divider />
          <Pressable onPress={() => router.push("/themes")}>
            <KitRow label="Board & app themes" hint="Includes Midnight dark">
              <KitIcon name="chevronRight" size={18} color={colors.ink300} />
            </KitRow>
          </Pressable>
        </KitCard>

        <Text style={section}>Reminders</Text>
        <Pressable onPress={() => router.push("/notifications")}>
          <KitCard style={{ flexDirection: "row", alignItems: "center", gap: space["3"] }}>
            <KitIcon name="bell" size={22} color={colors.brand} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: font.displayBold, fontSize: type.sm.fontSize, color: colors.ink }}>Practice notifications</Text>
              <Text style={{ fontFamily: font.displayMedium, fontSize: type.xs.fontSize, color: colors.ink500 }}>
                {s.notificationsEnabled ? "On" : "Off"}
              </Text>
            </View>
            <KitIcon name="chevronRight" size={18} color={colors.ink300} />
          </KitCard>
        </Pressable>

        <Text style={section}>Sound & accessibility</Text>
        <KitCard style={{ paddingVertical: 0, gap: 0 }}>
          <KitRow label="Sound effects" hint="Moves and wins">
            <Switch value={s.sound} onValueChange={(v) => settings.set("sound", v)} trackColor={track} />
          </KitRow>
          <Divider />
          <KitRow label="Reduce motion" hint="Static coach stills">
            <Switch value={s.reducedMotion} onValueChange={(v) => settings.set("reducedMotion", v)} trackColor={track} />
          </KitRow>
          <Divider />
          <View style={{ paddingVertical: space["3"] }}>
            <Text style={{ fontFamily: font.displayBold, fontSize: type.sm.fontSize, color: colors.ink }}>Text size</Text>
            <Slider value={s.textScale} min={0.85} max={1.25} step={0.05} onChange={(v) => settings.set("textScale", v)} />
          </View>
        </KitCard>

        <Text style={section}>Coach</Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space["2"] }}>
          {COACH_CHARACTER_LIST.map((c) => {
            const on = s.coachCharacter === c.id;
            return (
              <Pressable key={c.id} onPress={() => settings.set("coachCharacter", c.id as CoachCharacterId)} style={{ width: "47%", flexGrow: 1, flexDirection: "row", alignItems: "center", gap: space["2"], padding: space["3"], borderRadius: 14, borderWidth: 2, borderColor: on ? colors.brand : colors.hairline, backgroundColor: colors.surfaceCard }}>
                <KitCoachAvatar character={c.id} size={40} />
                <Text style={{ fontFamily: font.displayBold, fontSize: type.sm.fontSize, color: on ? colors.brand : colors.ink }} numberOfLines={1}>{c.name}</Text>
              </Pressable>
            );
          })}
        </View>

        {guest ? (
          <KitButton label="Log in or enroll" size="sm" block={false} style={{ marginTop: space["5"] }} onPress={() => { exitGuest(); router.push("/login"); }} />
        ) : (
          <Pressable onPress={() => void Linking.openURL(PRIVACY_URL)} style={{ marginTop: space["5"] }}>
            <Text style={{ fontFamily: font.displayBold, fontSize: type.sm.fontSize, color: colors.brand }}>Privacy policy</Text>
          </Pressable>
        )}

        <Text style={{ fontFamily: font.displayMedium, fontSize: type.xs.fontSize, color: colors.ink300, textAlign: "center", marginTop: space["6"] }}>
          ChessSchool v{Constants.expoConfig?.version ?? "0.2.0"}
        </Text>
      </PremiumScreenFrame>
    </AppShell>
  );
}

function KitRow({ label, hint, children }: { label: string; hint: string; children: ReactNode }) {
  const { space, font, type, colors } = usePremiumKitTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", paddingVertical: space["3"] }}>
      <View style={{ flex: 1, paddingRight: space["3"] }}>
        <Text style={{ fontFamily: font.displayBold, fontSize: type.sm.fontSize, color: colors.ink }}>{label}</Text>
        <Text style={{ fontFamily: font.displayMedium, fontSize: type.xs.fontSize, color: colors.ink500, marginTop: 2 }}>{hint}</Text>
      </View>
      {children}
    </View>
  );
}

function Divider() {
  const { colors } = usePremiumKitTheme();
  return <View style={{ height: 1, backgroundColor: colors.hairline }} />;
}

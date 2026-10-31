import { Pressable, ScrollView, Text, useColorScheme, View } from "react-native";
import { KitButton, KitCard, KitIcon, usePremiumKitTheme } from "@/components/kit";
import { TopBar } from "@/TopBar";
import { useSettings } from "@/settings";
import { resolvePremiumColorMode } from "@/themeMode";
import { classDetailCaption, classRowChrome, type ClassRowTone } from "./premiumModel";

export type ClassLessonRow = {
  id: string;
  title: string;
  mastery: number;
  tone: ClassRowTone;
  minutes?: number;
};

export function PremiumClassDetail({
  title,
  blurb,
  rows,
  activeIndex,
  examTitle,
  onBack,
  onOpen,
  onStart,
}: {
  title: string;
  blurb: string;
  rows: ClassLessonRow[];
  activeIndex: number;
  examTitle: string | null;
  onBack: () => void;
  onOpen: (id: string, tone: ClassRowTone) => void;
  onStart: () => void;
}) {
  const { colors, font, type, space, radius } = usePremiumKitTheme();
  const mode = resolvePremiumColorMode(useSettings().themeMode, useColorScheme());
  const lessonRows = rows.filter((row) => row.tone !== "exam");
  const current = lessonRows.find((row) => row.tone === "current") ?? lessonRows[0];
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }} testID="class-detail">
      <TopBar />
      <ScrollView contentContainerStyle={{ padding: space["4"], paddingBottom: space["12"], gap: space["3"] }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: space["2"] }}>
          <Pressable accessibilityLabel="Back to course map" onPress={onBack} style={{ width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: colors.surfaceCard }}>
            <KitIcon name="chevronLeft" size={22} color={colors.ink} />
          </Pressable>
          <Text style={{ fontFamily: font.uiBold, color: colors.ink500, letterSpacing: 1, textTransform: "uppercase" }}>
            {lessonRows.length} lessons
          </Text>
        </View>
        <Text testID="class-title" style={{ fontFamily: font.displayBold, color: colors.ink, fontSize: type.h1.fontSize, lineHeight: type.h1.lineHeight }}>{title}</Text>
        <Text style={{ fontFamily: font.uiMedium, color: colors.ink500, fontSize: type.body.fontSize }}>{blurb}</Text>
        {rows.map((row, index) => {
          const caption = row.tone === "exam" ? (examTitle ?? classDetailCaption({ tone: "exam", index, mastery: row.mastery, activeIndex })) : classDetailCaption({ tone: row.tone, index, mastery: row.mastery, activeIndex, minutes: row.minutes });
          const chrome = classRowChrome(row.tone, mode);
          return (
            <Pressable key={row.id} testID={`class-row-${row.id}`} onPress={() => onOpen(row.id, row.tone)} style={{ flexDirection: "row", gap: space["3"], alignItems: "center", minHeight: 56, paddingVertical: 12, paddingHorizontal: 14, borderRadius: radius.lg, backgroundColor: colors.surfaceCard, borderWidth: 1.5, borderColor: chrome.border, borderBottomWidth: chrome.edge ? 4.5 : 1.5, borderBottomColor: chrome.edge ?? chrome.border }}>
              <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: chrome.tile, alignItems: "center", justifyContent: "center" }}>
                <KitIcon name={chrome.glyph} size={24} color={chrome.icon} filled={chrome.filled} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: font.displayBold, color: colors.ink }}>{row.tone === "exam" ? "Class exam" : `${index + 1} · ${row.title}`}</Text>
                <Text style={{ color: colors.ink500, fontFamily: font.uiMedium }}>{caption}</Text>
              </View>
            </Pressable>
          );
        })}
        <KitCard>
          <Text style={{ fontFamily: font.uiBold, color: colors.ink500, letterSpacing: 1, textTransform: "uppercase" }}>Skills in this class</Text>
          {lessonRows.slice(0, 4).map((row) => {
            const pct = Math.round(row.mastery * 100);
            const low = row.mastery < 0.6;
            return (
              <View key={row.id} style={{ marginTop: 10 }}>
                <Text style={{ fontFamily: font.displayBold, color: colors.ink }}>{row.title}</Text>
                <View style={{ height: 6, borderRadius: 99, backgroundColor: colors.surfaceSunken, marginTop: 4 }}>
                  <View style={{ width: `${pct}%`, height: 6, backgroundColor: low ? colors.accent : colors.brand }} />
                </View>
              </View>
            );
          })}
        </KitCard>
        {current ? <KitButton label={current.tone === "current" ? `Start ${current.title}` : "Review class"} variant="accent" icon="play" onPress={onStart} /> : null}
      </ScrollView>
    </View>
  );
}

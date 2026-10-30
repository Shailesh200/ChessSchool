import { useEffect } from "react";
import { View } from "react-native";
import { Redirect, useLocalSearchParams } from "expo-router";
import { KitBottomNav } from "@/components/kit";
import { PremiumLearnScreen } from "@/screens/premium/PremiumLearnScreen";
import { PremiumReviewScreen } from "@/screens/premium/PremiumReviewScreen";
import type { ReviewSkill } from "@/screens/premium/premiumModel";
import { settings } from "@/settings";
import { premiumPreviewDecision } from "@/screens/premium/premiumModel";
import type { MapStage } from "@/screens/premium/premiumModel";

const TACTICS: MapStage[] = [
  {
    id: "tactics",
    name: "Tactics",
    locked: false,
    cleared: false,
    doneClasses: 1,
    totalClasses: 4,
    semesters: [
      {
        id: "forks",
        title: "Forks, pins & skewers",
        classes: [
          { id: "pins", title: "Pins", graduated: true, unlocked: true },
          { id: "forks", title: "Knight forks", graduated: false, unlocked: true },
          { id: "skewers", title: "Skewers", graduated: false, unlocked: false },
        ],
      },
    ],
  },
];

/** Design comparison route. Open only when EXPO_PUBLIC_PREMIUM_PREVIEW=1 and APP_VARIANT is not production. */
export default function PremiumPreviewScreen() {
  const params = useLocalSearchParams<{ id?: string; theme?: string }>();
  const id = params.id ?? "03-map";
  const dark = params.theme === "dark" || id.endsWith("-dark");

  const previewDenied =
    premiumPreviewDecision({
      APP_VARIANT: process.env.APP_VARIANT,
      EXPO_PUBLIC_PREMIUM_PREVIEW: process.env.EXPO_PUBLIC_PREMIUM_PREVIEW,
    }) === "deny";

  useEffect(() => {
    if (previewDenied) return;
    const prevMode = settings.get().themeMode;
    const prevKit = settings.get().uiKit;
    settings.set("uiKit", "premium");
    settings.set("themeMode", dark ? "dark" : "light");
    return () => {
      settings.set("themeMode", prevMode);
      settings.set("uiKit", prevKit);
    };
  }, [dark, previewDenied]);

  if (previewDenied) return <Redirect href="/" />;

  const reviewSkills: ReviewSkill[] = [
    { id: "fork", title: "Fork the king and queen", mastery: 0.48, needsPractice: true },
    { id: "pin", title: "Pins to the king", mastery: 0.55, needsPractice: true },
    { id: "knight", title: "Knight moves", mastery: 0.9, needsPractice: false },
    { id: "mate", title: "Back-rank mate", mastery: 0.72, needsPractice: false },
    { id: "protect", title: "Protect your pieces", mastery: 0.81, needsPractice: false },
    { id: "castle", title: "Castling", mastery: 0.64, needsPractice: false },
  ];
  if (id === "20-review-tab" || id === "10a-review-queue") {
    return (
      <View style={{ flex: 1 }}>
        <PremiumReviewScreen mode={id === "10a-review-queue" ? "queue" : "tab"} fixture={{ skills: reviewSkills, mistakeCount: 3 }} />
        <KitBottomNav />
      </View>
    );
  }

  let body = <PremiumLearnScreen fixture={{ phase: "ready", stages: TACTICS, dueCount: 6, chromeOnly: true }} />;
  if (id === "03-map-loading") body = <PremiumLearnScreen fixture={{ phase: "loading", chromeOnly: true }} />;
  else if (id === "03-map-empty") body = <PremiumLearnScreen fixture={{ phase: "empty", chromeOnly: true }} />;
  else if (id === "03-map-error") body = <PremiumLearnScreen fixture={{ phase: "error", chromeOnly: true }} />;
  else if (id === "03-map-offline") {
    body = (
      <PremiumLearnScreen
        fixture={{
          phase: "offline",
          chromeOnly: true,
          stages: TACTICS,
          dueCount: 6,
          resumeTitle: "Fork the king and queen",
          resumeLessonId: "fork-kq",
        }}
      />
    );
  }
  return (
    <View style={{ flex: 1 }}>
      {body}
      <KitBottomNav />
    </View>
  );
}

export type CoachSlug = "otto" | "kira" | "skye" | "ash" | "rex";
export type CoachMood = "neutral" | "happy" | "thinking" | "encouraging" | "celebrating" | "sad";

const still: Record<CoachSlug, Partial<Record<CoachMood, number>>> = {
  otto: {
    neutral: require("../../assets/premium/coaches/still/otto-neutral.webp"),
    happy: require("../../assets/premium/coaches/still/otto-happy.webp"),
    thinking: require("../../assets/premium/coaches/still/otto-thinking.webp"),
    encouraging: require("../../assets/premium/coaches/still/otto-encouraging.webp"),
    celebrating: require("../../assets/premium/coaches/still/otto-celebrating.webp"),
    sad: require("../../assets/premium/coaches/still/otto-sad.webp"),
  },
  kira: {
    neutral: require("../../assets/premium/dex/head-kira-neutral.webp"),
    happy: require("../../assets/premium/dex/head-kira-happy.webp"),
    thinking: require("../../assets/premium/dex/head-kira-thinking.webp"),
  },
  skye: {
    neutral: require("../../assets/premium/dex/head-skye-neutral.webp"),
    happy: require("../../assets/premium/dex/head-skye-happy.webp"),
    thinking: require("../../assets/premium/dex/head-skye-thinking.webp"),
  },
  ash: {
    neutral: require("../../assets/premium/dex/head-ash-neutral.webp"),
    happy: require("../../assets/premium/dex/head-ash-happy.webp"),
    thinking: require("../../assets/premium/dex/head-ash-thinking.webp"),
  },
  rex: {
    neutral: require("../../assets/premium/dex/head-rex-neutral.webp"),
    happy: require("../../assets/premium/dex/head-rex-happy.webp"),
    thinking: require("../../assets/premium/dex/head-rex-thinking.webp"),
  },
};

const bust: Partial<Record<CoachSlug, number>> = {
  kira: require("../../assets/premium/dex/bust-kira-neutral.webp"),
  skye: require("../../assets/premium/dex/bust-skye-neutral.webp"),
  ash: require("../../assets/premium/dex/bust-ash-neutral.webp"),
  rex: require("../../assets/premium/dex/bust-rex-neutral.webp"),
  otto: require("../../assets/premium/dex/bust-otto-happy.webp"),
};

export function coachStill(slug: CoachSlug, mood: CoachMood = "neutral"): number {
  return still[slug][mood] ?? still[slug].neutral ?? still.otto.neutral!;
}

export function coachBust(slug: CoachSlug): number {
  return bust[slug] ?? bust.kira!;
}

export const COACH_MATCH_PILL: Record<CoachSlug, string> = {
  otto: "Coach",
  kira: "Medium",
  skye: "Easy",
  rex: "Hard",
  ash: "Strict",
};

export function coachDisplayName(slug: CoachSlug): string {
  const names: Record<CoachSlug, string> = {
    otto: "Otto",
    kira: "Kira",
    skye: "Skye",
    ash: "Ash",
    rex: "Rex",
  };
  return names[slug];
}

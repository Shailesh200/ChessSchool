import type { CoachVoiceId } from "@/core/store/settings.store";

export type VoiceHairStyle =
  | "wavy"
  | "bob"
  | "curly"
  | "bun"
  | "straight"
  | "short"
  | "spiky"
  | "side"
  | "crop"
  | "messy";

export type VoicePortraitSpec = {
  tone: { from: string; to: string; ring: string };
  skin: string;
  hair: string;
  shirt: string;
  hairStyle: VoiceHairStyle;
  eye: "round" | "soft" | "focused";
  mouth: "smile" | "grin" | "neutral" | "firm";
  glasses?: boolean;
  beard?: "none" | "stubble" | "goatee" | "full";
  detail?: "bindi" | "freckles" | "earring" | "sparkle";
};

export const VOICE_PORTRAITS: Record<CoachVoiceId, VoicePortraitSpec> = {
  auto: {
    tone: { from: "#E0E7FF", to: "#C4B5FD", ring: "#7C3AED" },
    skin: "#FFEDD5",
    hair: "#6366F1",
    shirt: "#8B5CF6",
    hairStyle: "wavy",
    eye: "soft",
    mouth: "smile",
    detail: "sparkle",
  },
  jenny: {
    tone: { from: "#FFEDD5", to: "#FDBA74", ring: "#EA580C" },
    skin: "#FED7AA",
    hair: "#C2410C",
    shirt: "#FB923C",
    hairStyle: "wavy",
    eye: "round",
    mouth: "smile",
  },
  emma: {
    tone: { from: "#FEF9C3", to: "#FDE68A", ring: "#CA8A04" },
    skin: "#FFE4C7",
    hair: "#D97706",
    shirt: "#FBBF24",
    hairStyle: "bob",
    eye: "soft",
    mouth: "smile",
  },
  aria: {
    tone: { from: "#FCE7F3", to: "#F9A8D4", ring: "#DB2777" },
    skin: "#FECACA",
    hair: "#1F2937",
    shirt: "#F472B6",
    hairStyle: "curly",
    eye: "round",
    mouth: "grin",
  },
  michelle: {
    tone: { from: "#E0F2FE", to: "#7DD3FC", ring: "#0284C7" },
    skin: "#D4A574",
    hair: "#171717",
    shirt: "#0EA5E9",
    hairStyle: "bun",
    eye: "focused",
    mouth: "firm",
    detail: "earring",
  },
  jane: {
    tone: { from: "#D1FAE5", to: "#6EE7B7", ring: "#059669" },
    skin: "#FFEDD5",
    hair: "#78350F",
    shirt: "#10B981",
    hairStyle: "short",
    eye: "focused",
    mouth: "neutral",
    glasses: true,
  },
  sara: {
    tone: { from: "#EDE9FE", to: "#A78BFA", ring: "#6D28D9" },
    skin: "#E7C8A8",
    hair: "#57534E",
    shirt: "#7C3AED",
    hairStyle: "straight",
    eye: "soft",
    mouth: "neutral",
  },
  sonia: {
    tone: { from: "#FEE2E2", to: "#FCA5A5", ring: "#DC2626" },
    skin: "#FECACA",
    hair: "#7F1D1D",
    shirt: "#1E3A8A",
    hairStyle: "bob",
    eye: "focused",
    mouth: "firm",
    detail: "earring",
  },
  natasha: {
    tone: { from: "#FEF3C7", to: "#FCD34D", ring: "#D97706" },
    skin: "#FDBA74",
    hair: "#CA8A04",
    shirt: "#38BDF8",
    hairStyle: "wavy",
    eye: "round",
    mouth: "grin",
    detail: "freckles",
  },
  neerja: {
    tone: { from: "#FFEDD5", to: "#FDBA74", ring: "#C2410C" },
    skin: "#C68642",
    hair: "#1C1917",
    shirt: "#F97316",
    hairStyle: "straight",
    eye: "soft",
    mouth: "smile",
    detail: "bindi",
  },
  guy: {
    tone: { from: "#E2E8F0", to: "#94A3B8", ring: "#334155" },
    skin: "#FFEDD5",
    hair: "#292524",
    shirt: "#475569",
    hairStyle: "short",
    eye: "focused",
    mouth: "firm",
    beard: "stubble",
  },
  roger: {
    tone: { from: "#D6D3D1", to: "#78716C", ring: "#292524" },
    skin: "#E7C8A8",
    hair: "#44403C",
    shirt: "#1C1917",
    hairStyle: "side",
    eye: "focused",
    mouth: "neutral",
    beard: "full",
  },
  brian: {
    tone: { from: "#DBEAFE", to: "#93C5FD", ring: "#2563EB" },
    skin: "#F5D0C5",
    hair: "#57534E",
    shirt: "#3B82F6",
    hairStyle: "short",
    eye: "soft",
    mouth: "smile",
    glasses: true,
    beard: "goatee",
  },
  davis: {
    tone: { from: "#F3F4F6", to: "#D1D5DB", ring: "#4B5563" },
    skin: "#D4A574",
    hair: "#9CA3AF",
    shirt: "#6B7280",
    hairStyle: "crop",
    eye: "soft",
    mouth: "neutral",
  },
  steffan: {
    tone: { from: "#1E293B", to: "#475569", ring: "#0F172A" },
    skin: "#8D5524",
    hair: "#171717",
    shirt: "#334155",
    hairStyle: "crop",
    eye: "focused",
    mouth: "firm",
    beard: "stubble",
  },
  ryan: {
    tone: { from: "#DBEAFE", to: "#60A5FA", ring: "#1D4ED8" },
    skin: "#FECACA",
    hair: "#78350F",
    shirt: "#1E40AF",
    hairStyle: "side",
    eye: "focused",
    mouth: "neutral",
    beard: "stubble",
  },
  william: {
    tone: { from: "#CCFBF1", to: "#5EEAD4", ring: "#0F766E" },
    skin: "#FDBA74",
    hair: "#92400E",
    shirt: "#14B8A6",
    hairStyle: "messy",
    eye: "round",
    mouth: "smile",
    detail: "freckles",
  },
  tony: {
    tone: { from: "#FEE2E2", to: "#F87171", ring: "#B91C1C" },
    skin: "#FFEDD5",
    hair: "#1C1917",
    shirt: "#EF4444",
    hairStyle: "spiky",
    eye: "round",
    mouth: "grin",
  },
  jason: {
    tone: { from: "#E0E7FF", to: "#A5B4FC", ring: "#4338CA" },
    skin: "#F5D0C5",
    hair: "#44403C",
    shirt: "#6366F1",
    hairStyle: "short",
    eye: "soft",
    mouth: "neutral",
  },
  andrew: {
    tone: { from: "#D9F99D", to: "#A3E635", ring: "#65A30D" },
    skin: "#FFEDD5",
    hair: "#713F12",
    shirt: "#84CC16",
    hairStyle: "messy",
    eye: "soft",
    mouth: "smile",
  },
};

/** Flat illustrated avatar ids — stored in profile.avatarUrl and bot profiles. */
export type FlatAvatarId =
  | "bot-pip"
  | "bot-cody"
  | "bot-remi"
  | "bot-sasha"
  | "bot-vera"
  | "bot-magnus"
  | "bot-titan"
  | "coach-friendly"
  | "coach-strict"
  | "coach-mentor"
  | "coach-tactical"
  | "ava-bunny"
  | "ava-fox"
  | "ava-owl"
  | "ava-bear"
  | "ava-sunflower"
  | "ava-rose"
  | "ava-oak"
  | "ava-knight"
  | "ava-queen"
  | "ava-rook"
  | "ava-bishop"
  | "ava-rocket"
  | "ava-gem"
  | "ava-trophy"
  | "ava-star";

export type FlatAvatarTone = {
  /** Tile background gradient stops */
  from: string;
  to: string;
  ring: string;
};

export const FLAT_AVATAR_TONES: Record<FlatAvatarId, FlatAvatarTone> = {
  "bot-pip": { from: "#FEF08A", to: "#FACC15", ring: "#CA8A04" },
  "bot-cody": { from: "#BAE6FD", to: "#38BDF8", ring: "#0284C7" },
  "bot-remi": { from: "#BBF7D0", to: "#4ADE80", ring: "#16A34A" },
  "bot-sasha": { from: "#FECACA", to: "#F87171", ring: "#DC2626" },
  "bot-vera": { from: "#DDD6FE", to: "#A78BFA", ring: "#7C3AED" },
  "bot-magnus": { from: "#FDE68A", to: "#F59E0B", ring: "#B45309" },
  "bot-titan": { from: "#E2E8F0", to: "#94A3B8", ring: "#475569" },
  "coach-friendly": { from: "#FED7AA", to: "#FB923C", ring: "#EA580C" },
  "coach-strict": { from: "#E5E7EB", to: "#9CA3AF", ring: "#374151" },
  "coach-mentor": { from: "#BFDBFE", to: "#60A5FA", ring: "#2563EB" },
  "coach-tactical": { from: "#FECDD3", to: "#FB7185", ring: "#E11D48" },
  "ava-bunny": { from: "#FCE7F3", to: "#F9A8D4", ring: "#DB2777" },
  "ava-fox": { from: "#FFEDD5", to: "#FB923C", ring: "#C2410C" },
  "ava-owl": { from: "#E0E7FF", to: "#818CF8", ring: "#4338CA" },
  "ava-bear": { from: "#D6D3D1", to: "#A8A29E", ring: "#57534E" },
  "ava-sunflower": { from: "#FEF9C3", to: "#FDE047", ring: "#CA8A04" },
  "ava-rose": { from: "#FFE4E6", to: "#FB7185", ring: "#E11D48" },
  "ava-oak": { from: "#DCFCE7", to: "#86EFAC", ring: "#15803D" },
  "ava-knight": { from: "#CFFAFE", to: "#22D3EE", ring: "#0891B2" },
  "ava-queen": { from: "#F3E8FF", to: "#C084FC", ring: "#9333EA" },
  "ava-rook": { from: "#E7E5E4", to: "#78716C", ring: "#44403C" },
  "ava-bishop": { from: "#EDE9FE", to: "#A78BFA", ring: "#6D28D9" },
  "ava-rocket": { from: "#DBEAFE", to: "#3B82F6", ring: "#1D4ED8" },
  "ava-gem": { from: "#CCFBF1", to: "#2DD4BF", ring: "#0F766E" },
  "ava-trophy": { from: "#FEF3C7", to: "#FBBF24", ring: "#B45309" },
  "ava-star": { from: "#E0F2FE", to: "#38BDF8", ring: "#0369A1" },
};

/** Pickable Student ID avatars. */
export const USER_AVATAR_OPTIONS: FlatAvatarId[] = [
  "ava-bunny",
  "ava-fox",
  "ava-owl",
  "ava-bear",
  "ava-sunflower",
  "ava-rose",
  "ava-oak",
  "ava-knight",
  "ava-queen",
  "ava-rook",
  "ava-bishop",
  "ava-rocket",
  "ava-gem",
  "ava-trophy",
  "ava-star",
];

export const COACH_AVATAR: Record<string, FlatAvatarId> = {
  friendly: "coach-friendly",
  strict: "coach-strict",
  mentor: "coach-mentor",
  tactical: "coach-tactical",
};

const LEGACY_ICON_TO_FLAT: Record<string, FlatAvatarId> = {
  pawn: "ava-knight",
  knight: "ava-knight",
  bishop: "ava-bishop",
  rook: "ava-rook",
  queen: "ava-queen",
  crown: "ava-queen",
  cap: "coach-mentor",
  robot: "bot-cody",
  trophy: "ava-trophy",
  star: "ava-star",
  brain: "ava-owl",
  sword: "coach-tactical",
  target: "ava-star",
  medal: "ava-trophy",
  gem: "ava-gem",
  flame: "ava-rose",
  seedling: "ava-oak",
};

export function resolveFlatAvatar(value: string | null | undefined): FlatAvatarId {
  if (!value) return "ava-knight";
  if (value in FLAT_AVATAR_TONES) return value as FlatAvatarId;
  return LEGACY_ICON_TO_FLAT[value] ?? "ava-knight";
}

export function botAvatarId(name: string): FlatAvatarId {
  const key = name.toLowerCase();
  if (key === "pip") return "bot-pip";
  if (key === "cody") return "bot-cody";
  if (key === "remi") return "bot-remi";
  if (key === "sasha") return "bot-sasha";
  if (key === "vera") return "bot-vera";
  if (key.includes("magnus")) return "bot-magnus";
  if (key === "titan") return "bot-titan";
  return "bot-cody";
}

export function botAvatarIdForElo(elo: number): FlatAvatarId {
  if (elo <= 500) return "bot-pip";
  if (elo <= 800) return "bot-cody";
  if (elo <= 1100) return "bot-remi";
  if (elo <= 1500) return "bot-sasha";
  if (elo <= 1900) return "bot-vera";
  if (elo <= 2300) return "bot-magnus";
  return "bot-titan";
}

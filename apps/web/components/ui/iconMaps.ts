import type { IconName } from "./Icon";
import {
  USER_AVATAR_OPTIONS,
  COACH_AVATAR,
  resolveFlatAvatar,
  type FlatAvatarId,
} from "./flatAvatars/catalog";

export type IconTone = "brand" | "gold" | "accent" | "success" | "violet" | "neutral";

export {
  USER_AVATAR_OPTIONS as AVATAR_OPTIONS,
  resolveFlatAvatar as resolveAvatar,
  COACH_AVATAR,
  type FlatAvatarId,
};

const strip = (s: string) => s.replace(/\uFE0F/g, "").trim();

/** Map curriculum / UI emoji strings to premium line icons. */
const EMOJI_TO_ICON: Record<string, IconName> = {
  "♟": "pawn",
  "📝": "journal",
  "🎯": "target",
  "🏆": "trophy",
  "🤖": "robot",
  "👥": "users",
  "💬": "message",
  "🐣": "seedling",
  "🙂": "wave",
  "⚔": "sword",
  "🧠": "brain",
  "👑": "crown",
  "🤝": "handshake",
  "📖": "book",
  "🔍": "search",
  "💡": "bulb",
  "🔊": "volume",
  "🔇": "volumeOff",
  "📡": "wifi",
  "💾": "save",
  "⚠": "warning",
  "🌱": "seedling",
  "✨": "sparkle",
  "🍴": "fork",
  "📚": "book",
  "🎖": "medal",
  "🎓": "cap",
  "🔥": "flame",
  "📅": "calendar",
  "💎": "gem",
  "🥇": "medal",
  "⭐": "star",
  "🌟": "star",
  "💯": "target",
  "🎒": "backpack",
  "📐": "compass",
  "🏛": "building",
  "💙": "heart",
  "🌲": "tree",
  "🤍": "heart",
  "🌙": "moon",
  "⚙": "gear",
  "🤸": "celebrate",
  "🧩": "puzzle",
  "📌": "pin",
  "💰": "gem",
  "♔": "crown",
  "📈": "chart",
  "🎩": "cap",
  "😊": "wave",
  "🧑‍🏫": "cap",
  "🔗": "link",
  "⏱": "calendar",
  "🚀": "rocket",
  "🧸": "seedling",
  "📘": "book",
  "🗺": "map",
  "📜": "scroll",
  "🤴": "crown",
  "📔": "journal",
  "🔐": "lock",
  "🔌": "plug",
  "🔁": "review",
  "📋": "journal",
  "👋": "wave",
  "🎉": "celebrate",
  "✅": "check",
  "♚": "crown",
  "♛": "queen",
  "♜": "rook",
  "♞": "knight",
  "♝": "bishop",
};

const EMOJI_TO_TONE: Record<string, IconTone> = {
  "🏆": "gold",
  "🥇": "gold",
  "🎖": "gold",
  "⭐": "gold",
  "🌟": "gold",
  "🔥": "accent",
  "💎": "violet",
  "🌙": "violet",
  "💙": "brand",
  "🌲": "success",
  "🌱": "success",
  "🐣": "success",
  "🎯": "accent",
  "🚀": "accent",
  "🤸": "accent",
  "👑": "gold",
  "♔": "gold",
  "♚": "gold",
  "♛": "gold",
  "🤴": "gold",
  "🎓": "brand",
  "🎒": "brand",
  "📐": "brand",
  "🏛": "violet",
  "🧸": "accent",
  "🎉": "gold",
  "✅": "success",
  "⚠": "accent",
};

const ACHIEVEMENT_ICONS: Record<string, IconName> = {
  "first-step": "seedling",
  perfect: "sparkle",
  tactician: "fork",
  checkmaster: "crown",
  scholar: "book",
  "scholar-25": "medal",
  "scholar-100": "cap",
  graduate: "cap",
  "streak-3": "flame",
  "streak-7": "calendar",
  "streak-30": "gem",
  "first-win": "trophy",
  "winner-10": "medal",
  "giant-slayer": "sword",
  "rated-1000": "star",
  "rated-1500": "star",
  centurion: "target",
};

const COACH_TONE_ICONS: Record<string, IconName> = {
  friendly: "wave",
  strict: "cap",
  mentor: "learn",
  tactical: "sword",
  minimal: "volumeOff",
};

const BOT_TIER_ICONS: Record<string, IconName> = {
  pip: "seedling",
  cody: "pawn",
  remi: "knight",
  sasha: "sword",
  vera: "queen",
  "magnus jr.": "crown",
  titan: "trophy",
};

export function emojiToIcon(emoji: string): IconName {
  if (!emoji) return "star";
  const bare = strip(emoji);
  return EMOJI_TO_ICON[emoji] ?? EMOJI_TO_ICON[bare] ?? "star";
}

export function emojiToTone(emoji: string): IconTone | undefined {
  if (!emoji) return undefined;
  const bare = strip(emoji);
  return EMOJI_TO_TONE[emoji] ?? EMOJI_TO_TONE[bare];
}

export function achievementIcon(id: string): IconName {
  return ACHIEVEMENT_ICONS[id] ?? "trophy";
}

export function coachToneIcon(id: string): IconName {
  return COACH_TONE_ICONS[id] ?? "message";
}

export function botTierIcon(name: string): IconName {
  return BOT_TIER_ICONS[name.toLowerCase()] ?? "robot";
}

const JOURNAL_KIND_ICONS: Record<string, IconName> = {
  lesson: "book",
  match: "pawn",
  review: "search",
  exam: "journal",
  reflection: "brain",
};

export function journalKindIcon(kind: string): IconName {
  return JOURNAL_KIND_ICONS[kind] ?? "journal";
}

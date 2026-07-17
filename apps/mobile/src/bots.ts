import type { BotProfile } from "@chess-school/core";
import { botProfile, botLabel, botAvatarIdForElo, BOT_ELO_PRESETS, BOT_ELO_CEILINGS } from "@chess-school/core";
export { botProfile, botLabel, botAvatarIdForElo, BOT_ELO_PRESETS, BOT_ELO_CEILINGS };

const BOT_VISUALS: Record<string, { emoji: string; tone: { from: string; to: string; ring: string } }> = {
  "bot-pip": { emoji: "🐣", tone: { from: "#FEF08A", to: "#FACC15", ring: "#CA8A04" } },
  "bot-cody": { emoji: "🙂", tone: { from: "#BAE6FD", to: "#38BDF8", ring: "#0284C7" } },
  "bot-remi": { emoji: "🎯", tone: { from: "#BBF7D0", to: "#4ADE80", ring: "#16A34A" } },
  "bot-sasha": { emoji: "⚔️", tone: { from: "#FECACA", to: "#F87171", ring: "#DC2626" } },
  "bot-vera": { emoji: "🧠", tone: { from: "#DDD6FE", to: "#A78BFA", ring: "#7C3AED" } },
  "bot-magnus": { emoji: "👑", tone: { from: "#FDE68A", to: "#F59E0B", ring: "#B45309" } },
  "bot-titan": { emoji: "🏆", tone: { from: "#E2E8F0", to: "#94A3B8", ring: "#475569" } },
};

export type MobileBotProfile = BotProfile & {
  emoji: string;
  tone: { from: string; to: string; ring: string };
};

export function mobileBotProfile(elo: number): MobileBotProfile {
  const base = botProfile(elo);
  const visual = BOT_VISUALS[base.avatarId] ?? BOT_VISUALS["bot-cody"]!;
  return { ...base, ...visual };
}

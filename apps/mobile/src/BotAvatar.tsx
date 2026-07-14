import { botAvatarIdForElo } from "@chess-school/core";
import { FlatAvatar } from "./flatAvatars/FlatAvatar";
import { botAvatarIdForElo as flatBotForElo } from "./flatAvatars/catalog";

/** Gradient tile + flat portrait for bot opponents. */
export function BotAvatar({ elo, size = 44 }: { elo: number; size?: number }) {
  return <FlatAvatar id={flatBotForElo(elo)} size={size} />;
}

/** Portrait by avatar id (for settings / future use). */
export function BotAvatarById({ avatarId, size = 44 }: { avatarId: string; size?: number }) {
  return <FlatAvatar id={avatarId} size={size} />;
}

export function botAvatarId(elo: number): string {
  return botAvatarIdForElo(elo);
}

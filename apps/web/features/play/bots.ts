import type { FlatAvatarId } from "@/components/ui/flatAvatars/catalog";
import { botAvatarId, botAvatarIdForElo } from "@/components/ui/flatAvatars/catalog";
import { botProfile as coreBotProfile, botLabel as coreBotLabel } from "@chess-school/core";

/** Named opponents per ELO band — tier logic in @chess-school/core. */
export interface BotProfile {
  name: string;
  avatarId: FlatAvatarId;
  blurb: string;
}

export function botProfile(elo: number): BotProfile {
  const b = coreBotProfile(elo);
  return { name: b.name, avatarId: b.avatarId as FlatAvatarId, blurb: b.blurb };
}

export function botAvatarForElo(elo: number): FlatAvatarId {
  return botAvatarIdForElo(elo);
}

export function botAvatarForName(name: string): FlatAvatarId {
  return botAvatarId(name);
}

export function botLabel(elo: number): string {
  return coreBotLabel(elo);
}

export { botAvatarId, botAvatarIdForElo };

import {
  botAvatarId,
  botAvatarIdForElo,
  type FlatAvatarId,
} from "@/components/ui/flatAvatars/catalog";

/** Named opponents per ELO band — gives the vs-Bot mode personality. */
export interface BotProfile {
  name: string;
  avatarId: FlatAvatarId;
  blurb: string;
}

const BOTS: (BotProfile & { max: number })[] = [
  { max: 500, name: "Pip", avatarId: "bot-pip", blurb: "Just learning the moves" },
  { max: 800, name: "Cody", avatarId: "bot-cody", blurb: "Casual beginner" },
  { max: 1100, name: "Remi", avatarId: "bot-remi", blurb: "Knows the basics" },
  { max: 1500, name: "Sasha", avatarId: "bot-sasha", blurb: "Sharp club player" },
  { max: 1900, name: "Vera", avatarId: "bot-vera", blurb: "Strong expert" },
  { max: 2300, name: "Magnus Jr.", avatarId: "bot-magnus", blurb: "Master strength" },
  { max: 9999, name: "Titan", avatarId: "bot-titan", blurb: "Grandmaster engine" },
];

export function botProfile(elo: number): BotProfile {
  const b = BOTS.find((x) => elo <= x.max) ?? BOTS[BOTS.length - 1]!;
  return { name: b.name, avatarId: b.avatarId, blurb: b.blurb };
}

export function botAvatarForElo(elo: number): FlatAvatarId {
  return botAvatarIdForElo(elo);
}

export function botAvatarForName(name: string): FlatAvatarId {
  return botAvatarId(name);
}

/** "Cody · 600" — name + ELO for player bars / titles. */
export function botLabel(elo: number): string {
  const b = botProfile(elo);
  return `${b.name} · ${elo}`;
}

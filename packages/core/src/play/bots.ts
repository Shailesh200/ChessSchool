/** Named opponents per ELO band — shared by web + mobile. */
export interface BotProfile {
  name: string;
  avatarId: string;
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

/** Tier ceilings — keep in sync with flat avatar mapping on web. */
export const BOT_ELO_CEILINGS = [500, 800, 1100, 1500, 1900, 2300] as const;

export function botAvatarIdForElo(elo: number): string {
  if (elo <= 500) return "bot-pip";
  if (elo <= 800) return "bot-cody";
  if (elo <= 1100) return "bot-remi";
  if (elo <= 1500) return "bot-sasha";
  if (elo <= 1900) return "bot-vera";
  if (elo <= 2300) return "bot-magnus";
  return "bot-titan";
}

export function botProfile(elo: number): BotProfile {
  const b = BOTS.find((x) => elo <= x.max) ?? BOTS[BOTS.length - 1]!;
  return { name: b.name, avatarId: b.avatarId, blurb: b.blurb };
}

export function botLabel(elo: number): string {
  const b = botProfile(elo);
  return `${b.name} · ${elo}`;
}

/** Play-tab ELO presets — each maps to a named bot tier on web. */
export const BOT_ELO_PRESETS = [300, 600, 900, 1200, 1600, 2000] as const;

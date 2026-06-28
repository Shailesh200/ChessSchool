/** Named opponents per ELO band — gives the vs-Bot mode personality. */
export interface BotProfile {
  name: string;
  emoji: string;
  blurb: string;
}

const BOTS: (BotProfile & { max: number })[] = [
  { max: 500, name: "Pip", emoji: "🐣", blurb: "Just learning the moves" },
  { max: 800, name: "Cody", emoji: "🙂", blurb: "Casual beginner" },
  { max: 1100, name: "Remi", emoji: "🎯", blurb: "Knows the basics" },
  { max: 1500, name: "Sasha", emoji: "⚔️", blurb: "Sharp club player" },
  { max: 1900, name: "Vera", emoji: "🧠", blurb: "Strong expert" },
  { max: 2300, name: "Magnus Jr.", emoji: "👑", blurb: "Master strength" },
  { max: 9999, name: "Titan", emoji: "🏆", blurb: "Grandmaster engine" },
];

export function botProfile(elo: number): BotProfile {
  const b = BOTS.find((x) => elo <= x.max) ?? BOTS[BOTS.length - 1]!;
  return { name: b.name, emoji: b.emoji, blurb: b.blurb };
}

/** "🙂 Cody · 600" — name + ELO for player bars / titles. */
export function botLabel(elo: number): string {
  const b = botProfile(elo);
  return `${b.emoji} ${b.name} · ${elo}`;
}

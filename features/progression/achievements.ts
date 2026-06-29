export interface Achievement {
  id: string;
  title: string;
  description: string;
  emoji: string;
}

export const ACHIEVEMENTS: Achievement[] = [
  { id: "first-step", title: "First Step", description: "Complete your first lesson", emoji: "🌱" },
  { id: "perfect", title: "Flawless", description: "Finish a lesson with no mistakes", emoji: "✨" },
  { id: "tactician", title: "Tactician", description: "Learn the fork", emoji: "🍴" },
  { id: "checkmaster", title: "Checkmaster", description: "Deliver your first checkmate", emoji: "👑" },
  { id: "scholar", title: "Scholar", description: "Master 5 lessons", emoji: "📚" },
  { id: "scholar-25", title: "Honor Roll", description: "Master 25 lessons", emoji: "🎖️" },
  { id: "scholar-100", title: "Professor", description: "Master 100 lessons", emoji: "🧑‍🏫" },
  { id: "graduate", title: "Graduate", description: "Graduate your first class", emoji: "🎓" },
  { id: "streak-3", title: "On Fire", description: "Reach a 3-day streak", emoji: "🔥" },
  { id: "streak-7", title: "Week Warrior", description: "Reach a 7-day streak", emoji: "📅" },
  { id: "streak-30", title: "Unstoppable", description: "Reach a 30-day streak", emoji: "💎" },
  { id: "first-win", title: "Victorious", description: "Beat a bot for the first time", emoji: "🏆" },
  { id: "winner-10", title: "Champion", description: "Beat the bot 10 times", emoji: "🥇" },
  { id: "giant-slayer", title: "Giant Slayer", description: "Beat a 1600+ bot", emoji: "⚔️" },
  { id: "rated-1000", title: "Rising Star", description: "Reach a 1000 rating", emoji: "⭐" },
  { id: "rated-1500", title: "Class Act", description: "Reach a 1500 rating", emoji: "🌟" },
  { id: "centurion", title: "Centurion", description: "Earn 1000 XP", emoji: "💯" },
];

export function getAchievement(id: string): Achievement | undefined {
  return ACHIEVEMENTS.find((a) => a.id === id);
}

/** Returns achievement ids potentially earned by completing a lesson. */
export function checkLessonAchievements(
  lessonId: string,
  ctx: { mastered: number; perfect?: boolean; xp?: number; streak?: number; graduated?: boolean },
): string[] {
  const earned: string[] = ["first-step"];
  if (lessonId === "fork-master") earned.push("tactician");
  if (lessonId === "mate-in-one") earned.push("checkmaster");
  if (ctx.perfect) earned.push("perfect");
  if (ctx.mastered >= 5) earned.push("scholar");
  if (ctx.mastered >= 25) earned.push("scholar-25");
  if (ctx.mastered >= 100) earned.push("scholar-100");
  if (ctx.graduated) earned.push("graduate");
  if ((ctx.streak ?? 0) >= 3) earned.push("streak-3");
  if ((ctx.streak ?? 0) >= 7) earned.push("streak-7");
  if ((ctx.streak ?? 0) >= 30) earned.push("streak-30");
  if ((ctx.xp ?? 0) >= 1000) earned.push("centurion");
  return earned;
}

/** Achievement ids potentially earned by finishing a bot match. */
export function checkMatchAchievements(ctx: {
  won: boolean;
  wins: number;
  botElo: number;
  rating: number;
}): string[] {
  const earned: string[] = [];
  if (ctx.won) {
    earned.push("first-win");
    if (ctx.wins >= 10) earned.push("winner-10");
    if (ctx.botElo >= 1600) earned.push("giant-slayer");
  }
  if (ctx.rating >= 1000) earned.push("rated-1000");
  if (ctx.rating >= 1500) earned.push("rated-1500");
  return earned;
}

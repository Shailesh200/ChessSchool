export interface Achievement {
  id: string;
  title: string;
  description: string;
  emoji: string;
}

export const ACHIEVEMENTS: Achievement[] = [
  { id: "first-step", title: "First Step", description: "Complete your first lesson", emoji: "🌱" },
  { id: "tactician", title: "Tactician", description: "Learn the fork", emoji: "🍴" },
  { id: "checkmaster", title: "Checkmaster", description: "Deliver your first checkmate", emoji: "👑" },
  { id: "scholar", title: "Scholar", description: "Master 5 lessons", emoji: "📚" },
  { id: "streak-3", title: "On Fire", description: "Reach a 3-day streak", emoji: "🔥" },
  { id: "first-win", title: "Victorious", description: "Beat a bot for the first time", emoji: "🏆" },
];

export function getAchievement(id: string): Achievement | undefined {
  return ACHIEVEMENTS.find((a) => a.id === id);
}

/** Returns achievement ids potentially earned by completing a lesson. */
export function checkLessonAchievements(
  lessonId: string,
  ctx: { mastered: number },
): string[] {
  const earned: string[] = ["first-step"];
  if (lessonId === "fork-master") earned.push("tactician");
  if (lessonId === "mate-in-one") earned.push("checkmaster");
  if (ctx.mastered >= 5) earned.push("scholar");
  return earned;
}

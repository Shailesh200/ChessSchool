/** House assignment from onboarding goal — shared by server actions and REST API. */
export const HOUSE_BY_GOAL: Record<string, string> = {
  "beat-friends": "Knights",
  "reach-1000": "Pawns",
  "reach-1500": "Rooks",
  openings: "Bishops",
  tournament: "Queens",
  "learn-scratch": "Pawns",
  "get-tactics": "Bishops",
  "play-fun": "Knights",
};

export function houseForGoal(goal: string): string {
  return HOUSE_BY_GOAL[goal] ?? "Pawns";
}

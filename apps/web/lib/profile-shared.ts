/** House assignment from onboarding goal — shared by server actions and REST API. */
export const HOUSE_BY_GOAL: Record<string, string> = {
  "beat-friends": "Knights",
  "reach-1000": "Pawns",
  "reach-1500": "Rooks",
  openings: "Bishops",
  tournament: "Queens",
};

export function houseForGoal(goal: string): string {
  return HOUSE_BY_GOAL[goal] ?? "Pawns";
}

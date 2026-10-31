import type { OptionItem } from "./OptionList";

export const BOA_GOAL_OPTIONS: OptionItem[] = [
  {
    id: "learn-scratch",
    title: "Learn from scratch",
    subtitle: "Start with the board and the pieces",
    icon: "learn",
  },
  {
    id: "tactics",
    title: "Get better at tactics",
    subtitle: "Forks, pins and winning material",
    icon: "target",
  },
  {
    id: "fun",
    title: "Play for fun",
    subtitle: "Friendly games with a coach",
    icon: "play",
  },
];

export const BOA_LEVEL_OPTIONS: OptionItem[] = [
  {
    id: "600",
    title: "I know nothing",
    subtitle: "Perfect. We start at square one",
    icon: "sparkle",
  },
  {
    id: "900",
    title: "I know how the pieces move",
    subtitle: "Skip the basics",
    icon: "cap",
  },
  {
    id: "1400",
    title: "I already play",
    subtitle: "Start with tactics",
    icon: "trophy",
  },
];

export function mapBoaGoalToSettings(goalId: string): string {
  if (goalId === "tactics") return "openings";
  if (goalId === "fun") return "beat-friends";
  return "reach-1000";
}

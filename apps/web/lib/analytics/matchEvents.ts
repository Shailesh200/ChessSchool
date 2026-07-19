import { trackEvent } from "@/core/analytics/track";

/** How the match was played (product channel). */
export type MatchChannel =
  | "bot"
  | "pass"
  | "online"
  | "shadow"
  | "arena"
  | "assisted"
  | "think";

export type MatchOpponent = "bot" | "human";

/** Human sub-mode when opponent is human. */
export type HumanKind = "same_device" | "share_link";

/** Player-centric result when a side is identifiable; pass uses side_result. */
export type MatchOutcome = "win" | "loss" | "draw" | "white_win" | "black_win";

export type MatchStartProps = {
  channel: MatchChannel;
  opponent: MatchOpponent;
  humanKind?: HumanKind;
  targetElo?: number | null;
  timeMin?: number;
  fromHomework?: boolean;
  variant?: string;
  color?: "w" | "b";
};

export type MatchEndProps = MatchStartProps & {
  outcome: MatchOutcome;
  result: "1-0" | "0-1" | "1/2-1/2";
  reason: string;
  moveCount: number;
  durationMs?: number;
};

export function trackMatchStart(props: MatchStartProps): void {
  trackEvent("match_start", { ...props });
}

export function trackMatchEnd(props: MatchEndProps): void {
  trackEvent("match_end", { ...props });
}

export function outcomeFromWinner(
  winner: "w" | "b" | null,
  playerColor: "w" | "b",
): MatchOutcome {
  if (winner == null) return "draw";
  return winner === playerColor ? "win" : "loss";
}

export function passOutcome(winner: "w" | "b" | null): MatchOutcome {
  if (winner == null) return "draw";
  return winner === "w" ? "white_win" : "black_win";
}

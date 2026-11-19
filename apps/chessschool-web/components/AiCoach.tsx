"use client";

import { copy } from "@chessschool/design";
import { Icon } from "./Icon";
import { Cody } from "./Lottie";

/** The small "AI" pill on a bot's avatar or name. */
export function AiBadge({ className = "" }: { className?: string }) {
  return (
    <span className={`ai-badge ${className}`} aria-hidden>
      {copy.ai.badge}
    </span>
  );
}

/** A line from the AI coach in a game (hint reason or mistake comment), framed in the AI's violet. */
export function AiCoachCard({ kind, text }: { kind: "hint" | "comment"; text: string }) {
  return (
    <div className="ai-coach" role="status" aria-live="polite">
      <Cody size={44} />
      <div>
        <span className="ai-coach-label">
          <Icon name="sparkles" size={14} />
          {kind === "hint" ? copy.ai.hint : copy.ai.coach}
        </span>
        <p>{text}</p>
      </div>
    </div>
  );
}

"use client";

import { copy } from "@chessschool/design";
import { useEffect, useState } from "react";
import { Icon } from "./Icon";
import { Cody } from "./Lottie";

/**
 * The AI coach in a game as a corner widget: a Cody button that asks for help, and a note that floats
 * over the game below it. It is absolutely placed, so it never moves or resizes the board.
 */
export function AiCoachButton({ text, asking, onAsk }: { text: string | null; asking: boolean; onAsk: () => void }) {
  const [open, setOpen] = useState(false);
  // A new note pops open by itself; the learner can fold it back into the button.
  useEffect(() => setOpen(Boolean(text)), [text]);
  return (
    <span className="ai-fab">
      <button type="button" className="icon-btn ai-fab-btn" aria-label={copy.ai.ask} aria-expanded={open} aria-busy={asking} onClick={() => (text ? setOpen((o) => !o) : onAsk())}>
        <Cody size={36} />
        {text && !open ? <i className="ai-fab-dot" aria-hidden /> : null}
      </button>
      {open && text ? (
        <div className="ai-fab-note" role="status" aria-live="polite">
          <div>
            <span className="ai-coach-label">
              <Icon name="sparkles" size={14} />
              {copy.ai.coach}
            </span>
            <p>{text}</p>
          </div>
          <button type="button" className="ai-fab-close" aria-label={copy.ai.dismiss} onClick={() => setOpen(false)}>
            <Icon name="close" size={18} />
          </button>
        </div>
      ) : null}
    </span>
  );
}

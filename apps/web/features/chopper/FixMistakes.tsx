"use client";

import Link from "next/link";
import { CoachAvatar } from "@/components/ui/coachCharacters/CoachAvatar";
import { MiniBoard } from "./MiniBoard";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { useProgression } from "@/core/store/progression.store";
import { KitIcon } from "./KitIcon";
import { FIX_FEN } from "./catalog";

/**
 * Design 10b. Live data is the newest mistake in the progression log.
 * "Next" opens the existing mistake LessonPlayer (`?play=1`).
 */
export function FixMistakes({ fixture = false }: { fixture?: boolean }) {
  const mistakeLog = useProgression((s) => s.mistakeLog);
  const seen = new Set<string>();
  const picks = mistakeLog.filter((m) =>
    seen.has(m.fen) ? false : (seen.add(m.fen), true),
  );
  const current = picks[0];
  const total = fixture ? 3 : Math.max(picks.length, current ? picks.length : 0);
  const index = total === 0 ? 0 : 1;
  const fen = fixture || !current ? FIX_FEN : current.fen;
  const bubble =
    fixture || !current
      ? "Close. You took the pawn on a7, then Black’s queen took a2 and the fork was gone."
      : "You slipped here before. Find the better move this time.";

  return (
    <div className="chopper-lesson">
      <div className="lessonhead">
        <Link className="iconbtn" href="/review" aria-label="Close lesson">
          <KitIcon name="x" />
        </Link>
        <ProgressBar value={total ? index / total : 0.33} label="Lesson progress" />
      </div>
      <div className="lgrid">
        <div className="lcoach stack">
          <div className="stack" style={{ alignItems: "flex-start" }}>
            <span className="cs-tag">
              Fix mistakes · {total ? `${index} of ${total}` : "0 of 0"}
            </span>
            <h2>Here is what happened</h2>
          </div>
          <div className="cs-coach">
            <CoachAvatar character="anxious_nerd" state="think" size="lg" alt="Otto" />
            <div className="cs-bubble">{bubble}</div>
          </div>
        </div>
        <div className="lbd">
          <div className="big-mini">
            <MiniBoard fen={fen} />
            <svg className="fix-arrow" viewBox="0 0 8 8" aria-hidden="true">
              <path d="M4.5 2.5 L0.87 6.13" />
              <polygon points="0.5,6.5 0.66,5.92 1.08,6.34" />
            </svg>
          </div>
        </div>
        <div className="lx">
          <div className="ladder">
            <span className="pill ok">
              <KitIcon name="check" className="sm" />1 Your move
            </span>
            <span className="cs-tag">2 The reply</span>
            <span className="pill">3 Try again</span>
          </div>
        </div>
      </div>
      <div className="actionbar">
        {picks.length > 0 ? (
          <Link className="btn" href="/practice/mistakes?play=1">
            Next: find the better move
          </Link>
        ) : (
          <Link className="btn" href="/gym">
            Next: find the better move
          </Link>
        )}
      </div>
    </div>
  );
}

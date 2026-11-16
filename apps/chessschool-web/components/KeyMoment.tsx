"use client";

import { keyMomentCard, type Color, type MoveNote, type ReviewPly } from "@chessschool/chess";
import { copy, keyMomentText } from "@chessschool/design";
import { useMemo } from "react";
import { Board } from "./Board";
import { shareText } from "./Celebration";
import { Button, useToast } from "./ui";

/**
 * One card for the game's decisive move: the board, the move played against the better one, and
 * why. `coachNoteFor` gives the Phase 2 coach note for that move when the learner already asked
 * for it; otherwise the detector's tag text. Renders nothing until the analysis is done.
 */
export function KeyMomentCard({ plies, notes, done, side, orientation, coachNoteFor, onShow }: { plies: ReviewPly[]; notes: Record<number, MoveNote>; done: boolean; side: Color | null; orientation: Color; coachNoteFor?: (ply: number) => string | null; onShow?: (ply: number) => void }) {
  const toast = useToast();
  // The analysis fills `notes` a move at a time; the card is built once, when it is complete.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const m = useMemo(() => (done ? keyMomentCard(plies, notes, side) : null), [done, plies, side]);
  if (!m) return null;
  const mistake = m.kind === "mistake";
  return (
    <section className={`key-moment${mistake ? "" : " is-great"}`} aria-labelledby="key-moment-title">
      <h3 id="key-moment-title">{mistake ? copy.keyMoment.title : copy.keyMoment.great}</h3>
      <div className="key-moment-body">
        <div className="key-moment-board">
          <Board
            hideCoords
            disabled
            fen={mistake ? m.fenBefore : m.fen}
            orientation={orientation}
            lastMove={mistake ? null : m.lastMove}
            arrows={mistake ? [{ from: m.lastMove.from, to: m.lastMove.to, tone: "played" }, ...(m.betterMove ? [{ from: m.betterMove.from, to: m.betterMove.to, tone: "better" as const }] : [])] : []}
            label={copy.keyMoment.boardLabel(m.move, m.better)}
          />
        </div>
        <div className="key-moment-text">
          <p className="key-moment-played">{copy.keyMoment.played(m.move)}</p>
          {m.better ? <p className="key-moment-better">{copy.keyMoment.better(m.better)}</p> : null}
          <p className="muted">{keyMomentText(m, coachNoteFor?.(m.ply))}</p>
        </div>
      </div>
      <div className="sheet-actions">
        {onShow ? (
          <Button variant="secondary" icon="eye" onClick={() => onShow(m.ply)}>
            {copy.keyMoment.show}
          </Button>
        ) : null}
        <Button variant="secondary" onClick={() => void shareText(copy.keyMoment.shareText(m.move, m.better)).then((copied) => copied && toast(copy.celebrate.copied))}>
          {copy.keyMoment.share}
        </Button>
      </div>
    </section>
  );
}

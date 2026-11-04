"use client";

import { arrowShape, boardSquares, fileIndex, isPieceSet, pieceArtwork, rankIndex, readFen, squareLabel, type BoardArrow, type Color, type MoveRef, type Piece, type PieceOp, type PieceSetId, type Square } from "@chessschool/chess";
import { copy } from "@chessschool/design";
import { useEffect, useMemo, useRef, useState } from "react";
import { useReducedMotion } from "@/lib/hooks";
import { useApp } from "@/lib/state";

function Op({ op }: { op: PieceOp }) {
  const paint = { fill: op.fill ?? "#000", stroke: op.stroke, strokeWidth: op.sw };
  if (op.t === "circle") return <circle cx={op.cx} cy={op.cy} r={op.r} {...paint} />;
  if (op.t === "ellipse") return <ellipse cx={op.cx} cy={op.cy} rx={op.rx} ry={op.ry} {...paint} />;
  return (
    <path
      d={op.d}
      {...paint}
      strokeLinejoin={op.lj as "round" | undefined}
      strokeLinecap={op.lc as "round" | undefined}
      fillOpacity={op.fo}
      fillRule={op.fr as "evenodd" | undefined}
    />
  );
}

/** One piece in the chosen set (the learner's set unless `set` is given). */
export function PieceArt({ piece, size, set }: { piece: Piece; size?: number; set?: PieceSetId }) {
  const { state } = useApp();
  const chosen = set ?? (isPieceSet(state.prefs.pieceSet) ? state.prefs.pieceSet : "toy");
  const art = pieceArtwork(chosen, piece.color, piece.type);
  if (art.kind === "asset") {
    // eslint-disable-next-line @next/next/no-img-element -- tiny local SVGs, no optimisation needed
    return <img src={`/assets/pieces/${art.asset}.svg`} width={size} height={size} alt="" className={`piece-svg${art.pixelated ? " is-pixel" : ""}`} draggable={false} />;
  }
  const d = art.drawing;
  return (
    <svg viewBox={d.viewBox} width={size} height={size} className="piece-svg" aria-hidden focusable="false" shapeRendering={d.pixelated ? "crispEdges" : undefined}>
      {d.ops.map((op, i) => (
        <Op key={i} op={op} />
      ))}
    </svg>
  );
}

type BoardProps = {
  fen: string;
  orientation?: Color;
  selected?: Square | null;
  targets?: Square[];
  lastMove?: MoveRef | null;
  check?: Square | null;
  highlight?: Square[];
  hints?: Square[];
  stars?: Square[];
  onTap?: (sq: Square) => void;
  disabled?: boolean;
  /** Change this number to play the "not quite" shake. */
  shake?: number;
  label?: string;
  arrows?: BoardArrow[];
};

export function Board({ fen, orientation = "w", selected, targets = [], lastMove, check, highlight = [], hints = [], stars = [], onTap, disabled, shake = 0, label = copy.lesson.board, arrows = [] }: BoardProps) {
  const { state } = useApp();
  const { coords, legalDots } = state.prefs;
  const pieces = useMemo(() => readFen(fen), [fen]);
  const squares = useMemo(() => boardSquares(orientation), [orientation]);
  const reduced = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const btns = useRef<(HTMLButtonElement | null)[]>([]);
  const [focus, setFocus] = useState(() => squares.indexOf(orientation === "w" ? "e2" : "e7"));

  useEffect(() => {
    if (!shake || reduced) return;
    ref.current?.animate([{ transform: "translateX(0)" }, { transform: "translateX(-8px)" }, { transform: "translateX(7px)" }, { transform: "translateX(-4px)" }, { transform: "translateX(0)" }], { duration: 360, easing: "ease-out" });
  }, [shake, reduced]);

  const moveFocus = (i: number) => {
    const n = Math.max(0, Math.min(63, i));
    setFocus(n);
    btns.current[n]?.focus();
  };
  const onKey = (e: React.KeyboardEvent, i: number) => {
    const col = i % 8;
    const map: Record<string, number> = { ArrowRight: col < 7 ? i + 1 : i, ArrowLeft: col > 0 ? i - 1 : i, ArrowUp: i - 8, ArrowDown: i + 8, Home: i - col, End: i - col + 7 };
    if (e.key in map) {
      e.preventDefault();
      moveFocus(map[e.key]);
    }
  };

  const slide = (sq: Square) => {
    if (reduced || !lastMove || lastMove.to !== sq) return undefined;
    const sign = orientation === "w" ? 1 : -1;
    const dx = (fileIndex(lastMove.from) - fileIndex(sq)) * 100 * sign;
    const dy = (rankIndex(sq) - rankIndex(lastMove.from)) * 100 * sign;
    return { "--dx": `${dx}%`, "--dy": `${dy}%` } as React.CSSProperties;
  };

  return (
    <div ref={ref} className={`board${disabled ? " board-disabled" : ""}`} role="group" aria-label={label} data-fen={fen} data-stars={stars.join(" ")}>
      {squares.map((sq, i) => {
        const piece = pieces.get(sq);
        const light = (fileIndex(sq) + rankIndex(sq)) % 2 === 1;
        const isTarget = targets.includes(sq);
        const parts = [squareLabel(sq, piece)];
        if (selected === sq) parts.push(copy.a11y.selected);
        if (isTarget) parts.push(copy.a11y.target);
        if (stars.includes(sq)) parts.push(copy.a11y.star);
        if (lastMove && (lastMove.from === sq || lastMove.to === sq)) parts.push(copy.a11y.lastMove);
        const cls = [
          "sq",
          light ? "sq-light" : "sq-dark",
          selected === sq && "is-selected",
          lastMove && (lastMove.from === sq || lastMove.to === sq) && "is-last",
          highlight.includes(sq) && "is-teach",
          hints.includes(sq) && "is-hint",
          check === sq && "is-check",
        ]
          .filter(Boolean)
          .join(" ");
        const row = Math.floor(i / 8);
        const col = i % 8;
        return (
          <button
            key={sq}
            ref={(el) => {
              btns.current[i] = el;
            }}
            type="button"
            className={cls}
            tabIndex={i === focus ? 0 : -1}
            aria-label={parts.join(", ")}
            aria-disabled={disabled || undefined}
            onFocus={() => setFocus(i)}
            onKeyDown={(e) => onKey(e, i)}
            onClick={() => !disabled && onTap?.(sq)}
          >
            {coords && col === 0 ? <span className="coord coord-rank">{sq[1]}</span> : null}
            {coords && row === 7 ? <span className="coord coord-file">{sq[0]}</span> : null}
            {stars.includes(sq) ? (
              <svg className="star" viewBox="0 0 24 24" aria-hidden>
                <path d="M12 2.8l2.8 5.8 6.3.9-4.6 4.4 1.1 6.3L12 17.2l-5.6 3 1.1-6.3L2.9 9.5l6.3-.9L12 2.8Z" />
              </svg>
            ) : null}
            {piece ? (
              <span className="piece" key={lastMove?.to === sq ? `${lastMove.from}${fen}` : sq} style={slide(sq)} data-slide={slide(sq) ? "" : undefined}>
                <PieceArt piece={piece} />
              </span>
            ) : null}
            {isTarget && legalDots ? <span className={piece ? "ring" : "dot"} aria-hidden /> : null}
          </button>
        );
      })}
      {arrows.length ? (
        <svg className="board-arrows" viewBox="0 0 800 800" aria-hidden>
          {arrows.map((a) => {
            const g = arrowShape(a, orientation);
            return (
              <g key={`${a.from}${a.to}${a.tone}`} className={`arrow arrow-${a.tone}`}>
                <line x1={g.x1} y1={g.y1} x2={g.x2} y2={g.y2} />
                <polygon points={g.head} />
              </g>
            );
          })}
        </svg>
      ) : null}
    </div>
  );
}

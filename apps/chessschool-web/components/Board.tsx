"use client";

import {
  arrowShape,
  boardSquares,
  fileIndex,
  isPieceSet,
  moveEffects,
  pieceArtwork,
  promotionColumn,
  rankIndex,
  readFen,
  squareLabel,
  turnOf,
  type BoardArrow,
  type Color,
  type MoveRef,
  type Piece,
  type PieceOp,
  type PieceSetId,
  type PromotionPiece,
  type Square,
} from "@chessschool/chess";
import { copy } from "@chessschool/design";
import { useEffect, useMemo, useRef, useState } from "react";
import { useReducedMotion } from "@/lib/hooks";
import { useApp } from "@/lib/state";

function Op({ op, tint }: { op: PieceOp; tint?: string }) {
  const fill = tint ? (op.fill === "none" ? "none" : tint) : (op.fill ?? "#000");
  const stroke = tint && op.stroke ? tint : op.stroke;
  const paint = { fill, stroke, strokeWidth: op.sw };
  if (op.t === "circle") return <circle cx={op.cx} cy={op.cy} r={op.r} {...paint} />;
  if (op.t === "ellipse") return <ellipse cx={op.cx} cy={op.cy} rx={op.rx} ry={op.ry} {...paint} />;
  return (
    <path
      d={op.d}
      {...paint}
      strokeLinejoin={op.lj as "round" | undefined}
      strokeLinecap={op.lc as "round" | undefined}
      fillOpacity={tint ? 1 : op.fo}
      fillRule={op.fr as "evenodd" | undefined}
    />
  );
}

/** One piece in the chosen set (the learner's set unless `set` is given). `tint` draws a solid silhouette. */
export function PieceArt({ piece, size, set, tint }: { piece: Piece; size?: number; set?: PieceSetId; tint?: string }) {
  const { state } = useApp();
  const chosen = set ?? (isPieceSet(state.prefs.pieceSet) ? state.prefs.pieceSet : "toy");
  const art = pieceArtwork(chosen, piece.color, piece.type);
  if (art.kind === "asset") {
    // eslint-disable-next-line @next/next/no-img-element -- tiny local SVGs, no optimisation needed
    return <img src={`/assets/pieces/${art.asset}.svg`} width={size} height={size} alt="" className={`piece-svg${art.pixelated ? " is-pixel" : ""}`} style={tint ? { filter: "grayscale(1) contrast(1.4)", opacity: 0.92 } : undefined} draggable={false} />;
  }
  const d = art.drawing;
  return (
    <svg viewBox={d.viewBox} width={size} height={size} className="piece-svg" aria-hidden focusable="false" shapeRendering={d.pixelated ? "crispEdges" : undefined}>
      {d.ops.map((op, i) => (
        <Op key={i} op={op} tint={tint} />
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
  mate?: Square | null;
  highlight?: Square[];
  hints?: Square[];
  stars?: Square[];
  onTap?: (sq: Square) => void;
  disabled?: boolean;
  shake?: number;
  label?: string;
  arrows?: BoardArrow[];
  promotion?: MoveRef | null;
  onPromote?: (piece: PromotionPiece | null) => void;
  /** Faded piece on the destination of a suggested move. */
  guide?: { from: Square; to: Square; piece: Piece } | null;
};

type Fx = { id: number; captured: { square: Square; piece: Piece } | null; promoted: Square | null };

function cell(sq: Square, squares: Square[]): React.CSSProperties {
  const i = squares.indexOf(sq);
  return { left: `${(i % 8) * 12.5}%`, top: `${Math.floor(i / 8) * 12.5}%` };
}

export function Board({
  fen,
  orientation = "w",
  selected,
  targets = [],
  lastMove,
  check,
  mate,
  highlight = [],
  hints = [],
  stars = [],
  onTap,
  disabled,
  shake = 0,
  label = copy.lesson.board,
  arrows = [],
  promotion,
  onPromote,
  guide = null,
}: BoardProps) {
  const { state } = useApp();
  const { coords, legalDots } = state.prefs;
  const pieces = useMemo(() => readFen(fen), [fen]);
  const squares = useMemo(() => boardSquares(orientation), [orientation]);
  const reduced = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const prevFen = useRef(fen);
  const btns = useRef<(HTMLButtonElement | null)[]>([]);
  const [focus, setFocus] = useState(() => squares.indexOf(orientation === "w" ? "e2" : "e7"));
  const [fx, setFx] = useState<Fx | null>(null);
  const mover = turnOf(fen);

  useEffect(() => {
    const before = prevFen.current;
    prevFen.current = fen;
    if (before === fen) return;
    const e = moveEffects(before, fen, lastMove);
    setFx(e.captured || e.promoted ? { id: Date.now(), captured: e.captured, promoted: e.promoted && lastMove ? lastMove.to : null } : null);
  }, [fen, lastMove]);

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
    if (reduced || !lastMove || lastMove.to !== sq || mate === sq) return undefined;
    const sign = orientation === "w" ? 1 : -1;
    const dx = (fileIndex(lastMove.from) - fileIndex(sq)) * 100 * sign;
    const dy = (rankIndex(sq) - rankIndex(lastMove.from)) * 100 * sign;
    return { "--dx": `${dx}%`, "--dy": `${dy}%` } as React.CSSProperties;
  };

  const dragRef = useRef<{ from: Square; pointer: number; x: number; y: number; moved: boolean; captured: boolean } | null>(null);
  const skipClick = useRef(false);
  const [ghost, setGhost] = useState<{ piece: Piece; left: number; top: number } | null>(null);
  const [lift, setLift] = useState<Square | null>(null);
  const atPointer = (e: React.PointerEvent) => {
    const box = ref.current?.getBoundingClientRect();
    if (!box || box.width === 0) return null;
    const col = Math.floor(((e.clientX - box.left) / box.width) * 8);
    const row = Math.floor(((e.clientY - box.top) / box.height) * 8);
    const sq = col >= 0 && col < 8 && row >= 0 && row < 8 ? squares[row * 8 + col] : null;
    return { sq, left: ((e.clientX - box.left) / box.width) * 100, top: ((e.clientY - box.top) / box.height) * 100 };
  };
  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0 || disabled || promotion || !onTap) return;
    const hit = atPointer(e);
    const piece = hit?.sq ? pieces.get(hit.sq) : undefined;
    if (!hit?.sq || !piece || piece.color !== mover) return;
    let captured = false;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
      captured = true;
    } catch {
      /* a click still works if capture is unavailable */
    }
    dragRef.current = { from: hit.sq, pointer: e.pointerId, x: e.clientX, y: e.clientY, moved: false, captured };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const drag = dragRef.current;
    if (!drag || e.pointerId !== drag.pointer) return;
    const hit = atPointer(e);
    if (!hit) return;
    if (!drag.moved) {
      const dx = e.clientX - drag.x;
      const dy = e.clientY - drag.y;
      if (dx * dx + dy * dy < 36) return;
      drag.moved = true;
      setLift(drag.from);
      if (selected !== drag.from) onTap?.(drag.from);
    }
    const piece = pieces.get(drag.from);
    if (piece) setGhost({ piece, left: hit.left, top: hit.top });
  };
  const onPointerUp = (e: React.PointerEvent) => {
    const drag = dragRef.current;
    if (!drag || e.pointerId !== drag.pointer) return;
    dragRef.current = null;
    setGhost(null);
    setLift(null);
    // With pointer capture the click lands on the board, not the square, so the tap is
    // delivered here. Without capture, skip the square's own click so it is not applied twice.
    if (!drag.captured) skipClick.current = true;
    if (!drag.moved) {
      onTap?.(drag.from);
      return;
    }
    const hit = atPointer(e);
    if (hit?.sq && hit.sq !== drag.from) onTap?.(hit.sq);
  };

  return (
    <div
      ref={ref}
      className={`board${disabled ? " board-disabled" : ""}${mate ? " is-mate" : ""}`}
      role="group"
      aria-label={label}
      data-fen={fen}
      data-stars={stars.join(" ")}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
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
          (hints.includes(sq) || guide?.from === sq || guide?.to === sq) && "is-hint",
          check === sq && "is-check",
          mate === sq && "is-mated",
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
            onClick={() => {
              if (skipClick.current) {
                skipClick.current = false;
                return;
              }
              if (!disabled && !promotion) onTap?.(sq);
            }}
          >
            {coords && col === 0 ? <span className="coord coord-rank">{sq[1]}</span> : null}
            {coords && row === 7 ? <span className="coord coord-file">{sq[0]}</span> : null}
            {stars.includes(sq) ? (
              <svg className="star" viewBox="0 0 24 24" aria-hidden>
                <path d="M12 2.8l2.8 5.8 6.3.9-4.6 4.4 1.1 6.3L12 17.2l-5.6 3 1.1-6.3L2.9 9.5l6.3-.9L12 2.8Z" />
              </svg>
            ) : null}
            {guide?.to === sq ? (
              <span className="piece guide-piece" aria-hidden>
                <PieceArt piece={guide.piece} />
              </span>
            ) : null}
            {piece ? (
              <span className={`piece${mate === sq ? " is-falling" : ""}${fx?.promoted === sq ? " is-promoted" : ""}${lift === sq ? " is-lifted" : ""}`} key={lastMove?.to === sq ? `${lastMove.from}${fen}` : sq} style={slide(sq)} data-slide={slide(sq) ? "" : undefined}>
                <PieceArt piece={piece} />
              </span>
            ) : null}
            {isTarget && legalDots ? <span className={piece ? "ring" : "dot"} aria-hidden /> : null}
          </button>
        );
      })}

      {fx && !reduced ? (
        <div key={fx.id} className="board-fx" aria-hidden>
          {fx.captured ? (
            <span className={`capture-ghost${(fx.captured.piece.color === "b" ? orientation === "w" : orientation === "b") ? " is-down" : " is-up"}`} style={cell(fx.captured.square, squares)}>
              <PieceArt piece={fx.captured.piece} tint={fx.captured.piece.color === "w" ? "#FFFFFF" : "#1C1B2E"} />
              {Array.from({ length: 8 }, (_, i) => (
                <i key={i} className="capture-spark" style={{ "--a": `${(i / 8) * 360}deg` } as React.CSSProperties} />
              ))}
            </span>
          ) : null}
          {fx.promoted ? <span className="promo-ring" style={cell(fx.promoted, squares)} /> : null}
        </div>
      ) : null}

      {ghost ? (
        <span className="drag-ghost" style={{ left: `${ghost.left}%`, top: `${ghost.top}%` }} aria-hidden>
          <PieceArt piece={ghost.piece} />
        </span>
      ) : null}

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

      {mate ? <div className="mate-stamp">{copy.play.mate}</div> : null}

      {promotion ? (
        <div className="promo-layer">
          <button type="button" className="promo-scrim" aria-label={copy.gym.cancel} onClick={() => onPromote?.(null)} />
          {promotionColumn(promotion.to).map(({ square, piece, index }) => (
            <button
              key={piece}
              type="button"
              className={`promo-pick${index === 0 ? " is-queen" : ""}`}
              style={{ ...cell(square, squares), animationDelay: `${index * 45}ms` }}
              aria-label={copy.gym.promotePieces[piece]}
              onClick={() => onPromote?.(piece)}
            >
              <PieceArt piece={{ type: piece, color: mover }} />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

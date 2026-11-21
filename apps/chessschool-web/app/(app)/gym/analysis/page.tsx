"use client";

import {
  editorFen,
  editorFrom,
  EMPTY_FEN,
  evaluationLabel,
  goLine,
  lineCheck,
  lineFen,
  lineFromMoves,
  lineLast,
  numberedLine,
  PALETTE,
  placePiece,
  positionProblem,
  promoteLine,
  readPastedFen,
  redoLine,
  START_FEN,
  startLine,
  tapLine,
  undoLine,
  type AnalysisLine,
  type Castling,
  type Color,
  type EditorState,
  type Piece,
  type Square,
} from "@chessschool/chess";
import { copy } from "@chessschool/design";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import { Board } from "@/components/Board";
import { BoardStage } from "@/components/BoardStage";
import { EvalBar } from "@/components/GameParts";
import { Button, Segmented, TextField, TopBar, useToast } from "@/components/ui";
import { useEvaluation } from "@/lib/analysis";
import { copyText } from "@/lib/share";
import { useApp } from "@/lib/state";

const GLYPH: Record<string, string> = { wk: "♔", wq: "♕", wr: "♖", wb: "♗", wn: "♘", wp: "♙", bk: "♚", bq: "♛", br: "♜", bb: "♝", bn: "♞", bp: "♟" };

/** Opens with `fen`, or a game's `start` + space-separated `moves` on move `at`; `side=b` shows Black at the bottom. */
function initialLine(p: URLSearchParams): AnalysisLine {
  const start = readPastedFen(p.get("start") ?? "");
  const moves = p.get("moves");
  if (start && moves) return lineFromMoves(start, moves.split(/\s+/).filter(Boolean), p.get("at") ? Number(p.get("at")) : undefined);
  const fen = readPastedFen(p.get("fen") ?? "") ?? START_FEN;
  return startLine(positionProblem(fen) ? START_FEN : fen);
}

export default function AnalysisPage() {
  return (
    <Suspense fallback={<div className="page-skeleton" aria-busy="true" />}>
      <AnalysisBoard />
    </Suspense>
  );
}

function AnalysisBoard() {
  const params = useSearchParams();
  const { cue } = useApp();
  const toast = useToast();
  const t = copy.analysisBoard;
  const [line, setLine] = useState<AnalysisLine>(() => initialLine(params));
  const [orientation, setOrientation] = useState<Color>(params.get("side") === "b" ? "b" : "w");
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [brush, setBrush] = useState<Piece | null>(PALETTE[0]);
  const [fenText, setFenText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const fen = lineFen(line);
  const { evaluation, done } = useEvaluation(editor ? null : fen);
  const cp = evaluation ? (evaluation.mate !== null ? Math.sign(evaluation.mate || (evaluation.cp > 0 ? 1 : -1)) * 1500 : evaluation.cp) : 0;
  const editFen = editor ? editorFen(editor) : null;
  const bestLine = useMemo(() => (evaluation?.best.length ? numberedLine(fen, evaluation.best) : ""), [evaluation, fen]);
  const overLabel = evaluation?.over === "checkmate" ? t.checkmate : evaluation?.over === "stalemate" ? t.stalemate : null;
  const label = evaluationLabel(evaluation);

  // Arrow keys step through the line, as on the replay screen.
  useEffect(() => {
    if (editor) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement | null)?.closest(".board, input, textarea")) return;
      if (e.key === "ArrowLeft") setLine((l) => undoLine(l));
      if (e.key === "ArrowRight") setLine((l) => redoLine(l));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [editor]);

  const tap = (sq: Square) => {
    if (editor) {
      setEditor(placePiece(editor, sq, brush));
      setError(null);
      return;
    }
    const next = tapLine(line, sq);
    if (next.at !== line.at || next.moves !== line.moves) cue("tap");
    setLine(next);
  };
  const startEdit = () => {
    setEditor(editorFrom(fen));
    setFenText(fen);
    setError(null);
  };
  const finishEdit = () => {
    if (!editFen) return;
    const problem = positionProblem(editFen);
    if (problem) {
      setError(t.problems[problem]);
      cue("gentle-no");
      return;
    }
    setLine(startLine(editFen));
    setEditor(null);
  };
  const loadFen = () => {
    const pasted = readPastedFen(fenText);
    if (!pasted) return setError(t.badFen);
    setEditor(editorFrom(pasted));
    setError(null);
  };
  const startTurn = line.start.split(" ")[1] === "b" ? 1 : 0;
  const startNo = Number(line.start.split(" ")[5]) || 1;

  return (
    <div className="page play-page analysis-page">
      <TopBar backHref="/gym" title={t.title} />
      <div className="play">
        <BoardStage
          className="play-stage"
          top={
            <div className="player">
              <p className="stage-status">{editor ? t.edit : (overLabel ?? (evaluation ? t.depth(evaluation.depth) : t.thinking))}</p>
              {!editor ? (
                <span className="clock" aria-label={t.evalLabel(label)}>
                  {label}
                </span>
              ) : null}
            </div>
          }
          bottom={null}
        >
          <div className="analysis-board">
            {!editor ? <EvalBar cp={cp} orientation={orientation} /> : null}
            <Board
              fen={editFen ?? fen}
              orientation={orientation}
              lastMove={editor ? null : lineLast(line)}
              selected={editor ? null : line.selected}
              targets={editor ? [] : line.targets}
              check={editor ? null : lineCheck(line)}
              arrows={!editor && evaluation?.bestMove ? [{ ...evaluation.bestMove, tone: "better" }] : []}
              onTap={tap}
              promotion={editor ? null : line.promotion}
              onPromote={(piece) => setLine(promoteLine(line, piece))}
            />
          </div>
        </BoardStage>
        <div className="play-panel">
          {editor ? (
            <>
              <p className="muted">{t.placeHint}</p>
              <div className="ab-palette" role="radiogroup" aria-label={t.palette}>
                {[...PALETTE, null].map((p) => {
                  const on = p ? brush?.type === p.type && brush.color === p.color : brush === null;
                  return (
                    <button key={p ? p.color + p.type : "eraser"} type="button" role="radio" aria-checked={on} aria-label={p ? t.pieceLabel(copy.play.sides[p.color], t.pieces[p.type]) : t.eraser} className="ab-piece" onClick={() => setBrush(p)}>
                      {p ? GLYPH[p.color + p.type] : "⌫"}
                    </button>
                  );
                })}
              </div>
              <div className="ab-row">
                <Button variant="secondary" onClick={() => setEditor(editorFrom(EMPTY_FEN))}>
                  {t.clear}
                </Button>
                <Button variant="secondary" onClick={() => setEditor(editorFrom(START_FEN))}>
                  {t.start}
                </Button>
              </div>
              <Segmented label={t.toMove} value={editor.turn} options={(["w", "b"] as const).map((v) => ({ value: v, label: copy.play.sides[v] }))} onChange={(v) => setEditor({ ...editor, turn: v })} />
              <fieldset className="ab-row" style={{ border: 0, padding: 0, margin: 0 }}>
                <legend className="muted">{t.castling}</legend>
                {(["K", "Q", "k", "q"] as (keyof Castling)[]).map((f) => (
                  <label key={f} className="ab-check">
                    <input type="checkbox" checked={editor.castling[f]} onChange={() => setEditor({ ...editor, castling: { ...editor.castling, [f]: !editor.castling[f] } })} />
                    {t.castle[f]}
                  </label>
                ))}
              </fieldset>
              <TextField label={t.fen} hint={t.fenHint} value={fenText} onChange={(e) => setFenText(e.target.value)} autoCapitalize="none" autoCorrect="off" spellCheck={false} />
              <Button variant="secondary" onClick={loadFen}>
                {t.loadFen}
              </Button>
              {error ? (
                <p className="ab-error" role="alert">
                  {error}
                </p>
              ) : null}
              <Button icon="check" onClick={finishEdit}>
                {t.done}
              </Button>
            </>
          ) : (
            <>
              <div className="ab-line" role="status" aria-live="polite">
                <span className="muted small">{`${t.best}${evaluation ? ` · ${t.depth(evaluation.depth)}` : ""}${done ? "" : ` · ${t.thinking}`}`}</span>
                <strong>{overLabel ?? (bestLine || t.thinking)}</strong>
              </div>
              {line.moves.length ? (
                <ol className="move-list" aria-label={copy.myGames.moves}>
                  {line.moves.map((m, i) => {
                    const name = `${Math.floor((i + startTurn) / 2) + startNo}${(i + startTurn) % 2 ? "…" : "."} ${m.san}`;
                    return (
                      <li key={i}>
                        <button type="button" className="move-chip" aria-pressed={line.at === i + 1} aria-label={copy.myGames.goTo(name)} onClick={() => setLine(goLine(line, i + 1))}>
                          {name}
                        </button>
                      </li>
                    );
                  })}
                </ol>
              ) : null}
              <div className="analysis-nav">
                <Button variant="secondary" icon="undo" onClick={() => setLine(undoLine(line))} disabled={!line.at} aria-label={t.undo}>
                  {""}
                </Button>
                <Button variant="secondary" icon="redo" onClick={() => setLine(redoLine(line))} disabled={line.at >= line.moves.length} aria-label={t.redo}>
                  {""}
                </Button>
                <Button variant="secondary" icon="refresh" onClick={() => setOrientation(orientation === "w" ? "b" : "w")} aria-label={t.flip}>
                  {""}
                </Button>
              </div>
              <Button variant="secondary" icon="edit" onClick={startEdit}>
                {t.edit}
              </Button>
              <Button variant="ghost" icon="doc" onClick={() => void copyText(fen).then((ok) => ok && toast(t.copied))}>
                {copy.myGames.copyFen}
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

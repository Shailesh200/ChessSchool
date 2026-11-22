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
import { useLocalSearchParams } from "expo-router";
import { useMemo, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Board } from "@/components/Board";
import { BoardStage } from "@/components/BoardStage";
import { EvalBar } from "@/components/GameParts";
import { Button, Choice, Segmented, T, TopBar } from "@/components/ui";
import { useEvaluation } from "@/lib/analysis";
import { useApp } from "@/lib/state";
import { fonts, useTheme } from "@/lib/theme";

const GLYPH: Record<string, string> = { wk: "♔", wq: "♕", wr: "♖", wb: "♗", wn: "♘", wp: "♙", bk: "♚", bq: "♛", br: "♜", bb: "♝", bn: "♞", bp: "♟" };

/** Opens with `fen`, or a game's `start` + space-separated `moves` on move `at`; `side=b` shows Black at the bottom. */
function initialLine(p: { fen?: string; start?: string; moves?: string; at?: string }): AnalysisLine {
  const start = (p.start && readPastedFen(p.start)) || null;
  if (start && p.moves) return lineFromMoves(start, p.moves.split(/\s+/).filter(Boolean), p.at ? Number(p.at) : undefined);
  const fen = (p.fen && readPastedFen(p.fen)) || START_FEN;
  return startLine(positionProblem(fen) ? START_FEN : fen);
}

export default function AnalysisBoard() {
  const params = useLocalSearchParams<{ fen?: string; start?: string; moves?: string; at?: string; side?: string }>();
  const { cue } = useApp();
  const { c } = useTheme();
  const t = copy.analysisBoard;
  const [line, setLine] = useState<AnalysisLine>(() => initialLine(params));
  const [orientation, setOrientation] = useState<Color>(params.side === "b" ? "b" : "w");
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [brush, setBrush] = useState<Piece | null>(PALETTE[0]);
  const [error, setError] = useState<string | null>(null);
  const fen = lineFen(line);
  const { evaluation, done } = useEvaluation(editor ? null : fen);
  const cp = evaluation ? (evaluation.mate !== null ? Math.sign(evaluation.mate || (evaluation.cp > 0 ? 1 : -1)) * 1500 : evaluation.cp) : 0;
  const editFen = editor ? editorFen(editor) : null;
  const bestLine = useMemo(() => (evaluation?.best.length ? numberedLine(fen, evaluation.best) : ""), [evaluation, fen]);

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
  const overLabel = evaluation?.over === "checkmate" ? t.checkmate : evaluation?.over === "stalemate" ? t.stalemate : null;
  const label = evaluationLabel(evaluation);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }}>
      <View style={{ paddingHorizontal: 12 }}>
        <TopBar title={t.title} />
      </View>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: 24, gap: 10, maxWidth: 640, width: "100%", alignSelf: "center" }}>
        <View style={{ height: 460, maxHeight: 520 }}>
          <BoardStage
            top={
              <>
                <T role="label" style={{ flex: 1 }} numberOfLines={1}>
                  {editor ? t.edit : (overLabel ?? (evaluation ? t.depth(evaluation.depth) : t.thinking))}
                </T>
                {!editor ? (
                  <View accessible accessibilityLabel={t.evalLabel(label)} style={{ minWidth: 72, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, alignItems: "center", backgroundColor: c.sunken }}>
                    <T role="label" style={{ fontFamily: fonts.bold, fontVariant: ["tabular-nums"] }}>
                      {label}
                    </T>
                  </View>
                ) : null}
              </>
            }
          >
            {(size) => (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                {!editor ? <EvalBar cp={cp} orientation={orientation} height={size - 28} /> : null}
                <Board
                  size={editor ? size : size - 20}
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
              </View>
            )}
          </BoardStage>
        </View>

        {editor ? (
          <View style={{ gap: 10 }}>
            <T role="small" color="textMuted">
              {t.placeHint}
            </T>
            <View accessibilityRole="radiogroup" accessibilityLabel={t.palette} style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
              {[...PALETTE, null].map((p) => {
                const on = p ? brush?.type === p.type && brush.color === p.color : brush === null;
                const name = p ? t.pieceLabel(copy.play.sides[p.color], t.pieces[p.type]) : t.eraser;
                return (
                  <Pressable
                    key={p ? p.color + p.type : "eraser"}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: on }}
                    accessibilityLabel={name}
                    onPress={() => setBrush(p)}
                    style={{ width: 44, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: on ? c.brand : c.line, backgroundColor: on ? c.brandSoft : c.card }}
                  >
                    <T role="heading" style={{ fontSize: 26, lineHeight: 32 }}>
                      {p ? GLYPH[p.color + p.type] : "⌫"}
                    </T>
                  </Pressable>
                );
              })}
            </View>
            <View style={{ flexDirection: "row", gap: 8 }}>
              <View style={{ flex: 1 }}>
                <Button title={t.clear} variant="secondary" onPress={() => setEditor(editorFrom(EMPTY_FEN))} />
              </View>
              <View style={{ flex: 1 }}>
                <Button title={t.start} variant="secondary" onPress={() => setEditor(editorFrom(START_FEN))} />
              </View>
            </View>
            <Segmented label={t.toMove} value={editor.turn} options={(["w", "b"] as const).map((v) => ({ value: v, label: copy.play.sides[v] }))} onChange={(v) => setEditor({ ...editor, turn: v })} />
            <T role="label">{t.castling}</T>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {(["K", "Q", "k", "q"] as (keyof Castling)[]).map((f) => (
                <View key={f} style={{ flexBasis: "47%", flexGrow: 1 }}>
                  <Choice label={t.castle[f]} selected={editor.castling[f]} onPress={() => setEditor({ ...editor, castling: { ...editor.castling, [f]: !editor.castling[f] } })} />
                </View>
              ))}
            </View>
            {error ? (
              <T role="small" color="dangerText">
                {error}
              </T>
            ) : null}
            <Button title={t.done} icon="check" onPress={finishEdit} />
          </View>
        ) : (
          <View style={{ gap: 10 }}>
            <View accessibilityLiveRegion="polite" style={{ gap: 4, padding: 12, borderRadius: 18, borderWidth: 1, borderColor: c.line, backgroundColor: c.card }}>
              <T role="micro" color="textSubtle">
                {`${t.best}${evaluation ? ` · ${t.depth(evaluation.depth)}` : ""}${done ? "" : " · " + t.thinking}`}
              </T>
              <T role="body" style={{ fontFamily: fonts.semibold }}>
                {overLabel ?? (bestLine || t.thinking)}
              </T>
            </View>
            {line.moves.length ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                {line.moves.map((m, i) => {
                  const startTurn = line.start.split(" ")[1] === "b" ? 1 : 0;
                  const n = Math.floor((i + startTurn) / 2) + (Number(line.start.split(" ")[5]) || 1);
                  const name = `${n}${(i + startTurn) % 2 ? "…" : "."} ${m.san}`;
                  const on = line.at === i + 1;
                  return (
                    <Pressable key={i} accessibilityRole="button" accessibilityLabel={copy.myGames.goTo(name)} accessibilityState={{ selected: on }} onPress={() => setLine(goLine(line, i + 1))} style={{ paddingHorizontal: 10, paddingVertical: 7, borderRadius: 12, backgroundColor: on ? c.brandSoft : c.sunken }}>
                      <T role="small" style={{ fontFamily: fonts.semibold, color: on ? c.brandText : c.textMuted }}>
                        {name}
                      </T>
                    </Pressable>
                  );
                })}
              </ScrollView>
            ) : null}
            <View style={{ flexDirection: "row", gap: 8 }}>
              <View style={{ flex: 1 }}>
                <Button title="" icon="undo" label={t.undo} variant="secondary" disabled={!line.at} onPress={() => setLine(undoLine(line))} />
              </View>
              <View style={{ flex: 1 }}>
                <Button title="" icon="redo" label={t.redo} variant="secondary" disabled={line.at >= line.moves.length} onPress={() => setLine(redoLine(line))} />
              </View>
              <View style={{ flex: 1 }}>
                <Button title="" icon="refresh" label={t.flip} variant="secondary" onPress={() => setOrientation(orientation === "w" ? "b" : "w")} />
              </View>
            </View>
            <Button title={t.edit} icon="edit" variant="secondary" onPress={startEdit} />
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

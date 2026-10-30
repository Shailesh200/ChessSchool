import { ScrollView, Text, View, useWindowDimensions } from "react-native";
import { ChessBoard } from "@/ChessBoard";
import { KitButton, usePremiumKitTheme } from "@/components/kit";
import type { CoachCharacterId } from "@/coachCharacters";
import { PremiumLessonCoachSection } from "./PremiumLessonCoachSection";
import { PremiumLessonFeedbackBar } from "./PremiumLessonFeedbackBar";
import { PremiumLessonHeader } from "./PremiumLessonHeader";
import { PremiumLessonHintSection } from "./PremiumLessonHintSection";
import { PremiumWhyQuizPanel } from "./PremiumWhyQuizPanel";
import { correctBarTitle, lessonTagSuffix, stepTitle } from "./lessonCopy";
import {
  isTapSquaresStep,
  isWhyQuizStep,
  lessonStepBadge,
  premiumCoachMood,
} from "./lessonStepUi";
import { lessonDisplayXp } from "./lessonXp";

export type PremiumLessonStep = {
  id: string;
  kind: "info" | "observe" | "move" | "quiz";
  coach: string;
  hint?: string;
  fen?: string;
  orientation?: "white" | "black";
  solution?: string[];
  moves?: string[];
  arrows?: { startSquare: string; endSquare: string; color?: string }[];
  highlight?: string[];
  highlightFiles?: string[];
  highlightRanks?: number[];
  tag?: string;
  successText?: string;
  failText?: string;
  question?: string;
  options?: { label: string; emoji?: string }[];
  correct?: number;
};

type Props = {
  lessonTitle: string;
  lessonTag?: string | null;
  lessonOrdinal: number;
  step: PremiumLessonStep;
  index: number;
  total: number;
  phase: "playing" | "correct" | "wrong";
  displayFen?: string;
  lastMove: { from: string; to: string } | null;
  flipped: boolean;
  coachCharacter: CoachCharacterId | string;
  coachLine: string;
  hintLevel: number;
  hintTip: string;
  hintsEnabled: boolean;
  observeReady: boolean;
  boardHighlights?: string[];
  boardArrows?: { startSquare: string; endSquare: string; color?: string }[];
  boardHighlightFiles?: string[];
  boardHighlightRanks?: number[];
  tappedSquares: string[];
  onSquareTap: (sq: string) => void;
  onMove: (from: string, to: string) => boolean;
  onClose: () => void;
  onContinueIntro: () => void;
  onHint: () => void;
  onTryAgain: () => void;
  onShowHint: () => void;
  onContinueCorrect: () => void;
  onQuizSubmit: (ok: boolean) => void;
  onTapCheck: () => void;
  onTapClear: () => void;
  advancing: boolean;
};

const MAX_BOARD = 390;

export function PremiumLessonShell(props: Props) {
  const { width } = useWindowDimensions();
  const { colors, space, font, type } = usePremiumKitTheme();
  const horizontalPad = width > MAX_BOARD ? (width - MAX_BOARD) / 2 : 0;
  const boardSize = Math.min(width - space["4"] * 2, MAX_BOARD - space["4"] * 2, 360);

  const {
    lessonTitle,
    lessonTag,
    lessonOrdinal,
    step,
    index,
    total,
    phase,
    displayFen,
    lastMove,
    flipped,
    coachCharacter,
    coachLine,
    hintLevel,
    hintsEnabled,
    observeReady,
    boardHighlights,
    boardArrows,
    boardHighlightFiles,
    boardHighlightRanks,
    tappedSquares,
    onSquareTap,
    onMove,
    onClose,
    onContinueIntro,
    onHint,
    onTryAgain,
    onShowHint,
    onContinueCorrect,
    onQuizSubmit,
    onTapCheck,
    onTapClear,
    advancing,
  } = props;

  const tapMode = isTapSquaresStep(step);
  const whyQuiz = isWhyQuizStep(step);
  const progressPct = ((index + (phase === "correct" ? 1 : 0)) / Math.max(total, 1)) * 100;
  const mood = premiumCoachMood(phase, step.kind, hintLevel);
  const badge = lessonStepBadge(lessonOrdinal, step.kind, {
    hintLevel,
    tapSquares: tapMode,
    phase,
    tagSuffix: lessonTagSuffix(lessonTag ?? step.tag),
  });
  const title = stepTitle(step, lessonTitle);
  const badgeText = badge;

  const showIntroCta = step.kind === "info" || (step.kind === "observe" && observeReady);
  const showFeedback = phase === "correct" || phase === "wrong";
  const solvable = step.kind === "move" && phase === "playing";
  const turnSide = (displayFen ?? step.fen ?? "w").split(" ")[1] === "b" ? "Black" : "White";
  const turnCue = solvable && !tapMode ? `💡 ${turnSide} to move · find the fork` : undefined;

  const arrowColor = colors.accent;
  const hintArrows =
    hintLevel >= 3 && solvable && step.solution?.[0]
      ? [{ startSquare: step.solution[0].split(":")[0]!, endSquare: step.solution[0].split(":")[1]!, color: arrowColor }]
      : [];
  const mergedArrows = [...(boardArrows ?? []), ...hintArrows];

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <PremiumLessonHeader progressPct={progressPct} onClose={onClose} />
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: horizontalPad,
          paddingBottom: space["4"],
          flexGrow: 1,
          maxWidth: MAX_BOARD,
          width: "100%",
          alignSelf: "center",
        }}
        keyboardShouldPersistTaps="handled"
      >
        <PremiumLessonCoachSection
          badge={badgeText}
          title={title}
          coachLine={coachLine}
          coachCharacter={coachCharacter}
          mood={mood}
        />

        <View style={{ flexGrow: 1, justifyContent: "center", alignItems: "center", marginTop: space["3"], gap: space["3"] }}>
          {whyQuiz && step.fen && step.options ? (
            <PremiumWhyQuizPanel
              key={`${step.id}-${phase}`}
              fen={step.fen}
              options={step.options}
              correctIndex={step.correct ?? 0}
              arrows={step.arrows}
              highlights={step.highlight}
              boardSize={boardSize}
              onSubmit={onQuizSubmit}
            />
          ) : step.fen ? (
            <>
              <ChessBoard
                fen={displayFen ?? step.fen}
                size={boardSize}
                orientation={(step.orientation ?? "white") === "black" ? (flipped ? "white" : "black") : flipped ? "black" : "white"}
                onMove={onMove}
                interactive={step.kind === "move" && phase === "playing" && !tapMode}
                showNotation
                lastMove={lastMove}
                arrows={mergedArrows}
                highlights={boardHighlights}
                highlightFiles={boardHighlightFiles}
                highlightRanks={boardHighlightRanks}
                successSquare={phase === "correct" ? lastMove?.to ?? null : null}
                checkSquare={phase === "wrong" ? lastMove?.to ?? null : null}
                tappedSquares={tapMode ? tappedSquares : undefined}
                onSquareTap={tapMode && phase === "playing" ? onSquareTap : undefined}
                tapSelectionColor={colors.brand50}
                tapSelectionBorder={colors.brand}
              />
              {tapMode ? (
                <Text style={{ fontFamily: font.displaySemibold, fontSize: type.sm.fontSize, color: colors.ink500 }}>
                  <Text style={{ fontFamily: font.displayBold, color: colors.ink }}>{tappedSquares.length}</Text>
                  {` of ${step.solution?.length ?? 0} squares selected`}
                </Text>
              ) : null}
            </>
          ) : null}
        </View>

        {!showFeedback && step.kind === "move" && solvable && hintsEnabled && hintLevel === 0 ? (
          <PremiumLessonHintSection
            hintLevel={hintLevel}
            onHintPress={onHint}
            turnCue={turnCue}
            showCheck={tapMode}
            checkDisabled={tapMode && tappedSquares.length === 0}
            onCheck={onTapCheck}
          />
        ) : null}

        {!showFeedback && hintLevel > 0 && step.kind === "move" ? (
          <PremiumLessonHintSection
            hintLevel={hintLevel}
            onHintPress={onHint}
            showCheck={tapMode}
            checkDisabled={tapMode && tappedSquares.length === 0}
            onCheck={onTapCheck}
          />
        ) : null}
      </ScrollView>

      {showFeedback ? (
        phase === "correct" ? (
          <PremiumLessonFeedbackBar
            variant="correct"
            title={correctBarTitle(coachCharacter, step.successText ?? "Nice work!")}
            body={step.successText ?? "Correct!"}
            xpDelta={lessonDisplayXp(1)}
            onContinue={onContinueCorrect}
          />
        ) : (
          <PremiumLessonFeedbackBar
            variant="wrong"
            title="Not quite"
            body={step.failText ?? "Try again — look for a move that hits two targets at once."}
            onTryAgain={onTryAgain}
            onShowMe={hintsEnabled ? onShowHint : undefined}
          />
        )
      ) : showIntroCta ? (
        <View style={{ paddingHorizontal: space["4"] + horizontalPad, paddingBottom: space["4"] }}>
          <KitButton
            label={step.kind === "observe" && !observeReady ? "Watching…" : advancing ? "Loading…" : step.kind === "info" ? "Got it" : "Continue"}
            disabled={advancing || (step.kind === "observe" && !observeReady)}
            onPress={onContinueIntro}
          />
        </View>
      ) : tapMode && phase === "playing" ? (
        <View
          style={{
            flexDirection: "row",
            gap: space["2"],
            paddingHorizontal: space["4"] + horizontalPad,
            paddingBottom: space["4"],
            maxWidth: MAX_BOARD + horizontalPad * 2,
            alignSelf: "center",
            width: "100%",
          }}
        >
          <View style={{ flex: 1 }}>
            <KitButton label="Clear" variant="ghost" onPress={onTapClear} block />
          </View>
          <View style={{ flex: 2 }}>
            <KitButton label="Check" disabled={tappedSquares.length === 0} onPress={onTapCheck} block />
          </View>
        </View>
      ) : null}
    </View>
  );
}

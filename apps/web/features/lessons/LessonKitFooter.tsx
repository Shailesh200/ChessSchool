"use client";

import { KitLottie } from "@/components/motion/KitLottie";

export function LessonKitFooter({
  phase,
  stepKind,
  observeReady,
  playing,
  quizReady,
  solvable,
  exam,
  successTitle,
  successWhy,
  failTitle,
  failWhy,
  onContinue,
  onShowHint,
  onTryAgain,
}: {
  phase: "playing" | "correct" | "wrong";
  stepKind: string;
  observeReady: boolean;
  playing: boolean;
  quizReady?: boolean;
  solvable: boolean;
  exam?: boolean;
  successTitle: string;
  successWhy: string;
  failTitle: string;
  failWhy: string;
  onContinue: () => void;
  onShowHint: () => void;
  onTryAgain: () => void;
}) {
  const showInfoContinue =
    playing && (stepKind === "info" || (stepKind === "observe" && observeReady));
  const showQuizContinue = Boolean(quizReady);
  const showQuizWrong = phase === "wrong" && stepKind === "quiz";
  const showMoveCorrect = phase === "correct" && stepKind === "move";
  const showMoveWrong = phase === "wrong" && stepKind === "move";
  const showDrillBar =
    playing && solvable && stepKind === "move" && !showMoveCorrect && !showMoveWrong;

  if (showMoveCorrect) {
    return (
      <div className="lesson-stage-footer-inner" data-testid="lesson-fbar-correct">
        <KitLottie id="xp-pop" className="xp-lot" />
        <div className="cs-fbar" role="status">
          <div className="cs-fbar__head">
            <span className="cs-fbar__icon lot-ic">
              <KitLottie id="success-burst" className="absolute inset-0 h-full w-full" />
              <span className="ic-fallback">
                <svg className="cs-ic" viewBox="0 0 24 24" aria-hidden style={{ strokeWidth: 3 }}>
                  <path d="M20 6 9 17l-5-5" />
                </svg>
              </span>
            </span>
            <div>
              <span className="cs-fbar__title">{successTitle}</span>
              {successWhy ? <span className="cs-fbar__why">{successWhy}</span> : null}
            </div>
          </div>
          <div className="btns">
            <button type="button" className="cs-btn" onClick={onContinue}>
              Continue
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (showMoveWrong) {
    return (
      <div className="lesson-stage-footer-inner" data-testid="lesson-fbar-wrong">
        <div className="cs-fbar cs-fbar--wrong" role="status">
          <div className="cs-fbar__head">
            <span className="cs-fbar__icon lot-ic">
              <KitLottie id="error-shake" className="absolute inset-0 h-full w-full" />
              <span className="ic-fallback">
                <svg className="cs-ic" viewBox="0 0 24 24" aria-hidden style={{ strokeWidth: 3 }}>
                  <path d="M18 6 6 18" />
                  <path d="m6 6 12 12" />
                </svg>
              </span>
            </span>
            <div>
              <span className="cs-fbar__title">{failTitle}</span>
              {failWhy ? <span className="cs-fbar__why">{failWhy}</span> : null}
            </div>
          </div>
          <div className="btns">
            <button type="button" className="cs-btn" onClick={onTryAgain}>
              Try again
            </button>
            {!exam ? (
              <button type="button" className="cs-btn cs-btn--soft" onClick={onShowHint}>
                Show me
              </button>
            ) : null}
          </div>
        </div>
      </div>
    );
  }

  if (showQuizWrong) {
    return (
      <div className="lesson-stage-footer-inner" data-testid="lesson-fbar-wrong">
        <div className="cs-fbar cs-fbar--wrong" role="status">
          <div className="cs-fbar__head">
            <span className="cs-fbar__icon lot-ic">
              <KitLottie id="error-shake" className="absolute inset-0 h-full w-full" />
              <span className="ic-fallback">
                <svg className="cs-ic" viewBox="0 0 24 24" aria-hidden style={{ strokeWidth: 3 }}>
                  <path d="M18 6 6 18" />
                  <path d="m6 6 12 12" />
                </svg>
              </span>
            </span>
            <div>
              <span className="cs-fbar__title">{failTitle}</span>
              {failWhy ? <span className="cs-fbar__why">{failWhy}</span> : null}
            </div>
          </div>
          <div className="btns">
            <button type="button" className="cs-btn" onClick={onTryAgain}>
              Try again
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (showInfoContinue || showQuizContinue) {
    const intro = stepKind === "info";
    return (
      <div className="lesson-stage-footer-inner">
        <div className="cs-actionbar">
          <div className="btns">
            <button
              type="button"
              className="cs-btn"
              onClick={onContinue}
              data-testid={intro ? "lesson-got-it" : undefined}
            >
              {intro ? "Got it" : "Continue"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (showDrillBar) {
    return (
      <div className="lesson-stage-footer-inner" data-testid="lesson-drill-bar">
        <div className="cs-actionbar">
          <div className="btns">
            <button type="button" className="cs-btn" disabled>
              Check
            </button>
          </div>
        </div>
      </div>
    );
  }

  return <div className="lesson-stage-footer-inner" aria-hidden />;
}

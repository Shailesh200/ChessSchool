/**
 * Pure layout maths for board screens (lesson player, and the board fit used by
 * play/game). No React Native imports so it runs under vitest.
 *
 * Root cause of the lesson-player P0s (UI-M-003/004/005/017/018): the board was a
 * fixed square (width - 16, up to 470) inside a non-scrolling column, and the coach
 * bubble, hint bar and CTA were siblings that simply overflowed/overlapped it when
 * the screen was short (SE, 200% font, landscape). Now the screen is a flow layout:
 *  - the body is ALWAYS a ScrollView (nothing can be clipped or unreachable),
 *  - the coach bubble has a maxHeight and scrolls inside,
 *  - the board is sized from the space that is really left (never below BOARD_MIN),
 *  - the hint bar is a normal-flow sibling under the board, never over it,
 *  - landscape puts the board and the panel side by side.
 */
export const BOARD_MIN = 200;
export const BOARD_MAX = 470;
export const SIDE_PAD = 8;
/** Coach bubble may take at most this share of the body height (portrait). */
export const BUBBLE_MAX_SHARE = 0.3;
/** Header (back/progress/buttons) height estimate before the body is measured. */
export const HEADER_ESTIMATE = 56;
/** Footer CTA height estimate at font scale 1, before the body is measured. */
export const FOOTER_ESTIMATE = 76;

export type LessonLayoutInput = {
  windowWidth: number;
  windowHeight: number;
  /** OS font scale (PixelRatio.getFontScale / useWindowDimensions().fontScale). */
  fontScale: number;
  /** Measured body (scroll area) size once onLayout has fired. */
  bodyWidth?: number;
  bodyHeight?: number;
  /** false for quiz steps: no board, so landscape stays single column. */
  hasBoard?: boolean;
};

export type LessonLayout = {
  landscape: boolean;
  sideBySide: boolean;
  boardSize: number;
  bubbleMaxHeight: number;
  /** Width of the right-hand panel when side by side, else the body width. */
  panelWidth: number;
  /** Always true: the body must scroll so no control is ever unreachable. */
  scrollable: true;
};

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

export function computeLessonLayout(input: LessonLayoutInput): LessonLayout {
  const { windowWidth, windowHeight } = input;
  const fontScale = clamp(input.fontScale || 1, 1, 4);
  const hasBoard = input.hasBoard !== false;
  const landscape = windowWidth > windowHeight;
  const availW = input.bodyWidth ?? windowWidth;
  const availH =
    input.bodyHeight ??
    Math.max(
      0,
      windowHeight -
        HEADER_ESTIMATE -
        Math.round(FOOTER_ESTIMATE * Math.min(fontScale, 2)),
    );
  const sideBySide = landscape && hasBoard;

  if (sideBySide) {
    // Board column also holds the "White to move" row above the board.
    const byHeight = availH - SIDE_PAD * 2 - Math.ceil(28 * fontScale);
    const boardSize = Math.max(
      Math.min(BOARD_MIN, byHeight),
      Math.min(byHeight, BOARD_MAX, Math.round(availW * 0.55)),
    );
    return {
      landscape,
      sideBySide,
      boardSize,
      bubbleMaxHeight: Math.max(80, Math.round(availH * 0.5)),
      panelWidth: Math.max(0, availW - boardSize - SIDE_PAD * 3),
      scrollable: true,
    };
  }

  const bubbleMaxHeight = Math.max(96, Math.round(availH * BUBBLE_MAX_SHARE));
  // Row with "White to move" + gaps, grows with font scale.
  const reserve = Math.ceil(36 * fontScale) + 16;
  const byWidth = Math.min(availW - SIDE_PAD * 2, BOARD_MAX);
  const byHeight = availH - bubbleMaxHeight - reserve;
  const boardSize = hasBoard
    ? Math.max(Math.min(BOARD_MIN, byWidth), Math.min(byWidth, byHeight))
    : byWidth;
  return {
    landscape,
    sideBySide: false,
    boardSize,
    bubbleMaxHeight,
    panelWidth: availW,
    scrollable: true,
  };
}

/**
 * Board edge for screens with a fixed stack around the board (play/game: two
 * player bars, scrubber). `reserved` is everything else that must fit in `availH`.
 * Never below BOARD_MIN (the screen scrolls instead of shrinking the board).
 */
export function fitBoardSize(opts: {
  availW: number;
  availH: number;
  reserved: number;
  max?: number;
  sidePad?: number;
}): number {
  const max = opts.max ?? BOARD_MAX;
  const byWidth = Math.min(opts.availW - (opts.sidePad ?? SIDE_PAD * 2), max);
  const byHeight = opts.availH - opts.reserved;
  return Math.max(Math.min(BOARD_MIN, byWidth), Math.min(byWidth, byHeight));
}

/** Style objects derived from a layout. Pure, so they are unit tested. */
export function lessonStageStyles(l: LessonLayout) {
  return {
    root: { flex: 1 } as const,
    /** Portrait/column body: the ScrollView that keeps everything reachable. */
    scroll: { flex: 1 } as const,
    scrollContent: { paddingBottom: SIDE_PAD * 2, gap: SIDE_PAD } as const,
    /** Landscape: board column + panel column. */
    sideRow: { flex: 1, flexDirection: "row" as const },
    boardCol: {
      width: l.boardSize + SIDE_PAD * 2,
      paddingLeft: SIDE_PAD,
      justifyContent: "center" as const,
      alignItems: "center" as const,
    },
    panelCol: { flex: 1, minWidth: 0 },
    /** Board slot is in normal flow (never absolute), sized to the board. */
    boardSlot: { alignItems: "center" as const, justifyContent: "center" as const },
  };
}

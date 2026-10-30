import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  BOARD_MAX,
  BOARD_MIN,
  SIDE_PAD,
  computeLessonLayout,
  fitBoardSize,
  lessonStageStyles,
} from "./lessonLayout";

// [width, height] in dp. Portrait phones then landscape.
const PORTRAIT: Array<[number, number]> = [
  [320, 568],
  [360, 640],
  [375, 667],
  [390, 844],
  [430, 932],
];
const LANDSCAPE: Array<[number, number]> = [
  [844, 390],
  [667, 375],
  [640, 360],
  [932, 430],
];
const SCALES = [1, 1.3, 2];

// Body is the window minus a 56dp header; the portrait footer (CTA) is ~76dp * fontScale.
function bodyOf(w: number, h: number, fontScale: number, landscape: boolean) {
  const footer = landscape ? 0 : Math.round(76 * Math.min(fontScale, 2));
  return { bodyWidth: w, bodyHeight: h - 56 - footer };
}

describe("computeLessonLayout: lesson player geometry (UI-M-003/004/005/017/018)", () => {
  for (const scale of SCALES) {
    for (const [w, h] of PORTRAIT) {
      it(`UI-M-003 portrait ${w}x${h} @ fontScale ${scale}: scrolls, bubble capped, board visible above the fold`, () => {
        const body = bodyOf(w, h, scale, false);
        const l = computeLessonLayout({
          windowWidth: w,
          windowHeight: h,
          fontScale: scale,
          ...body,
        });
        expect(l.scrollable).toBe(true);
        expect(l.sideBySide).toBe(false);
        // UI-M-003: bubble can never take over the screen.
        expect(l.bubbleMaxHeight).toBeLessThanOrEqual(
          Math.max(96, Math.round(body.bodyHeight * 0.3)),
        );
        expect(l.bubbleMaxHeight).toBeLessThan(body.bodyHeight * 0.5);
        // Board: square, within width, never tiny.
        expect(l.boardSize).toBeGreaterThanOrEqual(
          Math.min(BOARD_MIN, w - SIDE_PAD * 2),
        );
        expect(l.boardSize).toBeLessThanOrEqual(Math.min(w - SIDE_PAD * 2, BOARD_MAX));
        // Board is visible: bubble cap + board fits in the visible body (the hint bar
        // follows in flow below, reachable by scrolling, never over the board).
        expect(l.bubbleMaxHeight + l.boardSize).toBeLessThanOrEqual(body.bodyHeight);
      });
    }
    for (const [w, h] of LANDSCAPE) {
      it(`UI-M-018 landscape ${w}x${h} @ fontScale ${scale}: board and panel side by side, board fits height`, () => {
        const body = bodyOf(w, h, scale, true);
        const l = computeLessonLayout({
          windowWidth: w,
          windowHeight: h,
          fontScale: scale,
          ...body,
        });
        expect(l.landscape).toBe(true);
        expect(l.sideBySide).toBe(true);
        expect(l.scrollable).toBe(true);
        expect(l.boardSize).toBeGreaterThanOrEqual(BOARD_MIN);
        // Board column + panel never exceed the width (no horizontal overflow).
        expect(l.boardSize + SIDE_PAD * 3 + l.panelWidth).toBeLessThanOrEqual(w);
        expect(l.panelWidth).toBeGreaterThanOrEqual(240);
        // Board never taller than the body (it would be cut off otherwise).
        expect(l.boardSize).toBeLessThanOrEqual(body.bodyHeight);
        expect(l.bubbleMaxHeight).toBeLessThanOrEqual(body.bodyHeight * 0.5 + 1);
      });
    }
  }

  it("UI-M-003 falls back to estimated chrome before the body is measured (no NaN, still capped)", () => {
    const l = computeLessonLayout({
      windowWidth: 390,
      windowHeight: 844,
      fontScale: 2,
    });
    expect(Number.isFinite(l.boardSize)).toBe(true);
    expect(l.boardSize).toBeGreaterThanOrEqual(BOARD_MIN);
    expect(l.bubbleMaxHeight).toBeLessThan(844 * 0.5);
  });

  it("UI-M-005 quiz steps (no board) stay single column in landscape and keep the bubble capped", () => {
    const l = computeLessonLayout({
      windowWidth: 844,
      windowHeight: 390,
      fontScale: 1,
      bodyWidth: 844,
      bodyHeight: 258,
      hasBoard: false,
    });
    expect(l.sideBySide).toBe(false);
    expect(l.scrollable).toBe(true);
    expect(l.bubbleMaxHeight).toBeLessThan(258 * 0.5);
  });
});

describe("lessonStageStyles", () => {
  it("UI-M-003/UI-M-004 caps the bubble, keeps the board slot in flow, and lays landscape out as a row", () => {
    const l = computeLessonLayout({
      windowWidth: 844,
      windowHeight: 390,
      fontScale: 2,
      bodyWidth: 844,
      bodyHeight: 334,
    });
    const s = lessonStageStyles(l);
    expect("bubbleCap" in s).toBe(false);
    expect(s.sideRow.flexDirection).toBe("row");
    expect(s.boardCol.width).toBe(l.boardSize + SIDE_PAD * 2);
    expect(JSON.stringify(s)).not.toContain('"absolute"');
  });
});

describe("fitBoardSize (play/game, UI-M-017)", () => {
  it("UI-M-017 shrinks the board so players + board + scrubber fit, but not below BOARD_MIN", () => {
    expect(
      fitBoardSize({ availW: 375, availH: 420, reserved: 150, max: 440, sidePad: 24 }),
    ).toBe(270);
    expect(
      fitBoardSize({ availW: 375, availH: 200, reserved: 150, max: 440, sidePad: 24 }),
    ).toBe(BOARD_MIN);
    expect(
      fitBoardSize({ availW: 375, availH: 900, reserved: 150, max: 440, sidePad: 24 }),
    ).toBe(351);
  });
});

// There is no React Native renderer under vitest here (node env), so the screens'
// wiring is pinned at source level: reverting the fix makes these fail.
describe("screen wiring", () => {
  const lesson = readFileSync(resolve(__dirname, "../app/lesson/[id].tsx"), "utf8");
  const game = readFileSync(resolve(__dirname, "../app/play/game.tsx"), "utf8");
  const stage = readFileSync(resolve(__dirname, "./LessonStageLayout.tsx"), "utf8");

  it("UI-M-003 lesson screen renders through the shared LessonStageLayout, not a fixed-size column", () => {
    expect(lesson).toContain("<LessonStageLayout");
    expect(lesson).toContain("layout.boardSize");
    expect(lesson).toContain("maxHeight: layout.bubbleMaxHeight");
    expect(lesson).not.toMatch(/Math\.min\(width - 16, 470\)/);
    expect(lesson).not.toContain("boardWrap");
  });

  it("UI-M-004 hint bar is in normal flow (never absolutely positioned over the board)", () => {
    const hintBar = lesson.match(/hintBar: \{[\s\S]*?\n    \},/)?.[0] ?? "";
    expect(hintBar).toContain("marginHorizontal");
    expect(hintBar).not.toContain("absolute");
    // The hint is passed as a flow sibling after the board slot.
    expect(stage.lastIndexOf("lesson-board-slot")).toBeLessThan(
      stage.lastIndexOf("{hint}"),
    );
  });

  it("UI-M-005/UI-M-018 stage layout has a scroll container and landscape side-by-side", () => {
    expect(stage).toContain('testID="lesson-scroll"');
    expect(stage).toContain("<ScrollView");
    expect(stage).toContain("layout.sideBySide");
    expect(stage).not.toContain("absolute");
  });

  it("UI-M-005 footer CTA / move cue is an in-flow sibling after the scroller, not an overlay", () => {
    expect(stage.indexOf("<ScrollView")).toBeLessThan(stage.indexOf("{footer}"));
    expect(stage).not.toContain("absolute");
    expect(lesson).not.toMatch(
      /position: "absolute"[\s\S]{0,120}(cta|moveCue|footer)/i,
    );
  });

  it("UI-M-003 lesson screen passes hasBoard (quiz = no board) and the hint to the stage, with the CTA as footer", () => {
    const stageOpen = lesson.indexOf("<LessonStageLayout");
    expect(stageOpen).toBeGreaterThan(-1);
    const stageJsx = lesson.slice(stageOpen);
    expect(stageJsx).toContain('hasBoard={step.kind !== "quiz"}');
    // Props are passed in this order; each must be a real prop of the stage element.
    const idx = [
      "header={",
      "coach={(layout)",
      "board={(layout)",
      "hint={",
      "footer={",
    ].map((p) => stageJsx.indexOf(p));
    expect(idx.every((i) => i > -1)).toBe(true);
    expect([...idx].sort((a, b) => a - b)).toEqual(idx);
    // hint prop renders the hint bar for non-quiz steps; footer holds the CTA / move cue.
    const hintProp = stageJsx.slice(idx[3], idx[4]);
    expect(hintProp).toContain("styles.hintBar");
    expect(hintProp).toContain('step.kind !== "quiz"');
    const footerProp = stageJsx.slice(idx[4]);
    expect(footerProp).toContain("styles.bottom");
    expect(footerProp).toContain('label={advancing || resolvingNext ? "Loading…"');
    // The board gets the measured size from the stage layout, never a local constant.
    expect(stageJsx.slice(idx[2], idx[3])).toContain("size={layout.boardSize}");
  });

  it("BOARD_MIN floor stays 200 (a 120 floor would let the board collapse)", () => {
    expect(BOARD_MIN).toBe(200);
    expect(BOARD_MAX).toBe(470);
  });

  it("UI-M-017 play/game: board is fed the MEASURED stage height with a non-zero font-scaled reserve", () => {
    const fit = game.match(/fitBoardSize\(\{[\s\S]*?\}\);/)?.[0] ?? "";
    expect(fit).toMatch(/availW:\s*stage\?\.w\s*\?\?\s*width/);
    expect(fit).toMatch(/availH:\s*stage\?\.h\s*\?\?\s*Number\.POSITIVE_INFINITY/);
    const reserved = fit.match(/reserved:\s*([^\n]*?),\n/)?.[1] ?? "";
    expect(reserved.length).toBeGreaterThan(0);
    expect(reserved).not.toMatch(/^0\b/);
    expect(reserved).toContain("fontScale");
    expect(reserved).toMatch(/\b56\b/);
    expect(fit).toMatch(/max:\s*440/);
    expect(game).toMatch(
      /const \[stage, setStage\] = useState<\{ w: number; h: number \} \| null>\(null\)/,
    );
    expect(game).toMatch(/const \{ width, fontScale \} = useWindowDimensions\(\)/);
    expect(game).not.toMatch(/Math\.min\(width - 24, 440\)/);
  });

  it("UI-M-017 play/game: the middle region is a game-scroll ScrollView whose onLayout feeds setStage, wrapping bars + board", () => {
    const open = game.indexOf("<ScrollView");
    const close = game.indexOf("</ScrollView>");
    expect(open).toBeGreaterThan(-1);
    expect(close).toBeGreaterThan(open);
    const scroller = game.slice(open, close);
    const openTag = scroller.slice(0, scroller.indexOf("\n      >") + 1 || undefined);
    expect(openTag).toContain('testID="game-scroll"');
    expect(openTag).toMatch(
      /onLayout=\{\(e\) => \{[\s\S]*nativeEvent\.layout[\s\S]*setStage\(/,
    );
    expect(openTag).toContain("flex: 1");
    // Both player bars and the board live inside the scroller; the scrubber stays outside, after it.
    expect((scroller.match(/<PlayerBar/g) ?? []).length).toBe(2);
    expect(scroller).toContain("<ChessBoard");
    expect(scroller).toContain("width: boardSize, height: boardSize");
    expect(game.indexOf("styles.scrubber")).toBeGreaterThan(close);
    // Only one ScrollView in the screen: the old non-scrolling View column is gone.
    expect((game.match(/<ScrollView/g) ?? []).length).toBe(1);
    expect(game).toMatch(/import \{[^}]*\bScrollView\b[^}]*\} from "react-native"/);
    expect(game).toContain('import { fitBoardSize } from "@/lessonLayout"');
  });
});

import { createElement, type ReactElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Behavioural test of LessonStageLayout (UI-M-003/004/005). There is no React Native
// renderer under vitest (node env), so react-native is replaced by string host
// components and useState by a controllable cell. The component function is then
// called directly and the element tree it returns is inspected: structure, ordering,
// the onLayout handlers, and the layout object handed to coach/board.
const dims = { width: 390, height: 844, fontScale: 1 };
let bodyState: { w: number; h: number } | null = null;
const setBody = vi.fn();

vi.mock("react-native", () => ({
  View: "View",
  ScrollView: "ScrollView",
  useWindowDimensions: () => dims,
}));
vi.mock("react", async (orig) => {
  const actual = await orig<typeof import("react")>();
  return { ...actual, useState: () => [bodyState, setBody] };
});

import { LessonStageLayout } from "./LessonStageLayout";
import { computeLessonLayout, type LessonLayout } from "./lessonLayout";

type El = ReactElement<{
  children?: ReactNode;
  testID?: string;
  scrollEnabled?: boolean;
  onLayout?: (e: unknown) => void;
}>;

function kids(el: El): El[] {
  const c = el.props.children;
  const arr = Array.isArray(c) ? c.flat(Infinity) : [c];
  return arr.filter(
    (x): x is El => !!x && typeof x === "object" && "props" in (x as object),
  );
}
function find(el: El, testID: string): El | null {
  if (el.props?.testID === testID) return el;
  for (const k of kids(el)) {
    const hit = find(k, testID);
    if (hit) return hit;
  }
  return null;
}
function contains(el: El, target: El): boolean {
  return el === target || kids(el).some((k) => contains(k, target));
}

const header = createElement("Header") as El;
const hint = createElement("Hint") as El;
const footer = createElement("Footer") as El;

function render(opts: {
  w?: number;
  h?: number;
  fontScale?: number;
  hasBoard?: boolean;
  omitHasBoard?: boolean;
  scrollEnabled?: boolean;
  body?: { w: number; h: number } | null;
}) {
  dims.width = opts.w ?? 390;
  dims.height = opts.h ?? 844;
  dims.fontScale = opts.fontScale ?? 1;
  bodyState = opts.body ?? null;
  const seen: LessonLayout[] = [];
  const coach = createElement("Coach") as El;
  const board = createElement("Board") as El;
  const props: Record<string, unknown> = {
    header,
    hint,
    footer,
    coach: (l: LessonLayout) => (seen.push(l), coach),
    board: (l: LessonLayout) => (seen.push(l), board),
  };
  if (opts.scrollEnabled !== undefined) props.scrollEnabled = opts.scrollEnabled;
  if (!opts.omitHasBoard) props.hasBoard = opts.hasBoard ?? true;
  const root = (LessonStageLayout as unknown as (p: unknown) => El)(props);
  return { root, coach, board, layout: seen[seen.length - 1] };
}

beforeEach(() => {
  setBody.mockClear();
  bodyState = null;
});

describe("LessonStageLayout portrait (UI-M-003/004/005)", () => {
  it("UI-M-003 body is the lesson-scroll ScrollView, between header and footer, with an onLayout measurer", () => {
    const { root } = render({});
    const parts = kids(root);
    const scroller = find(root, "lesson-scroll")!;
    expect(scroller).toBeTruthy();
    expect(scroller.type).toBe("ScrollView");
    expect(typeof scroller.props.onLayout).toBe("function");
    expect(parts[0]).toBe(header);
    expect(parts[1]).toBe(scroller);
    expect(parts[2]).toBe(footer);
  });

  it("UI-M-005 footer is an in-flow sibling AFTER the scroller, never inside it", () => {
    const { root } = render({});
    const scroller = find(root, "lesson-scroll")!;
    expect(contains(scroller, footer)).toBe(false);
    expect(contains(scroller, header)).toBe(false);
    expect(kids(root).indexOf(footer)).toBeGreaterThan(kids(root).indexOf(scroller));
  });

  it("UI-M-004 scroller order is coach, board slot (holding the board), then the hint, all inside the scroller", () => {
    const { root, coach, board } = render({});
    const scroller = find(root, "lesson-scroll")!;
    const slot = find(root, "lesson-board-slot")!;
    const order = kids(scroller);
    expect(order[0]).toBe(coach);
    expect(order[1]).toBe(slot);
    expect(order[2]).toBe(hint);
    expect(kids(slot)).toEqual([board]);
  });

  it("UI-M-003 onLayout of the scroller stores the measured body and the layout then uses it", () => {
    const { root } = render({ fontScale: 1 });
    const scroller = find(root, "lesson-scroll")!;
    scroller.props.onLayout!({ nativeEvent: { layout: { width: 390, height: 300 } } });
    expect(setBody).toHaveBeenCalledTimes(1);
    const updater = setBody.mock.calls[0][0] as (
      p: { w: number; h: number } | null,
    ) => unknown;
    expect(updater(null)).toEqual({ w: 390, h: 300 });
    const same = { w: 390, h: 300 };
    expect(updater(same)).toBe(same);

    const estimated = render({ fontScale: 1 }).layout;
    const measured = render({ fontScale: 1, body: { w: 390, h: 300 } }).layout;
    expect(measured).toEqual(
      computeLessonLayout({
        windowWidth: 390,
        windowHeight: 844,
        fontScale: 1,
        bodyWidth: 390,
        bodyHeight: 300,
      }),
    );
    expect(measured.bubbleMaxHeight).not.toBe(estimated.bubbleMaxHeight);
    expect(measured.boardSize).not.toBe(estimated.boardSize);
  });

  it("UI-M-003 the OS font scale reaches computeLessonLayout (200% text shrinks the board budget)", () => {
    const one = render({ fontScale: 1 }).layout;
    const two = render({ fontScale: 2 }).layout;
    expect(one).toEqual(
      computeLessonLayout({ windowWidth: 390, windowHeight: 844, fontScale: 1 }),
    );
    expect(two).toEqual(
      computeLessonLayout({ windowWidth: 390, windowHeight: 844, fontScale: 2 }),
    );
    expect(two).not.toEqual(one);
    // With a measured body the font scale still drives the board reserve.
    const body = { w: 390, h: 500 };
    expect(render({ fontScale: 2, body }).layout.boardSize).toBeLessThan(
      render({ fontScale: 1, body }).layout.boardSize,
    );
  });

  it("UI-M-005 quiz steps (hasBoard=false) stay a single column even in landscape; hasBoard defaults to true", () => {
    const quiz = render({ w: 844, h: 390, hasBoard: false });
    expect(find(quiz.root, "lesson-side-row")).toBeNull();
    expect(find(quiz.root, "lesson-scroll")).toBeTruthy();
    expect(quiz.layout.sideBySide).toBe(false);

    const lessonStep = render({ w: 844, h: 390, hasBoard: true });
    expect(find(lessonStep.root, "lesson-side-row")).toBeTruthy();
    expect(lessonStep.layout.sideBySide).toBe(true);

    const dflt = render({ w: 844, h: 390, omitHasBoard: true });
    expect(find(dflt.root, "lesson-side-row")).toBeTruthy();
  });

  it("UI-M-005 hasBoard=false in portrait gives the full-width slot (no board budget taken)", () => {
    const quiz = render({ hasBoard: false }).layout;
    const withBoard = render({ hasBoard: true }).layout;
    expect(quiz).toEqual(
      computeLessonLayout({
        windowWidth: 390,
        windowHeight: 844,
        fontScale: 1,
        hasBoard: false,
      }),
    );
    expect(quiz.boardSize).toBeGreaterThanOrEqual(withBoard.boardSize);
  });
});

describe("LessonStageLayout landscape side by side (UI-M-018)", () => {
  it("board column left, panel scroller + footer on the right, onLayout on the row", () => {
    const { root, board, coach } = render({ w: 844, h: 390 });
    const row = find(root, "lesson-side-row")!;
    expect(typeof row.props.onLayout).toBe("function");
    const [boardCol, panel] = kids(row);
    expect(boardCol.props.testID).toBe("lesson-board-col");
    expect(kids(boardCol)).toEqual([board]);
    const scroller = find(panel, "lesson-scroll")!;
    expect(scroller.type).toBe("ScrollView");
    expect(kids(scroller)).toEqual([coach, hint]);
    expect(contains(scroller, footer)).toBe(false);
    expect(kids(panel).indexOf(footer)).toBeGreaterThan(kids(panel).indexOf(scroller));
  });
});

describe("LessonStageLayout scroll lock while a piece is dragged (Android fallback)", () => {
  it("scrollEnabled defaults to true and maps false/true onto the body ScrollView (portrait)", () => {
    expect(find(render({}).root, "lesson-scroll")!.props.scrollEnabled).toBe(true);
    expect(find(render({ scrollEnabled: false }).root, "lesson-scroll")!.props.scrollEnabled).toBe(false);
    expect(find(render({ scrollEnabled: true }).root, "lesson-scroll")!.props.scrollEnabled).toBe(true);
  });

  it("the landscape panel ScrollView honours it too", () => {
    expect(
      find(render({ w: 844, h: 390, scrollEnabled: false }).root, "lesson-scroll")!.props.scrollEnabled,
    ).toBe(false);
    expect(
      find(render({ w: 844, h: 390 }).root, "lesson-scroll")!.props.scrollEnabled,
    ).toBe(true);
  });
});

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { createBoardPanConfig, type BoardPanEvent } from "./boardPan";

type Cell = { type: string; color: "w" | "b" } | null;

function setup(opts: { interactive?: boolean; piece?: Cell; noCallback?: boolean } = {}) {
  const piece: Cell =
    "piece" in opts ? (opts.piece ?? null) : { type: "p", color: "w" };
  const calls = {
    dragFrom: [] as Array<string | null>,
    dragXY: [] as unknown[],
    moves: [] as string[],
    dragActive: [] as boolean[],
  };
  const d = {
    dragRef: { current: null as { from: string; piece: Cell } | null },
    movedRef: { current: false },
    startXYRef: { current: null as { x: number; y: number } | null },
    sqAtRef: {
      current: (x: number, y: number) => (y < 50 ? "e2" : "e4") as string | null,
    },
    pieceAtRef: { current: (_sq: string) => piece },
    tapRef: { current: (_sq: string, _p: Cell) => {} },
    tryMoveRef: {
      current: (from: string, to: string) => void calls.moves.push(`${from}${to}`),
    },
    interactiveRef: { current: opts.interactive ?? true },
    onDragActiveChangeRef: {
      current: opts.noCallback ? undefined : (a: boolean) => void calls.dragActive.push(a),
    },
    setDragFrom: (sq: string | null) => void calls.dragFrom.push(sq),
    setDragXY: (xy: unknown) => void calls.dragXY.push(xy),
    setSelected: (_sq: string | null) => {},
  };
  return { pan: createBoardPanConfig<Cell>(d), d, calls };
}
const at = (x: number, y: number): BoardPanEvent => ({
  nativeEvent: { locationX: x, locationY: y },
});

describe("ChessBoard pan responder vs the lesson ScrollView (UI-M-003 drag fix)", () => {
  it("refuses a termination request while a piece drag is active, so the ScrollView cannot steal a vertical drag", () => {
    const { pan } = setup();
    pan.onPanResponderGrant(at(10, 10));
    expect(pan.onPanResponderTerminationRequest()).toBe(false);
    // still refused after the finger has moved far enough to start the ghost
    pan.onPanResponderMove(at(10, 80));
    expect(pan.onPanResponderTerminationRequest()).toBe(false);
  });

  it("allows termination again once the drag is released or terminated", () => {
    const a = setup();
    a.pan.onPanResponderGrant(at(10, 10));
    a.pan.onPanResponderMove(at(10, 80));
    a.pan.onPanResponderRelease(at(10, 80));
    expect(a.pan.onPanResponderTerminationRequest()).toBe(true);
    expect(a.calls.moves).toEqual(["e2e4"]);
    const b = setup();
    b.pan.onPanResponderGrant(at(10, 10));
    b.pan.onPanResponderTerminate();
    expect(b.pan.onPanResponderTerminationRequest()).toBe(true);
  });

  it("does not block scrolling when the touch is not a piece drag (empty square or non-interactive board)", () => {
    const empty = setup({ piece: null });
    empty.pan.onPanResponderGrant(at(10, 10));
    expect(empty.pan.onPanResponderTerminationRequest()).toBe(true);
    const locked = setup({ interactive: false });
    locked.pan.onPanResponderGrant(at(10, 10));
    expect(locked.pan.onPanResponderTerminationRequest()).toBe(true);
  });

  it("if the ScrollView does take the gesture, onPanResponderTerminate still cancels the drag cleanly", () => {
    const { pan, d, calls } = setup();
    pan.onPanResponderGrant(at(10, 10));
    pan.onPanResponderMove(at(10, 80));
    expect(calls.dragFrom).toEqual(["e2"]);
    pan.onPanResponderTerminate();
    expect(d.dragRef.current).toBeNull();
    expect(calls.dragFrom.at(-1)).toBeNull();
    expect(calls.moves).toEqual([]);
  });

  it("ChessBoard builds its PanResponder from createBoardPanConfig (no second, unguarded config)", () => {
    const src = readFileSync(resolve(__dirname, "ChessBoard.tsx"), "utf8");
    expect(src).toContain('import { createBoardPanConfig } from "./boardPan"');
    expect(src).toMatch(/PanResponder\.create\(\s*createBoardPanConfig</);
    expect(src.match(/PanResponder\.create\(/g)?.length).toBe(1);
  });
});

describe("ChessBoard drag-active callback (Android fallback: lock the lesson ScrollView during a piece drag)", () => {
  it("fires true when a piece drag starts (grant on a piece of an interactive board)", () => {
    const { pan, calls } = setup();
    pan.onPanResponderGrant(at(10, 10));
    expect(calls.dragActive).toEqual([true]);
    pan.onPanResponderMove(at(10, 80)); // moving does not re-fire
    expect(calls.dragActive).toEqual([true]);
  });

  it("fires false on release (after a drag, and after a plain tap)", () => {
    const a = setup();
    a.pan.onPanResponderGrant(at(10, 10));
    a.pan.onPanResponderMove(at(10, 80));
    a.pan.onPanResponderRelease(at(10, 80));
    expect(a.calls.dragActive).toEqual([true, false]);
    const b = setup();
    b.pan.onPanResponderGrant(at(10, 10));
    b.pan.onPanResponderRelease(at(10, 10));
    expect(b.calls.dragActive).toEqual([true, false]);
  });

  it("fires false on terminate, so a ScrollView that steals the gesture cannot leave scroll locked", () => {
    const { pan, calls } = setup();
    pan.onPanResponderGrant(at(10, 10));
    pan.onPanResponderMove(at(10, 80));
    pan.onPanResponderTerminate();
    expect(calls.dragActive).toEqual([true, false]);
  });

  it("never fires for touches that are not piece drags (empty square, non-interactive board)", () => {
    const empty = setup({ piece: null });
    empty.pan.onPanResponderGrant(at(10, 10));
    empty.pan.onPanResponderMove(at(10, 80));
    empty.pan.onPanResponderRelease(at(10, 80));
    expect(empty.calls.dragActive).toEqual([]);
    const locked = setup({ interactive: false });
    locked.pan.onPanResponderGrant(at(10, 10));
    locked.pan.onPanResponderTerminate();
    expect(locked.calls.dragActive).toEqual([]);
    // a terminate with no prior grant also stays silent
    const none = setup();
    none.pan.onPanResponderTerminate();
    expect(none.calls.dragActive).toEqual([]);
  });

  it("every drag re-fires true then false; works with no callback supplied", () => {
    const { pan, calls } = setup();
    for (let i = 0; i < 2; i++) {
      pan.onPanResponderGrant(at(10, 10));
      pan.onPanResponderRelease(at(10, 10));
    }
    expect(calls.dragActive).toEqual([true, false, true, false]);
    const bare = setup({ noCallback: true });
    expect(() => {
      bare.pan.onPanResponderGrant(at(10, 10));
      bare.pan.onPanResponderRelease(at(10, 10));
    }).not.toThrow();
  });

  it("keeps the existing termination-request guard alongside the callback (belt and braces)", () => {
    const { pan } = setup();
    pan.onPanResponderGrant(at(10, 10));
    expect(pan.onPanResponderTerminationRequest()).toBe(false);
  });

  it("wiring: ChessBoard exposes onPieceDragActiveChange and passes it through a ref to the config; lesson screen locks the body scroll", () => {
    const board = readFileSync(resolve(__dirname, "ChessBoard.tsx"), "utf8");
    expect(board).toContain("onPieceDragActiveChange?: (active: boolean) => void");
    expect(board).toMatch(/onDragActiveChangeRef,\s*\n\s*setDragFrom/);
    // released on unmount / when the board stops being interactive
    expect(board).toMatch(/return \(\) => onDragActiveChangeRef\.current\?\.\(false\)/);
    const lesson = readFileSync(resolve(__dirname, "../app/lesson/[id].tsx"), "utf8");
    expect(lesson).toContain("onPieceDragActiveChange={setPieceDragActive}");
    expect(lesson).toContain("scrollEnabled={!pieceDragActive}");
    // reset on step / lesson change so scroll can never stay disabled
    expect(lesson).toMatch(/useEffect\(\(\) => \{\s*setPieceDragActive\(false\);\s*\}, \[id, index\]\)/);
  });
});

describe("boardPan release when interactive flips false mid-drag", () => {
  it("drops the move but still unlocks scroll (onPieceDragActiveChange false)", () => {
    const { pan, d, calls } = setup();
    pan.onPanResponderGrant(at(10, 10));
    pan.onPanResponderMove(at(10, 80));
    d.interactiveRef.current = false;
    pan.onPanResponderRelease(at(10, 80));
    expect(calls.moves).toEqual([]);
    expect(calls.dragActive).toEqual([true, false]);
  });
});

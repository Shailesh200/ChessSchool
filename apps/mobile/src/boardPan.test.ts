import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { createBoardPanConfig, type BoardPanEvent } from "./boardPan";

type Cell = { type: string; color: "w" | "b" } | null;

function setup(opts: { interactive?: boolean; piece?: Cell } = {}) {
  const piece: Cell =
    "piece" in opts ? (opts.piece ?? null) : { type: "p", color: "w" };
  const calls = {
    dragFrom: [] as Array<string | null>,
    dragXY: [] as unknown[],
    moves: [] as string[],
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

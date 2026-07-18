import { describe, expect, it } from "vitest";
import { PIECE_PATHS, getPieceDrawing } from "./pieceSvgPaths";
import { PIECE_THEMES } from "./pieceThemes";

const CODES = ["wK", "wQ", "wR", "wB", "wN", "wP", "bK", "bQ", "bR", "bB", "bN", "bP"] as const;

/** Keep in sync with Piece.tsx svgFill. */
function svgFill(fill: string | undefined): string {
  return fill === undefined ? "#000" : fill;
}

describe("piece asset drawings", () => {
  const assetThemes = PIECE_THEMES.filter((t) => t.style === "asset");

  for (const theme of assetThemes) {
    const set = theme.shapeSet as keyof typeof PIECE_PATHS;
    if (!PIECE_PATHS[set]) continue;

    it(`${theme.id} (${set}) has all 12 piece drawings`, () => {
      for (const code of CODES) {
        const d = getPieceDrawing(set, code);
        expect(d?.ops?.length, `${set}/${code}`).toBeGreaterThan(0);
      }
    });
  }

  it("svgFill defaults omitted fill to black (M-47)", () => {
    expect(svgFill(undefined)).toBe("#000");
    expect(svgFill("none")).toBe("none");
    expect(svgFill("#fff")).toBe("#fff");
  });

  it("cburnett black pawn omits fill in source (relies on SVG/black default)", () => {
    const d = getPieceDrawing("cburnett", "bP");
    expect(d?.ops?.[0]?.t).toBe("path");
    const op = d!.ops[0] as { fill?: string };
    expect(op.fill).toBeUndefined();
    expect(svgFill(op.fill)).toBe("#000");
  });

  it("cburnett white pawn has explicit light fill", () => {
    const d = getPieceDrawing("cburnett", "wP");
    const fill = d!.ops.find((o) => o.t === "path" && "fill" in o && o.fill)?.fill;
    expect(fill).toBe("#fff");
  });
});

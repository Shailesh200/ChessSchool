import type { Color, PieceType } from "./board";

/**
 * ChessSchool's own piece set: chunky, rounded "toy" pieces drawn on a 100×100 grid.
 * `body` shapes are filled with the side colour and outlined; `detail` strokes add a few lines.
 */
export type PieceArt = { body: string[]; detail: string[]; dots?: [number, number, number][] };

const circle = (cx: number, cy: number, r: number) => `M${cx - r} ${cy}a${r} ${r} 0 1 0 ${r * 2} 0a${r} ${r} 0 1 0 ${-r * 2} 0Z`;
const BASE = "M22 85Q22 77 31 76H69Q78 77 78 85Q78 91 72 91H28Q22 91 22 85Z";

export const PIECE_ART: Record<PieceType, PieceArt> = {
  p: {
    body: [BASE, "M38 52Q37 66 30 77H70Q63 66 62 52Z", "M34 47Q34 43 38 43H62Q66 43 66 47Q66 52 62 52H38Q34 52 34 47Z", circle(50, 29, 14)],
    detail: [],
  },
  r: {
    body: [
      BASE,
      "M34 42H66L63 77H37Z",
      "M27 19Q27 16 30 16H37Q39 16 39 19V24H45V19Q45 16 48 16H52Q55 16 55 19V24H61V19Q61 16 63 16H70Q73 16 73 19V37Q73 42 68 42H32Q27 42 27 37Z",
    ],
    detail: ["M37 58H63"],
  },
  n: {
    body: [
      BASE,
      "M66 77H31Q29 64 39 56Q46 50 45 45L35 49Q25 52 21 45Q19 39 27 32L42 20Q44 11 51 10L55 17Q68 19 74 34Q80 54 66 77Z",
    ],
    detail: ["M58 22Q67 31 67 46", "M30 41L33 43"],
    dots: [[48, 29, 3.4]],
  },
  b: {
    body: [
      BASE,
      "M39 57Q35 69 30 77H70Q65 69 61 57Z",
      "M34 53Q34 49 38 49H62Q66 49 66 53Q66 57 62 57H38Q34 57 34 53Z",
      "M50 14Q67 27 65 40Q63 49 50 49Q37 49 35 40Q33 27 50 14Z",
      circle(50, 11, 5),
    ],
    detail: ["M55 25L46 37"],
  },
  q: {
    body: [
      BASE,
      "M34 59H66Q65 69 70 77H30Q35 69 34 59Z",
      "M25 31L36 47L42 27L50 45L58 27L64 47L75 31L68 59H32Z",
      circle(25, 28, 5),
      circle(42, 23, 5),
      circle(58, 23, 5),
      circle(75, 28, 5),
      circle(50, 18, 6),
    ],
    detail: ["M35 64H65"],
  },
  k: {
    body: [
      BASE,
      "M37 61H63Q62 70 70 77H30Q38 70 37 61Z",
      "M33 57Q33 53 37 53H63Q67 53 67 57Q67 61 63 61H37Q33 61 33 57Z",
      "M29 31Q50 20 71 31Q73 44 64 53H36Q27 44 29 31Z",
      "M46 5H54V11H60V18H54V25H46V18H40V11H46Z",
    ],
    detail: ["M38 39H62"],
  },
};

/** Fill, outline and detail colours per side. Same on light and dark themes so pieces read on any board. */
export const PIECE_COLORS: Record<Color, { fill: string; stroke: string; detail: string; dot: string }> = {
  w: { fill: "#FFF7E8", stroke: "#2A2547", detail: "#B9B3D9", dot: "#2A2547" },
  b: { fill: "#3B3770", stroke: "#15132B", detail: "#7E79D6", dot: "#FFF7E8" },
};

export const PIECE_STROKE = 4;

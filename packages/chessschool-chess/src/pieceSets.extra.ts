import type { Color, PieceType } from "./board";

/**
 * Five silhouette sets drawn on the same 100×100 grid as the Classic pieces.
 * `body` and `shade` shapes are filled and outlined; `detail` lines are stroked only; `dots` are small filled circles.
 */
export type SetShape = { body: string[]; shade?: string[]; detail?: string[]; dots?: [number, number, number][] };
export type SetPalette = { fill: string; shade: string; stroke: string; detail: string; dot: string; sw: number; dw: number };
export type ExtraSet = { art: Record<PieceType, SetShape>; colors: Record<Color, SetPalette> };

const circle = (cx: number, cy: number, r: number) => `M${cx - r} ${cy}a${r} ${r} 0 1 0 ${r * 2} 0a${r} ${r} 0 1 0 ${-r * 2} 0Z`;
/** A horizontal pill (collar) centred on y. */
const collar = (x1: number, x2: number, y: number, h = 7) => `M${x1 + h / 2} ${y - h / 2}H${x2 - h / 2}Q${x2} ${y - h / 2} ${x2} ${y}Q${x2} ${y + h / 2} ${x2 - h / 2} ${y + h / 2}H${x1 + h / 2}Q${x1} ${y + h / 2} ${x1} ${y}Q${x1} ${y - h / 2} ${x1 + h / 2} ${y - h / 2}Z`;
const CROSS = (y: number) => `M47 ${y}H53V${y + 6}H59V${y + 12}H53V${y + 20}H47V${y + 12}H41V${y + 6}H47Z`;

/* ---------- Staunton: the tournament shapes, two-tier base and turned collars ---------- */
const ST_BASE = "M21 90Q21 83 28 82H72Q79 83 79 90Z";
const ST_PLINTH = "M30 82Q30 77 35 76H65Q70 77 70 82Z";
const staunton: ExtraSet = {
  art: {
    p: { body: [ST_BASE, ST_PLINTH, "M37 76Q41 64 44 57H56Q59 64 63 76Z", collar(34, 66, 56), circle(50, 39, 13)] },
    r: {
      body: [ST_BASE, ST_PLINTH, "M34 76L36 42H64L66 76Z", "M30 42Q30 37 35 36H65Q70 37 70 42Z", "M29 37V17H38V24H45.5V17H54.5V24H62V17H71V37Z"],
      detail: ["M37 50H63", "M36 68H64"],
    },
    n: {
      body: [ST_BASE, ST_PLINTH, "M33 76Q30 62 40 54Q46 49 44 44L31 49Q22 51 20 44Q18 38 26 32L40 20Q42 12 47 9L52 16Q66 18 72 33Q78 52 69 76Z"],
      detail: ["M55 18Q67 26 69 44Q70 60 66 72", "M29 44L32 45"],
      dots: [[44, 28, 2.8]],
    },
    b: {
      body: [ST_BASE, ST_PLINTH, "M39 76Q42 66 44 58H56Q58 66 61 76Z", collar(35, 65, 56), "M50 15Q66 28 64 42Q62 52 50 52Q38 52 36 42Q34 28 50 15Z", circle(50, 11, 4.5)],
      detail: ["M56 25L47 37"],
    },
    q: {
      body: [ST_BASE, ST_PLINTH, "M37 76Q41 63 43 56H57Q59 63 63 76Z", collar(33, 67, 54), "M31 50L24 28L36 40L40 22L47 38L50 18L53 38L60 22L64 40L76 28L69 50Z", circle(24, 26, 4), circle(40, 20, 4), circle(50, 15, 4.5), circle(60, 20, 4), circle(76, 26, 4)],
    },
    k: {
      body: [ST_BASE, ST_PLINTH, "M37 76Q41 63 43 57H57Q59 63 63 76Z", collar(33, 67, 55), "M32 51Q29 34 40 30H60Q71 34 68 51Z", CROSS(8)],
      detail: ["M36 42H64"],
    },
  },
  colors: {
    w: { fill: "#F8F2E4", shade: "#E6DCC6", stroke: "#2B2620", detail: "#9C8F78", dot: "#2B2620", sw: 3.5, dw: 3 },
    b: { fill: "#34302D", shade: "#24211F", stroke: "#0E0C0B", detail: "#8F857B", dot: "#F8F2E4", sw: 3.5, dw: 3 },
  },
};

/* ---------- Modern flat: straight edges, a second tone on bases and collars ---------- */
const FL_BASE = "M27 80H73Q76 80 76 83V90H24V83Q24 80 27 80Z";
const flat: ExtraSet = {
  art: {
    p: { body: ["M38 80L42 56H58L62 80Z", circle(50, 40, 13)], shade: [FL_BASE, "M35 52H65V59H35Z"] },
    r: { body: ["M34 80V36H66V80Z", "M30 37V16H39V24H46V16H54V24H61V16H70V37Z"], shade: [FL_BASE, "M34 60H66V67H34Z"] },
    n: {
      body: ["M34 80L34 60L44 48L29 51L24 41L42 19L46 8L54 18L66 24L73 41L70 80Z"],
      shade: [FL_BASE, "M54 18L66 24L73 41L70 80H63L65 42L60 27Z"],
      dots: [[45, 31, 3]],
    },
    b: { body: ["M40 80L44 58H56L60 80Z", "M50 12Q68 30 62 50H38Q32 30 50 12Z", circle(50, 10, 4)], shade: [FL_BASE, "M36 50H64V58H36Z"], detail: ["M55 25L47 38"] },
    q: { body: ["M38 80L42 56H58L62 80Z", "M31 50L26 25L40 38L50 16L60 38L74 25L69 50Z", circle(26, 22, 4), circle(50, 13, 4), circle(74, 22, 4)], shade: [FL_BASE, "M33 50H67V57H33Z"] },
    k: { body: ["M38 80L42 56H58L62 80Z", "M32 50Q32 31 50 31Q68 31 68 50Z", CROSS(8)], shade: [FL_BASE, "M33 50H67V57H33Z"] },
  },
  colors: {
    w: { fill: "#FFFFFF", shade: "#D5DEE9", stroke: "#33415A", detail: "#33415A", dot: "#33415A", sw: 3, dw: 3 },
    b: { fill: "#3A4863", shade: "#26324A", stroke: "#18202F", detail: "#9FB0CC", dot: "#E8EEF6", sw: 3, dw: 3 },
  },
};

/* ---------- Chaturanga: domes, arches and a lotus-scalloped base ---------- */
const CH_BASE = "M20 90Q20 82 28 81H72Q80 82 80 90Z";
const CH_LOTUS = "M27 86Q32 82 37 86Q42 82 47 86Q52 82 57 86Q62 82 67 86Q71 83 73 86";
const chaturanga: ExtraSet = {
  art: {
    p: { body: [CH_BASE, "M38 81Q40 68 44 60H56Q60 68 62 81Z", collar(35, 65, 59), "M50 23Q61 31 62 41Q63 52 50 54Q37 52 38 41Q39 31 50 23Z", circle(50, 19, 3.6)], detail: [CH_LOTUS] },
    r: {
      body: [CH_BASE, "M32 81L35 44H65L68 81Z", "M28 45V28H34Q34 20 39.5 17Q45 20 45 28H55Q55 20 60.5 17Q66 20 66 28H72V45Z"],
      detail: [CH_LOTUS, "M44 81V70Q50 61 56 70V81", "M34 53H66"],
    },
    n: {
      body: [CH_BASE, "M33 81Q30 64 40 56Q46 51 44 46L31 51Q22 53 20 46Q18 40 26 34L40 22Q42 14 47 11L52 18Q66 20 72 35Q78 54 69 81Z", "M50 15Q53 3 64 5Q59 9 57 17Z"],
      detail: [CH_LOTUS, "M27 41Q37 40 45 32", "M55 21Q66 29 68 46"],
      dots: [[44, 30, 2.8]],
    },
    b: {
      body: [CH_BASE, "M40 81Q42 66 44 59H56Q58 66 60 81Z", collar(35, 65, 58), "M50 11Q65 27 64 40Q64 52 50 54Q36 52 36 40Q35 27 50 11Z", circle(50, 9, 3.4)],
      detail: [CH_LOTUS, "M50 18V50", "M43 26Q40 39 43 50", "M57 26Q60 39 57 50"],
    },
    q: {
      body: [CH_BASE, "M38 81Q40 65 42 59H58Q60 65 62 81Z", collar(32, 68, 57), "M31 53Q28 37 34 26Q40 34 44 24Q47 14 50 9Q53 14 56 24Q60 34 66 26Q72 37 69 53Z"],
      detail: [CH_LOTUS, "M35 47H65"],
      dots: [[50, 37, 3.6]],
    },
    k: {
      body: [CH_BASE, "M38 81Q40 65 42 59H58Q60 65 62 81Z", collar(32, 68, 57), "M48.5 14H51.5V28H48.5Z", "M32 53Q30 37 40 31Q46 28 50 22Q54 28 60 31Q70 37 68 53Z", "M35 17Q50 3 65 17Z"],
      detail: [CH_LOTUS, "M37 45H63"],
      dots: [[50, 38, 3.2]],
    },
  },
  colors: {
    w: { fill: "#FCEED6", shade: "#F2D9AE", stroke: "#6B2A1A", detail: "#D9822B", dot: "#B3401F", sw: 3.5, dw: 3 },
    b: { fill: "#7C2230", shade: "#5E1622", stroke: "#33080F", detail: "#F2B544", dot: "#F2B544", sw: 3.5, dw: 3 },
  },
};

/* ---------- Bold geometric: triangles, blocks and diamonds with a heavy line ---------- */
const GE_BASE = "M22 90L28 78H72L78 90Z";
const geometric: ExtraSet = {
  art: {
    p: { body: [GE_BASE, "M34 78L50 47L66 78Z", circle(50, 36, 12)] },
    r: { body: [GE_BASE, "M32 78V31H68V78Z", "M28 31V13H40V21H46V13H54V21H60V13H72V31Z"], detail: ["M32 55H68"] },
    n: { body: [GE_BASE, "M32 78L40 55L25 51L27 37L46 14L52 22L60 13L73 38L68 78Z"], dots: [[47, 31, 3.4]] },
    b: { body: [GE_BASE, "M36 78L50 54L64 78Z", "M50 9L68 39L50 63L32 39Z"], detail: ["M43 37L57 30"] },
    q: { body: [GE_BASE, "M30 78L36 45H64L70 78Z", "M28 45L23 17L38 32L50 9L62 32L77 17L72 45Z"] },
    k: { body: [GE_BASE, "M32 78L36 47H64L68 78Z", "M30 47L34 27H66L70 47Z", "M45 3H55V9H61V17H55V27H45V17H39V9H45Z"], detail: ["M36 62H64"] },
  },
  colors: {
    w: { fill: "#F5F3EC", shade: "#F5F3EC", stroke: "#141428", detail: "#141428", dot: "#141428", sw: 5, dw: 4.5 },
    b: { fill: "#1E1E3A", shade: "#1E1E3A", stroke: "#05050F", detail: "#F5F3EC", dot: "#F5F3EC", sw: 5, dw: 4.5 },
  },
};

/* ---------- Bubble: round, soft and smiley ---------- */
const BU_BASE = "M24 87Q24 78 34 78H66Q76 78 76 87Q76 92 70 92H30Q24 92 24 87Z";
const face = (y: number, gap = 5): Pick<SetShape, "detail" | "dots"> => ({ dots: [[50 - gap, y, 2.6], [50 + gap, y, 2.6]], detail: [`M${46} ${y + 6}Q50 ${y + 9.5} ${54} ${y + 6}`] });
const bubble: ExtraSet = {
  art: {
    p: { body: [BU_BASE, "M33 80Q31 60 50 58Q69 60 67 80Z", circle(50, 39, 17)], ...face(37) },
    r: {
      body: [BU_BASE, "M30 80V40Q30 34 36 34H64Q70 34 70 40V80Z", "M28 37V22Q28 16 34 16Q40 16 40 22V26H45V22Q45 16 50 16Q55 16 55 22V26H60V22Q60 16 66 16Q72 16 72 22V37Z"],
      ...face(53, 6),
    },
    n: {
      body: [BU_BASE, "M32 80Q30 64 40 57Q46 53 44 48L34 51Q22 53 22 43Q22 35 32 29L42 21Q44 10 52 12Q68 16 74 34Q80 57 68 80Z"],
      detail: ["M27 45Q31 47 35 45"],
      dots: [[48, 31, 3.4]],
    },
    b: { body: [BU_BASE, "M35 80Q33 63 44 59H56Q67 63 65 80Z", "M50 15Q68 27 66 42Q64 57 50 57Q36 57 34 42Q32 27 50 15Z", circle(50, 12, 5)], ...face(39) },
    q: {
      body: [BU_BASE, "M33 80Q33 61 50 59Q67 61 67 80Z", "M34 34L36 20L43 28L50 16L57 28L64 20L66 34Z", circle(36, 18, 3.6), circle(50, 14, 3.6), circle(64, 18, 3.6), circle(50, 45, 15)],
      dots: [[45, 44, 2.6], [55, 44, 2.6]],
      detail: ["M46 50Q50 53.5 54 50"],
    },
    k: {
      body: [BU_BASE, "M33 80Q33 61 50 59Q67 61 67 80Z", "M35 37V26L42 30L50 23L58 30L65 26V37Z", circle(50, 46, 15), "M47 6H53V11H58V17H53V24H47V17H42V11H47Z"],
      ...face(45),
    },
  },
  colors: {
    w: { fill: "#FFF9F0", shade: "#FFE7C7", stroke: "#4A3B6B", detail: "#4A3B6B", dot: "#4A3B6B", sw: 4, dw: 3 },
    b: { fill: "#6A4FB3", shade: "#523C92", stroke: "#2A1E50", detail: "#FFF9F0", dot: "#FFF9F0", sw: 4, dw: 3 },
  },
};

export const EXTRA_SETS = { staunton, flat, chaturanga, geometric, bubble } as const;
export type ExtraSetId = keyof typeof EXTRA_SETS;

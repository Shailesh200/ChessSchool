/**
 * Decorative background art, as data both apps draw (react-native-svg on native, inline <svg> on the web).
 * A backdrop is a repeating tile (kolam, jaali, board squares…) that fades out where text sits, plus a few
 * large, very faint motifs (piece silhouettes, a lotus, a rosette). Colours are palette roles, so every
 * theme and dark mode get matching art. All of it is hidden from screen readers.
 */

export type ArtTone = "brand" | "accent" | "gold" | "success" | "text";
/** One tile shape: filled, or stroked when `stroke` is set. `o` is its opacity before the backdrop's own. */
export type ArtOp = { d: string; stroke?: number; o?: number };
export type ArtTile = { id: TileId; size: number; ops: ArtOp[] };
export type MotifId = "pawn" | "knight" | "bishop" | "rook" | "queen" | "king" | "lotus" | "rosette";
/** A motif centred at (x, y) as shares of the area, `size` in points, drawn from a 100×100 shape. */
export type ArtMotif = { shape: MotifId; x: number; y: number; size: number; rotate: number; tone: ArtTone; o: number };
/** How the tile fades: "edges" keeps it at the top and bottom of a screen, "top" only at the top, "corner" in the top-right corner of a card. */
export type ArtFade = "edges" | "top" | "corner";
export type Backdrop = { id: string; tile: ArtTile; tone: ArtTone; o: number; fade: ArtFade; motifs: ArtMotif[] };

const circle = (cx: number, cy: number, r: number) => `M${cx - r} ${cy}a${r} ${r} 0 1 0 ${r * 2} 0a${r} ${r} 0 1 0 ${-r * 2} 0Z`;
const r1 = (n: number) => Math.round(n * 10) / 10;
/** Rotates a list of [x, y] points about (cx, cy). */
const turn = (pts: [number, number][], deg: number, cx = 50, cy = 50) => {
  const a = (deg * Math.PI) / 180;
  return pts.map(([x, y]) => [r1(cx + (x - cx) * Math.cos(a) - (y - cy) * Math.sin(a)), r1(cy + (x - cx) * Math.sin(a) + (y - cy) * Math.cos(a))] as const);
};

/* ---------- tiles ---------- */

export type TileId = "kolam" | "checker" | "jaali" | "stars" | "scales" | "chevron" | "bandhani" | "grid" | "diamonds";

function starPath(cx: number, cy: number, r: number) {
  const pts: [number, number][] = [];
  for (let i = 0; i < 16; i++) {
    const a = (i * Math.PI) / 8 - Math.PI / 2;
    const rr = i % 2 ? r * 0.55 : r;
    pts.push([r1(cx + rr * Math.cos(a)), r1(cy + rr * Math.sin(a))]);
  }
  return `M${pts.map(([x, y]) => `${x} ${y}`).join("L")}Z`;
}

export const TILES: Record<TileId, ArtTile> = {
  // Kolam: a dot grid looped by flowing lines, drawn on doorsteps across South India.
  kolam: {
    id: "kolam",
    size: 48,
    ops: [{ d: circle(24, 24, 1.8) }, { d: circle(0, 0, 1.8) }, { d: circle(48, 0, 1.8) }, { d: circle(0, 48, 1.8) }, { d: circle(48, 48, 1.8) }, { d: "M0 24Q12 12 24 0M24 48Q36 36 48 24M24 0Q36 12 48 24M0 24Q12 36 24 48", stroke: 1.4 }],
  },
  checker: { id: "checker", size: 40, ops: [{ d: "M0 0H20V20H0ZM20 20H40V40H20Z", o: 0.7 }] },
  // Jaali: the pierced-stone lattice of Mughal windows.
  jaali: { id: "jaali", size: 56, ops: [{ d: "M0 28Q14 28 14 14Q14 0 28 0Q42 0 42 14Q42 28 56 28M0 28Q14 28 14 42Q14 56 28 56Q42 56 42 42Q42 28 56 28", stroke: 1.3 }, { d: circle(28, 28, 2) }] },
  stars: { id: "stars", size: 56, ops: [{ d: starPath(28, 28, 10), stroke: 1.3 }, { d: circle(0, 0, 2) }, { d: circle(56, 0, 2) }, { d: circle(0, 56, 2) }, { d: circle(56, 56, 2) }] },
  scales: { id: "scales", size: 32, ops: [{ d: "M0 16A16 16 0 0 1 32 16M-16 32A16 16 0 0 1 16 32M16 32A16 16 0 0 1 48 32", stroke: 1.2 }] },
  chevron: { id: "chevron", size: 40, ops: [{ d: "M0 14L10 4L20 14L30 4L40 14M0 34L10 24L20 34L30 24L40 34", stroke: 1.5 }] },
  // Bandhani: tie-dye dots from Gujarat and Rajasthan.
  bandhani: { id: "bandhani", size: 36, ops: [{ d: [circle(9, 6, 1.4), circle(6, 9, 1.4), circle(12, 9, 1.4), circle(9, 12, 1.4), circle(27, 24, 1.4), circle(24, 27, 1.4), circle(30, 27, 1.4), circle(27, 30, 1.4)].join("") }] },
  grid: { id: "grid", size: 32, ops: [{ d: "M0 0.5H32M0.5 0V32", stroke: 1, o: 0.8 }, { d: circle(0.5, 0.5, 1.6) }] },
  diamonds: { id: "diamonds", size: 44, ops: [{ d: "M22 6L38 22L22 38L6 22Z", stroke: 1.2 }, { d: circle(22, 22, 1.8) }] },
};

/* ---------- motifs (100×100, filled) ---------- */

function rosette(): string[] {
  const petal: [number, number][] = [
    [50, 50],
    [57, 32],
    [50, 12],
    [43, 32],
  ];
  const out: string[] = [];
  for (let i = 0; i < 8; i++) {
    const [a, b, c, d] = turn(petal, i * 45);
    out.push(`M${a[0]} ${a[1]}Q${b[0]} ${b[1]} ${c[0]} ${c[1]}Q${d[0]} ${d[1]} ${a[0]} ${a[1]}Z`);
  }
  return [...out, circle(50, 50, 9)];
}

export const MOTIFS: Record<MotifId, string[]> = {
  pawn: ["M30 90H70Q72 78 62 74Q58 62 60 54H40Q42 62 38 74Q28 78 30 90Z", "M34 54Q34 48 40 48H60Q66 48 66 54Z", circle(50, 36, 14)],
  rook: ["M28 90H72V80H66L63 44H37L34 80H28Z", "M30 44V20H38V28H46V20H54V28H62V20H70V44Z"],
  knight: ["M30 90H72Q78 56 72 36Q66 20 52 16L48 8Q41 12 40 20L26 32Q18 40 21 46Q25 52 34 49L44 45Q46 50 40 55Q30 64 30 90Z"],
  bishop: ["M30 90H70Q66 76 60 70V60H40V70Q34 76 30 90Z", "M50 14Q68 28 64 44Q62 56 50 56Q38 56 36 44Q32 28 50 14Z", circle(50, 10, 5)],
  queen: ["M30 90H70Q64 76 66 60H34Q36 76 30 90Z", "M24 30L36 60H64L76 30L62 44L56 24L50 42L44 24L38 44Z", circle(24, 27, 5), circle(44, 21, 5), circle(56, 21, 5), circle(76, 27, 5)],
  king: ["M30 90H70Q64 76 66 62H34Q36 76 30 90Z", "M30 34Q50 22 70 34Q72 50 64 62H36Q28 50 30 34Z", "M46 4H54V10H60V17H54V24H46V17H40V10H46Z"],
  lotus: ["M50 84Q28 76 18 54Q38 56 50 70Q62 56 82 54Q72 76 50 84Z", "M50 72Q36 52 50 22Q64 52 50 72Z", "M48 74Q28 62 28 38Q44 48 50 66Z", "M52 74Q72 62 72 38Q56 48 50 66Z"],
  rosette: rosette(),
};

/* ---------- catalogue ---------- */

const m = (shape: MotifId, x: number, y: number, size: number, rotate: number, tone: ArtTone, o: number): ArtMotif => ({ shape, x, y, size, rotate, tone, o });

/** The four main tabs share this one, so switching tabs never changes the scenery. */
export const TABS_BACKDROP: Backdrop = {
  id: "tabs",
  tile: TILES.kolam,
  tone: "brand",
  o: 0.09,
  fade: "edges",
  motifs: [m("knight", 0.9, 0.86, 230, -8, "brand", 0.06), m("rosette", 0.06, 0.1, 150, 0, "accent", 0.07), m("lotus", 0.08, 0.6, 110, 8, "gold", 0.08)],
};

/** Lessons: graph paper, like a chess notebook. */
export const LESSON_BACKDROP: Backdrop = {
  id: "lesson",
  tile: TILES.grid,
  tone: "brand",
  o: 0.07,
  fade: "edges",
  motifs: [m("rook", 0.92, 0.1, 140, 8, "brand", 0.06), m("lotus", 0.08, 0.94, 170, 0, "accent", 0.07)],
};

/** Each bot's own room. Ids are stable even when a bot is renamed. */
export const BOT_BACKDROPS: Record<string, Backdrop> = {
  pip: { id: "bot-pip", tile: TILES.bandhani, tone: "accent", o: 0.14, fade: "edges", motifs: [m("pawn", 0.88, 0.9, 200, -10, "accent", 0.07), m("pawn", 0.1, 0.08, 90, 14, "gold", 0.08)] },
  rooky: { id: "bot-rooky", tile: TILES.checker, tone: "brand", o: 0.06, fade: "edges", motifs: [m("rook", 0.9, 0.88, 210, 6, "brand", 0.07)] },
  bishop: { id: "bot-bishop", tile: TILES.jaali, tone: "success", o: 0.12, fade: "edges", motifs: [m("bishop", 0.9, 0.88, 220, -6, "success", 0.07), m("rosette", 0.08, 0.08, 110, 0, "success", 0.07)] },
  ivy: { id: "bot-ivy", tile: TILES.scales, tone: "success", o: 0.1, fade: "edges", motifs: [m("queen", 0.88, 0.88, 220, -4, "brand", 0.07), m("lotus", 0.1, 0.1, 120, 0, "success", 0.08)] },
  atlas: { id: "bot-atlas", tile: TILES.chevron, tone: "brand", o: 0.09, fade: "edges", motifs: [m("king", 0.9, 0.88, 230, 4, "brand", 0.07)] },
  raja: { id: "bot-raja", tile: TILES.stars, tone: "gold", o: 0.16, fade: "edges", motifs: [m("king", 0.88, 0.88, 220, -6, "gold", 0.1), m("rosette", 0.1, 0.08, 130, 0, "gold", 0.1)] },
  cody: { id: "bot-cody", tile: TILES.kolam, tone: "accent", o: 0.12, fade: "edges", motifs: [m("knight", 0.9, 0.88, 230, -8, "accent", 0.08), m("lotus", 0.08, 0.08, 110, 0, "gold", 0.09)] },
};

/** Puzzles rotate through these so the screen changes with every puzzle. */
export const PUZZLE_BACKDROPS: readonly Backdrop[] = [
  { id: "puzzle-0", tile: TILES.diamonds, tone: "brand", o: 0.1, fade: "edges", motifs: [m("knight", 0.9, 0.9, 200, -10, "brand", 0.07)] },
  { id: "puzzle-1", tile: TILES.scales, tone: "accent", o: 0.1, fade: "edges", motifs: [m("queen", 0.1, 0.9, 190, 8, "accent", 0.07)] },
  { id: "puzzle-2", tile: TILES.stars, tone: "gold", o: 0.14, fade: "edges", motifs: [m("rosette", 0.9, 0.9, 190, 0, "gold", 0.09)] },
  { id: "puzzle-3", tile: TILES.chevron, tone: "success", o: 0.1, fade: "edges", motifs: [m("bishop", 0.88, 0.9, 190, -6, "success", 0.07)] },
  { id: "puzzle-4", tile: TILES.bandhani, tone: "brand", o: 0.14, fade: "edges", motifs: [m("lotus", 0.12, 0.9, 190, 0, "brand", 0.07)] },
  { id: "puzzle-5", tile: TILES.jaali, tone: "accent", o: 0.1, fade: "edges", motifs: [m("rook", 0.9, 0.9, 180, 6, "accent", 0.07)] },
];

/** Hero cards: art gathers in the top-right corner, away from the text on the left. */
export const CARD_BACKDROPS = {
  course: { id: "card-course", tile: TILES.kolam, tone: "brand", o: 0.16, fade: "corner", motifs: [m("lotus", 0.06, 0.12, 70, -10, "accent", 0.1)] },
  rank: { id: "card-rank", tile: TILES.stars, tone: "gold", o: 0.22, fade: "corner", motifs: [m("rosette", 0.95, 0.1, 120, 0, "gold", 0.12)] },
  rating: { id: "card-rating", tile: TILES.diamonds, tone: "brand", o: 0.16, fade: "corner", motifs: [m("knight", 0.62, 0.86, 110, -12, "brand", 0.07)] },
  hero: { id: "card-hero", tile: TILES.jaali, tone: "brand", o: 0.15, fade: "corner", motifs: [m("rosette", 0.96, 0.08, 110, 0, "accent", 0.1)] },
} satisfies Record<string, Backdrop>;

/** Stable small hash for picking art by id. */
export function artHash(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193) >>> 0;
  return h;
}

/** A bot's room; bots without their own pick one by id, so it never changes between games. */
export function botBackdrop(botId: string): Backdrop {
  return BOT_BACKDROPS[botId] ?? Object.values(BOT_BACKDROPS)[artHash(botId) % Object.keys(BOT_BACKDROPS).length];
}

export const puzzleBackdrop = (puzzleId: string): Backdrop => PUZZLE_BACKDROPS[artHash(puzzleId) % PUZZLE_BACKDROPS.length];

/** Dark backgrounds need a little more ink for the same subtle effect. */
export const artStrength = (dark: boolean) => (dark ? 1.9 : 1.4);

/** Fade stops (offset, how much of the tile shows) top to bottom, or from the corner outwards. */
export const ART_FADES: Record<ArtFade, readonly [number, number][]> = {
  edges: [
    [0, 1],
    [0.3, 0.45],
    [0.7, 0.45],
    [1, 0.9],
  ],
  top: [
    [0, 1],
    [0.55, 0],
  ],
  corner: [
    [0, 1],
    [0.55, 0.35],
    [1, 0],
  ],
};

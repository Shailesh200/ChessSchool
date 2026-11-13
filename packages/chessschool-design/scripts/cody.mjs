#!/usr/bin/env node
// Generates the Storybook × Clay Cody vector rig as Lottie animations + a static SVG.
// Usage: node scripts/cody.mjs (from packages/chessschool-design)
// Outputs: assets/lottie/cody/*.json, assets/lottie/cody/manifest.json, assets/svg/cody.svg
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const PKG = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIRS = [join(PKG, "assets/lottie/cody")];
const SVG_DIR = join(PKG, "assets/svg");
import { compose, drop, ellipse, heartShapes, lin, loop, path, poly, rad, rect, smooth, sparkle, strokePath } from "./lottie-kit.mjs";

const W = 512;
const H = 512;
const FPS = 60;

/* ---------------- palette (matte clay: low-contrast shading, no specular) ---------------- */
const C = {
  ink: "#1B1838",
  clayHi: "#7A77EC",
  clay: "#5F5CD9",
  clayMid: "#5653CC",
  clayLo: "#4643B4",
  clayDeep: "#34318F",
  brow: "#2A2770",
  freckle: "#A9A6FF",
  cheek: "#F49AB0",
  mouth: "#3A1D2E",
  tongue: "#E8707F",
  teeth: "#FFFDF7",
  frame: "#2A2547",
  cap: "#2D2C40",
  capHi: "#3B3A52",
  capLo: "#1F1E2E",
  mustard: "#E6AA3C",
  mustardLo: "#C38A24",
  book: "#D4493D",
  bookLo: "#A8352B",
  page: "#FFF6E4",
  pageLo: "#F1E3C6",
  white: "#FFFFFF",
  tear: "#8FD3FF",
  heart: "#FF5A7E",
  star: "#F7BF45",
  starLo: "#DE9D24",
};

/* ---------------- rig ---------------- */
// Layers are listed bottom -> top. Positions are in comp space at rest (anchor = position = pivot).
const EYE_L = [212, 212];
const EYE_R = [300, 212];
const LENS = 74;
// Soft storybook outline; also keeps the silhouette readable on the dark theme.
const OUTLINE = { stroke: { color: "#2E2B86", w: 5 } };

const beadEye = ([x, y]) => [
  ellipse(x, y, 30, 36, C.ink),
  ellipse(x - 6, y - 8, 10, 10, C.white, { op: 95 }),
  ellipse(x + 6, y + 9, 4, 4, C.white, { op: 70 }),
];
const arc = (pts, w = 6) => strokePath(smooth(pts, { closed: false }), C.ink, w);
const happyArc = ([x, y]) => arc([[x - 15, y + 5], [x, y - 8], [x + 15, y + 5]]);
const sleepyArc = ([x, y]) => arc([[x - 15, y], [x, y + 8], [x + 15, y]]);
const squeeze = ([x, y], dir) => strokePath(poly([[x - 11 * dir, y - 10], [x + 10 * dir, y], [x - 11 * dir, y + 10]], false), C.ink, 6);

const MOUTHS = {
  smile: [arc([[240, 270], [256, 282], [272, 270]])],
  open: [
    path(smooth([[236, 266], [256, 264], [276, 266], [268, 288], [256, 294], [244, 288]], { corners: [0, 2] }), C.mouth),
    ellipse(256, 288, 20, 9, C.tongue),
  ],
  grin: [
    path(smooth([[228, 263], [256, 261], [284, 263], [274, 292], [256, 301], [238, 292]], { corners: [0, 2] }), C.mouth),
    rect(256, 269, 36, 10, 3, C.teeth),
    ellipse(256, 293, 22, 10, C.tongue),
  ],
  wow: [ellipse(256, 282, 24, 30, C.mouth), ellipse(256, 290, 14, 8, C.tongue)],
  frown: [arc([[244, 282], [256, 274], [268, 282]])],
  side: [arc([[244, 278], [260, 281], [272, 270]])],
  tiny: [ellipse(256, 278, 12, 9, C.mouth)],
};

const BROWS = {
  soft: [[[196, 170], [212, 165], [228, 170]], [[284, 170], [300, 165], [316, 170]]],
  raise: [[[196, 171], [212, 167], [228, 171]], [[284, 164], [300, 152], [316, 160]]],
  up: [[[194, 165], [212, 153], [230, 163]], [[282, 163], [300, 153], [318, 165]]],
  sad: [[[196, 170], [212, 166], [228, 158]], [[284, 158], [300, 166], [316, 170]]],
};

function buildLayers(face, extras, front = []) {
  const layers = [];
  const add = (name, opts) => layers.push({ name, ...opts });

  add("root", { null: true, pivot: [256, 474], restS: [88, 88] });
  add("shadow", { parent: "root", pivot: [256, 474], shapes: [ellipse(256, 476, 236, 26, C.clayDeep, { op: 18 })] });
  add("rig", { null: true, parent: "root", pivot: [256, 472] });
  const arm = (cx, x1, x2) => [
    rect(cx, 362, 46, 86, 23, lin(x1, 330, x2, 404, [[0, C.clay], [1, C.clayLo]]), OUTLINE),
    ellipse(cx, 396, 30, 14, C.clayDeep, { op: 18 }),
  ];
  add("armL", { parent: "rig", pivot: [180, 324], restR: 16, shapes: arm(176, 158, 196) });
  add("armR", { parent: "rig", pivot: [332, 324], restR: -16, shapes: arm(336, 354, 316) });
  add("body", {
    parent: "rig",
    pivot: [256, 472],
    shapes: [
      rect(256, 446, 244, 56, 28, lin(256, 420, 256, 474, [[0, C.clayMid], [1, C.clayDeep]]), OUTLINE),
      strokePath(smooth([[146, 432], [256, 440], [366, 432]], { closed: false }), C.clayDeep, 5, { op: 35 }),
      path(
        smooth([[198, 318], [186, 360], [170, 398], [148, 426], [364, 426], [342, 398], [326, 360], [314, 318]], { corners: [3, 4] }),
        lin(148, 380, 364, 380, [[0, C.clayLo], [0.4, C.clay], [1, C.clayDeep]]),
        OUTLINE,
      ),
      ellipse(226, 372, 40, 80, C.clayHi, { op: 22, rot: 12 }),
      strokePath(smooth([[300, 352], [310, 372], [306, 392]], { closed: false }), C.clayDeep, 4, { op: 16 }),
      strokePath(smooth([[290, 360], [298, 374], [295, 388]], { closed: false }), C.clayDeep, 4, { op: 12 }),
      rect(256, 316, 202, 48, 24, lin(256, 292, 256, 340, [[0, C.clayHi], [1, C.clayLo]]), OUTLINE),
      strokePath(smooth([[168, 334], [256, 342], [344, 334]], { closed: false }), C.clayDeep, 5, { op: 30 }),
    ],
  });
  add("head", {
    parent: "rig",
    pivot: [256, 306],
    shapes: [
      ellipse(256, 198, 248, 238, rad(212, 140, 240, [[0, C.clayHi], [0.5, C.clay], [1, C.clayLo]]), OUTLINE),
      strokePath(smooth([[146, 200], [152, 156], [178, 120]], { closed: false }), C.clayHi, 6, { op: 55 }),
      strokePath(smooth([[318, 126], [334, 140], [340, 160]], { closed: false }), C.clayDeep, 4, { op: 14 }),
      strokePath(smooth([[312, 136], [324, 146], [328, 160]], { closed: false }), C.clayDeep, 4, { op: 10 }),
      ellipse(178, 270, 38, 22, C.cheek, { op: 88 }),
      ellipse(334, 270, 38, 22, C.cheek, { op: 88 }),
      ...[[170, 268], [180, 274], [188, 266], [324, 266], [332, 274], [342, 268]].map(([x, y]) => ellipse(x, y, 5, 5, C.freckle, { op: 80 })),
      ...MOUTHS[face.mouth],
    ],
  });
  add("brows", {
    parent: "head",
    pivot: [256, 166],
    shapes: BROWS[face.brows ?? "soft"].map((pts) => strokePath(smooth(pts, { closed: false }), C.brow, 6)),
  });

  if (face.eyes === "open" || face.eyes === "blink") {
    add("eyes", { parent: "head", pivot: [256, 212], shapes: [...beadEye(EYE_L), ...beadEye(EYE_R)] });
  }
  if (face.eyes === "closed" || face.eyes === "blink") {
    add("eyesClosed", { parent: "head", pivot: [256, 212], restO: face.eyes === "blink" ? 0 : 100, shapes: [happyArc(EYE_L), happyArc(EYE_R)] });
  }
  if (face.eyes === "sleepy") add("eyesClosed", { parent: "head", pivot: [256, 212], shapes: [sleepyArc(EYE_L), sleepyArc(EYE_R)] });
  if (face.eyes === "squeeze") add("eyesClosed", { parent: "head", pivot: [256, 212], shapes: [squeeze(EYE_L, 1), squeeze(EYE_R, -1)] });
  if (face.eyes === "heart") {
    add("hearts", {
      parent: "head",
      pivot: [256, 212],
      shapes: [...heartShapes(EYE_L[0], EYE_L[1] + 2, 40, C.heart), ...heartShapes(EYE_R[0], EYE_R[1] + 2, 40, C.heart)],
    });
  }

  const lens = ([x, y]) => [
    ellipse(x, y, LENS, LENS, C.white, { op: 14 }),
    ellipse(x, y, LENS, LENS, undefined, { stroke: { color: C.frame, w: 6 } }),
    strokePath(smooth([[x - 24, y - 12], [x - 16, y - 24], [x - 4, y - 29]], { closed: false }), C.white, 4, { op: 55 }),
  ];
  add("glasses", {
    parent: "head",
    pivot: [256, 212],
    shapes: [
      ...lens(EYE_L),
      ...lens(EYE_R),
      strokePath(smooth([[249, 208], [256, 201], [263, 208]], { closed: false }), C.frame, 6),
      strokePath(poly([[175, 204], [148, 196]], false), C.frame, 6),
      strokePath(poly([[337, 204], [364, 196]], false), C.frame, 6),
    ],
  });

  add("cap", {
    parent: "head",
    pivot: [256, 96],
    shapes: [
      path(smooth([[170, 98], [342, 98], [336, 140], [256, 152], [176, 140]], { corners: [0, 1] }), lin(256, 98, 256, 150, [[0, C.capHi], [1, C.capLo]])),
      path(smooth([[110, 92], [256, 40], [402, 92], [256, 138]], { k: 1 / 14 }), lin(160, 50, 360, 140, [[0, C.capHi], [1, C.cap]]), { stroke: { color: "#55547A", w: 4 } }),
      strokePath(smooth([[132, 92], [256, 50], [380, 92]], { closed: false, k: 1 / 10 }), C.capHi, 4, { op: 60 }),
      ellipse(256, 88, 24, 18, lin(256, 80, 256, 98, [[0, C.mustard], [1, C.mustardLo]])),
    ],
  });
  add("tasselCord", { parent: "cap", pivot: [256, 88], shapes: [strokePath(smooth([[256, 88], [322, 90], [382, 100]], { closed: false }), C.mustard, 7)] });
  add("tassel", {
    parent: "cap",
    pivot: [382, 100],
    shapes: [
      strokePath(poly([[382, 100], [384, 144]], false), C.mustard, 7),
      ellipse(384, 148, 22, 14, C.mustardLo),
      path(smooth([[372, 150], [396, 150], [402, 186], [384, 196], [366, 186]], { corners: [0, 1] }), lin(372, 150, 398, 194, [[0, C.mustard], [1, C.mustardLo]])),
      ...[376, 384, 392].map((x) => strokePath(poly([[x, 158], [x + (x - 384) * 0.3, 190]], false), C.mustardLo, 3, { op: 70 })),
    ],
  });

  // Arms that reach toward the face must draw above it, but still under the glasses and cap.
  for (const name of front) {
    const from = layers.findIndex((l) => l.name === name);
    const [a] = layers.splice(from, 1);
    layers.splice(layers.findIndex((l) => l.name === "glasses"), 0, a);
  }
  // Props can sit directly above or below a named layer (e.g. a book held in a hand).
  for (const e of extras) {
    const { above, below, ...layer } = e;
    const anchor = above ?? below;
    if (!anchor) layers.push(layer);
    else layers.splice(layers.findIndex((l) => l.name === anchor) + (above ? 1 : 0), 0, layer);
  }
  return layers;
}

/* ---------------- props ---------------- */
const closedBook = (cx, cy) => [
  rect(cx, cy, 58, 74, 8, lin(cx, cy - 37, cx, cy + 37, [[0, C.book], [1, C.bookLo]])),
  rect(cx + 25, cy, 6, 62, 2, C.page),
  rect(cx - 24, cy, 10, 74, 5, C.bookLo),
  rect(cx + 2, cy - 14, 26, 10, 3, C.mustard),
];
const pageLines = (x1, x2, y, flip = 1) =>
  [0, 12, 24].map((d) => strokePath(poly([[x1, y + d], [x2 - (d === 24 ? 14 * flip : 0), y + d - 2]], false), C.pageLo, 3));
const openBook = (cx, cy) => [
  path(poly([[cx - 78, cy - 30], [cx, cy - 20], [cx + 78, cy - 30], [cx + 78, cy + 36], [cx, cy + 44], [cx - 78, cy + 36]]), C.bookLo),
  path(smooth([[cx - 72, cy - 32], [cx - 36, cy - 36], [cx - 2, cy - 24], [cx - 2, cy + 36], [cx - 36, cy + 28], [cx - 72, cy + 30]], { corners: [0, 2, 3, 5] }), C.page),
  path(smooth([[cx + 2, cy - 24], [cx + 36, cy - 36], [cx + 72, cy - 32], [cx + 72, cy + 30], [cx + 36, cy + 28], [cx + 2, cy + 36]], { corners: [0, 2, 3, 5] }), C.pageLo),
  ...pageLines(cx - 60, cx - 14, cy - 16, -1),
  ...pageLines(cx + 14, cx + 60, cy - 18),
];
const flipPage = (cx, cy) => [
  path(smooth([[cx + 2, cy - 24], [cx + 36, cy - 36], [cx + 72, cy - 32], [cx + 72, cy + 30], [cx + 36, cy + 28], [cx + 2, cy + 36]], { corners: [0, 2, 3, 5] }), C.page),
  ...pageLines(cx + 14, cx + 60, cy - 18),
];
function roundStar(cx, cy, R) {
  const pts = [];
  for (let k = 0; k < 10; k++) {
    const ang = (Math.PI / 5) * k - Math.PI / 2;
    const rr = k % 2 === 0 ? R : R * 0.5;
    pts.push([cx + Math.cos(ang) * rr, cy + Math.sin(ang) * rr]);
  }
  return smooth(pts, { k: 1 / 14 });
}

const sparkleLayer = (name, cx, cy, R, color = C.star) => ({ name, parent: "root", pivot: [cx, cy], shapes: [path(sparkle(cx, cy, R), color)] });
const bubbleQ = {
  name: "question",
  parent: "head",
  pivot: [404, 66],
  shapes: [
    ellipse(404, 66, 64, 64, C.white),
    ellipse(376, 100, 14, 14, C.white),
    strokePath(smooth([[392, 56], [404, 46], [417, 56], [414, 68], [404, 74], [404, 82]], { closed: false, corners: [5] }), C.clayMid, 7),
    ellipse(404, 93, 9, 9, C.clayMid),
  ],
};
const zLayer = (name, cx, cy, s) => ({
  name,
  parent: "root",
  pivot: [cx, cy],
  shapes: [strokePath(poly([[cx - s, cy - s], [cx + s, cy - s], [cx - s, cy + s], [cx + s, cy + s]], false), C.clayMid, s * 0.45)],
});
const sweat = { name: "sweat", parent: "head", pivot: [352, 136], shapes: [path(drop(352, 136, 14), C.tear), ellipse(348, 136, 6, 9, C.white, { op: 70 })] };
const tearL = { name: "tearL", parent: "head", pivot: [206, 254], shapes: [path(drop(206, 254, 8), C.tear)] };
const tearR = { name: "tearR", parent: "head", pivot: [306, 254], shapes: [path(drop(306, 254, 8), C.tear)] };
const floatHeart = (name, cx, cy, s) => ({ name, parent: "root", pivot: [cx, cy], shapes: heartShapes(cx, cy, s, C.heart) });

/* ---------------- animation helpers ---------------- */
function blink(at) {
  return {
    eyes: { s: [[0, [100, 100], "hold"], [at, [100, 100]], [at + 4, [100, 8]], [at + 8, [100, 100]]] },
    eyesClosed: { o: [[0, 0, "hold"], [at + 3, 100, "hold"], [at + 6, 0, "hold"]] },
  };
}
function merge(...tracks) {
  const out = {};
  for (const t of tracks) for (const [layer, props] of Object.entries(t)) out[layer] = { ...(out[layer] ?? {}), ...props };
  return out;
}
/** Same keyframes with the value negated: keeps a held prop upright while its arm rotates. */
const counter = (track) => track.map(([t, v, e]) => [t, -v, e]);

/* ---------------- animations ---------------- */
const celebrateArmR = [[0, -16], [14, -40], [30, -128, "out"], [70, -118], [100, -100], [120, -100]];

const ANIMS = {
  idle: {
    frames: 180,
    loop: true,
    poster: 0,
    face: { eyes: "blink", mouth: "smile" },
    tracks: merge(
      {
        rig: { s: loop(90, 180, [[100, 100], [103, 97.5], [100, 100]]) },
        head: { r: loop(180, 180, [0, 2, 0, -2, 0]) },
        tassel: { r: loop(180, 180, [0, 9, 0, -7, 0]) },
        armL: { r: loop(90, 180, [16, 20, 16]) },
        armR: { r: loop(90, 180, [-16, -20, -16]) },
        shadow: { s: loop(90, 180, [[100, 100], [103, 100], [100, 100]]) },
      },
      blink(120),
    ),
  },
  wave: {
    frames: 120,
    loop: false,
    poster: 32,
    front: ["armL", "armR"],
    face: { eyes: "blink", mouth: "open", brows: "up" },
    tracks: merge(
      {
        rig: { s: [[0, [100, 100]], [10, [104, 95]], [22, [98, 103]], [32, [100, 100]]] },
        armR: { r: [[0, -16], [18, -128, "out"], [30, -100], [42, -128], [54, -100], [66, -128], [92, -16, "inOut"], [120, -16]] },
        armL: { r: [[0, 6], [120, 6]] },
        head: { r: [[0, 0], [18, -8], [80, -8], [100, 0], [120, 0]] },
        tassel: { r: [[0, 0], [20, -14, "out"], [44, 10], [70, -6], [100, 0], [120, 0]] },
      },
      blink(98),
    ),
    extras: [{ name: "book", parent: "armL", above: "armL", pivot: [172, 404], restR: -6, shapes: closedBook(172, 404) }],
  },
  happy: {
    frames: 72,
    loop: true,
    poster: 22,
    front: ["armL", "armR"],
    face: { eyes: "open", mouth: "open", brows: "up" },
    tracks: {
      rig: {
        p: [[0, [0, 0], "out"], [20, [0, -18], "in"], [36, [0, 0]], [72, [0, 0]]],
        s: [[0, [100, 100]], [16, [97, 104]], [36, [107, 93], "out"], [52, [100, 100]], [72, [100, 100]]],
      },
      shadow: { s: [[0, [100, 100]], [20, [84, 84]], [36, [104, 104]], [52, [100, 100]], [72, [100, 100]]] },
      armL: { r: [[0, 60], [20, 120], [36, 60], [72, 60]] },
      armR: { r: [[0, -60], [20, -120], [36, -60], [72, -60]] },
      tassel: { r: [[0, 0], [20, -16], [40, 12], [60, 0], [72, 0]] },
    },
  },
  giggle: {
    frames: 96,
    loop: true,
    poster: 0,
    front: ["armR"],
    face: { eyes: "closed", mouth: "grin", brows: "up" },
    tracks: {
      head: { r: loop(24, 96, [0, -4, 0, 4, 0], "inOut") },
      rig: { s: loop(12, 96, [[100, 100], [102, 98], [100, 100]]) },
      armL: { r: [[0, 30], [96, 30]] },
      armR: { r: loop(24, 96, [118, 124, 118]) },
      tassel: { r: loop(24, 96, [0, 8, 0, -8, 0]) },
    },
  },
  celebrate: {
    frames: 120,
    loop: false,
    poster: 40,
    front: ["armL", "armR"],
    face: { eyes: "closed", mouth: "grin", brows: "up" },
    tracks: {
      rig: {
        p: [[0, [0, 0]], [14, [0, 0], "out"], [36, [0, -40], "in"], [56, [0, 0], "out"], [120, [0, 0]]],
        s: [[0, [100, 100]], [14, [110, 88], "out"], [30, [93, 110]], [52, [100, 100]], [58, [112, 88], "out"], [80, [100, 100]], [120, [100, 100]]],
      },
      shadow: { s: [[0, [100, 100]], [14, [108, 108]], [36, [66, 66]], [56, [110, 110]], [80, [100, 100]], [120, [100, 100]]] },
      cap: { p: [[0, [0, 0]], [30, [0, 0], "out"], [42, [0, -12], "inOut"], [62, [0, 0], "back"], [120, [0, 0]]], r: [[0, 0], [42, -10], [62, 0], [120, 0]] },
      armL: { r: [[0, 16], [14, 40], [30, 128, "out"], [70, 118], [100, 100], [120, 100]] },
      armR: { r: celebrateArmR },
      book: { r: counter(celebrateArmR).map(([t, v, e]) => [t, v + 12, e]) },
      tassel: { r: [[0, 0], [36, 24], [60, -18], [80, 8], [100, 0], [120, 0]] },
      ...Object.fromEntries(
        [
          ["star1", -150, -150],
          ["star2", 160, -170],
          ["star3", -200, -30],
          ["star4", 200, -50],
          ["star5", -40, -230],
          ["star6", 70, -240],
        ].map(([n, dx, dy], i) => [
          n,
          {
            s: [[0, [0, 0], "hold"], [30 + i * 2, [0, 0], "back"], [48 + i * 2, [110, 110]], [100, [60, 60]], [120, [0, 0]]],
            p: [[0, [0, 0], "hold"], [30 + i * 2, [0, 0], "out"], [70 + i * 2, [dx * 0.25, dy * 0.25]], [120, [dx * 0.32, dy * 0.32]]],
            r: [[0, 0], [120, i % 2 ? 90 : -90]],
            o: [[0, 0, "hold"], [30 + i * 2, 100], [96, 100], [120, 0]],
          },
        ]),
      ),
    },
    extras: [
      { name: "book", parent: "armR", above: "armR", pivot: [338, 408], shapes: closedBook(338, 408) },
      sparkleLayer("star1", 256 - 150, 230 - 150, 22),
      sparkleLayer("star2", 256 + 160, 230 - 170, 18),
      sparkleLayer("star3", 256 - 200, 230 - 30, 16),
      sparkleLayer("star4", 256 + 200, 230 - 50, 22),
      sparkleLayer("star5", 256 - 40, 230 - 230, 14, C.clayHi),
      sparkleLayer("star6", 256 + 70, 230 - 240, 16, C.clayHi),
    ],
  },
  thinking: {
    frames: 150,
    loop: true,
    poster: 40,
    front: ["armR"],
    face: { eyes: "blink", mouth: "side", brows: "raise" },
    tracks: merge(
      {
        head: { r: [[0, 0], [24, 8], [130, 8], [150, 0]] },
        eyes: { p: [[0, [0, 0]], [24, [7, -7]], [130, [7, -7]], [150, [0, 0]]] },
        glasses: { p: [[0, [0, 0]], [24, [0, 0]], [32, [0, -6], "out"], [44, [0, 0]], [150, [0, 0]]] },
        brows: { p: [[0, [0, 0]], [24, [0, -3]], [130, [0, -3]], [150, [0, 0]]] },
        armR: { r: [[0, -16], [24, 128, "out"], [130, 128], [150, -16]] },
        armL: { r: [[0, 16], [150, 16]] },
        question: {
          s: [[0, [0, 0], "hold"], [26, [0, 0], "back"], [44, [100, 100]], [120, [100, 100]], [140, [0, 0]], [150, [0, 0]]],
          p: [[0, [0, 0]], [60, [0, -6]], [100, [0, 4]], [150, [0, 0]]],
        },
        tassel: { r: loop(150, 150, [0, 6, 0, -4, 0]) },
      },
      { eyes: { s: [[0, [100, 100], "hold"], [96, [100, 100]], [100, [100, 8]], [104, [100, 100]]] }, eyesClosed: { o: [[0, 0, "hold"], [99, 100, "hold"], [102, 0, "hold"]] } },
    ),
    extras: [bubbleQ],
  },
  proud: {
    frames: 120,
    loop: true,
    poster: 30,
    front: ["armL", "armR"],
    face: { eyes: "closed", mouth: "open", brows: "up" },
    tracks: {
      rig: { s: [[0, [100, 100]], [24, [102, 103], "out"], [96, [102, 103]], [120, [100, 100]]] },
      head: { r: [[0, 0], [24, -5], [96, -5], [120, 0]] },
      armL: { r: [[0, -34], [24, -40], [96, -40], [120, -34]] },
      armR: { r: [[0, 34], [24, 40], [96, 40], [120, 34]] },
      heldStar: { s: [[0, [100, 100]], [24, [106, 106], "back"], [96, [106, 106]], [120, [100, 100]]], r: loop(120, 120, [0, -4, 0, 4, 0]) },
      spark1: { s: loop(60, 120, [[40, 40], [110, 110], [40, 40]]), r: [[0, 0], [120, 90]] },
      spark2: { s: [[0, [100, 100]], [30, [40, 40]], [60, [100, 100]], [90, [40, 40]], [120, [100, 100]]], r: [[0, 0], [120, -90]] },
      spark3: { s: loop(40, 120, [[50, 50], [100, 100], [50, 50]]) },
    },
    extras: [
      {
        name: "heldStar",
        parent: "rig",
        below: "armL",
        pivot: [256, 372],
        shapes: [path(roundStar(256, 372, 54), lin(256, 318, 256, 426, [[0, C.star], [1, C.starLo]])), path(roundStar(250, 362, 22), C.white, { op: 28 })],
      },
      sparkleLayer("spark1", 110, 150, 20),
      sparkleLayer("spark2", 410, 200, 16),
      sparkleLayer("spark3", 400, 330, 12, C.clayHi),
    ],
  },
  wow: {
    frames: 90,
    loop: false,
    poster: 20,
    face: { eyes: "open", mouth: "wow", brows: "up" },
    tracks: {
      rig: { p: [[0, [0, 0], "out"], [12, [0, -24], "in"], [26, [0, 0]], [90, [0, 0]]], s: [[0, [100, 100]], [10, [95, 106]], [28, [104, 96], "out"], [44, [100, 100]], [90, [100, 100]]] },
      eyes: { s: [[0, [100, 100]], [12, [122, 122], "back"], [60, [116, 116]], [90, [100, 100]]] },
      glasses: { p: [[0, [0, 0]], [14, [0, 10], "back"], [70, [0, 10]], [90, [0, 0]]] },
      brows: { p: [[0, [0, 0]], [12, [0, -6], "out"], [70, [0, -6]], [90, [0, 0]]] },
      armL: { r: [[0, 16], [12, 70, "out"], [70, 60], [90, 16]] },
      armR: { r: [[0, -16], [12, -70, "out"], [70, -60], [90, -16]] },
      cap: { p: [[0, [0, 0]], [12, [0, -14], "out"], [30, [0, 0], "back"], [90, [0, 0]]] },
      tassel: { r: [[0, 0], [14, -20], [34, 12], [54, -4], [90, 0]] },
    },
  },
  oops: {
    frames: 120,
    loop: true,
    poster: 30,
    front: ["armR"],
    face: { eyes: "squeeze", mouth: "frown", brows: "sad" },
    tracks: {
      head: { r: [[0, 0], [10, -6], [20, 6], [30, -4], [40, 0], [120, 0]] },
      glasses: { r: [[0, -7], [120, -7]] },
      cap: { r: [[0, 8], [120, 8]], p: [[0, [6, 4]], [120, [6, 4]]] },
      armR: { r: [[0, 150], [120, 150]] },
      armL: { r: [[0, 16], [120, 16]] },
      sweat: {
        p: [[0, [0, 0], "in"], [80, [0, 36]], [81, [0, 0], "hold"], [120, [0, 0]]],
        o: [[0, 0], [10, 100], [60, 100], [80, 0, "hold"], [120, 0]],
        s: [[0, [60, 60]], [14, [100, 100]], [120, [100, 100]]],
      },
      tassel: { r: [[0, 0], [10, 10], [20, -10], [30, 6], [44, 0], [120, 0]] },
    },
    extras: [sweat],
  },
  "sad-soft": {
    frames: 150,
    loop: true,
    poster: 40,
    face: { eyes: "open", mouth: "frown", brows: "sad" },
    tracks: {
      rig: { s: [[0, [100, 100]], [30, [101, 96]], [150, [101, 96]]] },
      head: { r: [[0, 0], [30, 5], [150, 5]] },
      eyes: { p: [[0, [0, 0]], [30, [0, 5]], [150, [0, 5]]] },
      cap: { r: [[0, 0], [30, 6], [150, 6]] },
      tassel: { r: [[0, 0], [30, 14], [150, 14]] },
      armL: { r: [[0, 16], [30, 6], [150, 6]] },
      armR: { r: [[0, -16], [30, -6], [150, -6]] },
      tearL: { s: [[0, [0, 0]], [40, [100, 100], "out"], [150, [100, 100]]], p: [[0, [0, 0]], [40, [0, 0]], [120, [0, 14]], [150, [0, 14]]] },
      tearR: { s: [[0, [0, 0]], [50, [100, 100], "out"], [150, [100, 100]]], p: [[0, [0, 0]], [50, [0, 0]], [130, [0, 14]], [150, [0, 14]]] },
    },
    extras: [tearL, tearR],
  },
  love: {
    frames: 120,
    loop: true,
    poster: 10,
    face: { eyes: "heart", mouth: "open", brows: "up" },
    tracks: {
      hearts: { s: [[0, [100, 100]], [10, [118, 118], "out"], [24, [100, 100]], [34, [114, 114], "out"], [48, [100, 100]], [120, [100, 100]]] },
      rig: { r: loop(120, 120, [0, 3, 0, -3, 0]) },
      armL: { r: [[0, 50], [120, 50]] },
      armR: { r: [[0, -50], [120, -50]] },
      fh1: { p: [[0, [0, 0], "out"], [120, [-20, -120]]], o: [[0, 0], [20, 100], [90, 100], [120, 0]], s: [[0, [60, 60]], [120, [110, 110]]] },
      fh2: { p: [[0, [0, 0], "hold"], [30, [0, 0], "out"], [120, [24, -110]]], o: [[0, 0, "hold"], [30, 0], [50, 100], [100, 100], [120, 0]], s: [[0, [50, 50]], [120, [90, 90]]] },
    },
    extras: [floatHeart("fh1", 110, 200, 34), floatHeart("fh2", 404, 230, 28)],
  },
  sleepy: {
    frames: 180,
    loop: true,
    poster: 60,
    face: { eyes: "sleepy", mouth: "tiny", brows: "soft" },
    tracks: {
      rig: { s: loop(180, 180, [[100, 100], [104, 96], [100, 100]]) },
      head: { r: loop(180, 180, [0, 6, 0]) },
      glasses: { p: [[0, [0, 6]], [180, [0, 6]]], r: [[0, -4], [180, -4]] },
      cap: { r: [[0, -6], [180, -6]] },
      armL: { r: [[0, 10], [180, 10]] },
      armR: { r: [[0, -10], [180, -10]] },
      ...Object.fromEntries(
        ["z1", "z2", "z3"].map((n, i) => [
          n,
          {
            p: [[0, [0, 0], "hold"], [i * 50, [0, 0], "out"], [i * 50 + 110, [30, -70]], [180, [30, -70]]],
            o: [[0, 0, "hold"], [i * 50, 0], [i * 50 + 20, 100], [i * 50 + 90, 100], [Math.min(i * 50 + 110, 180), 0]],
          },
        ]),
      ),
    },
    extras: [
      { name: "lapBook", parent: "rig", pivot: [256, 430], shapes: openBook(256, 430) },
      zLayer("z1", 372, 116, 12),
      zLayer("z2", 394, 92, 9),
      zLayer("z3", 412, 72, 7),
    ],
  },
  reading: {
    frames: 180,
    loop: true,
    poster: 40,
    front: ["armL", "armR"],
    face: { eyes: "blink", mouth: "smile", brows: "soft" },
    tracks: merge(
      {
        rig: { s: loop(90, 180, [[100, 100], [102, 98.5], [100, 100]]) },
        head: { r: [[0, 0], [20, 3], [90, 3], [110, -3], [160, -3], [180, 0]] },
        eyes: { p: [[0, [-6, 8]], [90, [6, 8]], [100, [-6, 8], "hold"], [180, [-6, 8]]] },
        armL: { r: [[0, -12], [180, -12]] },
        armR: { r: [[0, 12], [96, 12], [112, 30], [130, 12], [180, 12]] },
        page: { s: [[0, [100, 100], "hold"], [100, [100, 100]], [130, [-100, 100], "hold"], [131, [100, 100], "hold"], [180, [100, 100]]] },
        tassel: { r: loop(180, 180, [0, 6, 0, -5, 0]) },
      },
      blink(150),
    ),
    extras: [
      { name: "openBook", parent: "rig", below: "armL", pivot: [256, 350], shapes: openBook(256, 350) },
      { name: "page", parent: "openBook", below: "armL", pivot: [256, 350], shapes: flipPage(256, 350) },
    ],
  },
};

function toLottie(name, anim) {
  return compose({
    name: `cody-${name}`,
    w: W,
    h: H,
    fps: FPS,
    frames: anim.frames,
    layers: buildLayers(anim.face, anim.extras ?? [], anim.front ?? []),
    tracks: anim.tracks,
  });
}

/* ---------------- SVG emitter (rest pose) ---------------- */
function svgPath({ v, i, o, c }) {
  let d = `M${v[0][0].toFixed(1)} ${v[0][1].toFixed(1)}`;
  const seg = (a, b) => {
    const c1 = [v[a][0] + o[a][0], v[a][1] + o[a][1]];
    const c2 = [v[b][0] + i[b][0], v[b][1] + i[b][1]];
    d += `C${c1.map((n) => n.toFixed(1)).join(" ")} ${c2.map((n) => n.toFixed(1)).join(" ")} ${v[b].map((n) => n.toFixed(1)).join(" ")}`;
  };
  for (let k = 1; k < v.length; k++) seg(k - 1, k);
  if (c) {
    seg(v.length - 1, 0);
    d += "Z";
  }
  return d;
}

function toSvg(anim) {
  const layers = buildLayers(anim.face, []);
  const byName = new Map(layers.map((l) => [l.name, l]));
  const defs = [];
  let gid = 0;
  const paint = (p) => {
    if (typeof p === "string") return p;
    const id = `g${gid++}`;
    const stops = p.stops.map(([t, c]) => `<stop offset="${t}" stop-color="${c}"/>`).join("");
    if (p.linear) {
      const [x1, y1, x2, y2] = p.linear;
      defs.push(`<linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}">${stops}</linearGradient>`);
    } else {
      const [cx, cy, r] = p.radial;
      defs.push(`<radialGradient id="${id}" gradientUnits="userSpaceOnUse" cx="${cx}" cy="${cy}" r="${r}">${stops}</radialGradient>`);
    }
    return `url(#${id})`;
  };
  const restRot = (l) => {
    const r = anim.tracks[l.name]?.r?.[0]?.[1] ?? l.restR ?? 0;
    const [px, py] = l.pivot;
    const sc = l.restS ? ` translate(${px} ${py}) scale(${l.restS[0] / 100} ${l.restS[1] / 100}) translate(${-px} ${-py})` : "";
    return (r ? `rotate(${r} ${px} ${py})` : "") + sc;
  };
  const chain = (l) => {
    const parts = [];
    for (let cur = l; cur; cur = cur.parent ? byName.get(cur.parent) : null) parts.unshift(restRot(cur).trim());
    return parts.filter(Boolean).join(" ");
  };
  const body = layers
    .filter((l) => !l.null && l.name !== "eyesClosed")
    .map((l) => {
      const shapes = l.shapes
        .map((sh) => {
          const op = sh.op != null ? ` opacity="${sh.op / 100}"` : "";
          const fill = sh.fill ? ` fill="${paint(sh.fill)}"` : ' fill="none"';
          const stroke = sh.stroke ? ` stroke="${sh.stroke.color}" stroke-width="${sh.stroke.w}" stroke-linecap="round" stroke-linejoin="round"` : "";
          const rot = sh.rot ? ` transform="rotate(${sh.rot} ${sh.cx} ${sh.cy})"` : "";
          if (sh.type === "ellipse") return `<ellipse cx="${sh.cx}" cy="${sh.cy}" rx="${sh.w / 2}" ry="${sh.h / 2}"${fill}${stroke}${op}${rot}/>`;
          if (sh.type === "rect") return `<rect x="${sh.cx - sh.w / 2}" y="${sh.cy - sh.h / 2}" width="${sh.w}" height="${sh.h}" rx="${sh.r}"${fill}${stroke}${op}${rot}/>`;
          return `<path d="${svgPath(sh.p)}"${fill}${stroke}${op}/>`;
        })
        .join("");
      const t = chain(l);
      return t ? `<g transform="${t}">${shapes}</g>` : `<g>${shapes}</g>`;
    })
    .join("\n  ");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="Cody">\n  <defs>${defs.join("")}</defs>\n  ${body}\n</svg>\n`;
}

/* ---------------- write ---------------- */
const manifest = { version: 2, fps: FPS, size: [W, H], animations: [] };
for (const dir of OUT_DIRS) mkdirSync(dir, { recursive: true });
for (const [name, anim] of Object.entries(ANIMS)) {
  const json = JSON.stringify(toLottie(name, anim));
  for (const dir of OUT_DIRS) writeFileSync(join(dir, `${name}.json`), json);
  manifest.animations.push({ name, file: `${name}.json`, frames: anim.frames, loop: anim.loop, poster: anim.poster });
}
mkdirSync(SVG_DIR, { recursive: true });
writeFileSync(join(SVG_DIR, "cody.svg"), toSvg(ANIMS.idle));
for (const dir of OUT_DIRS) writeFileSync(join(dir, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
console.log(`cody: ${manifest.animations.length} animations + svg`);

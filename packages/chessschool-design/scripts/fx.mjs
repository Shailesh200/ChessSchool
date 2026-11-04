#!/usr/bin/env node
// One-shot effect animations (256×256, 60 fps). Text is drawn by the app, not baked in.
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { compose, ellipse, lin, path, poly, rect, smooth, sparkle, strokePath } from "./lottie-kit.mjs";

const OUT = join(dirname(fileURLToPath(import.meta.url)), "..", "assets/lottie/fx");
const C = { brand: "#5B5BD6", brandHi: "#8F8BFF", brandLo: "#3B35A0", gold: "#F6C343", goldHi: "#FFE08A", goldLo: "#D99A1E", coral: "#FF7A59", white: "#FFFFFF" };

const pawnEmblem = (cx, cy, s, color) => [
  ellipse(cx, cy - 0.42 * s, 0.36 * s, 0.36 * s, color),
  rect(cx, cy - 0.16 * s, 0.42 * s, 0.1 * s, 0.05 * s, color),
  path(poly([[cx - 0.16 * s, cy - 0.1 * s], [cx + 0.16 * s, cy - 0.1 * s], [cx + 0.26 * s, cy + 0.3 * s], [cx - 0.26 * s, cy + 0.3 * s]]), color),
  rect(cx, cy + 0.36 * s, 0.66 * s, 0.14 * s, 0.07 * s, color),
];

const burst = (prefix, n, cx, cy, R, color, size) =>
  Array.from({ length: n }, (_, i) => {
    const a = (Math.PI * 2 * i) / n - Math.PI / 2;
    return { name: `${prefix}${i}`, pivot: [cx, cy], shapes: [path(sparkle(cx + Math.cos(a) * R, cy + Math.sin(a) * R, size), color)], a };
  });
const burstTracks = (layers, start, dist) =>
  Object.fromEntries(
    layers.map((l, i) => [
      l.name,
      {
        s: [[0, [0, 0], "hold"], [start, [0, 0], "back"], [start + 14, [100, 100]], [start + 34, [0, 0]]],
        p: [[0, [0, 0], "hold"], [start, [0, 0], "out"], [start + 34, [Math.cos(l.a) * dist, Math.sin(l.a) * dist]]],
        o: [[0, 0, "hold"], [start, 100], [start + 26, 100], [start + 34, 0]],
      },
    ]),
  );

const FX = {};

// +XP: a gold star pops, a ring expands, sparkles fly out.
{
  const sparks = burst("sp", 6, 128, 128, 70, C.gold, 12);
  FX["xp-pop"] = compose({
    name: "fx-xp-pop",
    w: 256,
    h: 256,
    frames: 60,
    layers: [
      { name: "ring", pivot: [128, 128], shapes: [strokePath(smooth([[128, 78], [178, 128], [128, 178], [78, 128]]), C.goldHi, 6)] },
      ...sparks,
      {
        name: "star",
        pivot: [128, 128],
        shapes: [path(sparkle(128, 128, 54, 22), lin(128, 74, 128, 182, [[0, C.goldHi], [1, C.goldLo]])), path(sparkle(118, 114, 12, 4), C.white, { op: 80 })],
      },
    ],
    tracks: {
      star: { s: [[0, [0, 0], "back"], [16, [118, 118]], [26, [100, 100]], [60, [100, 100]]], r: [[0, -30], [26, 0], [60, 0]] },
      ring: { s: [[0, [40, 40], "out"], [30, [150, 150]], [60, [160, 160]]], o: [[0, 0], [6, 100], [30, 0], [60, 0]] },
      ...burstTracks(sparks, 8, 34),
    },
  });
}

// Streak spark: a coral-gold spark ignites with a soft glow.
{
  const sparks = burst("sp", 5, 128, 128, 64, C.coral, 10);
  FX["streak-spark"] = compose({
    name: "fx-streak-spark",
    w: 256,
    h: 256,
    frames: 72,
    layers: [
      { name: "glow", pivot: [128, 128], shapes: [ellipse(128, 128, 150, 150, C.gold, { op: 30 })] },
      ...sparks,
      {
        name: "spark",
        pivot: [128, 140],
        shapes: [
          path(sparkle(128, 128, 62, 20), lin(128, 66, 128, 190, [[0, C.goldHi], [0.55, C.gold], [1, C.coral]])),
          path(sparkle(128, 132, 26, 9), C.white, { op: 85 }),
        ],
      },
    ],
    tracks: {
      spark: { s: [[0, [0, 0], "back"], [18, [112, 112]], [30, [100, 100]], [56, [100, 100]], [72, [90, 90]]], r: [[0, -45], [30, 0], [72, 0]] },
      glow: { s: [[0, [20, 20], "out"], [24, [110, 110]], [48, [90, 90]], [72, [100, 100]]], o: [[0, 0], [12, 100], [72, 60]] },
      ...burstTracks(sparks, 12, 40),
    },
  });
}

// Stamp: a brand seal drops in with squash and an ink ring.
FX.stamp = compose({
  name: "fx-stamp",
  w: 256,
  h: 256,
  frames: 60,
  layers: [
    { name: "ink", pivot: [128, 128], shapes: [strokePath(smooth([[128, 40], [216, 128], [128, 216], [40, 128]]), C.brandHi, 6)] },
    {
      name: "seal",
      pivot: [128, 128],
      shapes: [
        ellipse(128, 128, 168, 168, lin(128, 44, 128, 212, [[0, C.brandHi], [1, C.brand]])),
        strokePath(smooth([[128, 58], [198, 128], [128, 198], [58, 128]]), C.white, 4, { op: 70 }),
        ...pawnEmblem(128, 132, 96, C.white),
      ],
    },
  ],
  tracks: {
    seal: { s: [[0, [190, 190], "in"], [12, [92, 92], "out"], [20, [104, 104]], [28, [100, 100]], [60, [100, 100]]], o: [[0, 0], [6, 100], [60, 100]], r: [[0, -14], [12, -6], [60, -6]] },
    ink: { s: [[0, [80, 80], "hold"], [12, [80, 80], "out"], [40, [128, 128]], [60, [130, 130]]], o: [[0, 0, "hold"], [12, 100], [40, 0], [60, 0]] },
  },
});

// Error shake: a soft coral badge with a gentle side-to-side shake.
FX["error-shake"] = compose({
  name: "fx-error-shake",
  w: 256,
  h: 256,
  frames: 40,
  layers: [
    {
      name: "badge",
      pivot: [128, 128],
      shapes: [
        ellipse(128, 128, 140, 140, C.coral),
        rect(128, 110, 18, 54, 9, C.white),
        ellipse(128, 158, 18, 18, C.white),
      ],
    },
  ],
  tracks: {
    badge: {
      p: [[0, [0, 0]], [6, [-18, 0]], [12, [16, 0]], [18, [-12, 0]], [24, [8, 0]], [30, [-4, 0]], [36, [0, 0]], [40, [0, 0]]],
      s: [[0, [70, 70], "back"], [10, [100, 100]], [40, [100, 100]]],
    },
  },
});

// Splash mark: the app tile scales in, the pawn rises, a ring pulses.
FX["splash-mark"] = compose({
  name: "fx-splash-mark",
  w: 256,
  h: 256,
  frames: 90,
  layers: [
    { name: "pulse", pivot: [128, 128], shapes: [strokePath(smooth([[128, 34], [222, 128], [128, 222], [34, 128]]), C.brandHi, 5)] },
    { name: "tile", pivot: [128, 128], shapes: [rect(128, 128, 168, 168, 44, lin(128, 44, 128, 212, [[0, C.brandHi], [1, C.brand]]))] },
    { name: "pawn", parent: "tile", pivot: [128, 170], shapes: pawnEmblem(128, 132, 104, C.white) },
  ],
  tracks: {
    tile: { s: [[0, [0, 0], "back"], [22, [100, 100]], [90, [100, 100]]], r: [[0, -12], [22, 0], [90, 0]] },
    pawn: { p: [[0, [0, 24], "hold"], [16, [0, 24], "back"], [34, [0, 0]], [90, [0, 0]]], o: [[0, 0, "hold"], [16, 0], [26, 100], [90, 100]] },
    pulse: { s: [[0, [60, 60], "hold"], [30, [60, 60], "out"], [70, [120, 120]], [90, [120, 120]]], o: [[0, 0, "hold"], [30, 100], [70, 0], [90, 0]] },
  },
});

mkdirSync(OUT, { recursive: true });
for (const [name, doc] of Object.entries(FX)) writeFileSync(join(OUT, `${name}.json`), JSON.stringify(doc));
console.log(`fx: ${Object.keys(FX).length} effects`);

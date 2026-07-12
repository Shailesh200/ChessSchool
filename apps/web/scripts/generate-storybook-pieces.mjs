#!/usr/bin/env node
/** Storybook princess chess pieces — original Disney-inspired fairytale silhouettes. */
import { writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const OUT = join(dirname(fileURLToPath(import.meta.url)), "../public/pieces/barbie");
mkdirSync(OUT, { recursive: true });

const BASE =
  "M11.5 35.5h22c1.4 0 2.5 1.1 2.7 2.5l.4 2.5H8.4l.4-2.5c.2-1.4 1.3-2.5 2.7-2.5z";

function wrap(body, pal) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 45 45">
  <defs>
    <linearGradient id="gown" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${pal.gownHi}"/>
      <stop offset="100%" stop-color="${pal.gownLo}"/>
    </linearGradient>
    <linearGradient id="gold" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${pal.goldHi}"/>
      <stop offset="100%" stop-color="${pal.goldLo}"/>
    </linearGradient>
  </defs>
  <ellipse cx="22.5" cy="41" rx="12" ry="2.4" fill="${pal.shadow}" opacity=".35"/>
  ${body}
</svg>`;
}

const PAL = {
  w: {
    gownHi: "#fff8ff",
    gownLo: "#ffd6f0",
    goldHi: "#ffe9a8",
    goldLo: "#e8b84a",
    hair: "#c9956a",
    skin: "#ffe8f2",
    stroke: "#a8558a",
    shadow: "#f0b8dc",
    gem: "#ff6eb4",
    cape: "#c4b5fd",
  },
  b: {
    gownHi: "#5b3d72",
    gownLo: "#3d2858",
    goldHi: "#d4a84b",
    goldLo: "#9a7228",
    hair: "#2a1838",
    skin: "#6b4a78",
    stroke: "#f9a8d4",
    shadow: "#1a1028",
    gem: "#ff8ec8",
    cape: "#4c1d95",
  },
};

function sparkles(pal) {
  return `<path d="M8 10l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z" fill="${pal.goldHi}" opacity=".85"/>
  <path d="M36 14l.6 1.5 1.5.6-1.5.6-.6 1.5-.6-1.5-1.5-.6 1.5-.6z" fill="${pal.goldHi}" opacity=".7"/>`;
}

const SHAPES = {
  p: (pal) => wrap(
    `${sparkles(pal)}
  <circle cx="22.5" cy="12.5" r="4.2" fill="url(#gold)" stroke="${pal.stroke}" stroke-width="1"/>
  <path d="M20.5 8.8h4l.6 2.2h-5.2z" fill="url(#gold)" stroke="${pal.stroke}" stroke-width=".8"/>
  <circle cx="22.5" cy="18" r="5.5" fill="${pal.skin}" stroke="${pal.stroke}" stroke-width="1.1"/>
  <circle cx="20.2" cy="17.5" r="1" fill="${pal.stroke}" opacity=".55"/>
  <circle cx="24.8" cy="17.5" r="1" fill="${pal.stroke}" opacity=".55"/>
  <path d="M16.5 23.5c0 5.5 2.7 9.5 6 9.5s6-4 6-9.5" fill="url(#gown)" stroke="${pal.stroke}" stroke-width="1.1"/>
  <path d="${BASE}" fill="url(#gold)" stroke="${pal.stroke}" stroke-width="1"/>`,
    pal,
  ),

  k: (pal) => wrap(
    `${sparkles(pal)}
  <path d="M17 7.5l1.5 3 3.2-.8-.7 3.2 2.8 1.8-3.2.8.5 3.2 3-.8-1.5-3 2.5-1.8-3-.5.8-3.2z" fill="url(#gold)" stroke="${pal.stroke}" stroke-width=".9"/>
  <path d="M19 5.5h7v2.2h-7z" fill="url(#gold)" stroke="${pal.stroke}" stroke-width=".8"/>
  <circle cx="22.5" cy="15.5" r="6.2" fill="${pal.skin}" stroke="${pal.stroke}" stroke-width="1.1"/>
  <path d="M16 13.5c1.5-3 4-4.5 6.5-4.5s5 1.5 6.5 4.5" fill="none" stroke="${pal.hair}" stroke-width="2.2" stroke-linecap="round"/>
  <circle cx="20" cy="15" r="1" fill="${pal.stroke}" opacity=".6"/>
  <circle cx="25" cy="15" r="1" fill="${pal.stroke}" opacity=".6"/>
  <path d="M14 22c0 6.5 3.8 11.5 8.5 11.5s8.5-5 8.5-11.5" fill="${pal.cape}" stroke="${pal.stroke}" stroke-width="1.1" opacity=".9"/>
  <path d="M16 24h13l-1.5 8H17.5z" fill="url(#gown)" stroke="${pal.stroke}" stroke-width="1"/>
  <path d="${BASE}" fill="url(#gold)" stroke="${pal.stroke}" stroke-width="1"/>`,
    pal,
  ),

  q: (pal) => wrap(
    `${sparkles(pal)}
  <path d="M14 8.5l2 2.8h3.2L17.5 8.5h2l1.6 2.8h3.2L21 8.5h1.5l2 2.8h3.2L24.5 8.5h1.5l2 2.8h3.2L28 8.5h1z" fill="url(#gold)" stroke="${pal.stroke}" stroke-width=".75"/>
  <circle cx="17" cy="7.8" r="1.1" fill="${pal.gem}"/>
  <circle cx="22.5" cy="6.8" r="1.3" fill="${pal.gem}"/>
  <circle cx="28" cy="7.8" r="1.1" fill="${pal.gem}"/>
  <path d="M13 12c2.5-2 5.5-3 9.5-3s7 1 9.5 3" fill="none" stroke="${pal.hair}" stroke-width="2.4" stroke-linecap="round"/>
  <circle cx="22.5" cy="16.5" r="6.5" fill="${pal.skin}" stroke="${pal.stroke}" stroke-width="1.1"/>
  <circle cx="19.8" cy="16" r="1.1" fill="${pal.stroke}" opacity=".55"/>
  <circle cx="25.2" cy="16" r="1.1" fill="${pal.stroke}" opacity=".55"/>
  <path d="M11 24c0 8 5 14 11.5 14s11.5-6 11.5-14c-2.5 2.5-6 4-11.5 4s-9-1.5-11.5-4z" fill="url(#gown)" stroke="${pal.stroke}" stroke-width="1.2"/>
  <path d="M14 26c3 3 6 4.5 8.5 4.5s5.5-1.5 8.5-4.5" fill="none" stroke="${pal.gownHi}" stroke-width="1" opacity=".7"/>
  <path d="${BASE}" fill="url(#gold)" stroke="${pal.stroke}" stroke-width="1"/>`,
    pal,
  ),

  r: (pal) => wrap(
    `<rect x="13" y="10" width="5" height="7" rx="1.5" fill="url(#gown)" stroke="${pal.stroke}" stroke-width="1"/>
  <rect x="20" y="8" width="5" height="9" rx="1.5" fill="url(#gown)" stroke="${pal.stroke}" stroke-width="1"/>
  <rect x="27" y="10" width="5" height="7" rx="1.5" fill="url(#gown)" stroke="${pal.stroke}" stroke-width="1"/>
  <path d="M15 9.5h1.8l-.9-2.2zM24 7.5h1.8l-.9-2.5zM33 9.5h1.8l-.9-2.2z" fill="${pal.gem}" stroke="${pal.stroke}" stroke-width=".6"/>
  <rect x="12" y="17" width="21" height="5.5" rx="1.2" fill="url(#gold)" stroke="${pal.stroke}" stroke-width="1"/>
  <path d="M15 22.5h15v10c0 1.5-3.4 2.8-7.5 2.8S15 34 15 32.5z" fill="url(#gown)" stroke="${pal.stroke}" stroke-width="1.1"/>
  <path d="M19 26h7v4h-7z" fill="${pal.skin}" opacity=".35" stroke="${pal.stroke}" stroke-width=".8"/>
  <circle cx="22.5" cy="28" r="1.2" fill="${pal.gem}"/>
  <path d="${BASE}" fill="url(#gold)" stroke="${pal.stroke}" stroke-width="1"/>`,
    pal,
  ),

  b: (pal) => wrap(
    `<path d="M22.5 5.5c1.5 0 2.7 1 2.7 2.3 0 .8-.4 1.5-1 1.9" fill="none" stroke="${pal.stroke}" stroke-width="1"/>
  <path d="M16 11l6.5-4.5 6.5 4.5v5l-6.5 3-6.5-3z" fill="url(#gold)" stroke="${pal.stroke}" stroke-width="1"/>
  <path d="M22.5 4.5l1.8 4.5 4.5 1.8-4.5 1.8-1.8 4.5-1.8-4.5-4.5-1.8 4.5-1.8z" fill="${pal.gem}" stroke="${pal.stroke}" stroke-width=".7"/>
  <circle cx="22.5" cy="19.5" r="6.5" fill="${pal.skin}" stroke="${pal.stroke}" stroke-width="1.1"/>
  <circle cx="19.8" cy="19" r="1" fill="${pal.stroke}" opacity=".55"/>
  <circle cx="25.2" cy="19" r="1" fill="${pal.stroke}" opacity=".55"/>
  <path d="M15.5 26c0 5.5 3.1 9.5 7 9.5s7-4 7-9.5" fill="url(#gown)" stroke="${pal.stroke}" stroke-width="1.1"/>
  <path d="M20 30h5v1.5c0 .8-1.1 1.5-2.5 1.5s-2.5-.7-2.5-1.5z" fill="url(#gold)" stroke="${pal.stroke}" stroke-width=".7"/>
  <path d="${BASE}" fill="url(#gold)" stroke="${pal.stroke}" stroke-width="1"/>`,
    pal,
  ),

  n: (pal) => wrap(
    `<path d="M11 34c1.5-10 6-16 12.5-18.5 2-.9 3.2-2.8 3.2-5 0-2.8-2.2-5-5-5-2.2 0-4 1.2-5 3.2-1.5 3-4.5 4-7 2.5-1-.6-1.4-1.8-1-2.8.8-2 2.5-4.5 4-6 1.5-1.5 3.5-2.5 6-2.5 6.5 0 11.5 5.5 11.5 12.5V34z" fill="url(#gown)" stroke="${pal.stroke}" stroke-width="1.2" stroke-linejoin="round"/>
  <path d="M26 12c3-1 6 .5 7.5 3" fill="none" stroke="${pal.hair}" stroke-width="2.5" stroke-linecap="round"/>
  <circle cx="25" cy="14.5" r="1.4" fill="${pal.stroke}" opacity=".55"/>
  <path d="M28 10.5c1.5 0 3 .8 3.5 2" fill="none" stroke="url(#gold)" stroke-width="1.4" stroke-linecap="round"/>
  <path d="M14 30c2 1.5 5 2 8.5 2" fill="none" stroke="${pal.goldHi}" stroke-width="1" opacity=".6"/>
  <path d="${BASE}" fill="url(#gold)" stroke="${pal.stroke}" stroke-width="1"/>`,
    pal,
  ),
};

for (const color of ["w", "b"]) {
  const pal = PAL[color];
  for (const [type, fn] of Object.entries(SHAPES)) {
    writeFileSync(join(OUT, `${color}${type.toUpperCase()}.svg`), fn(pal));
  }
}

console.log("Wrote 12 storybook princess pieces to", OUT);

#!/usr/bin/env node
/** Shonen adventure chess pieces — Naruto / One Piece inspired (original silhouettes). */
import { writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const OUT = join(dirname(fileURLToPath(import.meta.url)), "../public/pieces/anime");
mkdirSync(OUT, { recursive: true });

const BASE =
  "M11 35.5h23c1.3 0 2.4 1 2.6 2.3l.35 2.2H8.05l.35-2.2c.2-1.3 1.3-2.3 2.6-2.3z";

function wrap(body, pal) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 45 45">
  <defs>
    <linearGradient id="jacket" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${pal.jacketHi}"/>
      <stop offset="100%" stop-color="${pal.jacketLo}"/>
    </linearGradient>
    <linearGradient id="hair" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${pal.hairHi}"/>
      <stop offset="100%" stop-color="${pal.hairLo}"/>
    </linearGradient>
  </defs>
  <ellipse cx="22.5" cy="41" rx="11.5" ry="2.3" fill="${pal.shadow}" opacity=".5"/>
  ${body}
</svg>`;
}

const PAL = {
  w: {
    skin: "#fde0c8",
    jacketHi: "#ff8c42",
    jacketLo: "#e85d04",
    hairHi: "#ffd166",
    hairLo: "#f4a623",
    stroke: "#1a0f28",
    shadow: "#2a1838",
    metal: "#c5cdd8",
    metalHi: "#eef2f7",
    band: "#1e3a5f",
    accent: "#38bdf8",
    eye: "#1a1028",
    shine: "#fff",
  },
  b: {
    skin: "#8b6a58",
    jacketHi: "#1e4a7a",
    jacketLo: "#0f2847",
    hairHi: "#4a5568",
    hairLo: "#1f2937",
    stroke: "#f8fafc",
    shadow: "#0a0812",
    metal: "#64748b",
    metalHi: "#94a3b8",
    band: "#0f172a",
    accent: "#f97316",
    eye: "#f8fafc",
    shine: "#e2e8f0",
  },
};

function animeEyes(pal, y, spread = 6.5) {
  const lx = 22.5 - spread / 2;
  const rx = 22.5 + spread / 2;
  return `<ellipse cx="${lx}" cy="${y}" rx="2.1" ry="2.5" fill="${pal.eye}"/>
  <ellipse cx="${rx}" cy="${y}" rx="2.1" ry="2.5" fill="${pal.eye}"/>
  <circle cx="${lx + 0.6}" cy="${y - 0.8}" r=".75" fill="${pal.shine}"/>
  <circle cx="${rx + 0.6}" cy="${y - 0.8}" r=".75" fill="${pal.shine}"/>`;
}

function headband(pal, y = 11.5) {
  return `<rect x="14.5" y="${y}" width="16" height="3.2" rx=".8" fill="${pal.band}" stroke="${pal.stroke}" stroke-width="1.1"/>
  <rect x="18.5" y="${y + 0.35}" width="8" height="2.5" rx=".4" fill="${pal.metal}" stroke="${pal.stroke}" stroke-width=".8"/>
  <path d="M19.2 ${y + 1.1}h5.6M20 ${y + 1.9}h4" stroke="${pal.stroke}" stroke-width=".55" opacity=".65"/>`;
}

function speedLines(pal) {
  return `<path d="M4 18h5M3 22h6M5 26h4" stroke="${pal.accent}" stroke-width="1.2" stroke-linecap="round" opacity=".55"/>
  <path d="M41 20h-5M42 24h-6" stroke="${pal.accent}" stroke-width="1.2" stroke-linecap="round" opacity=".45"/>`;
}

const SHAPES = {
  p: (pal) => wrap(
    `${speedLines(pal)}
  <circle cx="22.5" cy="14.5" r="7" fill="${pal.skin}" stroke="${pal.stroke}" stroke-width="2"/>
  ${animeEyes(pal, 14.5, 5.5)}
  <rect x="15" y="9.8" width="15" height="3" rx="1" fill="${pal.band}" stroke="${pal.stroke}" stroke-width="1.2"/>
  <rect x="18.5" y="10.1" width="8" height="2.2" rx=".4" fill="${pal.metal}" stroke="${pal.stroke}" stroke-width=".7"/>
  <path d="M15.5 21.5c0 6 3.1 10.5 7 10.5s7-4.5 7-10.5" fill="url(#jacket)" stroke="${pal.stroke}" stroke-width="2" stroke-linejoin="round"/>
  <path d="${BASE}" fill="${pal.jacketLo}" stroke="${pal.stroke}" stroke-width="1.4"/>`,
    pal,
  ),

  k: (pal) => wrap(
    `${speedLines(pal)}
  <path d="M15 6l2.5 4.5 5-.8-1.2 5 4.2 2.8-5.2.5 1 5.2 4.8-1.5-2.8-4.8 3-3.2-1.2-5 4.8.2z" fill="url(#hair)" stroke="${pal.stroke}" stroke-width="1.3" stroke-linejoin="round"/>
  ${headband(pal, 12)}
  <circle cx="22.5" cy="18" r="7.2" fill="${pal.skin}" stroke="${pal.stroke}" stroke-width="2"/>
  ${animeEyes(pal, 18)}
  <path d="M13.5 25.5c0 7.5 4 13 9 13s9-5.5 9-13" fill="url(#jacket)" stroke="${pal.stroke}" stroke-width="2"/>
  <path d="M17 27h11l-1 6.5H18z" fill="${pal.band}" stroke="${pal.stroke}" stroke-width="1.2"/>
  <path d="${BASE}" fill="${pal.jacketLo}" stroke="${pal.stroke}" stroke-width="1.4"/>`,
    pal,
  ),

  q: (pal) => wrap(
    `<path d="M12 10c3-3 7-4.5 10.5-4.5s7.5 1.5 10.5 4.5" fill="none" stroke="url(#hair)" stroke-width="3" stroke-linecap="round"/>
  <path d="M32 9c2 4 2.5 9 1 14" fill="none" stroke="url(#hair)" stroke-width="2.8" stroke-linecap="round"/>
  <circle cx="22.5" cy="17.5" r="7" fill="${pal.skin}" stroke="${pal.stroke}" stroke-width="2"/>
  ${animeEyes(pal, 17.5)}
  <ellipse cx="30" cy="12" rx="2.2" ry="3.2" fill="${pal.accent}" stroke="${pal.stroke}" stroke-width="1.2"/>
  <path d="M12.5 25c0 8.5 4.5 14.5 10 14.5s10-6 10-14.5" fill="url(#jacket)" stroke="${pal.stroke}" stroke-width="2"/>
  <path d="M14 27c2.5 4 5.5 6 8.5 6s6-2 8.5-6" fill="none" stroke="${pal.jacketHi}" stroke-width="1.3" opacity=".7"/>
  <path d="${BASE}" fill="${pal.jacketLo}" stroke="${pal.stroke}" stroke-width="1.4"/>`,
    pal,
  ),

  r: (pal) => wrap(
    `<rect x="12" y="12" width="6" height="9" rx="1" fill="url(#jacket)" stroke="${pal.stroke}" stroke-width="1.6"/>
  <rect x="19.5" y="9" width="6" height="12" rx="1" fill="url(#jacket)" stroke="${pal.stroke}" stroke-width="1.6"/>
  <rect x="27" y="12" width="6" height="9" rx="1" fill="url(#jacket)" stroke="${pal.stroke}" stroke-width="1.6"/>
  <path d="M14.5 10.5h2.5M22 8h2.5M29.5 10.5h2.5" stroke="${pal.accent}" stroke-width="2" stroke-linecap="round"/>
  <rect x="11" y="21" width="23" height="5" rx="1" fill="${pal.band}" stroke="${pal.stroke}" stroke-width="1.4"/>
  <circle cx="22.5" cy="23.5" r="3.8" fill="${pal.metal}" stroke="${pal.stroke}" stroke-width="1.4"/>
  <path d="M20.5 22.5h4v2h-4z" fill="${pal.stroke}" opacity=".5"/>
  <path d="M15 26.5h15v7c0 1.8-3.4 3.2-7.5 3.2S15 35.3 15 33.5z" fill="url(#jacket)" stroke="${pal.stroke}" stroke-width="1.6"/>
  <path d="${BASE}" fill="${pal.jacketLo}" stroke="${pal.stroke}" stroke-width="1.4"/>`,
    pal,
  ),

  b: (pal) => wrap(
    `<path d="M22.5 4.5c1.6 0 2.8 1.1 2.8 2.5s-1.2 2.5-2.8 2.5" fill="none" stroke="${pal.stroke}" stroke-width="1.4"/>
  <path d="M15 12.5l7.5-5 7.5 5v6l-7.5 3.5-7.5-3.5z" fill="${pal.band}" stroke="${pal.stroke}" stroke-width="1.6" stroke-linejoin="round"/>
  <circle cx="22.5" cy="8.5" r="2.2" fill="${pal.accent}" stroke="${pal.stroke}" stroke-width="1.2"/>
  <path d="M21 7.5h3v2h-3z" fill="${pal.stroke}" opacity=".45"/>
  <circle cx="22.5" cy="20.5" r="6.8" fill="${pal.skin}" stroke="${pal.stroke}" stroke-width="2"/>
  ${animeEyes(pal, 20.5, 6)}
  <path d="M15.5 27.5c0 5.5 3.1 9.5 7 9.5s7-4 7-9.5" fill="url(#jacket)" stroke="${pal.stroke}" stroke-width="2"/>
  <path d="${BASE}" fill="${pal.jacketLo}" stroke="${pal.stroke}" stroke-width="1.4"/>`,
    pal,
  ),

  n: (pal) => wrap(
    `${speedLines(pal)}
  <path d="M10 34c2-11 7.5-17.5 14-19.5 2.2-1 3.5-3.2 3.5-5.8 0-3-2.5-5.5-5.5-5.5-2.5 0-4.6 1.4-5.8 3.6-1.8 3.2-5.2 4.5-8.2 3-1.2-.7-1.6-2.2-1.1-3.4 1.2-2.8 3.5-5.8 5.8-7.5 2-1.5 4.5-2.3 7.2-2.3 7.5 0 13 6.5 13 14.5V34z" fill="url(#jacket)" stroke="${pal.stroke}" stroke-width="2" stroke-linejoin="round"/>
  <path d="M27 11.5c3.5-1.2 7 .8 8.5 4.5" fill="none" stroke="url(#hair)" stroke-width="2.8" stroke-linecap="round"/>
  <path d="M30 9.5c1.8 0 3.5 1 4.2 2.8" fill="none" stroke="${pal.accent}" stroke-width="1.6" stroke-linecap="round"/>
  <ellipse cx="26.5" cy="14.5" rx="2" ry="2.4" fill="${pal.eye}"/>
  <circle cx="27.2" cy="13.6" r=".7" fill="${pal.shine}"/>
  <path d="M12 30c3 2 6.5 2.8 10 2.8" fill="none" stroke="${pal.accent}" stroke-width="1.5" stroke-linecap="round" opacity=".7"/>
  <path d="${BASE}" fill="${pal.jacketLo}" stroke="${pal.stroke}" stroke-width="1.4"/>`,
    pal,
  ),
};

for (const color of ["w", "b"]) {
  const pal = PAL[color];
  for (const [type, fn] of Object.entries(SHAPES)) {
    writeFileSync(join(OUT, `${color}${type.toUpperCase()}.svg`), fn(pal));
  }
}

console.log("Wrote 12 shonen anime pieces to", OUT);

#!/usr/bin/env node
// Builds src/data/mistakes.json: how often people at each rating lose centipawns, from the
// public-domain Lichess database. Streams one monthly file (one HTTP request, decoded on the fly by `zstd`,
// never written to disk) and stops after enough games with engine evaluations.
//   node --experimental-strip-types scripts/build-mistakes.mjs [month=2026-10] [games=200000]
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { Readable } from "node:stream";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import { Chess } from "chess.js";
import { BANDS, bandOf, CP_BUCKETS, phaseOf } from "../src/phase.ts";

const month = process.argv[2] ?? "2026-10";
const target = Number(process.argv[3] ?? 200_000);
const url = `https://database.lichess.org/standard/lichess_db_standard_rated_${month}.pgn.zst`;
const OUT = join(dirname(fileURLToPath(import.meta.url)), "../src/data/mistakes.json");
const PHASES = ["opening", "middlegame", "endgame"];
const CAP = 1000;

// counts[band][phase][tactical 0|1][bucket]
const counts = Object.fromEntries(BANDS.map((b) => [b, Object.fromEntries(PHASES.map((p) => [p, [CP_BUCKETS.map(() => 0), CP_BUCKETS.map(() => 0)]]))]));
const bucketOf = (loss) => {
  let i = 0;
  while (i + 1 < CP_BUCKETS.length && loss >= CP_BUCKETS[i + 1]) i++;
  return i;
};
/** Lichess eval (white's view) → capped centipawns. */
const sq = (i) => "abcdefgh"[i & 0xf] + (8 - (i >> 4));
const cp = (s) => (s.startsWith("#") ? (s.startsWith("#-") ? -CAP : CAP) : Math.max(-CAP, Math.min(CAP, Math.round(Number(s) * 100))));

function addGame(tags, movetext) {
  const elo = { w: Number(tags.WhiteElo), b: Number(tags.BlackElo) };
  const f = new Chess();
  let before = 20; // a typical start-position eval
  let ply = 0;
  const re = /\{([^}]*)\}|(\S+)/g;
  let pending = null;
  for (let m; (m = re.exec(movetext)); ) {
    if (m[2]) {
      const tok = m[2];
      if (/^\d+\.+$/.test(tok) || /^(1-0|0-1|1\/2-1\/2|\*)$/.test(tok)) continue;
      const san = /^(?:(O-O-O)|(O-O)|([NBRQK])?([a-h])?([1-8])?x?([a-h][1-8])(?:=([NBRQ]))?)[+#]?[?!]*$/.exec(tok);
      if (!san) return;
      // chess.js internals (pinned 1.4, as in engine.ts): public moves() builds SAN for every move and is ~20x slower.
      const legal = f._moves({ legal: true });
      const color = f._turn;
      let tactical = 0;
      for (const x of legal) {
        if (x.captured) tactical = 1;
        else {
          f._makeMove(x);
          if (f._isKingAttacked(f._turn)) tactical = 1;
          f._undoMove();
        }
        if (tactical) break;
      }
      let placement = "";
      for (let sq = 0; sq < 128; sq++) if (!(sq & 0x88) && f._board[sq]) placement += f._board[sq].type;
      const phase = phaseOf(placement, ply);
      const [, long, short, piece = "p", file, rank, to, promo] = san;
      const mv = legal.find((x) =>
        long ? x.flags & 64 : short ? x.flags & 32 :
        x.piece === piece.toLowerCase() && sq(x.to) === to && (!file || sq(x.from)[0] === file) && (!rank || sq(x.from)[1] === rank) && (x.promotion ?? "") === (promo ?? "").toLowerCase(),
      );
      if (!mv) return;
      f._makeMove(mv);
      ply++;
      pending = { tactical, phase, color };
    } else if (pending) {
      const ev = /\[%eval ([^\]\s]+)/.exec(m[1]);
      if (!ev) return;
      const after = cp(ev[1]);
      const loss = Math.max(0, pending.color === "w" ? before - after : after - before);
      counts[bandOf(elo[pending.color])][pending.phase][pending.tactical][bucketOf(loss)]++;
      before = after;
      pending = null;
    }
  }
}

const controller = new AbortController();
const res = await fetch(url, { signal: controller.signal, headers: { "user-agent": "chessschool-mistake-model (one stream)" } });
if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);
let bytes = 0;
const body = Readable.fromWeb(res.body);
body.on("data", (c) => (bytes += c.length));
// Node's zlib zstd rejects Lichess frames, so decode with the zstd CLI (brew install zstd).
const zstd = spawn("zstd", ["-dc", "--long=31"], { stdio: ["pipe", "pipe", "ignore"] });
body.pipe(zstd.stdin);
zstd.stdin.on("error", () => {});
const lines = createInterface({ input: zstd.stdout, crlfDelay: Infinity });

let seen = 0;
let kept = 0;
let tags = {};
let started = Date.now();
try {
  for await (const line of lines) {
    if (line.startsWith("[")) {
      const t = /^\[(\w+) "(.*)"\]$/.exec(line);
      if (t) tags[t[1]] = t[2];
      continue;
    }
    if (!line || line.startsWith(" ")) continue;
    // Movetext is a single line in Lichess exports.
    seen++;
    const base = Number((tags.TimeControl ?? "-").split("+")[0]);
    if (line.includes("[%eval") && base >= 180 && tags.WhiteElo && tags.BlackElo && tags.Variant === undefined) {
      addGame(tags, line);
      kept++;
      if (kept % 10_000 === 0) console.error(`${kept} kept / ${seen} seen, ${(bytes / 1e6).toFixed(0)} MB, ${((Date.now() - started) / 1000).toFixed(0)}s`);
      if (kept >= target) break;
    }
    tags = {};
  }
} finally {
  controller.abort();
  body.destroy();
  zstd.kill();
}

const LOSS = { inaccuracy: 50, mistake: 100, blunder: 300 };
const bands = {};
for (const b of BANDS) {
  const all = CP_BUCKETS.map((_, i) => PHASES.reduce((s, p) => s + counts[b][p][0][i] + counts[b][p][1][i], 0));
  const n = all.reduce((a, c) => a + c, 0);
  const atLeast = (cpl) => all.reduce((s, c, i) => s + (CP_BUCKETS[i] >= cpl ? c : 0), 0) / (n || 1);
  bands[b] = {
    moves: n,
    rates: { inaccuracy: +atLeast(LOSS.inaccuracy).toFixed(4), mistake: +atLeast(LOSS.mistake).toFixed(4), blunder: +atLeast(LOSS.blunder).toFixed(4) },
    // [phase] -> [quiet, tactical] -> counts per bucket
    counts: counts[b],
  };
}
const out = {
  source: url,
  month,
  license: "CC0 (Lichess open database)",
  gamesKept: kept,
  gamesSeen: seen,
  bytesDownloaded: bytes,
  filter: "standard rated, base time >= 180s, games with [%eval]; mover Elo band; evals capped at ±1000cp",
  tactical: "a capture or check was available to the mover (the PGN has no best move)",
  thresholds: LOSS,
  buckets: CP_BUCKETS,
  phases: PHASES,
  bands,
};
writeFileSync(OUT, JSON.stringify(out) + "\n");
console.error(`wrote ${OUT}: ${kept} games kept of ${seen} seen, ${bytes} bytes downloaded`);

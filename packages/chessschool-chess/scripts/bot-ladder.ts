// Seeded self-play round robin of the bot roster, to check each bot plays near its target rating.
// Ratings are fitted from the results (maximum likelihood, Elo scale) and anchored so their mean
// equals the mean target, so this measures the spacing between bots, not an absolute scale.
//   ../../apps/chessschool-api/node_modules/.bin/tsx scripts/bot-ladder.ts [gamesPerPair=6] [workers=6]
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { Chess } from "chess.js";
import { BOTS, chooseMove, type BotId } from "../src/bot";

const MAX_PLIES = 160;
const VALUE: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };

const seq = (seed: number) => () => {
  seed = (seed * 16807) % 2147483647;
  return (seed - 1) / 2147483646;
};

/** White's score: 1, 0.5 or 0. Unfinished games are adjudicated on material (3+ pawns ahead wins). */
function play(white: BotId, black: BotId, seed: number): number {
  const chess = new Chess();
  const rand = seq(seed);
  while (!chess.isGameOver() && chess.history().length < MAX_PLIES) {
    const m = chooseMove(chess.fen(), chess.turn() === "w" ? white : black, rand)!;
    chess.move(m.san);
  }
  if (chess.isCheckmate()) return chess.turn() === "w" ? 0 : 1;
  if (chess.isGameOver()) return 0.5;
  let diff = 0;
  for (const row of chess.board()) for (const c of row) if (c) diff += (c.color === "w" ? 1 : -1) * VALUE[c.type];
  return diff >= 3 ? 1 : diff <= -3 ? 0 : 0.5;
}

const [mode, ...args] = process.argv.slice(2);
const pairs: [BotId, BotId][] = [];
for (let i = 0; i < BOTS.length; i++) for (let j = i + 1; j < BOTS.length; j++) pairs.push([BOTS[i].id, BOTS[j].id]);

if (mode === "--worker") {
  const [games, index, count] = args.map(Number);
  const out: { a: BotId; b: BotId; score: number }[] = [];
  let k = 0;
  for (const [a, b] of pairs)
    for (let g = 0; g < games; g++) {
      if (k++ % count !== index) continue;
      const aWhite = g % 2 === 0;
      const s = play(aWhite ? a : b, aWhite ? b : a, 1000 + k * 7919);
      out.push({ a, b, score: aWhite ? s : 1 - s });
    }
  process.stdout.write(JSON.stringify(out));
} else {
  const games = Number(mode ?? 6);
  const workers = Number(args[0] ?? 6);
  const self = fileURLToPath(import.meta.url);
  const t0 = Date.now();
  const parts = await Promise.all(
    Array.from({ length: workers }, (_, i) =>
      new Promise<{ a: BotId; b: BotId; score: number }[]>((resolve, reject) => {
        const p = spawn(process.execPath, [...process.execArgv, self, "--worker", String(games), String(i), String(workers)], { stdio: ["ignore", "pipe", "inherit"] });
        let buf = "";
        p.stdout.on("data", (c) => (buf += c));
        p.on("close", (code) => (code === 0 ? resolve(JSON.parse(buf)) : reject(new Error(`worker ${i} exited ${code}`))));
      }),
    ),
  );
  const results = parts.flat();
  // Fit Elo ratings by gradient ascent on the log-likelihood.
  const ids = BOTS.map((b) => b.id);
  const r = Object.fromEntries(ids.map((id) => [id, 1000])) as Record<BotId, number>;
  const expected = (x: number, y: number) => 1 / (1 + 10 ** ((y - x) / 400));
  for (let it = 0; it < 5000; it++) {
    const grad = Object.fromEntries(ids.map((id) => [id, 0])) as Record<BotId, number>;
    for (const { a, b, score } of results) {
      const e = expected(r[a], r[b]);
      grad[a] += score - e;
      grad[b] -= score - e;
    }
    for (const id of ids) r[id] = Math.max(-2000, Math.min(4000, r[id] + 4 * grad[id]));
  }
  const meanTarget = BOTS.reduce((s, b) => s + b.rating, 0) / BOTS.length;
  const meanFit = ids.reduce((s, id) => s + r[id], 0) / ids.length;
  console.log(`${results.length} games (${games} per pair), ${((Date.now() - t0) / 1000).toFixed(0)}s`);
  for (const b of BOTS) {
    const mine = results.filter((x) => x.a === b.id || x.b === b.id);
    const pts = mine.reduce((s, x) => s + (x.a === b.id ? x.score : 1 - x.score), 0);
    const fit = Math.round(r[b.id] - meanFit + meanTarget);
    console.log(`${b.name.padEnd(17)} target ${b.rating}  measured ${fit}  (${fit - b.rating >= 0 ? "+" : ""}${fit - b.rating})  score ${pts}/${mine.length}`);
  }
  for (const [a, b] of pairs) {
    const g = results.filter((x) => x.a === a && x.b === b);
    console.log(`  ${a} vs ${b}: ${g.reduce((s, x) => s + x.score, 0)}/${g.length}`);
  }
}

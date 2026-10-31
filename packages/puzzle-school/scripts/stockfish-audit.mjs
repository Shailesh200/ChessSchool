#!/usr/bin/env node
/**
 * Stockfish puzzle bank audit — NOT run in CI.
 *
 *   node packages/puzzle-school/scripts/stockfish-audit.mjs [options]
 *
 * Options:
 *   --bank=DIR          default packages/puzzle-school/data/puzzles
 *   --out=DIR           default plans/content-audit
 *   --tier=fast|deep    analysis tier (default fast)
 *   --ids=FILE          newline ids to audit only
 *   --flagged=FILE      prior CSV with failures to re-audit (deep tier)
 *   --workers=N         default os.cpus().length
 *   --limit=N           cap rows (smoke)
 *
 * Convention (from compile-lesson.mjs): line[0] is opponent setup; solver plays
 * odd indices (1,3,5,…). Student board FEN is after line[0].
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { spawn } from "node:child_process";
import os from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Worker, isMainThread, parentPort, workerData } from "node:worker_threads";
import { Chess } from "chess.js";
import { loadBank, bucketPuzzles } from "../src/bank.mjs";
import { compilePuzzleSteps } from "../src/compile-lesson.mjs";
import { MATRIX } from "../data/matrix.mjs";
import { stageForRating } from "../src/concepts.mjs";

const STOCKFISH = process.env.STOCKFISH ?? "/usr/games/stockfish";

const here = dirname(fileURLToPath(import.meta.url));
const pkgRoot = join(here, "..");
const repoRoot = join(pkgRoot, "../..");

/** @typedef {{ cp: number, mate: number | null }} EvalScore */

function parseArgs(argv) {
  const opts = {
    bank: join(pkgRoot, "data/puzzles"),
    out: join(repoRoot, "plans/content-audit"),
    tier: "fast",
    workers: Math.max(1, Number(process.env.AUDIT_WORKERS ?? 0) || os.cpus().length),
    limit: 0,
    idsFile: "",
    flaggedFile: "",
  };
  for (const a of argv) {
    if (a.startsWith("--bank=")) opts.bank = a.slice(7);
    else if (a.startsWith("--out=")) opts.out = a.slice(6);
    else if (a.startsWith("--tier=")) opts.tier = a.slice(7);
    else if (a.startsWith("--workers=")) opts.workers = Math.max(1, Number(a.slice(10)));
    else if (a.startsWith("--limit=")) opts.limit = Number(a.slice(8));
    else if (a.startsWith("--ids=")) opts.idsFile = a.slice(6);
    else if (a.startsWith("--flagged=")) opts.flaggedFile = a.slice(10);
  }
  return opts;
}

function uciMove(uci) {
  return {
    from: uci.slice(0, 2),
    to: uci.slice(2, 4),
    promotion: uci.length > 4 ? uci[4] : undefined,
  };
}

/** @param {EvalScore} s @param {string} stm w|b */
function scoreToCp(s, stm) {
  if (s.mate != null) {
    const sign = s.mate > 0 ? 1 : -1;
    const cp = sign * (100000 - Math.abs(s.mate) * 100);
    return stm === "w" ? cp : -cp;
  }
  return stm === "w" ? s.cp : -s.cp;
}

function parseInfoScore(line, stm) {
  const mateM = line.match(/\bscore mate (-?\d+)/);
  if (mateM) {
    const mate = Number(mateM[1]);
    return { cp: 0, mate, stmCp: scoreToCp({ cp: 0, mate }, stm) };
  }
  const cpM = line.match(/\bscore cp (-?\d+)/);
  if (cpM) {
    const cp = Number(cpM[1]);
    return { cp, mate: null, stmCp: scoreToCp({ cp, mate: null }, stm) };
  }
  return null;
}

function tierConfig(tier) {
  if (tier === "deep") {
    return {
      depth: 18,
      movetime: 300,
      checkUnique: true,
      label: "deep depth=18 movetime=300ms multipv=2 + uniqueness",
    };
  }
  return {
    depth: 10,
    movetime: 35,
    checkUnique: false,
    label: "fast depth=10 movetime=35ms multipv=2 (no uniqueness)",
  };
}

class StockfishPool {
  /** @param {string} bin */
  constructor(bin) {
    this.bin = bin;
    this.proc = spawn(bin, [], { stdio: ["pipe", "pipe", "pipe"] });
    this.buf = "";
    this.pending = null;
    this.proc.stdout.on("data", (d) => this.onData(d.toString()));
    this.proc.stderr.on("data", () => {});
    this.ready = this.init();
  }

  send(cmd) {
    this.proc.stdin.write(`${cmd}\n`);
  }

  async init() {
    await this.command("uci", () => true);
    this.send("setoption name MultiPV value 2");
    this.send("isready");
    await this.command("isready", (l) => l.includes("readyok"));
  }

  onData(chunk) {
    this.buf += chunk;
    let idx;
    while ((idx = this.buf.indexOf("\n")) >= 0) {
      const line = this.buf.slice(0, idx).trim();
      this.buf = this.buf.slice(idx + 1);
      if (this.pending?.filter(line)) {
        this.pending.resolve();
        this.pending = null;
      }
    }
  }

  command(trigger, filter) {
    return new Promise((resolve, reject) => {
      this.pending = { filter, resolve, reject };
      if (trigger !== "isready") this.send(trigger);
    });
  }

  waitFor(filter) {
    return new Promise((resolve, reject) => {
      this.pending = { filter, resolve, reject };
    });
  }

  /**
   * @param {string} fen
   * @param {string[]} prefixUci
   * @param {{ depth: number, movetime: number }} cfg
   */
  async analyze(fen, prefixUci, cfg) {
    const parts = [`position fen ${fen}`];
    if (prefixUci.length) parts.push(`moves ${prefixUci.join(" ")}`);
    this.send(parts.join(" "));
    const stm = fen.split(" ")[1];
    /** @type {Map<number, { score: EvalScore, stmCp: number, pv: string[] }>} */
    const lines = new Map();

    this.send(`go depth ${cfg.depth} movetime ${cfg.movetime}`);
    await this.waitFor((line) => {
      if (line.startsWith("info ") && line.includes(" multipv ")) {
        const mpv = Number(line.match(/\bmultipv (\d+)/)?.[1] ?? 0);
        const pvM = line.match(/\bpv ([a-h1-8]+(?: [a-h1-8]+)*)/);
        const sc = parseInfoScore(line, stm);
        if (mpv && sc && pvM) {
          lines.set(mpv, {
            score: sc.mate != null ? { cp: 0, mate: sc.mate } : { cp: sc.cp, mate: null },
            stmCp: sc.stmCp,
            pv: pvM[1].split(" "),
          });
        }
      }
      return line.startsWith("bestmove ");
    });

    const mpv1 = lines.get(1);
    const mpv2 = lines.get(2);
    return { mpv1, mpv2, stm };
  }

  dispose() {
    try {
      this.send("quit");
    } catch {
      /* ignore */
    }
  }
}

function applyLine(fen, moves) {
  const g = new Chess(fen);
  for (const m of moves) {
    const u = m.replace(/:/g, "");
    if (!g.move(uciMove(u))) return { ok: false, fen: g.fen(), g: null };
  }
  return { ok: true, fen: g.fen(), g };
}

function solverMoveIndices(line) {
  const idx = [];
  for (let i = 1; i < line.length; i += 2) idx.push(i);
  return idx;
}

function isClearlyUnique(bestCp, secondCp) {
  if (bestCp >= 200 && secondCp < 100) return true;
  if (bestCp >= 100000 - 500 && secondCp < 100) return true;
  if (bestCp - secondCp >= 150) return true;
  if (bestCp >= 100000 - 500 && secondCp < 100000 - 900) return true;
  return false;
}

function moveMatchesPv(played, pv) {
  if (!pv?.length) return false;
  const p = played.replace(/:/g, "").toLowerCase();
  return pv[0].toLowerCase() === p;
}

function equalBest(playedCp, bestCp) {
  if (bestCp >= 100000 - 500 || playedCp >= 100000 - 500) {
    return playedCp >= 100000 - 500 && bestCp >= 100000 - 500;
  }
  return Math.abs(playedCp - bestCp) <= 25;
}

function checkDifficulty(puzzle, themeFile) {
  const issues = [];
  const stageCfg = MATRIX.stages[puzzle.stage];
  if (stageCfg) {
    const [lo, hi] = stageCfg.rating;
    if (puzzle.rating < lo || puzzle.rating > hi) {
      issues.push(`rating_out_of_band:${puzzle.rating}`);
    }
  }
  const expectedStage = stageForRating(puzzle.rating).id;
  if (expectedStage !== puzzle.stage) {
    issues.push(`rating_stage_mismatch:expected_${expectedStage}`);
  }
  const concept = puzzle.concepts[0];
  if (themeFile && concept && themeFile !== concept) {
    issues.push(`file_theme_mismatch:file_${themeFile}`);
  }
  const solverPlies = solverMoveIndices(puzzle.line).length;
  if (puzzle.stage === "novice" && solverPlies > 3) {
    issues.push(`depth_unlikely:novice_${solverPlies}ply`);
  }
  if (concept === "mate" && puzzle.rating < 900 && solverPlies === 1) {
    /* ok mate in 1 */
  } else if (concept === "mate" && puzzle.rating > 2400 && solverPlies === 1) {
    issues.push(`rating_implausible:mate1_${puzzle.rating}`);
  }
  return issues;
}

function checkTheme(puzzle, gAfterLine) {
  const concept = puzzle.concepts[0];
  const issues = [];
  if (!gAfterLine) return issues;
  if (concept === "mate") {
    if (!gAfterLine.isCheckmate()) issues.push("theme:mate_not_mate");
  }
  if (concept === "fork") {
    const last = gAfterLine.history({ verbose: true }).at(-1);
    if (last) {
      const board = gAfterLine.board();
      const piece = board[last.to]?.type;
      const color = last.color;
      let targets = 0;
      const attacks = gAfterLine.moves({ square: last.to, verbose: true });
      for (const a of attacks) {
        if (a.captured) targets++;
        else {
          const t = board[a.to];
          if (t && t.color !== color && "nbrq".includes(t.type)) targets++;
        }
      }
      if (targets < 2) issues.push("theme:fork_weak");
    }
  }
  return issues;
}

/**
 * @param {import('../src/bank.mjs').BankPuzzle} puzzle
 * @param {string} themeFile
 * @param {StockfishPool} engine
 * @param {{ depth: number, movetime: number }} cfg
 */
async function auditOne(puzzle, themeFile, engine, cfg) {
  const failures = [];
  const moves = puzzle.line.map((m) => m.replace(/:/g, ""));

  const compiled = compilePuzzleSteps(puzzle);
  if ("error" in compiled) {
    failures.push(`legal:${compiled.error}`);
    return failures;
  }

  const setup = applyLine(puzzle.fen, []);
  if (!setup.g) {
    failures.push("legal:bad_fen");
    return failures;
  }
  if (!setup.g.move(uciMove(moves[0]))) {
    failures.push("legal:illegal_setup");
    return failures;
  }
  const solverColor = setup.g.turn();
  for (let i = 1; i < moves.length; i++) {
    const side = setup.g.turn();
    const isSolver = i % 2 === 1;
    if (isSolver && side !== solverColor) {
      failures.push("side:solver_color_mismatch");
      break;
    }
    if (!setup.g.move(uciMove(moves[i]))) {
      failures.push(`legal:illegal_${i}`);
      break;
    }
  }

  failures.push(...checkDifficulty(puzzle, themeFile));

  const full = applyLine(puzzle.fen, moves);
  if (full.g) failures.push(...checkTheme(puzzle, full.g));

  for (const i of solverMoveIndices(moves)) {
    const prefix = moves.slice(0, i);
    const played = moves[i];
    const prefixMoves = moves.slice(0, i);
    const pos = applyLine(puzzle.fen, prefixMoves);
    if (!pos.g) {
      failures.push(`engine:bad_prefix_${i}`);
      continue;
    }
    const fen = pos.g.fen();
    const { mpv1, mpv2 } = await engine.analyze(fen, [], cfg);
    if (!mpv1) {
      failures.push(`engine:no_result_${i}`);
      continue;
    }

    const g2 = new Chess(fen);
    if (!g2.move(uciMove(played))) {
      failures.push(`engine:illegal_solver_${i}`);
      continue;
    }

    const bestCp = mpv1.stmCp;
    let playedScoreCp = bestCp;
    let playedIsBest = moveMatchesPv(played, mpv1.pv);
    if (playedIsBest) {
      playedScoreCp = bestCp;
    } else if (mpv2 && moveMatchesPv(played, mpv2.pv)) {
      playedScoreCp = mpv2.stmCp;
      playedIsBest = equalBest(playedScoreCp, bestCp);
    } else {
      const single = await engine.analyze(fen, [played], cfg);
      if (single.mpv1) {
        playedScoreCp = -single.mpv1.stmCp;
        playedIsBest = equalBest(playedScoreCp, bestCp);
      } else failures.push(`engine:unknown_score_${i}`);
    }

    if (!playedIsBest && !equalBest(playedScoreCp, bestCp)) {
      failures.push(`correct:not_best_${i}:played=${playedScoreCp},best=${bestCp}`);
    }

    if (cfg.checkUnique && mpv2) {
      const secondCp = mpv2.stmCp;
      if (!isClearlyUnique(bestCp, secondCp)) {
        failures.push(`unique:ambiguous_${i}:best=${bestCp},second=${secondCp}`);
      }
    }
  }

  return failures;
}

function puzzleThemeFile(puzzle, bankDir) {
  return puzzle.concepts[0] ?? "";
}

function priorityIds(puzzles) {
  const buckets = bucketPuzzles(puzzles);
  const ids = new Set();
  for (const arr of buckets.values()) {
    for (const p of arr) ids.add(p.id);
  }
  return ids;
}

if (!isMainThread) {
  const { puzzles, cfg, tierLabel } = workerData;
  const engine = new StockfishPool(STOCKFISH);
  await engine.ready;

  /** @type {Array<{ id: string, stage: string, theme: string, failures: string[], tier: string }>} */
  const rows = [];
  for (const { puzzle, themeFile } of puzzles) {
    const failures = await auditOne(puzzle, themeFile, engine, cfg);
    rows.push({
      id: puzzle.id,
      stage: puzzle.stage,
      theme: puzzle.concepts[0] ?? "",
      failures,
      tier: tierLabel,
    });
  }
  engine.dispose();
  parentPort.postMessage(rows);
} else {
  const opts = parseArgs(process.argv.slice(2));
  const cfg = tierConfig(opts.tier);
  const tierLabel = cfg.label;

  if (!existsSync(STOCKFISH)) {
    console.error(`✗ Stockfish not found at ${STOCKFISH}`);
    process.exit(2);
  }

  let puzzles = loadBank(opts.bank);
  if (opts.idsFile) {
    const want = new Set(
      readFileSync(opts.idsFile, "utf8")
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean),
    );
    puzzles = puzzles.filter((p) => want.has(p.id));
  } else if (opts.flaggedFile) {
    const flagged = new Set();
    const text = readFileSync(opts.flaggedFile, "utf8");
    for (const line of text.split("\n").slice(1)) {
      const id = line.split(",")[0];
      if (id && id !== "id") flagged.add(id);
    }
    puzzles = puzzles.filter((p) => flagged.has(p.id));
  }

  if (opts.limit > 0) puzzles = puzzles.slice(0, opts.limit);

  const priority = priorityIds(loadBank(opts.bank));
  mkdirSync(opts.out, { recursive: true });

  console.log(
    `Auditing ${puzzles.length.toLocaleString()} puzzles · tier=${opts.tier} · workers=${opts.workers}`,
  );
  console.log(`  ${tierLabel}`);

  const started = Date.now();
  const chunkSize = Math.ceil(puzzles.length / opts.workers);
  /** @type {Promise<any>[]} */
  const workers = [];
  for (let w = 0; w < opts.workers; w++) {
    const slice = puzzles.slice(w * chunkSize, (w + 1) * chunkSize);
    if (!slice.length) continue;
    const payload = slice.map((puzzle) => ({
      puzzle,
      themeFile: puzzle.concepts[0] ?? "",
    }));
    workers.push(
      new Promise((resolve, reject) => {
        const worker = new Worker(new URL(import.meta.url), {
          workerData: { puzzles: payload, cfg, tierLabel },
        });
        worker.on("message", resolve);
        worker.on("error", reject);
        worker.on("exit", (c) => {
          if (c !== 0) reject(new Error(`worker exit ${c}`));
        });
      }),
    );
  }

  const parts = await Promise.all(workers);
  const allRows = parts.flat();
  const failRows = allRows.filter((r) => r.failures.length);

  const csvLines = [
    "id,stage,theme,tier,priority,failures,action,reason",
    ...allRows.map((r) => {
      const pri = priority.has(r.id) ? "yes" : "no";
      const f = r.failures.join("|").replace(/"/g, '""');
      return `"${r.id}","${r.stage}","${r.theme}","${r.tier}","${pri}","${f}","",""`;
    }),
  ];

  const outCsv = join(opts.out, `puzzles-audit-${opts.tier}.csv`);
  writeFileSync(outCsv, `${csvLines.join("\n")}\n`);

  const summary = {
    tier: opts.tier,
    tierSpec: tierLabel,
    scanned: allRows.length,
    failed: failRows.length,
    passed: allRows.length - failRows.length,
    durationMs: Date.now() - started,
    byFailure: {},
    byStage: {},
  };

  for (const r of failRows) {
    summary.byStage[r.stage] = (summary.byStage[r.stage] ?? 0) + 1;
    for (const f of r.failures) {
      const kind = f.split(":")[0];
      summary.byFailure[kind] = (summary.byFailure[kind] ?? 0) + 1;
    }
  }

  writeFileSync(join(opts.out, `summary-${opts.tier}.json`), JSON.stringify(summary, null, 2));
  console.log(JSON.stringify(summary, null, 2));
  console.log(`Wrote ${outCsv}`);
}

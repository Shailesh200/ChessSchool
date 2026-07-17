import { compilePuzzleSteps } from "./compile-lesson.mjs";
import { emptyReport, finalizeReport } from "./report.mjs";
import { MATRIX } from "../data/matrix.mjs";
import { conceptGroup } from "./concepts.mjs";

const MIN_COACH = 8;

/**
 * Validate a Puzzle School JSONL bank.
 * @param {import('./bank.mjs').BankPuzzle[]} puzzles
 * @param {{ command?: string, source?: string, failOnWarn?: boolean }} [opts]
 */
export function validateBank(puzzles, opts = {}) {
  const started = Date.now();
  const report = emptyReport(opts.command ?? "validate", opts.source ?? "bank");
  report.summary.scanned = puzzles.length;

  const seen = new Set();

  for (const p of puzzles) {
    const bucket = `${p.stage}:${p.concepts[0] ?? "?"}`;
    if (!p.id) {
      report.byOutcome.rejected.push({ id: "?", reason: "missing_id", detail: bucket });
      report.summary.rejected++;
      continue;
    }
    if (!p.fen || !Array.isArray(p.line) || p.line.length < 2) {
      report.byOutcome.rejected.push({ id: p.id, reason: "bad_record", detail: "fen/line" });
      report.summary.rejected++;
      continue;
    }
    if (!p.concepts?.length || !conceptGroup(p.concepts[0])) {
      report.byOutcome.rejected.push({ id: p.id, reason: "bad_concept", detail: String(p.concepts) });
      report.summary.rejected++;
      continue;
    }
    const stageCfg = MATRIX.stages[p.stage];
    if (!stageCfg) {
      report.byOutcome.rejected.push({ id: p.id, reason: "bad_stage", detail: p.stage });
      report.summary.rejected++;
      continue;
    }
    const [lo, hi] = stageCfg.rating;
    if (p.rating < lo || p.rating > hi) {
      report.byOutcome.rejected.push({
        id: p.id,
        reason: "rating_out_of_band",
        detail: `${p.rating} not in [${lo},${hi}] for ${p.stage}`,
      });
      report.summary.rejected++;
      continue;
    }

    const dupKey = `${p.fen}|${p.line.join(" ")}`;
    if (seen.has(dupKey)) {
      report.byOutcome.rejected.push({ id: p.id, reason: "duplicate_fen", detail: dupKey.slice(0, 60) });
      report.summary.rejected++;
      continue;
    }
    seen.add(dupKey);

    const compiled = compilePuzzleSteps(p);
    if ("error" in compiled) {
      report.byOutcome.rejected.push({ id: p.id, reason: "illegal_line", detail: compiled.error });
      report.summary.rejected++;
      continue;
    }

    const setupCoach = p.coach?.setup ?? compiled.steps[0]?.coach ?? "";
    if (setupCoach.trim().length < MIN_COACH) {
      report.byOutcome.warnings.push({
        id: p.id,
        code: "coach_short",
        detail: "setup coach is very short",
      });
      report.summary.warnings++;
    }
    if (/Your move\. Find the .* idea\./i.test(setupCoach)) {
      report.byOutcome.warnings.push({ id: p.id, code: "generic_coach", detail: "default Lichess coach" });
      report.summary.warnings++;
    }

    if (!report.byOutcome.rejected.some((r) => r.id === p.id)) {
      report.byOutcome.success.push(p.id);
      report.summary.inserted++;
    }
  }

  report.durationMs = Date.now() - started;
  return finalizeReport(report, { failOnReject: true, failOnWarn: opts.failOnWarn ?? false });
}

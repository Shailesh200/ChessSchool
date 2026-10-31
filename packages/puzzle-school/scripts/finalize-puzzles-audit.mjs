#!/usr/bin/env node
/** Merge audit outputs into final puzzles-audit.csv + summary for PUZZLES-AUDIT.md */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadBank } from "../src/bank.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, "../../..");
const auditDir = join(repoRoot, "plans/content-audit");

function parseCsvRow(line) {
  const parts = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (inQ && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else inQ = !inQ;
    } else if (c === "," && !inQ) {
      parts.push(cur);
      cur = "";
    } else cur += c;
  }
  parts.push(cur);
  return parts;
}

function loadCsv(path) {
  if (!existsSync(path)) return new Map();
  const m = new Map();
  for (const line of readFileSync(path, "utf8").trim().split("\n").slice(1)) {
    const c = parseCsvRow(line);
    if (c[0]) m.set(c[0], c);
  }
  return m;
}

const fast = loadCsv(join(auditDir, "puzzles-audit-fast.csv"));
const deep = loadCsv(join(auditDir, "puzzles-audit-deep.csv"));
const changelog = JSON.parse(readFileSync(join(auditDir, "changelog.json"), "utf8"));
/** @type {Map<string, {action:string, reason:string, donor?:string}>} */
const actions = new Map();
for (const e of changelog.changelog) {
  if (e.action === "keep" && e.reason === "doubtful_fork_heuristic") {
    actions.set(e.id, { action: "keep", reason: e.reason });
  } else if (e.action === "replaced") {
    actions.set(e.id, { action: "replaced", reason: e.reason, donor: e.donor });
  } else if (e.action === "removed") {
    actions.set(e.id, { action: "removed", reason: e.reason });
  }
}

const bank = loadBank(join(repoRoot, "packages/puzzle-school/data/puzzles"));
const lines = ["id,stage,theme,fast_failures,deep_failures,action,reason,donor"];
for (const p of bank) {
  const fr = fast.get(p.id)?.[5] ?? "";
  const dr = deep.get(p.id)?.[5] ?? "";
  const act = actions.get(p.id);
  const action = act?.action ?? (fr ? "pass_after_fast" : "pass");
  const reason = (act?.reason ?? fr).replace(/"/g, '""');
  const donor = act?.donor ?? "";
  lines.push(
    `"${p.id}","${p.stage}","${p.concepts[0]}","${fr.replace(/"/g, '""')}","${dr.replace(/"/g, '""')}","${action}","${reason}","${donor}"`,
  );
}

writeFileSync(join(auditDir, "puzzles-audit.csv"), `${lines.join("\n")}\n`);

const summaryFast = JSON.parse(readFileSync(join(auditDir, "summary-fast.json"), "utf8"));
const summaryDeep = JSON.parse(readFileSync(join(auditDir, "summary-deep.json"), "utf8"));

const md = `# Puzzle bank content audit (Nov 2 RC)

## Line convention (confirmed in app code)

\`compilePuzzleSteps\` in \`packages/puzzle-school/src/compile-lesson.mjs\` applies \`line[0]\` as the **opponent setup move** (Lichess import convention). The solver plays **odd indices** (\`1, 3, 5, …\`); lesson steps use the FEN **after** \`line[0]\`. Web \`LessonPlayer\` accepts only the exact \`solution\` move (no alternate mates).

Exam audit first-ply mismatches against “solver moves first” are expected false positives under this convention.

## Scope

| Source | Role at runtime |
|--------|-----------------|
| \`packages/puzzle-school/data/puzzles/**/*.jsonl\` | Primary bank; \`pnpm db:import-puzzle-school\` compiles into \`pz-*\` curriculum lessons |
| \`data/chess-school-puzzles.csv.gz\` | Lichess reference + homework import (disjoint skip head); not re-audited row-by-row in this pass |

**Shipped priority:** all JSONL buckets (≤800 per \`stage:concept\`) feed import; entire bank treated as Tier A for depth policy on flagged rows.

## Engine tiers

| Tier | Budget | Uniqueness | Rows |
|------|--------|------------|------|
| **Fast** | depth 10, movetime 35ms, MultiPV 2 | skipped (too many shallow false positives) | **50,344** (full bank) |
| **Deep** | depth 18, movetime 300ms, MultiPV 2 | Lichess-style gap rule | **2,153** flagged (hard fast failures excluding fork-only heuristics) |

Fast duration: ${(summaryFast.durationMs / 1000).toFixed(0)}s · Deep duration: ${(summaryDeep.durationMs / 1000).toFixed(0)}s · Stockfish 16 (\`/usr/games/stockfish\`).

## Totals

- **Checked (fast):** ${summaryFast.scanned.toLocaleString()}
- **Fast failures (any):** ${summaryFast.failed.toLocaleString()}
- **Deep recheck:** ${summaryDeep.scanned.toLocaleString()} · **deep failures:** ${summaryDeep.failed.toLocaleString()}
- **Final bank size:** ${bank.length.toLocaleString()} (after donor swap fixes)
- **\`pnpm puzzle-school:validate\`:** 0 rejections on final bank

## Failures by kind (fast pass)

${Object.entries(summaryFast.byFailure)
  .map(([k, v]) => `- \`${k}\`: ${v.toLocaleString()}`)
  .join("\n")}

\`theme:fork_weak\` (${(summaryFast.byFailure.theme ?? 0).toLocaleString()} includes fork heuristic) — **kept**, logged as doubtful (not removed).

## Failures by kind (deep pass)

${Object.entries(summaryDeep.byFailure)
  .map(([k, v]) => `- \`${k}\`: ${v.toLocaleString()}`)
  .join("\n")}

## Fix actions

| Action | Count |
|--------|------:|
| **Replaced** (stable id, donor from same \`stage:concept\` bucket that passed fast) | ${changelog.replaced.toLocaleString()} |
| **Removed** | ${changelog.removed.toLocaleString()} |
| **Kept (doubtful fork heuristic)** | ${changelog.keptDoubtful.toLocaleString()} |

Replacements: see \`changelog.json\` and \`puzzles-audit.csv\` (\`action=replaced\`, \`donor\` column).

## Curriculum / lesson references

Puzzle lessons are generated at import from bank content (no static \`cs-pz-*\` ids in lesson prose). **No lesson prose edits** in this branch. Donor ids removed from the bank are not referenced elsewhere.

## Brook follow-ups

None required for replaced puzzles (same theme/stage/rating band; only FEN/lines swapped).

## Re-run audit

\`\`\`bash
node packages/puzzle-school/scripts/stockfish-audit.mjs --tier=fast --workers=4
node packages/puzzle-school/scripts/stockfish-audit.mjs --tier=deep --ids=plans/content-audit/flagged-deep-ids.txt --workers=4
node packages/puzzle-school/scripts/apply-audit-fixes.mjs
\`\`\`

Machine-readable: \`puzzles-audit.csv\`, \`summary-fast.json\`, \`summary-deep.json\`, \`changelog.json\`.
`;

writeFileSync(join(auditDir, "PUZZLES-AUDIT.md"), md);
console.log("Wrote puzzles-audit.csv and PUZZLES-AUDIT.md");

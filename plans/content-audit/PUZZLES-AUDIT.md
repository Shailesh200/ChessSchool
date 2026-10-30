# Puzzle bank content audit (Nov 2 RC)

## Line convention (confirmed in app code)

`compilePuzzleSteps` in `packages/puzzle-school/src/compile-lesson.mjs` applies `line[0]` as the **opponent setup move** (Lichess import convention). The solver plays **odd indices** (`1, 3, 5, …`); lesson steps use the FEN **after** `line[0]`. Web `LessonPlayer` accepts only the exact `solution` move (no alternate mates).

Exam audit first-ply mismatches against “solver moves first” are expected false positives under this convention.

## Scope

| Source | Role at runtime |
|--------|-----------------|
| `packages/puzzle-school/data/puzzles/**/*.jsonl` | Primary bank; `pnpm db:import-puzzle-school` compiles into `pz-*` curriculum lessons |
| `data/chess-school-puzzles.csv.gz` | Lichess reference + homework import (disjoint skip head); not re-audited row-by-row in this pass |

**Shipped priority:** all JSONL buckets (≤800 per `stage:concept`) feed import; entire bank treated as Tier A for depth policy on flagged rows.

## Engine tiers

| Tier | Budget | Uniqueness | Rows |
|------|--------|------------|------|
| **Fast** | depth 10, movetime 35ms, MultiPV 2 | skipped (too many shallow false positives) | **50,344** (full bank) |
| **Deep** | depth 18, movetime 300ms, MultiPV 2 | Lichess-style gap rule | **2,153** flagged (hard fast failures excluding fork-only heuristics) |

Fast duration: 400s · Deep duration: 551s · Stockfish 16 (`/usr/games/stockfish`).

## Totals

- **Checked (fast):** 50,344
- **Fast failures (any):** 7,601
- **Deep recheck:** 2,153 · **deep failures:** 1,366
- **Final bank size:** 49,048 (after donor swap fixes)
- **`pnpm puzzle-school:validate`:** 0 rejections on final bank

## Failures by kind (fast pass)

- `correct`: 2,150
- `theme`: 5,602
- `engine`: 56
- `rating_implausible`: 1
- `depth_unlikely`: 110

`theme:fork_weak` (5,602 includes fork heuristic) — **kept**, logged as doubtful (not removed).

## Failures by kind (deep pass)

- `unique`: 3,581
- `correct`: 354
- `theme`: 154
- `engine`: 55
- `rating_implausible`: 1
- `depth_unlikely`: 110

## Fix actions

| Action | Count |
|--------|------:|
| **Replaced** (stable id, donor from same `stage:concept` bucket that passed fast) | 1,296 |
| **Removed** | 0 |
| **Kept (doubtful fork heuristic)** | 5,436 |

Replacements: see `changelog.json` and `puzzles-audit.csv` (`action=replaced`, `donor` column).

## Curriculum / lesson references

Puzzle lessons are generated at import from bank content (no static `cs-pz-*` ids in lesson prose). **No lesson prose edits** in this branch. Donor ids removed from the bank are not referenced elsewhere.

## Brook follow-ups

None required for replaced puzzles (same theme/stage/rating band; only FEN/lines swapped).

## Re-run audit

```bash
node packages/puzzle-school/scripts/stockfish-audit.mjs --tier=fast --workers=4
node packages/puzzle-school/scripts/stockfish-audit.mjs --tier=deep --ids=plans/content-audit/flagged-deep-ids.txt --workers=4
node packages/puzzle-school/scripts/apply-audit-fixes.mjs
```

Machine-readable: `puzzles-audit.csv`, `summary-fast.json`, `summary-deep.json`, `changelog.json`.

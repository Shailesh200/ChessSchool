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

### Why 50,344 → 49,048 with “1,296 replaced, 0 removed”

Each **replace** keeps the failing puzzle’s **`id`** but copies FEN/line from a **donor** row that passed audit in the same `stage:concept` bucket. Donor rows are **deleted** from the JSONL so the same position is not stored twice. So:

- **1,296** failing slots were rewritten in place (stable ids).
- **1,296** donor rows were removed from the bank.
- **Net row count:** 50,344 − 1,296 = **49,048** (no orphan “removed” ids left in files).

### Per stage × theme counts

| Stage:theme | Before | After | Δ |
|---|---:|---:|---:|
| elementary:advantage | 800 | 800 | 0 |
| elementary:attack | 2 | 2 | 0 |
| elementary:discovered | 800 | 796 | -4 |
| elementary:endgame | 800 | 780 | -20 |
| elementary:fork | 800 | 798 | -2 |
| elementary:mate | 800 | 792 | -8 |
| elementary:opening | 800 | 800 | 0 |
| elementary:pin | 800 | 799 | -1 |
| elementary:sacrifice | 793 | 783 | -10 |
| elementary:trapped | 800 | 794 | -6 |
| expert:advantage | 800 | 765 | -35 |
| expert:discovered | 800 | 734 | -66 |
| expert:endgame | 800 | 732 | -68 |
| expert:fork | 800 | 756 | -44 |
| expert:mate | 800 | 710 | -90 |
| expert:opening | 800 | 753 | -47 |
| expert:pin | 800 | 739 | -61 |
| expert:sacrifice | 786 | 718 | -68 |
| expert:trapped | 800 | 749 | -51 |
| high:advantage | 800 | 800 | 0 |
| high:attack | 3 | 3 | 0 |
| high:discovered | 800 | 794 | -6 |
| high:endgame | 800 | 778 | -22 |
| high:fork | 800 | 796 | -4 |
| high:mate | 800 | 789 | -11 |
| high:opening | 800 | 796 | -4 |
| high:pin | 800 | 793 | -7 |
| high:sacrifice | 794 | 768 | -26 |
| high:trapped | 800 | 795 | -5 |
| master:advantage | 800 | 784 | -16 |
| master:discovered | 800 | 779 | -21 |
| master:endgame | 800 | 773 | -27 |
| master:fork | 800 | 780 | -20 |
| master:mate | 800 | 770 | -30 |
| master:opening | 800 | 783 | -17 |
| master:pin | 800 | 774 | -26 |
| master:sacrifice | 796 | 750 | -46 |
| master:trapped | 800 | 779 | -21 |
| middle:advantage | 800 | 798 | -2 |
| middle:attack | 4 | 4 | 0 |
| middle:discovered | 800 | 797 | -3 |
| middle:endgame | 800 | 773 | -27 |
| middle:fork | 800 | 800 | 0 |
| middle:mate | 800 | 790 | -10 |
| middle:opening | 800 | 798 | -2 |
| middle:pin | 800 | 795 | -5 |
| middle:sacrifice | 796 | 766 | -30 |
| middle:trapped | 800 | 796 | -4 |
| novice:advantage | 800 | 797 | -3 |
| novice:attack | 2 | 2 | 0 |
| novice:discovered | 800 | 796 | -4 |
| novice:endgame | 800 | 705 | -95 |
| novice:fork | 800 | 798 | -2 |
| novice:mate | 800 | 796 | -4 |
| novice:opening | 800 | 800 | 0 |
| novice:pin | 800 | 796 | -4 |
| novice:sacrifice | 774 | 741 | -33 |
| novice:trapped | 800 | 769 | -31 |
| university:advantage | 800 | 792 | -8 |
| university:discovered | 800 | 783 | -17 |
| university:endgame | 800 | 776 | -24 |
| university:fork | 800 | 790 | -10 |
| university:mate | 800 | 786 | -14 |
| university:opening | 800 | 790 | -10 |
| university:pin | 800 | 781 | -19 |
| university:sacrifice | 794 | 760 | -34 |
| university:trapped | 800 | 789 | -11 |
| **Total** | **50,344** | **49,048** | **-1,296** |

**Curriculum minimums:** `buildCurriculumFromBuckets` only requires **≥3 puzzles per bucket** (and `validateBank` enforces rating/stage/line legality). Every bucket still meets that bar; sparse `*:attack` buckets (2–4 rows) were already below the 800-row adapt cap before audit and are unchanged in count.

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

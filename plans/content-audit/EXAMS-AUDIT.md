# Exams & quizzes content audit (nov2/content-exams)

**Branch:** `nov2/content-exams` (from `staging`)  
**Auditor run:** 2026-10-30 UTC  
**Scope:** Hand-authored preschool quizzes (`apps/web/content/data/*.mjs`), class quick tests (`buildClassExamSteps`), school stage exams (`/api/school-exam`), quiz UI shuffle logic, puzzle-school step validators. Lesson prose and `packages/puzzle-school/data/puzzles/**` were out of scope.

## Totals

| Area | Checked | Issues found | Fixed in branch |
|------|---------|--------------|-----------------|
| Preschool / curated **quiz** steps | **34** | **4** content + **1** duplicate-id hygiene | **4** content fixes + validator prevents recurrence |
| **Move** steps in curated lessons | 118 lessons (vitest + chess.js) | 0 illegal | — |
| **Class exam** pools (local.db after puzzle import) | **2,868** classes | **19** classes with &lt;2 scored steps in pool (exam correctly unavailable) | Generator widened to full class; min **2** scored steps |
| **School exam** generator | Logic + 400-position Stockfish sample | 0 illegal FEN/solution in import report | Single-move filter + shared picker |
| **Puzzle bank** (Stockfish spot-check, 400 random lessons) | **966** single-move steps | **871** engine mismatches vs marked 1st ply | **Listed for `nov2/content-puzzles`** (not edited here) |

### Failure types (curated quizzes)

| Type | Count before fix | Count after fix |
|------|------------------|-----------------|
| `quiz_duplicate_option` (case-insensitive) | 1 | 0 |
| Wrong square colour in coach copy | 1 | 0 |
| Ambiguous pawn-direction wording | 1 | 0 |
| Duplicate step id across lessons | 1 (`queen-value`) | 0 (renamed) |

## How questions are built

1. **Pre-School quizzes** — Hand-written `kind: "quiz"` steps in `lessons.mjs` + `preschool-lessons-extra.mjs`. Shuffled at runtime via `shuffleQuizOptions.ts` (correct index remapped).
2. **Class quick test** (`/class/[id]/exam`) — Server builds ~5 steps from the class’s teaching lessons: prefers **single-move** puzzles; Pre-School falls back to **quiz** steps when no moves exist (`classExam.ts`).
3. **School stage exam** (`/exam/school/[stage]`) — `GET /api/school-exam?stage=` samples random lessons in the stage, collects **single-move** puzzles, shuffles, returns **8** steps. Pass threshold **67%** (web `LessonPlayer`, mobile `EXAM_PASS_RATIO`).
4. **Imported curriculum** — ~50k puzzle lessons from `packages/puzzle-school` bank via `db:import-puzzle-school`; validated on import (`validateLessonSteps`). Not duplicated in this audit’s edits.

## Per-question change log (curated quizzes)

| Step id | Lesson id | Problem | Action | Reason |
|---------|-----------|---------|--------|--------|
| `pawn-notation-e4` | `pre-notation-pawn-e4` | Options `e4` and `E4` collided after normalization | Replaced distractor with `4e (number before letter)` | Exactly one unambiguous correct answer |
| `pawn-direction` | `pre-pawn-quiz` | Question implied pawns never move diagonally | Clarified: “When a pawn is **not capturing**…” | Matches teaching (forward walk vs diagonal capture) |
| `diag-info` | `pre-bishop-diagonal-info` | Coach said c1 bishop stays on **light** squares | Corrected to **dark** squares | c1 is a dark square; move c1→f4 is legal |
| `material-queen-points` | `pre-material-quiz` | Step id `queen-value` duplicated another lesson | Renamed step id (lesson id unchanged) | Stable analytics / exam logging |
| *(all other 30 quiz steps)* | *various* | Manual review + `validateQuizStep` | **verified** | Answers consistent with preschool lesson sequence |

Full machine-readable log: [`exams-audit.csv`](./exams-audit.csv) (2,902 rows including per-class exam pool status).

## Generator / logic changes

| File | Change | Test |
|------|--------|------|
| `packages/puzzle-school/src/quiz-validate.mjs` | Duplicate-option detection, require `explain` + `failText` | `quiz-validate.test.mjs` |
| `packages/puzzle-school/src/validate.mjs` | Delegates quiz checks to `validateQuizStep` | existing + curriculum validate |
| `apps/web/features/school/classExam.ts` | `isExamMoveStep`, `pickSchoolExamSteps`, widen class pool, `CLASS_EXAM_MIN_STEPS=2` | `classExam.test.ts` |
| `apps/web/app/api/school-exam/route.ts` | Uses shared single-move picker | `route.test.ts` |
| `apps/web/app/class/[id]/exam/page.tsx` | Requires minimum viable exam length | implicit via `classExamHasMinSteps` |
| `apps/web/features/lessons/lessons.test.ts` | Distinct normalized quiz labels | vitest |

## Pass rules (verified)

- **Class & school exams:** score ratio ≥ **0.67** on scored steps (`move` + `quiz`). Mobile and web aligned on `EXAM_PASS_RATIO`.
- **Class exam length:** up to **5** sampled steps; requires **≥2** scored steps available in the class pool.
- **School exam length:** **8** single-move puzzles when the stage has enough material.

## For other owners

### `nov2/content-puzzles` (puzzle bank)

- Stockfish 16 depth-12 spot-check on **400** random imported lessons flagged **871** positions where the marked first ply ≠ engine best (sample script: `plans/content-audit/verify_stockfish.py`). Examples include `pz-high-advantage-c26-l18/m1`, `pz-master-trapped-c16-l15/m1`. Do **not** merge puzzle JSONL changes on this branch.
- Curriculum import after audit: **53,239** lessons inserted, **0** rejected by `validateCurriculum`.

### `nov2/content-lessons` (lesson prose)

- No lesson `coach` prose outside the one bishop colour fix in `pre-bishop-diagonal-info` (factual error tied to quiz/exam integrity).

## Re-run audit

```bash
node plans/content-audit/run-exams-audit.mjs
python3 plans/content-audit/verify_stockfish.py   # optional; needs /usr/games/stockfish + local.db
pnpm --filter web test -- features/lessons/lessons.test.ts features/school/classExam.test.ts
pnpm --filter @chess-school/puzzle-school test
```

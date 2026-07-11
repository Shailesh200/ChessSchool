# @chess-school/puzzle-school

Curriculum validation and puzzle bank for ChessSchool. **No Next.js or database dependencies** — safe to open-source separately.

## Pre-School spine

Lessons tagged `preschool` must follow the ordered topic list in `data/preschool-spine.mjs`. See `plans/M-063_PUZZLE_SCHOOL.md`.

## Puzzle bank (Phase 3)

```
data/
  matrix.yaml / matrix.mjs   coverage targets
  preschool-spine.mjs        Pre-School topic order
  puzzles/                   JSONL per stage/concept (e.g. elementary/fork.jsonl)
src/                         validate, compile, stats, curriculum build
cli/puzzle-school.mjs        validate | stats | adapt-csv
```

### One-time: build bank from curated CSV

```bash
pnpm puzzle-school adapt-csv                    # data/chess-school-puzzles.csv.gz → data/puzzles/
pnpm puzzle-school validate                     # FEN + line + rubric
pnpm puzzle-school stats                        # matrix coverage report
```

### Import into local.db (from repo root / apps/web)

```bash
pnpm --filter web db:fresh
pnpm --filter web db:import-puzzle-school       # reads packages/puzzle-school/data/puzzles/
pnpm --filter web curriculum:validate
```

## Coach voice

Puzzle lessons use the school coach in `src/coach-voice.mjs`:

- **Setup** — stage-aware prompts per concept (no generic “find the idea” copy)
- **Mid-line** — short encouragement between combination moves
- **Capstone** — intro for the graduation match on each semester’s final class
- **Tutorials** — `tutorialCoach(concept, stage)` frames `CONCEPT_TUTORIALS` with Elementary → Masters tone

Override per puzzle in the bank with `coach.setup`, `coach.success`, and `coach.hint`.

## Commands (from repo root)

```bash
pnpm puzzle-school validate
pnpm puzzle-school stats
pnpm --filter web curriculum:validate
```

## Layout

```
data/           matrix + concept taxonomy + preschool lesson → topic map + puzzles/
src/            validate steps, spine, bank, quality rubric, report helpers
cli/            puzzle-school CLI
```

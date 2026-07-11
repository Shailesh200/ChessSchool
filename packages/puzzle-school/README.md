# @chess-school/puzzle-school

Curriculum validation and (future) puzzle bank format for ChessSchool. **No Next.js or database dependencies** — safe to open-source separately.

## Pre-School spine

Lessons tagged `preschool` must follow the ordered topic list in `data/preschool-spine.mjs`. See `plans/M-063_PUZZLE_SCHOOL.md`.

## Commands (from repo root)

```bash
pnpm --filter web curriculum:validate     # scan local.db
pnpm --filter web db:import-puzzles       # writes curriculum-import-report.json
```

## Layout

```
data/           matrix + concept taxonomy + preschool lesson → topic map
src/            validate steps, spine, quality rubric, report helpers
```

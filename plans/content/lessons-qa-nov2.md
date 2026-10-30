# Lessons & curriculum content QA — Nov 2 release

**Branch:** `nov2/content-lessons`  
**Base:** `origin/rc/nov2`  
**Scope:** Hand-authored **lessons** + **curriculum order** only. **Exams not edited** (separate reviewer).

## Summary counts

| Area | Checked | Fixed |
|------|---------|-------|
| Lessons (non-exam) | 87 | 1 coach line |
| Lesson steps | 139 (34 quiz · 38 move · 15 observe · 52 info) | 1 |
| Curriculum spine (preschool) | 14 classes · 70 lessons on spine | progression sync + DRY source |
| Elementary–middle curated classes | 8 classes · 13 lessons | 0 |

## Change log

| File | Item id | Problem | Fix |
|------|---------|---------|-----|
| `apps/web/content/data/preschool-lessons-extra.mjs` | `pre-bishop-diagonal-info` / `diag-info` | Coach said c1 bishop stays on **light** squares; c1 is **dark**. | Coach + comment → **dark** squares. |
| `packages/progression/src/preschool.ts` | preschool spine | Legacy `class-pre-pieces` / `class-pre-moves` ids and old lesson list; **out of sync** with web `school.mjs`. | Matched current meet-pieces + per-piece move classes. |
| `apps/web/content/data/preschool-curriculum.mjs` | (new) | Preschool order duplicated across school, seed, progression. | Single source; `school.mjs` uses `buildPreschoolClasses()`. |
| `apps/web/content/data/school.mjs` | `sem-preschool` | Inline class list could drift. | Built from `preschool-curriculum.mjs`. |
| `apps/web/app/chess-for-beginners/page.tsx` | SEO links | Pointed at removed classes `class-pre-pieces` / `class-pre-moves`. | → `class-pre-meet-pieces`, `class-pre-pawn-moves`. |

## Automation

| Command | Area |
|---------|--------|
| `pnpm --filter web lessons:validate` | Lessons |
| `pnpm --filter web exec vitest run scripts/validate-authored-lessons.test.ts` | Lessons |
| `pnpm --filter web curriculum:order` | Curriculum |
| `pnpm --filter web exec vitest run scripts/validate-curriculum-order.test.ts` | Curriculum |

## Not changed

### Legacy lessons off spine

`pre-pieces-roster`, `pre-pieces-queen`, `pre-pieces-king`, `pre-moves-e4`, `pre-pawn-basics` — still in `lessons.mjs`, not in `school.mjs`.

### Puzzles

Out of scope (`packages/puzzle-school/data/puzzles/**`, `data/chess-school-puzzles.csv.gz`).

### Exams (observed only)

| Item | Notes |
|------|-------|
| `exam-pieces` | Scripted captures; moves legal. Not edited. |
| `buildClassExamSteps` / web+mobile exam routes | Not modified. |

### Seed

No `seed.sql.gz` update in this pass (coach-only `.mjs` change; dump is a separate step).

## Verification

```bash
pnpm --filter web lessons:validate
pnpm --filter web curriculum:order
pnpm --filter web exec vitest run scripts/validate-authored-lessons.test.ts scripts/validate-curriculum-order.test.ts
pnpm --filter web db:fresh && pnpm --filter web curriculum:validate
```

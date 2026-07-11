# M-063 — Puzzle School & Curriculum Quality (owner spec)

> **Status:** Approved direction — replaces “Lichess bulk import as primary” in M-063.  
> **Gate:** G-WebGA content (step 2).  
> **Principle:** ChessSchool is a **school**, not a puzzle database with a skin.

---

## Vision

Ship a curriculum that feels as polished as top learning products (Chess.com lessons, Duolingo pacing) but with a **distinct school identity**: semesters, classes, coach voice, exams, and capstones — not a clone of either product.

**Quality over volume.** Every lesson on the launch ladder should be worth a student’s time. Bulk Lichess import was a bootstrap; launch content comes from our own **Puzzle School** bank.

| Dimension | Target |
|-----------|--------|
| Pedagogy | Learn → Observe → Try → Master; tutorials before puzzle sets |
| Voice | Consistent school coach — encouraging, precise, age-appropriate per stage |
| Puzzles | Clear tactical theme, one best line, coached setup where needed |
| Progression | Rating + concept bands within each class; prerequisites enforced |
| Theming | Class names, emoji, semester framing feel like a real academy |

---

## Puzzle School (separable package)

A **standalone, open-source-ready** puzzle & lesson bank — not embedded in app routes or DB schema.

### Package boundary

```
packages/puzzle-school/          # future: publish as @chess-school/puzzle-school
├── README.md                      # format spec, authoring guide, license
├── package.json                   # zero Next.js / Drizzle deps
├── src/
│   ├── types.ts                   # Puzzle, PuzzleLesson, Concept, StageBand
│   ├── schema/                    # JSON Schema for bank files
│   ├── validate.ts                # FEN + line validation (chess.js)
│   ├── quality.ts                 # rubric checks (coach length, theme match, dup FEN)
│   ├── concepts.ts                # unified concept taxonomy (school vocabulary)
│   ├── compile-lesson.ts          # Puzzle → LessonStep[] (observe + move chain)
│   └── matrix.ts                  # stage × concept × count targets
├── data/                          # committed bank (or git submodule later)
│   ├── matrix.yaml                # coverage targets
│   ├── concepts.yaml              # definitions + tutorial copy per concept
│   └── puzzles/                   # JSONL per stage-concept bucket
└── cli/
    └── puzzle-school.mjs          # validate | stats | export-for-import
```

**App integration** (thin adapter in `apps/web`):

```
apps/web/scripts/import-puzzle-school.mjs   # reads package → inserts lessons
apps/web/lib/puzzle-school/                 # optional re-exports for admin
```

The app **consumes** compiled lessons; it does not own puzzle authoring logic. Swapping banks or open-sourcing `puzzle-school` does not require forking the web app.

### Puzzle record (bank format)

Each puzzle is a first-class object — not only a flattened `lessons.steps` blob:

```yaml
id: cs-pz-middle-fork-0042
stage: middle
concepts: [fork, win-material]
rating: 1180
source: authored          # authored | adapted | reference
fen: "..."
sideToMove: white
line: ["e4e5", "d4e5", "f3e5"]   # UCI or from:to
coach:
  setup: "White just played Bg5. Find the fork."
  success: "The knight forks king and queen — class dismissed!"
  hint: "Which square attacks two pieces at once?"
themes: [school-homework, tactics-lab]
quality:
  reviewed: true
  reviewer: curriculum-team
  version: 1
```

Compilation produces a **lesson** with optional `observe` (setup line) + `move` steps — richer than current Lichess one-move-per-step import.

### Unified concept taxonomy

One vocabulary for hand-authored lessons, puzzle bank, homework, and campus:

| School concept | Covers (legacy tags) |
|----------------|----------------------|
| `mate` | checkmate, back rank, smothered, … |
| `fork` | knight fork, royal fork |
| `pin` | pin, skewer |
| `discovery` | discovered attack, double check |
| `win-material` | hanging piece, trapped piece, deflection |
| `sacrifice` | sacrifice, clearance, interference |
| `endgame` | opposition, promotion, rook endgame |
| `advantage` | convert, quiet move, prophylaxis |
| `opening` | principles, development, traps |
| `basics` | rules, notation, piece movement |

Lichess theme mapping remains in `import-lichess.mjs` as **optional reference tooling only**.

---

## Quality rubric (automated + human)

**Automated (`puzzle-school validate`):**

- [ ] FEN legal; line validates with chess.js
- [ ] Student moves only on correct side to move
- [ ] No duplicate FEN+line in bank
- [ ] Coach strings present; min/max length
- [ ] `rating` within stage band for bucket
- [ ] `concepts` match matrix assignment

**Human spot-check (per class):**

- [ ] Tutorial reads like a teacher, not a theme label
- [ ] First 3 puzzles in class are approachable; difficulty ramps
- [ ] School framing (class title, exam, capstone) matches stage
- [ ] Playthrough in lesson player — no confusing board orientation

---

## Content strategy (16k target)

| Tier | Count (launch) | How |
|------|----------------|-----|
| **A — Flagship authored** | ~800–1,200 | Hand-written in bank format; preschool + foundations + capstones |
| **B — School puzzle sets** | ~6,000–10,000 | Authored/adapted in Puzzle School bank; primary volume |
| **C — Reference pool** | optional | Lichess CSV **only** as remix input via `adapt-reference.mjs`, never direct `pz-*` dump |

**Launch bar (revised):**

| Criterion | Target |
|-----------|--------|
| Total lessons from Puzzle School bank | **≥8,000** verified |
| Stretch goal | **~16,000** as bank matures post-GA |
| Lichess `pz-*` semesters in production | **0** (retired or dev-only fallback) |
| Active stages with ≥3 populated classes | All 5 launch stages |
| Lessons per core class | **≥12** + tutorial + exam where specified |
| Invalid FEN / broken lines | **0** |
| Empty teaser classes on campus | **0** |

Authoring 16k fully hand-written puzzles is a **multi-quarter curriculum program**, not one sprint. M-063 delivers the **system + launch bank (≥8k)**; growth to 16k is tracked in the matrix with ongoing authoring.

---

## Pre-School progression spine (mandatory)

Pre-School is **not** part of the Lichess puzzle bank. It is **100% hand-authored**, quiz + observe + try, and must follow a **fixed pedagogical order**. No castling before piece moves; no checkmate before check; no clocks before the student knows how a game ends.

### Canonical unit order

| Unit | Topics (in order) | Lesson kinds |
|------|-------------------|--------------|
| **1 — The board** | 64 squares, files/ranks, coordinates, starting position, turns (White/Black) | info, quiz |
| **2 — Meet the pieces** | Roster, piece values intro (optional light touch), king & queen roles | info, quiz |
| **3 — How pieces move** | Pawn → knight → rook → bishop → queen → king (one piece per mini-unit, try moves on board) | observe, move, quiz |
| **4 — Capturing & blocking** | Capture, path blocked, “knights jump” | quiz, move |
| **5 — Special moves** | Promotion → castling → **en passant** (after castling; owner confirmed) | info, observe, move, quiz |
| **6 — Game endings** | Check → escape check → checkmate → stalemate → draw (50-move / repetition light touch) | info, quiz |
| **7 — Scoring the position** | Piece point values (Q=9, R=5, …), simple material count exercises | info, quiz, move |
| **8 — Playing a full game** | Goal of chess, resign, **clocks (conceptual only)** — what a time control is, how flag fall ends a game; **no timed play or blitz in Pre-School** (owner confirmed) | info, quiz |
| **9 — Chess language** | Notation (files, ranks, piece letters, simple moves & captures) | info, quiz, observe |

Units **1→9** are sequential. A lesson in unit N may only depend on units **≤ N**.

**Owner decisions (2026-07-11):** en passant in Pre-School after castling; clocks **conceptual only** (real timed matches start in Elementary / Play mode).

### Topic tags (preschool-only)

Each preschool lesson carries a `preschoolTopic` (in bank metadata or `tag` suffix) from this ordered list:

```text
board → pieces-intro → move-pawn → move-knight → move-rook → move-bishop → move-queen → move-king
→ capture → blocking → promotion → castling → en-passant
→ check → escape-check → checkmate → stalemate → draw
→ material-points → game-goal → clocks → notation
```

### Validation rules (enforced by `curriculum:validate`)

**ERROR — block seed/dump/remote:**

- Preschool lesson references a topic **before** its spine index (e.g. `castling` before `move-king`)
- Prerequisites skip a required unit (topological sort must respect spine)
- `move` step before student has had `observe` or `info` for that piece (per-unit rule table)
- Missing coach on info/quiz steps; quiz `correct` out of range
- FEN / move illegality (same as global rules)

**WARNING — flag for author review:**

- Coach mentions checkmate before `check` unit completed in prerequisite chain
- Lesson title implies advanced topic (e.g. “Castling”) with wrong `preschoolTopic`
- Duplicate pedagogical content (same FEN + same teaching goal)
- Unit has &lt; 2 lessons or &gt; 20 without review

**Pre-School is exempt** from puzzle-bank concept tags (`fork`, `pin`, …). Tactics semesters start at **Elementary**.

### Current content gap (to fix in M-063 Phase 2)

Today’s `class-pre-rules` teaches check, mate, stalemate, promotion, and castling **before** `class-pre-moves` finishes piece-by-piece practice — and campus class order shows Rules before Moves. Prerequisites partially patch this (`pre-pawn-basics` ← `pre-pieces-king`) but the journey still surfaces castling/checkmate too early.

**M-063 deliverable:** reorder classes to match the spine above, rewrite/extend lessons for **material points** and **clocks**, and run progression validation in CI.

---

## Curriculum validation tooling

All lessons (preschool + puzzle bank) pass through the same pipeline:

```text
pnpm curriculum:validate          # local.db or --remote Turso
  ├─ legality (chess.js)          ERROR
  ├─ structure (steps, quiz)      ERROR
  ├─ graph (prereqs, orphans)     ERROR
  ├─ preschool spine order        ERROR
  ├─ quality rubric               WARNING (Tier A: promote to ERROR)
  └─ report → curriculum-report.json
```

Integrated into `verify:milestone` and required before `db:dump` / `db:remote`.

---

## Import & validation report (required)

Every command that **writes lessons into `local.db`** (seed, `import-puzzle-school`, `import-homework`, admin bulk import) must print a **terminal summary** and write **`curriculum-import-report.json`** (and optional `.md` for humans).

### Report contents

```json
{
  "runAt": "ISO-8601",
  "command": "import-puzzle-school",
  "source": "packages/puzzle-school/data/puzzles/",
  "durationMs": 12345,
  "summary": {
    "scanned": 16200,
    "inserted": 15840,
    "updated": 0,
    "skipped": 280,
    "rejected": 80,
    "warnings": 42
  },
  "byOutcome": {
    "success": ["cs-pz-middle-fork-0001", "…"],
    "rejected": [
      { "id": "cs-pz-…", "reason": "illegal_move", "detail": "e2:e5 not legal from FEN …" },
      { "id": "cs-pz-…", "reason": "spine_violation", "detail": "preschoolTopic castling before move-king" },
      { "id": "cs-pz-…", "reason": "duplicate_fen", "detail": "same as cs-pz-…" },
      { "id": "cs-pz-…", "reason": "quality_rubric", "detail": "coach too short" }
    ],
    "skipped": [
      { "id": "lichess:abc", "reason": "bucket_full", "detail": "middle:fork at cap" }
    ],
    "warnings": [
      { "id": "…", "code": "generic_coach", "detail": "…" }
    ]
  },
  "byBucket": {
    "middle:fork": { "inserted": 380, "rejected": 2 },
    "preschool:notation": { "inserted": 10, "rejected": 0 }
  },
  "exitCode": 0
}
```

### Terminal summary (always print)

```text
══════════════════════════════════════════════════
 Curriculum import complete
══════════════════════════════════════════════════
  Scanned:    16,200
  Inserted:   15,840  ✓
  Rejected:       80  ✗ (see curriculum-import-report.json)
  Skipped:       280  ○ (bucket cap / duplicate policy)
  Warnings:       42  ⚠
  Duration:    12.3s
  Report:      apps/web/curriculum-import-report.json
══════════════════════════════════════════════════
```

### Outcome definitions

| Outcome | Meaning |
|---------|---------|
| **Inserted** | Written to DB; passed all ERROR checks |
| **Rejected** | Failed validation; **not** written (illegal FEN/move, spine violation, schema error) |
| **Skipped** | Valid but intentionally not imported (bucket full, reference-only, user `LIMIT`) |
| **Warning** | Inserted (or rejected per tier policy) but flagged for author review |

### Exit codes

| Code | When |
|------|------|
| `0` | All required inserts succeeded; 0 ERROR rejections |
| `1` | Any ERROR rejection, or insert count below launch matrix minimum |
| `2` | Fatal (DB unreachable, corrupt source file) |

`pnpm curriculum:validate` uses the same report shape with `command: "validate"` and no inserts — lists existing DB rows that would fail if re-imported.

Reports are **gitignored** by default (`curriculum-import-report.json`); CI uploads them as artifacts.

---

## Verify after every change

Run these from **repo root** unless noted. Stop at the first failing step and fix before continuing.

### A — Tooling / validator / package changes (`packages/puzzle-school`, scripts)

```bash
cd packages/puzzle-school && pnpm test
cd ../../apps/web && pnpm curriculum:validate    # uses existing local.db
pnpm typecheck && pnpm --filter web test
```

**Pass:** puzzle-school tests green; validate prints report (rejections expected until Phase 2 preschool fix).

### B — Hand-authored lesson edits (`content/data/*.mjs`)

```bash
cd apps/web
pnpm db:fresh                    # re-seed from .mjs → local.db
pnpm curriculum:validate         # exit 0 = no ERROR rejections
```

**Check report:** `apps/web/curriculum-import-report.json` → `byOutcome.rejected` must be `[]`.

**Optional spot-check:** `pnpm dev` → open changed lesson on campus/journey.

### C — Puzzle import / bank changes

```bash
cd apps/web
pnpm db:fresh
pnpm db:import-puzzle-school     # full import; or LIMIT=500 for quick smoke
pnpm curriculum:validate
```

**Pass import report:** `Rejected: 0`, `Inserted` matches expectation.  
**Pass validate:** `Rejected: 0` (warnings for `generic_coach` on bulk OK for now).

### D — Before committing `seed.sql` or pushing Turso

```bash
cd apps/web
pnpm db:dump                     # regenerates db/seed.sql from local.db
pnpm curriculum:validate         # still green
pnpm db:fresh && pnpm db:remote  # optional: dry-run remote from fresh seed.sql counts
# Or validate remote directly:
DATABASE_URL=libsql://… DATABASE_AUTH_TOKEN=… pnpm curriculum:validate -- --remote
```

**Only push remote when:** validate exit `0`, lesson count matches intent (~16k with full import, ~97 authored-only).

### E — Milestone boundary (owner approval / merge)

```bash
SKIP_LIGHTHOUSE=1 pnpm verify:milestone
```

### Quick reference

| You changed… | Minimum verify |
|--------------|----------------|
| `puzzle-school` validate logic | `pnpm test` (package) + `curriculum:validate` |
| Preschool lesson in `.mjs` | `db:fresh` → `curriculum:validate` (0 rejections) |
| Import script / csv.gz | `db:fresh` → `db:import-puzzle-school` → `curriculum:validate` |
| `seed.sql` / Turso | `db:dump` → `curriculum:validate` → `--remote` validate |
| UI lesson player only | `pnpm --filter web test` + manual playthrough |

**Report file:** always inspect `apps/web/curriculum-import-report.json` for `rejected` and `warnings` details.

---

## M-063 phased deliverables

### Phase 1 — Puzzle School foundation
- [x] `packages/puzzle-school` scaffold (types, schema, validate CLI)
- [x] `matrix.yaml` + preschool spine map committed
- [x] `curriculum:validate` CLI (legality + preschool spine + quality rubric + **import report**)
- [x] `db:import-puzzle-school` + import report on Lichess path (interim)
- [ ] `import-puzzle-school.mjs` reads Puzzle School JSONL bank (Phase 3)
- [x] Lichess path documented under `scripts/reference/`

### Phase 2 — Lesson quality uplift
- [ ] **Pre-School spine:** reorder classes/lessons (units 1–9: board → pieces → moves → capture → special → endings → points → clocks → notation)
- [ ] En passant after castling; clocks **conceptual only** (no timed Pre-School play)
- [ ] Expand hand-authored semesters (openings, endgames, tactics depth)
- [ ] School-themed tutorials per concept (not generic `TUTORIALS[concept]` strings)
- [ ] Capstone match lessons per major graduation class
- [ ] Coach voice guide in `packages/puzzle-school/README.md`
- [ ] `curriculum:validate` with preschool progression checks

### Phase 3 — Bank population & QA
- [ ] Populate bank to launch bar (≥8k)
- [ ] `pnpm puzzle-school validate` → 0 errors in CI
- [ ] Content matrix report (`pnpm puzzle-school stats`)
- [ ] Spot-check: full semester path in browser

### Phase 4 — Admin & ops
- [ ] Admin: import puzzle JSONL / edit puzzle metadata (extends M-023)
- [ ] `db/seed.sql` + Turso remote seed from Puzzle School export
- [ ] `pnpm verify:milestone` green

---

## Open-source readiness

| Concern | Approach |
|---------|----------|
| License | MIT (or CC0 for data, MIT for code) — decide before public repo |
| No app secrets | Package has no `DATABASE_URL`, no Turso, no auth |
| Data portability | Bank is plain JSON/YAML in `data/` |
| Versioning | Bank `version` field + semver on package |
| Third-party | Lichess-derived **adapted** puzzles tagged `source: adapted` with attribution note |

---

## Out of scope (unchanged)

- M-058 Personalized Mistake-DNA puzzles
- M-067 Story Mode narrative
- Procedural infinite drill generation (retired)

---

## Verification

```bash
pnpm --filter puzzle-school validate
pnpm --filter web db:import-puzzle-school   # writes curriculum-import-report.json
pnpm --filter web curriculum:validate
pnpm --filter web db:dump && pnpm --filter web db:remote   # from personal network
SKIP_LIGHTHOUSE=1 pnpm verify:milestone
```

Manual: campus shows no empty launch stages; one semester completed end-to-end; puzzle quality spot-check sign-off by owner.

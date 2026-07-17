# M-064 — Thinking Mode & Match Commentary

> **Status:** Verified (Phases 1–3 merged 2026-07-11; Phase 4 review hooks → M-065+ backlog)  
> **Branch:** `milestone/M-064-thinking-mode`  
> **Depends on:** M-063 (curriculum + live match chat foundation)

## Vision

Train **calculation** like a school exercise, and give every finished game a **coach recap** that feels personal — driven by coach personality and bot opponent, not extra settings.

**M-063 delivered:** in-game bot bubbles (move-aware, tier + personality).  
**M-064 extends:** post-game recap, thinking/calculation mode, deeper review hooks.

---

## Phased deliverables

### Phase 1 — Post-game recap (this branch)
- [x] `gameRecap.ts` — PGN-aware summary (material, checks, outcome, tier, personality)
- [x] Wire recap into `MatchView` when vs-bot game ends
- [x] Unit tests green

### Phase 2 — Thinking mode (vs bot)
- [x] Match chooser: **Thinking game** toggle (no clock default, calculation prompts)
- [x] Before player move: coach nudge from personality; confirm move step
- [x] Persist flag on `ActiveMatch`

### Phase 3 — Calculation trainer
- [x] Standalone `/play/think` + entry from Play chooser
- [x] Hide answer until player locks in a move or taps Show solution
- [x] Two-step hints via existing engine (`hintArrow`)

### Phase 4 — Review integration (deferred)
- [ ] Recap links to mate review / journal reflect
- [ ] Key-moment bookmarks from replay frames

---

## Verification

```bash
pnpm --filter web typecheck
pnpm --filter web test features/coaching/
SKIP_LIGHTHOUSE=1 pnpm verify:milestone
```

Manual: finish a game vs Cody and vs Titan — recap should differ in tone and depth.

---

## Out of scope (later milestones)

- M-058 Mistake-DNA personalized puzzles
- Full engine annotation export (PGN comments)
- M-067 Story Mode narrative layer

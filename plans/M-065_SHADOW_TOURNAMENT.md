# M-065 — Tournament & Shadow Opponent Modes

> **Status:** In Progress — Phase 3  
> **Branch:** `milestone/M-065-shadow-tournament`  
> **Depends on:** M-064 (match flow, saved games, coach commentary)

## Vision

**Shadow opponent** — replay a past game's moves on one side so you can rematch your old self or a past bot line from the same chair.

**Tournament** (later) — lightweight Swiss/arena among bots + local leaderboard (no server bracket yet).

---

## Phased deliverables

### Phase 1 — Shadow opponent ✅
- [x] Pick a saved game from review history
- [x] Human plays their original color; shadow replays opponent moves from PGN
- [x] Off-book detection when shadow can't continue
- [x] Entry from Play chooser → `/play/shadow`
- [x] Shadow rematch CTA on game replay (`/review/[id]`)

### Phase 2 — Shadow polish ✅
- [x] Coach lines for shadow mode (personality + off-book)
- [x] Optional: play as the opposite color (defend vs your past attack)
- [x] Fix shadow replay indexing (opponent-only move list)

### Phase 3 — Arena tournament (local)
- [ ] 4-bot round-robin at chosen ELO band
- [ ] Standings card + XP
- [ ] Persist run in progression store

### Phase 4 — Swiss bracket (optional)
- [ ] Pairing logic for 8-player bot Swiss
- [ ] Export results to journal

---

## Verification

```bash
pnpm --filter web typecheck
pnpm --filter web test features/play/
SKIP_LIGHTHOUSE=1 pnpm verify:milestone
```

Manual: finish a vs-bot game → Review → Shadow rematch → opponent moves replay.

---

## Out of scope

- Online multiplayer tournaments
- Rated shadow games (use normal bot rating for now)

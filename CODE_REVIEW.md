# ChessSchool — Production-Readiness Code Review

Two parallel deep reviews (mobile `apps/mobile`, web `apps/web`) + the live device-testing bug list, consolidated. Severity: **C**ritical / **H**igh / **M**edium / **L**ow. "✅ fixed" = already addressed this session.

---

## 0. Executive summary

The mobile app is **stylistically clean** (0 `any`, 0 `console.*`, 0 TODO, ~5k LOC) and feature-complete. The web backend is solid in shape but has **two CRITICAL security/data issues** and several HIGH data-integrity gaps that should be fixed before promoting to a public launch. The biggest cross-cutting risk on both sides is the **progress read-modify-write race / wholesale-overwrite** — concurrent writes can silently clobber or wipe user progress.

**Do-before-public-launch shortlist:** web session auth (C), game-id entropy (C), progress merge/transaction (H, both sides), 401 handling (H, app), infinite-spinner-on-error (H, app), rate limiting (H, web), DB indexes (H, web).

---

## 1. WEB (`apps/web`) — backend

### Critical
- **C1 — Online session is unauthenticated & impersonatable.** `app/api/session/[id]/route.ts` trusts client-supplied `body.color` to decide whose move it is; `gameSessions` has no `whiteUserId`/`blackUserId`. Anyone who knows an id can move **both** sides, resign or time-out either player. `POST /api/session` has no auth at all. **Fix:** add seat-owner columns, require `getApiUser`, derive mover color from the authenticated user.
- **C2 — Game id is guessable.** `Math.random().toString(36).slice(2,8)` = 6 chars (~31 bits), non-CSPRNG, no collision handling (dup id → unhandled 500). **Fix:** `crypto.randomUUID()` + collision retry.

### High
- **H1 — `progress` POST deletes ALL lessonRecords then re-inserts, no transaction.** A client posting a partial/empty `lessons` map destroys mastery history; a mid-failure leaves zero records. No max-merge. **Fix:** per-lesson upsert with `max(mastery, attempts)` in a transaction; never delete-all. *(Mobile mitigates by always round-tripping the full snapshot, but it's fragile.)*
- **H2 — Typed progress columns are last-write-wins.** `xp`, `streak`, `graduatedClasses` overwrite wholesale (only the JSON `data` blob is key-merged). A stale device can lower XP / wipe graduations. **Fix:** max-merge numeric columns.
- **H3 — No rate limiting** on `/api/auth/*` or mutating routes → brute-forceable login, write-amplification.
- **H4 — No DB indexes.** `lessonRecords.userId`, `lessons.classId`, `classes.semesterId` are full-scanned on every per-user request.
- **H5 — `campus`/`next-lesson`/`library` load the entire `lessons` table (≈16k rows) per request** and sort in JS, `force-dynamic`. **Fix:** cache the curriculum skeleton (changes only on admin edit).
- **H6 — Session tokens stored in plaintext** and used as the `sessions` PK (cookie + Bearer + key are the same value). A DB leak = usable creds for everyone. **Fix:** store `sha256(token)`.

### Medium
- Unguarded `await req.json()` → 500 on malformed body (`progress` POST, `session/[id]` POST). No zod validation → clients can write negative/huge XP, arbitrary mastery.
- Unguarded `JSON.parse` in `progress` GET (`graduatedClasses`) and `lesson/[id]` (`steps`) → 500 on a corrupt row.
- `placement` parses up to 600 lesson blobs per request (uncached, force-dynamic) — should be a precomputed cached set.
- Session cleanup: expired rows never deleted (unbounded growth); no revocation on credential change.
- User enumeration via login timing (short-circuit on missing email) + explicit "already enrolled" message.

---

## 2. APP (`apps/mobile`) — client

### High (resilience — the biggest shipping gap)
- **A-H1 — Infinite spinner on fetch failure** (`lesson/[id]`, `class/[id]`, `replay/[index]`): `.catch(()=>void 0)` leaves a spinner with no error/retry/back. Flaky network = permanently stuck. **Fix:** error state + retry + back.
- **A-H2 — No 401 handling after boot.** Session expiry mid-use → every `api()` throws, swallowed → user looks logged-in but writes silently fail. **Fix:** centralize 401 in `api()` → clear token → re-auth.
- **A-H3 — Progress write race / clobber.** Read-modify-write of the whole snapshot from 6+ places (lesson finish, exam, placement, game, homework, settings.pushToAccount) with last-writer-wins. Finish a lesson + toggle a setting quickly → one clobbers the other. **Fix:** single `mutateProgress(fn)` queue in `progressStore` that re-reads latest before merging (also dedupes the duplicated GET-modify-POST block in 6 files).

### Medium
- **A-M1 — Bot game time control is dead.** `play.tsx` lets you pick 5/10/20/30-min clocks; `game.tsx` ignores `time` and shows no clock. **Fix:** implement or remove the UI.
- **A-M2 — Promotion hard-coded to queen** at all 11 board call sites; underpromotion puzzles (e.g. `e7e8=N`) are unsolvable/mis-scored. **Fix:** promotion picker / detect in lesson/exam/placement.
- **A-M3 — Mastery always computes ~1.0** (`lesson/[id]` finish): you can't pass a move step without the right move, so `correct===total`. Dashboard/skill-tree mastery never reflects mistakes. **Fix:** score on first-attempt success / feed `mistakes` in.
- **A-M4 — Online clocks don't tick locally** (only on the 1.6s poll) → freeze-and-jump. **Fix:** local 1s interpolation.
- **A-M5 — Bot move in a bare `setTimeout(async)`** with no cleanup → setState-after-unmount; stale closure can write old position after `reset()`.
- **A-M6 — Heavy lists not virtualized.** `journal` renders up to 25 SVG boards in a ScrollView; `library`/`review`/`campus` map in ScrollView. **Fix:** `FlatList`.
- **A-M7 — Several screens fetch `/api/progress` directly** (class, play, journal, replay) bypassing `progressStore` → defeats the dedupe cache.
- **A-M8 — No-op settings shipped:** `highContrast`, `colorblind`, `hints` are persisted/synced but never read by any component. Either wire or hide.
- **A-M9 — Accessibility: 0 `accessibilityLabel`/`role` in the whole app.** Icon-only buttons + sliders + switches are invisible to screen readers → store-review risk.
- **A-M10 — Error-vs-empty conflation in placement/exam:** a fetch failure renders as "empty" → placement silently places a new student at Elementary. **Fix:** distinguish error from empty.

### Low / polish
- `login.tsx` shows the production **API URL** on screen — remove.
- Pull-to-refresh only on Learn; Profile/Review/Dashboard/Journal can't refresh stale cache.
- Profile name has no `numberOfLines` (overflow on long names).
- Draw types all labeled "Draw" (stalemate/threefold/50-move undifferentiated).
- `isNew` placement prompt keys off lessons-count, not the `placementDone` flag.
- Triple-duplicated level math (`progress-utils` ×2 + `TopBar`); duplicated `material()`/`buildFrames()`.
- `_layout.tsx` Gate effect depends on a fresh `segments` array each render.
- `onboarding.tsx` `THEME_MAP` collapses 4 choices into 3 board themes; `as never` cast hides a planTier type mismatch.

---

## 3. Live device-test bug list — status

| Reported issue | Status |
|---|---|
| Can't move pieces in lesson | ✅ fixed (drag-to-move + tap) |
| Lesson completion Back→Continue flash | ✅ fixed (Saving… state) |
| Exam/placement no move animation | ✅ fixed (show + animate move) |
| Lesson flicker on correct/wrong + no piece move | ✅ fixed (animate both; suppress post-drag double-anim) |
| vs Bot board stuck at top + no turn indicator | ✅ fixed (centered + active dot) |
| vs Human UI / no resign / spacing | ✅ fixed (player bars + resign) |
| Bot difficulty slider flicker | ✅ fixed (local drag + stepped emit) |
| Placement doesn't unlock placed school | ✅ fixed (records skipped stages) |
| Themes: few options vs web | ◑ board themes 3→8 done; **dedicated /themes page + preview + app color-themes pending** |
| Onboarding theme doesn't apply | ☐ pending — needs app-wide color-theme system (big) |
| Settings missing options (coach personality…) | ☐ pending |
| Continue-as-Guest on login | ☐ pending |
| Theme preview button | ☐ pending (part of /themes page) |
| Homework: Go button / completion message / checkbox sync | ☐ pending |
| Learning-profile card click → details | ☐ pending |
| Sounds don't match web | ☐ pending (port web's procedural audio → wav) |

---

## 4. Testing gaps

- **Web:** zero API tests for auth, the progress merge (highest-risk code), session ownership, or any mobile route. e2e is 9 guest-UI smoke tests only. **Add:** vitest integration (test libSQL file) for auth, progress-merge max/transaction, session seat-ownership.
- **App:** only `progression.test.ts` (20). **Add:** unit tests for `material/buildFrames/placedElo/clock/fenToBoard`; RNTL component tests for lesson move-correct/wrong-retry, online result-string mapping, settings persistence; a Maestro/Detox e2e for register→onboarding→placement→lesson→match; 401/500/offline simulation for `api.ts`.

---

## 5. Recommended order to ship

1. **Web security:** C1 (session seat auth) + C2 (game id) — these are the only true *security* holes.
2. **Data integrity:** H1+H2 (progress transaction + max-merge) on web, A-H3 (write queue) on app — protects user progress.
3. **App resilience:** A-H1 (no infinite spinners) + A-H2 (401 handling) — the difference between "works on my wifi" and "ships".
4. **Web hardening:** H3 (rate limit) + H4 (indexes) + input validation.
5. **UX correctness:** A-M1/2/3 (time control, promotion, mastery) + the remaining device-test bugs (themes page, guest, homework, sounds).
6. **Polish:** accessibility, no-op settings, virtualization, dedup.

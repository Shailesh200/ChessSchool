# ChessSchool — Asset brief (M-075 Phase A)

Original art only. No third-party icon fonts, no Duolingo/Lichess-derived art, no stock mascot packs.

**Phase A = source-of-truth specs + reference files in this repo.**  
**Phase B = wire assets into `apps/web/public/` and components.**

---

## Asset categories

| Category | Format | Phase A location | Phase B destination |
|----------|--------|------------------|---------------------|
| UI chrome icons | Inline SVG (`Icon.tsx`) | `assets/svg/icons/` samples | `components/ui/Icon.tsx` |
| Ceremony / hero | Lottie JSON + SVG fallback | `assets/lottie/`, `assets/svg/ceremony/` | `components/ui/Ceremony.tsx` (new) |
| Mascot (Cody) | PNG + optional SVG silhouette | `assets/images/mascot/` brief | `public/mascots/` |
| Empty states | SVG illustration | `assets/svg/empty/` | Feature empty-state components |
| Semester badges | SVG | `assets/svg/badges/` | Campus / Journey cards |
| Board accents | SVG overlays | `assets/svg/board/` | `features/board/` |
| Marketing / OG | PNG 1200×630 + SVG logo | `assets/images/og/` brief | `lib/og/` |

---

## SVG system (upgrade from current)

**Current:** ~40 icons in `Icon.tsx`, 2px stroke, duotone fill, `currentColor`.  
**Target:** Expand to **60+ icons**, add **filled + outline** variants for ceremony moments, keep single `Icon` component API.

### New icons (Phase B — spec locked here)

| Icon | Use |
|------|-----|
| `graduation` | Class complete, diploma sheet |
| `medal` | Achievement unlock |
| `streakShield` | Streak freeze / milestone |
| `puzzle` | Daily puzzle, tactics |
| `clock` | Time control, homework due |
| `bookOpen` | Library, lesson intro |
| `certificate` | School exam pass |
| `sparkleBurst` | XP award micro-moment |
| `crown` | Rank promotion |
| `handshake` | Online PvP invite |

Reference strokes: see `assets/svg/icons/sample-graduation.svg`.

### SVG rules

- ViewBox `0 0 24 24` for UI icons; `0 0 120 120` for illustrations
- Stroke `2`, `round` caps/joins; duotone fill at `opacity="0.16"`
- No embedded raster; no filters that break dark mode
- Theme via `currentColor` only

---

## Lottie inventory (≥3 ceremony moments — M-075 DoD)

| ID | Moment | Duration | Loop | Reduced motion |
|----|--------|----------|------|----------------|
| `lottie-lesson-complete` | Lesson finish overlay | 1.8s | once | Static SVG badge |
| `lottie-class-graduate` | Class graduation sheet | 2.4s | once | PNG diploma + fade |
| `lottie-exam-pass` | School exam pass | 2.0s | once | Icon + confetti CSS |
| `lottie-streak-milestone` | 7/30-day streak | 1.5s | once | Number tick only |
| `lottie-achievement-unlock` | Achievement toast hero | 1.2s | once | Icon scale spring |

### Lottie technical spec

- Bodymovin / LottieFiles export, **max 80 KB gzip** each
- No bitmap layers; vector shapes only (theme-friendly)
- Brand palette: `#5b5bd6`, `#ff7a59`, `#10b981`, `#f6c343`, ink `#1c1b2e`
- `@lottiefiles/dotlottie-react` or `lottie-react` in Phase B; lazy-load on ceremony routes only

Phase A deliverables:

- JSON specs in `assets/lottie/SPECS.md` (layer list, timing)
- Placeholder minimal JSON in `assets/lottie/placeholders/` for integration testing in Phase B
- SVG fallbacks in `assets/svg/ceremony/` (required for `prefers-reduced-motion`)

---

## Raster / image assets

### Mascot (Cody)

| Expression | Current | Phase B target |
|------------|---------|----------------|
| happy, think, cheer, sad, wave | PNG v2 in `public/mascots/` | Re-export at 1x/2x WebP + PNG fallback; optional SVG silhouette for loaders |

**Art direction:** 3D-rendered pawn professor, graduation cap, warm lighting, transparent background, max 256 KB per expression at 512px.

### Empty-state illustrations (SVG preferred)

| Screen | Asset |
|--------|-------|
| Library (no completions) | `empty-library.svg` |
| Review (no games) | `empty-review.svg` |
| Journal (no entries) | `empty-journal.svg` |
| Dashboard (new user) | `empty-dashboard.svg` |
| Homework (all done) | `empty-homework-done.svg` |

Samples in `assets/svg/empty/`.

### OG / social

- Keep procedural OG card (`lib/og/card.tsx`); add optional **hero texture** SVG watermark in Phase B
- App icons: refresh `public/icons/icon.svg` to match ceremony badge geometry (spec in `assets/svg/brand/`)

---

## Animation assets (non-Lottie)

Documented in `MOTION.md`. Implemented with **Framer Motion** + CSS in Phase B:

- Nav pill spring (`layoutId`)
- Card stagger on Campus / Journey
- Lesson step transitions
- Board move highlight pulse
- Toast / achievement slide-in
- Skeleton shimmer (CSS only, no Lottie)

---

## File size budget (Phase B gates)

| Surface | Budget |
|---------|--------|
| Home route initial JS | ≤280 KB gzip (lazy Lottie) |
| Single Lottie file | ≤80 KB gzip |
| SVG sprite (all icons) | ≤40 KB gzip inlined |
| Mascot expression | ≤256 KB each |

---

## Approval checklist (owner)

- [ ] Icon style matches brand (stroke, duotone, no emoji in chrome)
- [ ] Ceremony moments list is complete
- [ ] Lottie vs SVG-fallback strategy accepted
- [ ] Empty-state tone is friendly, not childish
- [ ] Desktop + mobile mockups align with asset placement (`mockups/`)

Sign-off: `APPROVAL.md`

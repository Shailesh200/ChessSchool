# Lottie specifications (M-075 Phase A)

Phase B loads from `public/lottie/*.json` (lazy). Placeholders below are **minimal valid Lottie** for integration tests only — replace with polished exports before GA.

---

## `lottie-lesson-complete`

| Property | Value |
|----------|-------|
| Canvas | 400×400 |
| FPS | 60 |
| Duration | 108 frames (1.8s) |
| Loop | false |

**Layers (design intent):**

1. Background circle scale 0→1 (brand indigo, 20% opacity)
2. Star burst — 8 rays rotate 0→45°
3. Particle dots — 12 items, radial explode, fade out frame 90
4. Checkmark stroke draw-on frame 20–50

**Fallback:** `assets/svg/ceremony/lesson-complete-badge.svg`

---

## `lottie-class-graduate`

| Property | Value |
|----------|-------|
| Canvas | 512×512 |
| Duration | 144 frames (2.4s) |

**Layers:**

1. Diploma card slide up (ease out)
2. Cap path bounce (translate Y)
3. Confetti rectangles (brand palette)
4. Text placeholder (hidden — real UI renders text in HTML)

**Fallback:** `assets/svg/ceremony/class-diploma.svg`

---

## `lottie-exam-pass`

Shorter variant of graduate; gold accent `#f6c343` dominant.

---

## `lottie-achievement-unlock`

Small 200×200; trophy scale spring; used inside toast, not full-screen.

---

## `lottie-streak-milestone`

Flame icon pulse + ring expand; coral `#ff7a59`.

---

## Production workflow

1. Design in Figma / After Effects with brand palette
2. Export via LottieFiles or Bodymovin
3. Optimize: remove unused assets, merge shapes, target ≤80 KB gzip
4. Validate with `lottie-web` player + reduced-motion off
5. Commit to `apps/web/public/lottie/` in Phase B only

## Placeholder files

`placeholders/` contains minimal JSON for Phase B dev wiring — **not for production**.

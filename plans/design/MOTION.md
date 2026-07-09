# ChessSchool — Motion storyboard (M-075 Phase A)

All motion must respect `prefers-reduced-motion: reduce` (already in `globals.css`).  
Phase B implements via Framer Motion + Lottie lazy-load + CSS keyframes.

---

## Motion principles

1. **Purposeful** — motion confirms success, shows hierarchy, never decorates idle UI
2. **Snappy** — default `--dur-base: 240ms`; ceremonies up to 2.4s once
3. **Springy** — `--ease-spring` for taps, nav pill, achievement pop
4. **Accessible** — reduced motion → instant state or static SVG; no essential info in motion alone

---

## Ceremony moments (Lottie + overlay)

### 1. Lesson complete

**Trigger:** last step of `LessonPlayer` success  
**Layers:** Cody cheer (mascot PNG) + Lottie `lottie-lesson-complete` confetti burst + XP pill count-up  
**Timing:** 0ms mascot scale-in → 200ms Lottie → 600ms XP spring → 1800ms dismiss CTA  
**Reduced motion:** static `lesson-complete-badge.svg` + instant XP number  
**Sound:** existing `audio.play("success")`

### 2. Class graduation

**Trigger:** class exam pass / graduation action  
**Layers:** full-screen sheet + Lottie `lottie-class-graduate` (cap toss) + class name type-in  
**Timing:** sheet slide-up 320ms → Lottie 2400ms → confetti CSS 400ms overlap → CTA  
**Reduced motion:** diploma SVG fade, no confetti  
**Haptic:** `haptics.fire("success")`

### 3. School exam pass

**Trigger:** stage exam pass in `PlacementTest` / school exam  
**Layers:** Lottie `lottie-exam-pass` + rank badge reveal  
**Timing:** 2000ms hero → stagger skill bars 80ms each  
**Reduced motion:** badge icon + text only

### 4. Achievement unlock

**Trigger:** new achievement in progression reducer  
**Layers:** toast takeover + Lottie `lottie-achievement-unlock` (small, top of toast)  
**Timing:** 1200ms loop-once; toast stays until dismissed  
**Reduced motion:** `Icon` trophy duotone + slide-in toast (existing pattern)

### 5. Streak milestone (7 / 30 days)

**Trigger:** streak hits milestone in progression  
**Layers:** inline banner on Campus + optional Lottie flame burst  
**Timing:** 1500ms; non-blocking  
**Reduced motion:** flame icon pulse disabled → static count

---

## Micro-interactions (Framer Motion — no Lottie)

| Element | Animation | Token |
|---------|-----------|-------|
| Bottom nav active pill | `layoutId="nav-pill"` spring | stiffness 400, damping 32 |
| Tab icon | y -1, scale 1.06 when active | spring 500/24 |
| Campus semester cards | stagger 60ms, fade+slide 12px | `listContainer` variants |
| Journey milestone nodes | scale 0.92→1 on unlock | `--ease-spring` |
| Lesson step advance | crossfade 200ms + board FEN transition | `--dur-base` |
| Primary button press | translateY 4px (shadow-button) | CSS `:active` |
| Match clock low time | opacity pulse 1s | CSS `@keyframes` |
| Board last-move square | highlight fade 800ms | existing board CSS |
| Modal / sheet | slide-up + backdrop blur | `--dur-slow` |
| Confetti (CSS fallback) | 12 particles, 400ms | `components/ui/Confetti.tsx` enhance |

---

## Loading states

| Surface | Pattern |
|---------|---------|
| Campus | Skeleton semester rows (3) + resume card block |
| Lesson | Board skeleton 1:1 + coach line skeleton |
| Dashboard | Radar chart placeholder circle + bar skeletons |
| Library | Grid of card skeletons |

No Lottie loaders — CSS shimmer only (`animate-pulse` + custom gradient in Phase B).

---

## Desktop-specific motion (M-059)

- Sidebar nav (≥1024px): crossfade content pane, no full-page slide
- Multi-column Campus: parallax **disabled** (performance)
- Hover states: subtle scale 1.02 on cards, 200ms

---

## Implementation map (Phase B)

| File (new/updated) | Responsibility |
|--------------------|----------------|
| `components/ui/CeremonyOverlay.tsx` | Lottie + fallback + reduced motion |
| `components/ui/AchievementToast.tsx` | Achievement takeover |
| `core/motion/variants.ts` | Shared stagger/spring presets |
| `features/lessons/LessonPlayer.tsx` | Lesson complete ceremony hook |
| `features/school/JourneyView.tsx` | Graduation sheet |

---

## Verification (Phase B)

- [ ] `prefers-reduced-motion` → no Lottie autoplay (Playwright + manual)
- [ ] Lighthouse Performance ≥90 on `/`, `/class/[id]`, `/lesson/[id]` with lazy Lottie
- [ ] No layout shift from mascot/Lottie load (reserve aspect-ratio box)

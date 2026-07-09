# ChessSchool — Design artifacts (M-075 / M-059)

Wireframes, mockups, motion specs, and **reference assets** (SVG, Lottie briefs, image specs) for the **Web GA UI overhaul**.

**No product UI code until Phase A is approved** — see `APPROVAL.md` and `plans/00_MASTER_DEVELOPMENT_PLAN.md` § M-075.

---

## Directory layout

```
plans/design/
├── README.md              ← this file
├── APPROVAL.md            ← owner sign-off (required before Phase B)
├── ASSETS.md              ← SVG, Lottie, raster inventory
├── MOTION.md              ← animations + ceremony storyboard
├── BREAKPOINTS.md         ← responsive tokens (M-059)
├── wireframes/            ← low-fi flows (markdown)
├── mockups/               ← high-fi SVG at 390px + 1280px
└── assets/
    ├── svg/
    │   ├── icons/         ← reference icons for Icon.tsx expansion
    │   ├── ceremony/      ← Lottie fallbacks
    │   └── empty/         ← empty-state illustrations
    ├── lottie/
    │   └── SPECS.md       ← Lottie layer specs (JSON in Phase B)
    └── images/
        └── mascot/        ← Cody re-export brief
```

---

## Phase A deliverables (current)

| Artifact | Status |
|----------|--------|
| Wireframes (Campus, Journey, Lesson, Dashboard, Graduation) | ✅ Draft |
| Mockups (40 screens) | ✅ Approved |
| ASSETS.md — SVG / Lottie / images | ✅ Approved |
| MOTION.md — Framer + Lottie moments | ✅ Approved |
| BREAKPOINTS.md | ✅ Approved |
| Reference SVG samples | ✅ Approved |
| Owner approval | ✅ Full Phase A · **Phase B in progress** |

---

## Approval workflow

1. Review artifacts in this folder (open SVG mockups in browser or IDE).
2. Comment on `APPROVAL.md` — **Approved**, **Revise**, or **Defer scope**.
3. When **Approved**, engineering starts **M-059** + **M-075 Phase B**:
   - Wire SVG/Lottie into `apps/web`
   - Expand `Icon.tsx`, add `CeremonyOverlay`, lazy Lottie
   - Desktop layouts per `BREAKPOINTS.md`

---

## Web GA surfaces

Both must be represented in mockups:

- **PWA** — installed mobile (390px baseline)
- **Browser** — desktop/tablet without install (1280px baseline)

---

## Reprioritized track (2026-07-09)

```text
M-044 ✓  →  M-075 Phase A (now)  →  [your approval]  →  M-059 + M-075-B
                                                      ↘  M-045–M-048 (before Web GA)
```

Hardening **M-045–M-048** resumes before launch; it does not block design review.

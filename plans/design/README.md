# ChessSchool — Design artifacts (M-075 / M-059)

Wireframes, mockups, and motion specs for the **Web GA UI overhaul**.  
**No UI implementation code until Phase A is approved** — see `plans/00_MASTER_DEVELOPMENT_PLAN.md` § M-075.

## Directory layout

```
plans/design/
├── README.md           ← this file
├── APPROVAL.md         ← owner sign-off (created at approval time)
├── ASSETS.md           ← original art direction, Lottie inventory
├── MOTION.md           ← animation storyboard, reduced-motion fallbacks
├── BREAKPOINTS.md      ← responsive tokens (M-059)
├── wireframes/         ← low-fi flows (PNG, PDF, or Figma export links)
└── mockups/            ← high-fi at 390px + 1280px
```

## Approval workflow

1. Commit wireframes + mockups (mobile **and** desktop browser widths).
2. Owner reviews — approve, revise, or defer scope.
3. Record decision in `APPROVAL.md`.
4. Only then: M-059 (browser layouts) + M-075 Phase B (implementation).

## Web GA surfaces

Both must be represented in mockups:

- **PWA** — installed/mobile standalone (M-010 already shipped; polish in M-075-B)
- **Browser** — desktop/tablet Chrome/Safari/Firefox without install (M-059)

## External tools

Figma (or similar) links may be referenced in `APPROVAL.md` if preferred over committed PNGs — but at least key screens must be exportable for offline review and visual regression baselines (M-072).

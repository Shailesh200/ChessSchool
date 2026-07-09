# Wireframe — Campus (`/`)

Low-fi flow. High-fi: `mockups/campus-mobile-390.svg`, `mockups/campus-desktop-1280.svg`.

## Mobile (390px)

```
┌─────────────────────────────┐
│ [Logo]  Daily goal ████░    │  ← TopBar + streak/XP chip
├─────────────────────────────┤
│ ┌ Resume card ────────────┐ │
│ │ Continue: Piece Movement │ │
│ │ [Continue →]             │ │
│ └─────────────────────────┘ │
│ Your place in school (nav)  │
│ ┌ Foundations ────────────┐ │
│ │ ○ Piece Movement 4/4   │ │
│ │ ○ Pawn Power      🔒     │ │
│ └─────────────────────────┘ │
│ ┌ Opening School ─────────┐ │
│ │ ...                      │ │
│ └─────────────────────────┘ │
├─────────────────────────────┤
│ Learn | Play | Review | Me  │  ← BottomNav
└─────────────────────────────┘
```

## Desktop (1280px)

```
┌──────────┬──────────────────────────────────────────────────┐
│ SIDEBAR  │  Daily goal + Resume card (wide)                  │
│ Learn    │  ┌────────────┬────────────┬────────────┐        │
│ Play     │  │ Semester 1 │ Semester 2 │ Semester 3 │        │
│ Review   │  │ class cards│            │            │        │
│ Profile  │  └────────────┴────────────┴────────────┘        │
│ ──────── │  SEO / curriculum links (collapsed on mobile)    │
│ Settings │                                                   │
└──────────┴──────────────────────────────────────────────────┘
```

## Interactions

- Tap class card → `/class/[id]` Journey
- Resume card → last lesson or class
- Daily goal tap → `/plan`

## Assets on this screen

- Semester header: optional badge SVG per stage
- Empty semester: `empty-dashboard.svg`
- Streak milestone: Lottie banner (non-blocking)

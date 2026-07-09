# Wireframe — Lesson (`/lesson/[id]`)

## Mobile

```
┌─────────────────────────────┐
│ ← Exit          Step 2/5    │
├─────────────────────────────┤
│                             │
│      ┌─────────────┐        │
│      │   BOARD     │        │  ← square board, full width
│      │             │        │
│      └─────────────┘        │
│                             │
│ ┌ Coach bubble ───────────┐ │
│ │ Push your e-pawn...     │ │
│ └─────────────────────────┘ │
│ [Hint]              [Skip?] │
└─────────────────────────────┘
```

## Desktop

```
┌────────────────────────────────────────────┐
│ ← Exit                         Step 2/5   │
├──────────────────────┬─────────────────────┤
│      BOARD           │  Coach + step list  │
│      (max 560px)     │  Progress bar       │
│                      │  Hint / actions     │
└──────────────────────┴─────────────────────┘
```

## Complete overlay (all widths)

- Full-screen dim + `CeremonyOverlay`
- Lottie lesson-complete + mascot cheer
- [Next lesson] [Back to class]

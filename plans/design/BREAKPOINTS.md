# ChessSchool — Responsive breakpoints (M-059 / M-075)

Mockups must exist at **390px** (mobile) and **1280px** (desktop browser).  
PWA standalone uses mobile layout; installed tablet uses `md`/`lg` rules below.

---

## Breakpoint tokens

| Token | Min width | Primary use |
|-------|-----------|-------------|
| `xs` | 0 | Phone portrait (320–389) |
| `sm` | 640px (Tailwind default) | Wide phone — design mockups use **390px** (`min-width: 390px` in tests) |
| `md` | 768px | Tablet portrait, wide phone landscape |
| `lg` | 1024px | Tablet landscape, small laptop |
| `xl` | 1280px | **Design mockup width** — desktop browser |
| `2xl` | 1536px | Large desktop (optional max-width cap) |

**Content max-width:** `max-w-6xl` (1152px) for reading; Campus grid may use full `xl` width.

---

## Layout matrix

| Route | Mobile (<768) | Tablet (768–1023) | Desktop (≥1024) |
|-------|---------------|-------------------|-----------------|
| `/` Campus | Single column, bottom nav | 2-col semester grid | 3-col grid + sticky resume sidebar |
| `/class/[id]` Journey | Vertical path | Path + lesson drawer | Path left, lesson list right |
| `/lesson/[id]` | Board full-bleed, coach below | Board max 520px centered | Board + coach side-by-side |
| `/play` | Match chooser stack | 2-col mode cards | Chooser + preview panel |
| `/dashboard` | Stack widgets | 2-col | Radar + heatmap row |
| `/library` | List | 2-col grid | 3-col grid + filters sidebar |
| `/settings` | Sections stack | Single column max-w-lg | Settings nav left, panel right |

---

## Navigation

| Width | Chrome |
|-------|--------|
| <1024 | Bottom tab bar (`BottomNav`) |
| ≥1024 | Left sidebar (`SidebarNav`, `aria-label="Main"`) — see mockup `campus-desktop-1280.svg` |

Bottom nav hidden on focus routes (lesson, play match) — unchanged.

---

## Typography scale (CSS `@theme` — Phase B)

| Role | Mobile | Desktop |
|------|--------|---------|
| Page title | `text-xl` / 1.25rem | `text-2xl` / 1.5rem |
| Section heading | `text-lg` | `text-xl` |
| Body | `text-sm` font-semibold | `text-base` |
| Caption | `text-xs` | `text-sm` |

---

## Spacing

- Page horizontal padding: `px-5` mobile → `px-8` desktop
- Section gap: `gap-4` mobile → `gap-6` desktop
- Card padding: `p-4` → `p-5`

---

## Touch vs pointer

- Min tap target: 44×44px (mobile)
- Desktop: hover states on cards/buttons; no hover-only critical actions
- `pointer: fine` → denser dashboard tables optional in Phase B

---

## Container queries (Phase B — M-059)

- Lesson board: `@container` min 400px → show move list beside board
- Campus card: `@container` min 280px → show lesson count pill inline

---

## Mockup files

See **`mockups/INDEX.md`** for all **40** SVG mockups (390px mobile + 1280px desktop pairs).

Wireframes (low-fi): `wireframes/*.md`

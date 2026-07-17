# Mascot image brief (Cody)

**Current production:** PNG v2 expressions in `apps/web/public/mascots/`  
**Phase B target:** WebP + PNG fallback, optional SVG silhouette for loaders

## Expressions (required)

| ID | File | Use |
|----|------|-----|
| happy | `cody-happy` | Default coach, campus |
| think | `cody-think` | Hint, puzzle |
| cheer | `cody-cheer` | Lesson complete, graduation |
| sad | `cody-sad` | Wrong move, loss |
| wave | `cody-wave` | Onboarding, online lobby |

## Export spec

- Master: 1024×1024 transparent PNG
- Deliver: 256w WebP + 256w PNG (@1x), 512w (@2x)
- Max file size: 256 KB per expression after compression
- Lighting: warm key from top-left; subtle purple rim (brand)

## Do not

- Use emoji or flat 2D clip-art style inconsistent with 3D pawn
- Add text or logos on mascot body
- License third-party character packs

## Phase A

Reference renders stay in `public/mascots/` until Phase B re-export.  
Motion pairs mascot PNG with Lottie overlay (see `MOTION.md`) — mascot does not animate inside Lottie.

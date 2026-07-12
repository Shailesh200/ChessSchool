# M-071 — Documentation Refresh

**Status:** In progress  
**Gate:** G-WebGA  
**Branch:** `milestone/M-071-documentation-refresh`

## Scope

Reconcile operational docs with the current codebase and milestone state. Retire
stale mobile parity audit. Update master plan progress after M-056, M-057, M-070.

## Deliverables

| File | Action |
|------|--------|
| `CLAUDE.md` | Rewritten — OAuth env, security, schema, milestone status; removed M-043/M-044 "known debt" |
| `README.md` | Fixed guest-only / no-backend claims; monorepo commands; roadmap pointer |
| `apps/mobile/PARITY.md` | **Retired** — redirect stub to `PARITY_GAPS.md` |
| `apps/mobile/PLAN.md` | Updated parity doc refs + phased execution status |
| `plans/00_MASTER_DEVELOPMENT_PLAN.md` | Project progress, M-056/057/070/075 status, Web GA path |
| `plans/design/README.md` | Phase B verified; current track through M-073 |
| `CODE_REVIEW.md` | Already updated in M-070 (M-043–M-048 complete) |

## Authoritative doc map

| Question | Read |
|----------|------|
| How do I run/build/deploy? | `CLAUDE.md` |
| What's the milestone roadmap? | `plans/00_MASTER_DEVELOPMENT_PLAN.md` |
| Mobile gaps vs web? | `apps/mobile/PARITY_GAPS.md` |
| Security audit findings? | `plans/M-070_SECURITY_AUDIT.md` |
| Historical code review? | `CODE_REVIEW.md` |
| Mobile store release? | `apps/mobile/RELEASE.md` |

## Verification checklist

- [x] No doc still claims M-043/M-044 as open debt in `CLAUDE.md`
- [x] `PARITY.md` points to `PARITY_GAPS.md` only
- [x] Master plan lists M-070 Verified, M-071 In Progress
- [x] README opening reflects accounts + Turso + Google OAuth
- [ ] Owner approval → merge to `main`

## Out of scope (deferred)

- Full README historical wave rewrite (lower sections kept as archive)
- `apps/mobile/PARITY_GAPS.md` content refresh (separate mobile milestone)
- M-073 launch runbook (M-073)

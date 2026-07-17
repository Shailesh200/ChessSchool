# M-070 — Security Audit & Privacy Alignment

**Status:** In progress  
**Gate:** G-WebGA  
**Branch:** `milestone/M-070-security-audit`

## Scope

Pre-launch security review building on M-043–M-048 production hardening. Re-audit
`CODE_REVIEW.md` findings, close remaining gaps, align `/privacy` with actual data
collection, and add regression tests.

## Baseline (already verified)

| Area | Milestone | Notes |
|------|-----------|-------|
| PvP seat auth + CSPRNG game IDs | M-043 | `session/[id]`, `game-session.ts` |
| Progress merge + transactional upsert | M-044 | `progress-server.ts` |
| Rate limiting + Zod validation | M-045 | `rate-limit.ts`, `api-schemas.ts` |
| DB indexes + curriculum cache | M-046 | `schema.ts`, `curriculum-skeleton.server.ts` |
| Hashed session tokens | M-047 | `session-token.ts`, `session-store.ts` |
| API integration tests | M-048 | `lib/api-integration/*` |
| Google OAuth + account linking | M-056 | `google-oauth.server.ts`, `auth.ts` |

## M-070 findings & fixes

### Fixed in this milestone

| ID | Severity | Issue | Fix |
|----|----------|-------|-----|
| H-070-1 | High | PvP timeout forgery via client `color` | Server derives timed-out seat from clocks |
| H-070-2 | High | Missing CSP / frame protection | `next.config.ts` headers |
| H-070-3 | High | Privacy policy incomplete | `app/privacy/page.tsx` rewrite |
| H-070-4 | High | TTS abuse vector | Tiered rate limits; `credentials: include` |
| M-070-2 | Medium | Account delete left analytics rows | Purge `analytics_events` + `web_vitals` |
| M-070-4 | Medium | Register email enumeration | Generic duplicate message |
| M-070-5 | Medium | Password min 6 vs API 8 | Align to 8 in `auth.ts` |
| M-070-6 | Medium | OAuth callback unrated | Rate limit on callback route |

### Documented / deferred post-GA

| ID | Issue | Notes |
|----|-------|-------|
| M-070-1 | In-memory rate limit per instance | Accept for launch; add KV/WAF at scale |
| M-070-3 | No session revoke on password change | No password-change flow yet |
| M-070-7 | Ably token unauthenticated | Subscribe-only; low risk |
| M-070-8 | Progress concurrent push race | Client write queue mitigates |
| L-070-3 | Public curriculum APIs unrate-limited | Low priority scraping risk |
| L-070-4 | `game_sessions` no TTL purge | Add cron in follow-up |

## Verification checklist

- [ ] `pnpm typecheck` green
- [ ] `pnpm lint` green
- [ ] `pnpm test` green (integration: timeout forgery, account delete purge)
- [ ] `pnpm build` green
- [ ] Manual: `/privacy` reflects Google OAuth, analytics, TTS
- [ ] Manual: online timeout only ends game when clock actually expired
- [ ] Owner sign-off

## Tests added

- `session.integration.test.ts` — forged timeout rejected (409); legit timeout accepted
- `auth.integration.test.ts` — account deletion purges analytics + vitals

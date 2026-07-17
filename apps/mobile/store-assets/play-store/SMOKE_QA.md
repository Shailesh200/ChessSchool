# Internal testing smoke checklist (Android)

Install from Play Console → Testing → Internal testing (or the EAS AAB after submit).

## Account

- [ ] Register with email/password
- [ ] Log out / log in
- [ ] Continue as guest, then enroll
- [ ] Google Sign-In (if OAuth clients + SHA-1 configured)

## Learn

- [ ] Campus / academy loads classes
- [ ] Open a class journey
- [ ] Complete one lesson (move animates, progress updates)
- [ ] Placement test reachable when needed

## Play

- [ ] Start vs Bot match, make moves, resign or finish
- [ ] Pass & play (vs Human) starts
- [ ] Online create/join does not crash (may need network)

## Account / settings

- [ ] Profile shows Student ID when enrolled
- [ ] Privacy policy opens `https://chess-school.in/privacy`
- [ ] Delete account works on a throwaway account
- [ ] Themes / piece sets switch without crash

## Offline / polish

- [ ] Airplane mode shows offline banner
- [ ] App relaunches without blank screen
- [ ] No localhost / debug strings in UI

## Sign-off

| Field | Value |
|-------|-------|
| Build / versionCode | |
| Tester | |
| Date | |
| Result | Pass / Fail |
| Notes | |

# Google Play listing copy (ChessSchool)

Use with assets in this folder. Privacy: https://chess-school.in/privacy

## App identity

| Field | Value |
|-------|-------|
| App name | ChessSchool |
| Package | `com.chessschool.app` |
| Category | Education |
| Short description (80 chars max) | Graduate through chess classes, puzzles, and matches. |
| Full description | ChessSchool is a free online chess academy structured like a real school. Enroll, take a placement test, and graduate from Starter to University with step-by-step lessons, homework, bots, and live multiplayer. Progress syncs across web and app. No credit card required. |
| Privacy policy URL | https://chess-school.in/privacy |
| Support URL | https://chess-school.in/support |
| Marketing URL | https://chess-school.in |

## Graphics

| Asset | File |
|-------|------|
| App icon 512×512 | `icon-512.png` |
| Feature graphic 1024×500 | `feature-graphic.png` |
| Phone screenshots | Device captures from `apps/mobile/maestro/store-shots.yaml` (`01-campus` … `06-review`). See `SHOTS.md`. Not committed as web PNGs. |

## Content rating / audience

- Complete IARC questionnaire → expect **Everyone** or **PEGI 3**
- Target audience: **13+** (accounts + online play)
- Store presence: not primarily Child-Directed

## Data safety (summary for Play Console form)

| Data type | Collected | Shared | Purpose |
|-----------|-----------|--------|---------|
| Email | Yes | No | Account |
| Name | Yes | No | Account / Student ID |
| App activity (gameplay, progress) | Yes | No | App functionality |
| App info / performance (vitals) | Yes | No | Analytics |

- Encrypted in transit: **Yes**
- Users can request deletion: **Yes** (Account → Delete account)
- Data deletion URL / in-app path: Account screen → Delete account

## Reviewer notes

Provide a throwaway test account email/password with a completed placement lesson if available.
Google Sign-In is supported when OAuth env is configured on the API.

## Copy review (F12)

Store listing sentences only. Jimbe owns the Play Console questionnaire. The Elementary semester titled Foundations is a different label and is not used here.

| Field | Before | After |
|-------|--------|-------|
| Full description | ChessSchool is a free online chess academy structured like a real school. Enroll, take a placement test, and graduate through Pre-School → University with FEN-verified lessons, homework, bots, and live multiplayer. Progress syncs across web and app. No credit card required. | ChessSchool is a free online chess academy structured like a real school. Enroll, take a placement test, and graduate from Starter to University with step-by-step lessons, homework, bots, and live multiplayer. Progress syncs across web and app. No credit card required. |
| Feature graphic file | `feature-graphic-1024x500.png` | `feature-graphic.png` |
| Phone screenshots | `screenshots/01-academy.png` … `06-profile.png` | Device captures from `apps/mobile/maestro/store-shots.yaml` (`01-campus` … `06-review`). Not committed as web PNGs. |

The Before cell keeps the previous sentence as history. Current listing copy says Starter, not Pre-School, and says step-by-step lessons. Short description is unchanged.

# Play phone screenshots

These six frames are captured from the real Android app (`com.chessschool.app`) by [`apps/mobile/maestro/store-shots.yaml`](../../../maestro/store-shots.yaml). They are not web screenshots, and this folder does not commit the PNGs.

The flow signs in as a made-up local student whose display name is **Alex**. Every shot below is that signed-in account. None of them is a guest frame. No email, password, student number, or child profile is on screen.

The app default coach is still Ash (`sarcastic`) until `lane-f/f3-default-coach` (PR #21) lands. That change has to land before the listing goes out. Lesson bubbles prefix the curriculum line with the active coach's opener. The lines below are what Ash shows today. The flow does not switch coaches.

Jimbe runs this flow from his branch `jimbe/e-native-store-shots`. That job is manual (`workflow_dispatch` only). This branch does not add a GitHub Actions workflow.

## Shot list

| # | File the flow writes | Route | Who |
|---|----------------------|-------|-----|
| 01 | `01-campus.png` | `chessschool:///academy` | Signed in as Alex |
| 02 | `02-class-journey.png` | `chessschool:///class/class-pre-board` | Signed in as Alex |
| 03 | `03-lesson.png` | `chessschool:///lesson/pawn-power` | Signed in as Alex |
| 04 | `04-bot-game.png` | `/play` → `/play/game` with elo 1600 and time `5` | Signed in as Alex |
| 05 | `05-tactic.png` | `chessschool:///lesson/fork-master` | Signed in as Alex |
| 06 | `06-review.png` | `chessschool:///review`, then the saved Vera game’s replay | Signed in as Alex |

### 01 Campus

- **State:** Signed-in academy, scrolled until the stage heading `stage-preschool` is on screen. The store-shot seed gives Alex streak **4** and **240** XP, so the greeting reads “Day 4 at the academy” and the subtitle is “Graduate through classes. Become a stronger player.” The guest enroll line is not this screen. Placement is already marked done, so the placement card is not in the way.
- **Must show:** The stage name **Starter** (stage id `preschool`). The Elementary semester titled Foundations is a different label and is not this heading.
- **Coach copy:** None. This screen has no lesson coach bubble.

### 02 Starter journey

- **State:** The Chess Board, the first class on the Starter stage (`class-pre-board`). Fresh Alex, class unlocked, no lessons completed. Header `class-title` reads “The Chess Board”.
- **Must show:** The class lesson path (64 Squares, Starting Position, Find d5, Reach e4). This is the journey inside Starter, not the Elementary semester named Foundations.
- **Coach copy:** None. This screen has no lesson coach bubble.

### 03 Lesson in progress

- **State:** Pawn Power, step `center` (index 0), kind `move`, still on the student to move. The flow does not play the move.
- **Must show:** The board, the lesson’s own e2–e4 arrow (curriculum data on that step, not an overlay drawn by the capture), and “White to move”. The hint bar uses the app fallback because this step has no `hint` and the tag `pawns` has no tip: “Take your time and calculate before you move.”
- **Coach copy:** Curriculum line “Pawns move forward. Push your e-pawn two squares to grab the centre!” With Ash, the bubble is “Bold of you to show up — Pawns move forward. Push your e-pawn two squares to grab the centre!”

### 04 Vera 1600 bot game

- **State:** vs Bot, opponent strength **1600** (the chooser name is Vera, blurb “Strong expert”), time control **5 min**, then Start match. The flow taps `sq-e2` then `sq-e4` and waits until “Thinking…” has cleared, so the frame is after White’s first move and Vera’s real reply. Vera’s move comes from the app (Stockfish when it is available at this rating, otherwise the JS bot). It is not a scripted book line.
- **Must show:** Header `vs Vera · 1600`, Vera’s bar and the “You” bar, both clocks (they start at 5:00 and count), and the board inset from the screen edges. The opponent row uses the app’s Vera bot mark. The account avatar is whatever Alex’s profile already uses. The flow taps the existing `sq-e2` and `sq-e4` ids. Those square views do not take the touch themselves; the board does.
- **Coach copy:** Before the first move the handshake, with Ash, is “Vs Vera (1600). Stay awake. Pawns die bored. Expert — small slips become lectures.” After Vera replies, the bubble is the live match comment for that reply. Do not replace it with a fixed sentence.

### 05 Fork tactic

- **State:** The Fork (`fork-master`). The flow passes the info step and the observe step (`watch`, which auto-plays d5–c7), then stops on the move step `fork`. It does not tap “Show a hint”, so the app does not add a hint arrow.
- **Must show:** The position before the fork is played: white knight on **d5**, black king on **e8**, black rook on **a8** (`r3k3/8/8/3N4/8/8/8/4K3`). All eight ranks. The hint under the board is the real fork tip. No arrows drawn by a script.
- **Coach copy:** Curriculum line “Your turn — find the royal fork!” With Ash, the bubble is “I'll keep this short — Your turn — find the royal fork!”
- **Hint:** “A knight fork hits two pieces at once — aim at the king and a big piece.”

### 06 Game review

- **State:** The flow resigns the Vera game from shot 04 (“Resigned — Vera wins”), opens the review list, and opens the row “vs Bot · 1600”. The shot is the replay screen, not the review index (that index shows Cody).
- **Must show:** The replay board for that game, the move label (`replay-move-label`), and the move chips for 1.e4 plus Vera’s real reply. The in-game Review button passes `gameId` while this screen reads `id`, so the flow uses the review list instead.
- **Coach copy:** None on a resigned replay. The move label is the line on screen.

## How Jimbe's job runs it

The emulator job is his, on `jimbe/e-native-store-shots` (`.github/workflows/play-store-screenshots.yml`). Trigger: **Actions → Play Store screenshots → Run workflow**. The default flow path is `apps/mobile/maestro/store-shots.yaml`. This branch does not contain that workflow.

His job builds a release APK on the runner, with no EAS and no Play signing key. The emulator reaches the API at `10.0.2.2` (his job uses port `3210`). It seeds the curriculum with `pnpm db:provision` (the loader script owns the seed file; the job does not read `seed.sql`). It then creates Alex with `pnpm --filter web db:seed:test-user`.

That script is the source of Alex's email and password. It does not print them. His job must pass the same pair into Maestro under the names below.

## Env vars

Do not commit them. Do not point the app at production (`https://www.chess-school.in`, `chess-school.vercel.app`, or a `main` / `staging` preview).

| Variable | Who sets it | What it is |
|----------|-------------|------------|
| `STORE_SHOT_EMAIL` | Jimbe's job, for the seed and for Maestro | Alex's email. If both this and `STORE_SHOT_PASSWORD` are unset, `db:seed:test-user` uses the made-up defaults in `apps/web/scripts/seed-test-user.mjs`. If the job sets them, the script uses those values instead. The Maestro login URL reads this name. |
| `STORE_SHOT_PASSWORD` | Jimbe's job, for the seed and for Maestro | Password for that same account. Not printed. The Maestro login URL reads this name. |
| `EXPO_PUBLIC_API_URL` | Jimbe's job, before the seed and at bundle time | `http://10.0.2.2:<port>`. `10.0.2.2` is the emulator's name for the host machine. The host guard must pass. |
| `EXPO_PUBLIC_PARITY` | Jimbe's job, at bundle time | `1`. Without it the login deep link does not auto-submit. A release build uses `EXPO_PUBLIC_API_URL` as given. |

The login step in `apps/mobile/maestro/store-shots.yaml` is:

`chessschool:///login?email=${STORE_SHOT_EMAIL}&password=${STORE_SHOT_PASSWORD}`

Maestro 2.6 does not expand `${...}` inside `openLink`. Before `maestro test`, substitute `STORE_SHOT_EMAIL` and `STORE_SHOT_PASSWORD` into that URL (same idea as the parity harness materializing `LOGIN_LINK`). Do not print the result.

`pnpm --filter web db:seed:test-user` calls `assertSafeCaptureHost` on `EXPO_PUBLIC_API_URL`, then still only accepts localhost, `127.0.0.1`, or `10.0.2.2`. It refuses `libsql:` and `http(s):` databases. Alex is a normal student, display name Alex, streak 4, 240 XP, onboarding already finished, no avatar upload, and not a child profile. There is no in-progress match, so shot 04 starts a new Vera game.

# ChessSchool v2 — Phase 2 (return loop + chess)

Builds on [PHASE1.md](PHASE1.md); the shell is unchanged, the rooms and path are now filled. Phase 3 (looks, Gym, Puzzles) is in [PHASE3.md](PHASE3.md).

| Package | New in Phase 2 |
|---------|----------------|
| `packages/chessschool-chess` (`@chessschool/chess`) | Board model, original piece art, chess.js helpers, Cody bot (Gentle / Steady), the handmade beginner path, Practice drills, lesson + game runners (pure reducers shared by web and native) |
| `packages/chessschool-design` | Sequential path, games + drills in progress, "you came back", reminder plan, hardened merge, board colours, Phase 2 copy, `undo` / `flag` / `bulb` icons, `reading` Cody animation |
| `apps/chessschool-api` | `/v1/home` reports the real next lesson and open rooms; uploads only count lessons in path order |

## Return loop

- **Streak:** a day counts when you finish a lesson, a Practice session or a game. It stays visible through the next day, then resets. XP only comes from first-time lessons, so no farming.
- **Daily goal:** lesson minutes, 3 minutes per Practice session, and real game minutes (capped at 30) fill the ring. Finishing a lesson shows "Day N of your streak!" and "Daily goal met!" when that changes.
- **You came back:** the first open of a new day after earlier practice shows a banner on Learn.
  - Streak still alive: "Your N-day streak is waiting." (with a spark).
  - Streak lapsed: a gentle fresh start.
  - It shows once a day and clears as soon as you do something.
- **Daily reminder:** Settings → Daily reminder, with a time of 8 am, 12 pm, 6 pm or 8 pm.
  - **Native:** schedules the next 7 days at that hour, re-planned whenever progress changes. Today is skipped once the goal is met or the hour has passed. Tapping a reminder opens Learn.
  - **Web:** the browser can't schedule notifications, so one is shown at the hour while ChessSchool is open in a tab or installed app, and only if the goal isn't met. Settings says so.
- **Merge hardening:**
  - Guest → account keeps every lesson (earliest date), the max XP, the newest streak, and games and drills.
  - The server drops lessons that skip the path order and caps XP to what those lessons award.
  - Progress saved before games and drills existed still loads.

## Chess

| Path node | Lesson | Steps |
|-----------|--------|-------|
| Meet the school | product tour (orientation) | 3 beats |
| The board | squares, files/ranks, start position | 9 — tap squares, find king/queen, quiz |
| How pieces move | rook, bishop, queen, knight, king | 11 — star-collecting drills per piece |
| Pawns & promotion | march, double step, capture, promote | 7 |
| Check & checkmate | spot check, give check, two mates in one | 7 |
| Your first game | a real game vs Gentle Cody | 3 — end any time after 12 moves |

- **Board:** original chunky piece set, tap-to-move with legal-move dots.
  - Highlights for selection, last move, teaching, hints and check, plus star targets.
  - Every square has a screen-reader label like "e4, white knight, can move here", and arrow keys move focus on web.
  - The last move slides in and a miss shakes gently; both are skipped with reduced motion.
  - Pawns always promote to a queen.
- **Feedback:** a right answer plays a chime and praise; a miss plays the soft "no", a shake and a hint. "Show me" highlights the answer.
- **Play room:** Cody plays Gentle (friendly mistakes, take-backs) or Steady (checks every capture reply, plays sensible openings).
  - You choose White, Black or random.
  - An unfinished game is saved and can be continued, resigning asks first, and results count toward the streak and goal.
- **Practice room:** five drills taken from finished lessons. Checkmate-in-one drills join after the check lesson.
- **Club** stays locked, with its reason and "Remind me".

## Routes

| Screen | Web | Native |
|--------|-----|--------|
| Lesson | `/lesson/[id]` (`meet` → `/orientation`, locked → explains which lesson comes first) | `lesson/[id]` (full-screen modal) |
| Play | `/play` (`/rooms/play` redirects) | `play` |
| Practice | `/practice` | `practice/index` |
| Practice session | `/practice/session` | `practice/session` (full-screen modal) |
| Club | `/rooms/club` | `rooms/[id]` (open rooms redirect) |

The service worker precaches the lesson, Play and Practice pages. Chess runs fully on the device, so lessons and games work offline.

## Verify

```bash
pnpm cs:check                                    # typecheck 5 packages + 101 unit tests
node apps/chessschool-web/e2e/phase2.mjs /tmp/p2 # web walkthrough (web :3100 + API :3300)
node apps/chessschool-web/e2e/phase1.mjs /tmp/p1 # Phase 1 regression
bash apps/chessschool/scripts/phase2-android.sh  # Android emulator (Expo Go)
```

Passed on 2026-11-04:

- **Unit tests:** design 69, chess 18 (every lesson is solved step by step, every puzzle has a solution and rejects a wrong move, and the bot always plays legal, sensible moves), API 14.
- **Web, mobile 390 light + dark:** the locked lesson explains itself.
  - The orientation, then all five chess lessons played through, a miss + hint, 125 XP, and the path complete.
  - Practice (5 drills), then Play: a move, Cody's reply, take back, leave and resume, resign.
  - Rooms shows "1 game · 0 wins". Sign up keeps 125 XP, and a wiped device logging back in gets everything back.
- **Web, desktop 1440:** lesson layout, keyboard play (arrows + Enter), and Steady Cody opening as White when you pick Black.
- **Web, reduced motion:** no running animations during a lesson.
- **Web, you came back:** a 3-day streak from yesterday shows the banner, a lesson makes it "Day 4 of your streak!", and the banner clears.
- **Web, Phase 1 regression:** passes. The production build compiles all 21 routes.
- **Android (Expo Go, dark theme):**
  - The Board, How pieces move, Pawns and Check lessons, finished by tapping squares through their accessibility labels.
  - Today then shows "Your first game" and 95 XP.
  - Rooms → Practice drill; Play → e4, Cody replies e5, take back, resign → "Game over."

## Not done / limits

- **iOS** isn't verified (no simulator on this machine).
- **Scheduled reminders** need a development or store build. Expo Go can't schedule them reliably, so the app skips scheduling there.
- **Web reminders** fire only while the app is open.
- Promotion always picks a queen, and there's no clock or online play. Club opens in a later phase.
- **Not done since Phase 1:** real Google sign-in, API hosting, and the new Turso database.
- **Store builds and submit:** only when asked.

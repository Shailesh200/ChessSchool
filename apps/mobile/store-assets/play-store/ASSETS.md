# Play listing assets

No avatars appear in these files. No coach portraits, mascots, or cartoon characters are in the frames.

The phone screenshots are the **web** app in a phone-sized browser window, not a native Android capture. This machine has no Android emulator. Web-only chrome is hidden for the capture (Next.js dev tools, the desktop sidebar, and the guest enroll banner). The signed-in streak and level bar, and the bottom tabs, stay because the phone app uses that same chrome.

Each screenshot is a local test account created on the dev database at capture time. The display name is Alex. The account is a normal student profile. No email address, real name, or child profile is in any frame.

Captions are drawn from `screenshots/caption-frame.html` (Fredoka, the same brand colours as `feature-graphic.html`) and composited on top. Final phone PNGs are 1080×1920 with no alpha.

## How to regenerate the phone screenshots

`capture.mjs` needs **system Chrome** (Playwright `channel: "chrome"`, not the bundled Chromium build).

```bash
pnpm --filter web dev
node apps/mobile/store-assets/play-store/capture.mjs screens
node apps/mobile/store-assets/play-store/capture.mjs screens 04,05,06
```

The optional id list recaptures only those frames. Omit it to recapture all six.

`BASE_URL` defaults to `http://localhost:3000`. Use `localhost`, not `127.0.0.1`. The script creates the local Alex user itself. `node apps/mobile/store-assets/play-store/capture.mjs graphic` re-renders `feature-graphic.html`; the PNG checked in here is the approved render, so leave that mode alone unless the HTML changes.

`node scripts/generate-play-store-assets.mjs` only runs the `screens` command above. It does not write `icon-512.png`, `feature-graphic-1024x500.png`, or the retired screenshot names.

| File | Dimensions | Bytes | What it shows |
|------|------------|------:|---------------|
| `feature-graphic.png` | 1024×500 | 78160 | ChessSchool wordmark, app icon, and a Staunton board (Italian Game). Source: `feature-graphic.html`. Approved; not regenerated here. |
| `feature-graphic.html` | — | — | Editable source for the feature graphic. Pieces are `apps/web/public/pieces/cburnett`. |
| `icon-512.png` | 512×512 | 29284 | Existing app icon (book and cap). Not a character. Not rewritten by the generator. |
| `screenshots/caption-frame.html` | — | — | Caption band source. Fredoka on `#5b5bd6` / `#4b46c4` / `#3b35a0`, gold rule `#f6c343`. |
| `screenshots/01-campus.png` | 1080×1920 | 327046 | Caption: “Learn chess step by step, like school”. Academy path with the stage name **Starter**. Signed-in level bar. Welcome mascot is scrolled off. |
| `screenshots/02-class-journey.png` | 1080×1920 | 263356 | Caption: “Short classes that build on each other”. The Chess Board class lesson path. No portrait on this screen. |
| `screenshots/03-lesson.png` | 1080×1920 | 283753 | Caption: “Learn by doing, one move at a time”. Pawn Power. Coach line “Okay. Stay with me — Pawns move forward. Push your e-pawn two squares to grab the centre!”, the board with the lesson’s e2–e4 arrow, and “White to move”. The generic “Take your time and calculate” tip is not in the frame. Portrait hidden. |
| `screenshots/04-bot-game.png` | 1080×1920 | 299309 | Caption: “Play bots that match your level”. Bot game vs **Vera · 1600** on a 5-minute clock. Header `vs Vera · 1600`. Opponent bar **Vera · 1600** at **4:22**, your bar **You** at **3:44**. Board inset from the edges. Position after 1.e4 e5 2.Nf3 Nc6 3.Bc4 Bc5 4.c3 Nf6 5.d3 d6 6.O-O O-O 7.Re1 a6 8.Nbd2 Ba7 9.h3 h6. Coach line “Vera plays slowly. Find the hidden weakness.” The coach portrait is hidden. The name row has no character art. |
| `screenshots/05-tactic.png` | 1080×1920 | 233879 | Caption: “Spot forks, pins and more”. The Fork, all 8 ranks visible below the progress header. The board is centred, with equal side margins. Knight on **c7**, black king on **e8**, rook on **a8**, with arrows from c7 to e8 and c7 to a8. Coach line: “Quick note — Watch the knight leap to c7 — checking the king and hitting the rook.” Hint under the board: “A knight fork hits two pieces at once — aim at the king and a big piece.” Continue is directly under that hint. Portrait hidden. |
| `screenshots/06-review.png` | 1080×1920 | 295170 | Caption: “Review every game, move by move”. Replay of that same game, stopped on **6. O-O**. This screen has no separate eval or coach card on a resigned game; the move line is the label. Move list: 1.e4 e5 2.Nf3 Nc6 3.Bc4 Bc5 4.c3 Nf6 5.d3 d6 6.O-O O-O 7.Re1 a6 8.Nbd2 Ba7 9.h3 h6. Board notation is hidden and the pieces are full size. The board is the same width as the bot-game frame, with the same side margins. The replay controls under the board sit inside those margins. No loading bar. The review index mascot is not this screen. |

Replaced because they showed coach or mascot art, or pointed at files that no longer exist: `screenshots/01-academy.png`, `screenshots/04-play.png`, `screenshots/05-review.png`, `screenshots/06-profile.png`, and `feature-graphic-1024x500.png`.

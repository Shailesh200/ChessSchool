# Play listing assets

Phone screenshots for Play are captures of the real Android app. The web/Playwright capture is retired: `capture.mjs`, the caption frame, and the six web PNGs are gone. This machine has no Android emulator, so the PNGs are not in this folder yet.

Run them with [`apps/mobile/maestro/store-shots.yaml`](../../../maestro/store-shots.yaml). The shot list, routes, coach copy, guest versus signed-in, and env vars are in [`SHOTS.md`](SHOTS.md). The flow signs in as a made-up local student named Alex. Luffy's `db:seed:test-user` (name may change) creates that account. Jimbe's job passes the email and password as `STORE_SHOT_EMAIL` and `STORE_SHOT_PASSWORD`. They are not printed, and the API base is the emulator host `10.0.2.2`, never production.

`assertSafeCaptureHost` still lives in `capture-host.mjs`, with `capture-host.test.mjs`. CI runs that test and `scripts/generate-play-store-assets.test.mjs`. Allowed hosts are localhost, 127.0.0.1, `10.0.2.2`, and a `chess-school-git-<branch>.vercel.app` preview whose branch is not `main` or `staging` and does not start with `main-` or `staging-`.

The app default coach is still Ash until `lane-f/f3-default-coach` (PR #21) lands, and that has to happen before this listing goes out. The Maestro flow does not force a coach. It does not script Vera’s moves, and it does not draw arrows on the fork lesson. Shot 05 uses the lesson’s own fork hint.

`node scripts/generate-play-store-assets.mjs` does not launch a capture and does not write phone screenshots. It does not write `icon-512.png`, `feature-graphic-1024x500.png`, or the retired screenshot names.

| File | Dimensions | Bytes | What it shows |
|------|------------|------:|---------------|
| `feature-graphic.png` | 1024×500 | 78160 | ChessSchool wordmark, app icon, and a Staunton board (Italian Game). Source: `feature-graphic.html`. Approved; not regenerated here. No coach portrait or mascot. |
| `feature-graphic.html` | — | — | Editable source for the feature graphic. Pieces are `apps/web/public/pieces/cburnett`. |
| `icon-512.png` | 512×512 | 29284 | Existing app icon (book and cap). Not a character. The generator checks that it is a 512×512 PNG. It does not rewrite the file. |
| `SHOTS.md` | — | — | Native shot list for the six Play frames. |
| `capture-host.mjs` | — | — | Host guard for registering the local Alex account. |
| `capture-host.test.mjs` | — | — | Node test for that guard. Wired into CI. |

Phone screenshots come from Jimbe's manual emulator job on `jimbe/e-native-store-shots`. This branch does not add a workflow. The env vars his job must set are in `SHOTS.md`.

Replaced earlier, and still not restored: `screenshots/01-academy.png`, `screenshots/04-play.png`, `screenshots/05-review.png`, `screenshots/06-profile.png`, and `feature-graphic-1024x500.png`.

# App Store listing draft (ChessSchool v2)

Draft only. Do not upload from this folder.

| Field | Value |
| --- | --- |
| Name | ChessSchool |
| Subtitle | Calm daily chess practice |
| Bundle ID | `com.chessschool.app` |
| SKU | `com.chessschool.app` |
| Apple ID (ascAppId) | 6828715695 |
| Primary category | Education |
| Secondary category | Games (optional) |
| Content rights | Does not contain third-party content that needs a license |
| Age rating | 4+ (no unrestricted web, no gambling, no user-generated public feed). Confirm in the questionnaire. The app is not in the Kids category. |
| Price | Free |
| Support URL | https://www.chess-school.in/ |
| Marketing URL | https://www.chess-school.in/ |
| Privacy policy URL | https://chess-school.in/privacy |
| Support email | support@chess-school.in |
| Copyright | ChessSchool |

Subtitle is 25 characters (limit 30).

## Promotional text (170)

A few calm minutes a day. Short lessons, a daily puzzle, and gentle games against bots. Start as a guest and save progress when you want.

## Keywords (100)

`lessons,puzzles,tactics,endgame,training,beginner,practice,openings,mate,coach`

78 characters. Do not repeat the app name. Commas do not need spaces.

## Description

ChessSchool is a calm place to get a little better at chess, a few minutes a day.

Learn with short lessons on a real board. Cody, the coach, stays with you from the first move through a beginner path you can finish at your own pace.

Practice:

- Daily puzzle, puzzle sprint, and themed puzzles
- Gym games against bots, with clocks, take-backs, and hints
- Pass and play for two people on one device
- Shuffle chess, set positions, and endgame practice
- Replay a game and look back at your moves

Start as a guest. Create an account when you want your name, streak, and lessons on every device. Sign in with email or Google. Daily reminders stay on this device. Lessons work offline and sync when you are signed in and back online.

No ads. The microphone and camera are used only when you choose "Say your move" (on-device speech) or the board scanner. Club play with friends online is not in this version yet.

## What's New (0.4.0)

Lessons, puzzles, and the Gym: bots, pass and play, clocks, and game review. Themes, piece sets, and app icons. Optional account so progress follows you to another device.

## Review notes

Sign in with email and password, or with Google, using the test account in App Review Information. A guest can use lessons without an account. Sign in with Apple is not in this build; see `SIGN_IN_WITH_APPLE.md` before submitting.

AI features: after a game the app can explain a move in plain words. Only the chess moves and board positions are sent to our server and then to an AI provider (Cloudflare Workers AI, with Groq and Anthropic as fallbacks). No names, emails, account ids or typed text are sent, and there is no free-form chat. Before the first explanation the app shows an AI consent screen. Adults can turn explanations off in Settings; on a child profile they stay off until a parent turns them on. The board scanner sends one photo of a chessboard only to read the position, and the photo is not kept. "Say your move" uses on-device speech recognition; audio never leaves the device.

Classes: in a class, tap a member to Report them (reason and optional note, seen only by our team) or Block them (they disappear from your classes and are not told). The class monitor can remove members.

Account deletion: Settings → Delete account. Full form answers for App Privacy and Data safety: `AI_DISCLOSURE.md`.

Export compliance: the app sets `usesNonExemptEncryption` to false (standard HTTPS only).

iPhone only (`supportsTablet` is false). Do not upload iPad screenshots.

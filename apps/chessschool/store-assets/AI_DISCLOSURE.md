# AI disclosure: store forms for Phase 2

Fill these in by hand at the end of Phase 2, after the Phase 2 build is the one you submit. Each section is a click-by-click list. `APP_STORE_PRIVACY.md` and `PLAY_DATA_SAFETY.md` are the Phase 1 drafts; where this file disagrees with them, this file is correct.

## What changed since the last submission

| Feature | What leaves the device | Where it goes | Kept? |
| --- | --- | --- | --- |
| AI game explanations (optional) | Chess moves and board positions (FEN) only. Never a name, email, account or profile id, or anything a child typed. | Our API, then Cloudflare Workers AI; Groq if that fails; Anthropic if both fail | The explanation text is cached per board position on our server, not linked to anyone |
| Lesson-writing tool | Nothing from the app. Staff use it from the admin website only. | Anthropic | Saved as a lesson draft, reviewed and published by a person |
| "Say your move" | Nothing. Speech recognition runs on the device. Only the recognised move is used, on the device. | Nowhere | No |
| Board scanner | One photo of a chessboard, sent only to read the position | Our API, then Anthropic | We don't store the photo. Only the position comes back. |
| Crash reports (added in Phase 1) | Error, stack trace, device and OS model, app version. `sendDefaultPii: false`, no session replay, no performance tracing. | Sentry | Sentry's retention |
| Anonymous usage events (added in Phase 1) | Event name, lesson id, step number, random install id, platform, app version. No account id. Off switch in Settings. | Our API | Deleted after 180 days |

Settings: adults see AI explanations by default and can turn them off; on a child profile they are off until a parent turns them on. The app shows an AI consent screen before the first explanation.

Privacy policy: the web page `/privacy` now has an "AI features" section (`#ai`), in English and Hindi. Deploy the web before you submit, so the policy reviewers open matches the build.

---

## 1. App Store Connect: App Privacy

App Store Connect → your app → **App Privacy** (left sidebar) → **Edit** next to Data Types.

Tracking stays **No** for everything below. Leave "Data Used to Track You" empty.

### 1a. Data types to tick (add these to the ones already ticked)

On the "Data Collection" screen, keep every box that is ticked now, and also tick:

1. **User Content → Photos or Videos** (board scanner photo).
2. **Diagnostics → Crash Data** (Sentry).
3. **Diagnostics → Other Diagnostic Data** (already ticked for update checks; keep it).
4. **Usage Data → Product Interaction** (anonymous usage events).

Already ticked, keep: **User Content → Gameplay Content**. The moves and positions sent for AI explanations are gameplay content, so this one row covers them. Do not add a new row for them.

Do **not** tick: **User Content → Audio Data**. "Say your move" audio never leaves the device, so it is not collected.

Click **Save**.

### 1b. Answers for each data type

App Store Connect asks three questions per type. Click **Set Up** next to each new type:

| Data type | Purpose (tick only these) | Linked to the user's identity? | Used for tracking? |
| --- | --- | --- | --- |
| Photos or Videos | App Functionality | **No** (the photo is sent without any account or profile id, and we don't keep it) | **No** |
| Crash Data | App Functionality | **No** (no account id or PII is attached) | **No** |
| Product Interaction | Analytics | **No** (random install id only, never the account) | **No** |
| Gameplay Content (existing row: re-open it and check) | App Functionality (already set) | **Yes** (already set; the synced progress is linked to the account. The AI copy is not, but Apple asks once per type, so keep Yes) | **No** |

Click **Publish** on the App Privacy page when all rows show "Set up".

Why Photos is declared even though we don't keep the photo: Apple counts data as collected when it is sent off the device and a third party (here the AI provider) may hold it longer than the single request. Declaring it is the safe answer.

### 1c. App Store privacy policy URL

App Information → **Privacy Policy URL**: `https://chess-school.in/privacy` (unchanged). The page now has the AI section.

---

## 2. Google Play Console: Data safety

Play Console → your app → **Policy and programs → App content → Data safety → Manage** (or **Start**). Click **Next** to go through the sections.

### 2a. Data collection and security (first page)

| Question | Answer |
| --- | --- |
| Does your app collect or share any of the required user data types? | **Yes** |
| Is all of the user data collected by your app encrypted in transit? | **Yes** |
| Which of the following methods of account creation does your app support? | Unchanged from Phase 1 (username and password, OAuth) |
| Do you provide a way for users to request that their data is deleted? | **Yes** (unchanged) |

### 2b. Data types (tick these, in addition to the ones already ticked)

On the "Data types" page, keep everything ticked now, and also tick:

1. **Photos and videos → Photos** (board scanner).
2. **App info and performance → Crash logs** (Sentry).
3. **App info and performance → Diagnostics** (Sentry device and OS details).

Already ticked, keep: **App activity → App interactions**. It covers the moves and positions sent for AI explanations and the anonymous usage events.

Do **not** tick: **Audio → Voice or sound recordings**. Speech recognition runs on the device.

### 2c. Answers for each data type

Click the arrow next to each ticked type. Play asks the same five questions for each:

**Photos and videos → Photos**

| Question | Answer |
| --- | --- |
| Is this data collected, shared, or both? | **Collected** only. (Sending it to the AI provider that reads the board for us is a service provider, which Play does not count as sharing.) |
| Is this data processed ephemerally? | **No** (we don't keep the photo, but the AI provider may hold API inputs for a short time under its own policy, so "No" is the safe answer) |
| Is this data required for your app, or can users choose whether it's collected? | **Users can choose** (only when they use the scanner) |
| Why is this user data collected? | **App functionality** |

**App info and performance → Crash logs**

| Question | Answer |
| --- | --- |
| Collected, shared, or both? | **Collected** (Sentry is a service provider) |
| Processed ephemerally? | **No** |
| Required or optional? | **Required** (there is no in-app switch for crash reports) |
| Why collected? | **Analytics** (to find and fix crashes) |

**App info and performance → Diagnostics**: same answers as Crash logs.

**App activity → App interactions** (existing row: open it and update)

| Question | Answer |
| --- | --- |
| Collected, shared, or both? | **Collected** (AI providers are service providers, not sharing) |
| Processed ephemerally? | **No** |
| Required or optional? | **Required** (progress is the product; AI explanations and usage events can each be switched off, but progress sync cannot) |
| Why collected? | **App functionality**, **Analytics** (tick both; Analytics is for the anonymous usage events) |

Click **Next**, review the preview, then **Save**. Play then shows the new label in the store after the next review.

---

## 3. App Review notes

There was no "the app uses no AI services" sentence in the repo to replace; the review notes paragraph in `APP_STORE_LISTING.md` has been replaced with the text below, and the listing line "The app does not use the microphone" was updated, since Phase 2 can use the microphone and camera.

### 3a. App Store Connect → App Review Information → Notes

Paste this (replace whatever is in the box now):

> Sign in with email and password, or with Google, using the test account in App Review Information. A guest can use lessons without an account.
>
> AI features: after a game the app can explain a move in plain words. Only the chess moves and board positions are sent to our server and then to an AI provider (Cloudflare Workers AI, with Groq and Anthropic as fallbacks). No names, emails, account ids or typed text are sent, and there is no free-form chat. Before the first explanation the app shows an AI consent screen. Adults can turn explanations off in Settings; on a child profile they stay off until a parent turns them on. The board scanner sends one photo of a chessboard only to read the position, and the photo is not kept. "Say your move" uses on-device speech recognition; audio never leaves the device.
>
> Classes: in a class, tap a member to Report them (reason and optional note, seen only by our team) or Block them (they disappear from your classes and are not told). The class monitor can remove members.
>
> Account deletion: Settings → Delete account. Export compliance: standard HTTPS only (`usesNonExemptEncryption` is false).

### 3b. Google Play Console → App content → App access

Play has no free-text review notes box. Under **App access → Manage → All or some functionality is restricted → Add instructions**, put the test account, and paste the same AI and Classes paragraphs above into "Any other information required to access your app".

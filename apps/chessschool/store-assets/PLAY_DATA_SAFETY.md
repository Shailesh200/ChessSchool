# Play Data safety draft

Answers from what ChessSchool v2 actually does (`apps/chessschool` and the `/v1` API it calls). This is a form draft, not a legal policy.

The app has no analytics SDK, no crash reporter, no ads, and no advertising ID. It does not use the microphone, camera, photos, contacts, or location. Sound is bundled playback only. Reminders are local notifications; the app does not register a push token.

Data is sent only to `https://api.chess-school.in` over HTTPS, and to Google when the learner chooses Google sign-in. Expo's update check contacts Expo (`u.expo.dev`) with the runtime version, platform, and channel. It is not tied to the ChessSchool account.

## Form-level answers

| Question | Answer |
| --- | --- |
| Does the app collect or share any of the required user data types? | Yes |
| Is all of the user data collected by your app encrypted in transit? | Yes |
| Do you provide a way for users to request that their data be deleted? | Yes. Settings → Delete account calls `DELETE /v1/me` and removes the server account, profile, progress, sessions, and class membership. Progress that exists only on the device stays until "Reset this device". |
| Account deletion web link | Play asks for a URL. The app deletes in Settings. There is no separate deletion page in this repo. Point the console at the privacy policy only if that page explains deletion; otherwise add a page first. |
| Ads | No |
| Data sold | No |
| Used for tracking (Play's "tracking" definition) | No |

## Data types

| Play data type | Collected | Shared | Ephemeral | Required | Purpose |
| --- | --- | --- | --- | --- | --- |
| Personal info → Name | Yes | No | No | Yes for an account; optional for a guest (stored on device) | App functionality, Account management |
| Personal info → Email address | Yes | No | No | Yes for an email or Google account | App functionality, Account management |
| Personal info → User IDs | Yes. Account id, and a random guest id created on device (`expo-crypto`) | No | No | Guest id is created for everyone; account id only after sign-in | App functionality, Account management |
| Personal info → Other info | Yes, optional. "Who is learning": just me, my child with me, or a class I teach. Not a date of birth. | No | No | Optional | App functionality |
| Personal info → Address, phone, race, political, religious, sexual | No | | | | |
| Financial info | No | | | | |
| Health and fitness | No | | | | |
| Location | No | | | | |
| Web browsing | No | | | | |
| Messages | No email or SMS. In-app feedback text is covered under user content below. | | | | |
| Photos and videos | No | | | | |
| Audio files | No. The app does not record. | | | | |
| Files and docs | No | | | | |
| Calendar | No | | | | |
| Contacts | No | | | | |
| App activity → App interactions | Yes. Lessons, puzzles, games, streak, XP, and practice, stored on device and uploaded for a signed-in account (`PUT /v1/progress`) | No | No | Progress is the product | App functionality |
| App activity → In-app search history | No | | | | |
| App activity → Installed apps | No | | | | |
| App activity → Other user-generated content | Yes. Feedback message and mood, class name, class member display names | Class member names are shown to other members of that class. Not sent to a data broker. | No | Optional (feedback and classes) | App functionality |
| App info → Crash logs | No | | | | |
| App info → Diagnostics | Only if the learner sends feedback: platform, OS version, theme, piece set, app version. Not collected automatically. | No | No | Optional | App functionality |
| App info → Other app performance data | No | | | | |
| Device or other IDs → Advertising ID | No | | | | |
| Device or other IDs → Device or other IDs | The guest id above is an app-generated UUID, not a hardware or advertising id. Declare it under User IDs, not here, unless the form forces a device-id row. | No | | | |

## Password

The password is sent to create or unlock an email account and stored on the server only as a hash. It is not logged and not sent to analytics. Play's checklist has no separate "password" row; cover it in the privacy policy and do not add a data type that the form does not list.

## IP address

The feedback endpoint rate-limits using the request IP. The IP is not written to the feedback table. Do not declare location. If the form asks about ephemeral processing, say the IP is used only to rate-limit and is not stored.

## Google sign-in

Choosing "Continue with Google" sends a Google ID token to ChessSchool's API. Google receives the sign-in as the identity provider. The app does not use Google for ads. Mark Google as a service provider for authentication, not as a data sale or share for advertising.

## Third parties

| Party | What they receive | Why |
| --- | --- | --- |
| ChessSchool API (`api.chess-school.in`) | Account, progress, feedback, classes | The app's own backend |
| Google | Sign-in, only if the learner chooses it | Authentication |
| Expo | Runtime version, platform, update channel, on an update check | Delivering an over-the-air update. Not linked to the account. |
| Apple / Google stores | Whatever the store already collects | Installing the app. Not sent by app code. |

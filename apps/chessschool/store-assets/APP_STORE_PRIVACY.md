# App Store privacy nutrition label draft

Answers from what ChessSchool v2 actually does. No analytics SDK, no crash reporter, no ads, no App Tracking Transparency prompt, no IDFA. The app does not use the microphone, camera, photos, contacts, or location.

Tracking: **No**. Leave "Data Used to Track You" empty.

## Data linked to the user

Collected when the learner creates an account or signs in. Purpose: **App Functionality**. Not used for third-party advertising. Not used for tracking.

| Category | Type | When |
| --- | --- | --- |
| Contact Info | Email Address | Email sign-up, or the email Google returns |
| Contact Info | Name | Sign-up, profile edit, or the name Google returns |
| Identifiers | User ID | Account id after sign-in |
| User Content | Gameplay Content | Lessons, puzzles, games, streak, and XP synced for a signed-in account |
| User Content | Customer Support | Feedback text and mood, only when they send feedback |
| User Content | Other User Content | Optional "who is learning" (just me, my child with me, or a class I teach), class name, and class member display names |

Class member names are visible to other members of that class. That is part of the feature, not tracking.

## Data not linked to the user

| Category | Type | Purpose | Notes |
| --- | --- | --- | --- |
| Identifiers | User ID | App Functionality | Random guest id stored on the device. It is sent with sign-up (to merge guest progress) and with feedback. After sign-in, treat the account as linked data above. A guest who never signs in and never sends feedback keeps this id on device only. |
| Other Data | Other Diagnostic Data | App Functionality | Expo update check: runtime version, platform, and channel sent to Expo. Not the ChessSchool account. Include this row so the label covers update checks. |
| Diagnostics | Other Diagnostic Data | App Functionality | Only inside a feedback message: OS version, app version, theme, piece set. Not collected in the background. |

Do **not** check: Health, Financial, Location, Sensitive Info, Contacts, Browsing History, Search History, Purchases, Photos or Videos, Audio Data, Crash Data, Performance Data, Product Interaction (there is no analytics SDK; saved lessons are Gameplay Content), Advertising Data, Device ID (no IDFA, no hardware id).

## Not collected

- Precise or coarse location
- Microphone or recorded audio
- Photos, camera, contacts
- Payment info
- Crash logs or performance traces
- Advertising identifier
- Push notification token (reminders are scheduled locally)

## Deletion

Settings → Delete account removes the server account and synced data. "Reset this device" clears the on-device copy. Say both in App Review notes if asked.

## Encryption

`ios.config.usesNonExemptEncryption` is false. Answer the export question as exempt (HTTPS only).

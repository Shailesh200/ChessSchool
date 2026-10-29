# QA simulator flows

Nami adds the Maestro flows in this directory, ported from her harness. The manual Android-only workflow `apps/mobile/.eas/workflows/qa-sim-mobile.yml` runs every `*.yaml` and `*.yml` file here, once per promotion candidate.

- App id: `com.chessschool.app` (see `parity/maestro/config.yaml`).
- The binary is an EAS `qa-sim` build. It is a release simulator/emulator build, with no Metro dev server.
- iOS Simulator calls the API at `http://localhost:3108`.
- Android Emulator calls the API at `http://10.0.2.2:3108`.
- That API is `next start -p 3108` on the Maestro runner. The database is local SQLite (`DATABASE_URL=file:local.db`), provisioned with `pnpm db:provision`.

Use `takeScreenshot` for images that should be kept, but never in a flow that types a password (a unit marked `secret yes` in `manifest.tsv`, or a `_common` file such as `sign-in-form.yaml` that such a unit runs). `scripts/qa-sim-flow-guard.py` fails the run if a flow with a password input has `takeScreenshot` or `startRecording`, and the runner deletes every image and video under a secret unit's debug dir. See PORTING-NOTES.md, section "v5". The workflow uploads this directory's Maestro debug output and screenshots as `qa-sim-ios-maestro` or `qa-sim-android-maestro`. The run also keeps EAS's Maestro Test Results artifact.

Maestro ignores this README. With no flow files yet, the Maestro job fails until the flows land.

# QA simulator flows

Nami adds the Maestro flows in this directory, ported from her harness. The manual workflow `apps/mobile/.eas/workflows/qa-sim.yml` runs every `*.yaml` and `*.yml` file here, once per promotion candidate.

- App id: `com.chessschool.app` (see `parity/maestro/config.yaml`).
- The binary is an EAS `qa-sim` build. It is a release simulator/emulator build, with no Metro dev server.
- iOS Simulator calls the API at `http://localhost:3108`.
- Android Emulator calls the API at `http://10.0.2.2:3108`.
- That API is `next start -p 3108` on the Maestro runner. The database is local SQLite (`DATABASE_URL=file:local.db`), provisioned with `pnpm db:provision`.

Use `takeScreenshot` for images that should be kept. The workflow uploads this directory's Maestro debug output and screenshots as `qa-sim-ios-maestro` or `qa-sim-android-maestro`. The run also keeps EAS's Maestro Test Results artifact.

Maestro ignores this README. With no flow files yet, the Maestro job fails until the flows land.

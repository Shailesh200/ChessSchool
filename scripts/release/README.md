# Release QA gates (GT-001, GT-002, GT-004)

Repo-native scripts for the QA release pipeline. They run on a fresh clone with **bash**, **node**, and **pnpm** only (no Python). The dependency audit step may use the network for `pnpm audit`.

| Gate   | Script | Notes |
|--------|--------|--------|
| GT-001 | `scripts/release/run-all.sh` | Runs all gates; writes `release-out/<SHA>/summary.json` |
| GT-002 | `scripts/release/deps-gate.sh` | Critical/high advisories vs `scripts/release/audit-waivers.json` |
| GT-004 | `scripts/release/approved-check.sh` + `release/approved-patch-ids.txt` | Patch-id list, no merges in `B..S`, identity grep |

## Usage

```bash
# Full gate suite (approved-check SKIPPED unless BASE and STAGING are set)
bash scripts/release/run-all.sh "$(git rev-parse HEAD)"

# Individual gates
bash scripts/release/deps-gate.sh [--out DIR]
bash scripts/release/secrets-scan.sh [--out DIR]
bash scripts/release/approved-check.sh --base B --staging S [--approved release/approved-patch-ids.txt]
```

pnpm shortcuts (repo root):

- `pnpm release:gates` — `run-all.sh` at `HEAD`
- `pnpm release:deps` — dependency audit gate
- `pnpm release:secrets` — secrets scan

## Approved patch list (GT-004)

`release/approved-patch-ids.txt` uses rows:

```text
label patch-id approver
```

`approver` is `imu` or `arc`. **Arc** adds rows when promoting staging. The file ships with the format header only; QA fails until rows cover every non-merge commit in `BASE..STAGING`.

Waivers for audit findings live in `scripts/release/audit-waivers.json` and require **Shailesh** sign-off before changes.

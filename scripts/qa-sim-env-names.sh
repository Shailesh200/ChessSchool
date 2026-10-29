#!/usr/bin/env bash
# DRAFT. Prints the sorted NAMES (never values) of every environment variable in this job, then STOPS (exit 1, with the reason)
# if any name is on the stop list. Used by the guard job and by qa-sim-e2e-android.sh (which must not just unset these and go on).
#   stop list: TURSO_*   VERCEL*   DATABASE_AUTH_TOKEN   any name containing PROD (case-sensitive, as env names are upper-case)
#              EXPO_PUBLIC_QA_SIM
# How EXPO_PUBLIC_QA_SIM from the EAS `development` environment is told apart from the eas.json qa-sim profile:
#   the profile's `env` is applied ONLY inside the build job (`type: build`, profile qa-sim). This guard and the e2e job are plain custom
#   jobs: their environment is the workflow's job `env:` plus the EAS environment named by `environment:` (development) and nothing from
#   eas.json. So EXPO_PUBLIC_QA_SIM present HERE can only come from the EAS development environment (or a job `env:` line, which the
#   workflow does not have; the guard greps for that too). The same EAS environment variables are also injected into the build job, so the
#   guard seeing the name here proves the build would see it as well. It must be absent: the profile alone is allowed to set it.
# Output goes to stdout and to $QA_ENV_NAMES_OUT (default: none). Mode label only changes the heading.
set -uo pipefail
mode="${1:-guard}"
names="$(compgen -e | LC_ALL=C sort -u)"       # compgen -e lists names only; values never touch this script's output
echo "[qa-sim] $mode job environment variable NAMES ($(printf '%s\n' "$names" | grep -c .)), sorted, values never printed:"
printf '%s\n' "$names" | sed 's/^/  /'
[ -n "${QA_ENV_NAMES_OUT:-}" ] && printf '%s\n' "$names" >"$QA_ENV_NAMES_OUT"
stop="$(printf '%s\n' "$names" | grep -E '^(TURSO_|VERCEL|DATABASE_AUTH_TOKEN|EXPO_PUBLIC_QA_SIM$)|PROD' || true)"
if [ -n "$stop" ]; then
  echo "qa-sim env-names REFUSED: these variable names must not exist in this job (names only):" >&2
  printf '%s\n' "$stop" | sed 's/^/  - /' >&2
  if printf '%s\n' "$stop" | grep -qx 'EXPO_PUBLIC_QA_SIM'; then
    echo "  EXPO_PUBLIC_QA_SIM here comes from the EAS development environment or a job env line, not the eas.json qa-sim profile (which only applies inside the build job). Remove it there; the qa-sim profile alone may set it." >&2
  fi
  echo "  Reason: a name like this could point the run at a real database, deployment or production build. Unsetting it quietly is not accepted: fix the environment and dispatch again." >&2
  exit 1
fi
echo "[qa-sim] env names: none of TURSO_*, VERCEL*, DATABASE_AUTH_TOKEN, *PROD*, EXPO_PUBLIC_QA_SIM present"
exit 0

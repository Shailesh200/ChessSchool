#!/usr/bin/env bash
# Install, provision a local file: database, then serve the web app on port 3108.
# The guard runs before install and again before the database is opened.
set -euo pipefail

root="$(git rev-parse --show-toplevel)"
cd "${root}"

bash "${root}/scripts/qa-sim-guard.sh"

export CI="${CI:-true}"
pnpm install --frozen-lockfile

bash "${root}/scripts/qa-sim-guard.sh"
if [ "${DATABASE_URL}" != "file:local.db" ]; then
  echo "Refusing to run: QA sim uses DATABASE_URL=file:local.db for apps/web." >&2
  exit 1
fi
unset DATABASE_AUTH_TOKEN

cd "${root}/apps/web"
pnpm db:provision
pnpm exec next build

log_dir="${root}/qa-sim-artifacts"
mkdir -p "${log_dir}"
log="${log_dir}/next.log"
# QA_SIM=1 turns on POST /api/qa/expire-session (apps/web/lib/qa-sim.ts); only here.
QA_SIM=1 setsid pnpm exec next start -p 3108 >"${log}" 2>&1 </dev/null &
pid="$!"
echo "${pid}" >"${log_dir}/next.pid"

ready() {
  node --input-type=module -e 'fetch("http://127.0.0.1:3108/",{redirect:"manual",signal:AbortSignal.timeout(2000)}).then(()=>process.exit(0)).catch(()=>process.exit(1))'
}

for _ in $(seq 1 90); do
  if ! kill -0 "${pid}" 2>/dev/null; then
    echo "next start exited before listening on port 3108." >&2
    tail -n 40 "${log}" >&2 || true
    exit 1
  fi
  if ready; then
    echo "Web app is listening on port 3108."
    exit 0
  fi
  sleep 2
done

echo "next start did not listen on port 3108." >&2
tail -n 40 "${log}" >&2 || true
exit 1

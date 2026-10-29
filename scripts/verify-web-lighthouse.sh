#!/usr/bin/env bash
# Lighthouse audit against production Next.js build — all routes in web-lighthouse-routes.json.
set -euo pipefail

# Readiness identifies our server by walking /proc for the setsid process group.
# Check these before dirname or the build, or a missing tool turns into a
# 30-second "stale server" timeout.
if ! command -v setsid >/dev/null 2>&1; then
  echo "✗ setsid is not on PATH. This script starts the preview server with setsid so it can stop only that process group. Install setsid (util-linux) and retry." >&2
  exit 1
fi
if [[ ! -d /proc ]] || [[ ! -r /proc/net/tcp && ! -r /proc/net/tcp6 ]]; then
  echo "✗ /proc is not available, so this script cannot check that the process listening on the preview port is the server it started. Refusing to run instead of timing out against another server." >&2
  exit 1
fi

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WEB="$ROOT/apps/web"
PORT="${WEB_PREVIEW_PORT:-4173}"
URL="http://127.0.0.1:${PORT}/"

LH_BIN="$ROOT/node_modules/.bin/lighthouse"
if [ ! -x "$LH_BIN" ]; then
  echo "✗ lighthouse not installed — run: pnpm add -D lighthouse chrome-launcher (from repo root)" >&2
  exit 1
fi

log() { echo "$@" >&2; }

PID_FILE="$WEB/.next/lighthouse-server.pid"

# Kill only the server this script started. Never kill by port.
cleanup() {
  local pid=""
  if [[ -f "$PID_FILE" ]]; then
    pid="$(cat "$PID_FILE" 2>/dev/null || true)"
    rm -f "$PID_FILE"
  fi
  if [[ -n "${pid}" ]] && kill -0 "${pid}" 2>/dev/null; then
    # Process group, when we started one with setsid; otherwise just that pid.
    kill -- "-${pid}" 2>/dev/null || kill "${pid}" 2>/dev/null || true
    wait "${pid}" 2>/dev/null || true
  fi
}
trap cleanup EXIT

# Fail if 4173 is taken on IPv4 or IPv6. Do not kill the occupant.
assert_port_free() {
  PORT="${PORT}" node --input-type=module <<'JS'
import net from "node:net";

const port = Number(process.env.PORT);
const targets = [
  { host: "127.0.0.1", ipv6Only: false },
  { host: "0.0.0.0", ipv6Only: false },
  { host: "::1", ipv6Only: true },
  { host: "::", ipv6Only: true },
];

const busy = [];
for (const target of targets) {
  const code = await new Promise((resolve) => {
    const server = net.createServer();
    server.once("error", (err) => resolve(err.code || String(err)));
    const opts = { port, host: target.host };
    if (target.ipv6Only) opts.ipv6Only = true;
    server.listen(opts, () => {
      server.close(() => resolve(""));
    });
  });
  if (code) busy.push(`${target.host} (${code})`);
}

if (busy.length > 0) {
  console.error(
    `Refusing to start: port ${port} is already in use on ${busy.join(", ")}. This script does not kill a process it did not start.`,
  );
  process.exit(1);
}
JS
}

if [ "${WEB_LH_FORCE_BUILD:-0}" = "1" ] || [ ! -d "$WEB/.next" ]; then
  log "→ Building apps/web"
  (cd "$ROOT" && pnpm --filter web build)
else
  log "→ Using existing apps/web build (set WEB_LH_FORCE_BUILD=1 to rebuild)"
fi

log "→ Ensuring local DB for next start"
(cd "$ROOT" && pnpm --filter web exec node scripts/ensure-db.mjs)

assert_port_free

BUILD_ID="$(tr -d '[:space:]' < "$WEB/.next/BUILD_ID")"
log "→ Starting production server on ${URL} (build ${BUILD_ID})"
mkdir -p "$WEB/.next"
rm -f "$PID_FILE"
# setsid makes this process the group leader. It records its own pid, then execs
# pnpm so that pid stays the leader of next-server. Cleanup kills only that group.
setsid bash -c 'echo $$ > "$1"; exec env PORT="$2" pnpm --dir "$3" start:app' \
  bash "$PID_FILE" "$PORT" "$WEB" >"$WEB/.next/lighthouse-server.log" 2>&1 &
PREVIEW_PID=""
for _ in $(seq 1 50); do
  if [[ -s "$PID_FILE" ]]; then
    PREVIEW_PID="$(cat "$PID_FILE")"
    break
  fi
  sleep 0.1
done
if [[ -z "${PREVIEW_PID}" ]]; then
  log "✗ Preview server did not record its pid."
  exit 1
fi

ready=0
for i in $(seq 1 60); do
  if ! kill -0 "${PREVIEW_PID}" 2>/dev/null; then
    log "✗ Preview server exited before it was ready. See ${WEB}/.next/lighthouse-server.log"
    exit 1
  fi
  if PORT="${PORT}" PREVIEW_PID="${PREVIEW_PID}" BUILD_ID="${BUILD_ID}" URL="${URL}" node --input-type=module <<'JS'
import fs from "node:fs";

const port = Number(process.env.PORT);
const ancestor = String(process.env.PREVIEW_PID);
const buildId = process.env.BUILD_ID;
const url = process.env.URL;

function listeningInodes(wantPort) {
  const inodes = new Set();
  for (const file of ["/proc/net/tcp", "/proc/net/tcp6"]) {
    let text = "";
    try {
      text = fs.readFileSync(file, "utf8");
    } catch {
      continue;
    }
    for (const line of text.trim().split("\n").slice(1)) {
      const parts = line.trim().split(/\s+/);
      const portHex = parts[1]?.split(":")[1];
      if (parts[3] === "0A" && Number.parseInt(portHex, 16) === wantPort) {
        inodes.add(parts[9]);
      }
    }
  }
  return inodes;
}

function pidsForInodes(inodes) {
  const found = [];
  for (const pid of fs.readdirSync("/proc")) {
    if (!/^\d+$/.test(pid)) continue;
    let fds = [];
    try {
      fds = fs.readdirSync(`/proc/${pid}/fd`);
    } catch {
      continue;
    }
    for (const fd of fds) {
      try {
        const target = fs.readlinkSync(`/proc/${pid}/fd/${fd}`);
        const match = /^socket:\[(\d+)\]$/.exec(target);
        if (match && inodes.has(match[1])) found.push(pid);
      } catch {
        // fd vanished
      }
    }
  }
  return [...new Set(found)];
}

function isOurs(pid) {
  let cur = String(pid);
  for (let i = 0; i < 30; i += 1) {
    if (cur === ancestor) return true;
    let stat = "";
    try {
      stat = fs.readFileSync(`/proc/${cur}/stat`, "utf8");
    } catch {
      return false;
    }
    const match = /\)\s+\S+\s+(\d+)/.exec(stat);
    if (!match) return false;
    cur = match[1];
    if (cur === "0" || cur === "1") return false;
  }
  return false;
}

const listeners = pidsForInodes(listeningInodes(port));
if (listeners.length === 0 || !listeners.every((pid) => isOurs(pid))) {
  process.exit(1);
}

const body = await fetch(url).then((res) => (res.ok ? res.text() : ""));
if (!buildId || !body.includes(buildId)) process.exit(1);
JS
  then
    ready=1
    log "→ Server ready (${i} attempts, pid ${PREVIEW_PID}, build ${BUILD_ID})"
    break
  fi
  sleep 0.5
done

if [[ "${ready}" -ne 1 ]]; then
  log "✗ Server on port ${PORT} is not the preview this script started (build ${BUILD_ID}). Refusing to audit a stale server."
  exit 1
fi

export WEB_PREVIEW_PORT="$PORT"
node "$ROOT/scripts/lighthouse-audit-routes.mjs"

REPORT_HTML="$ROOT/reports/lighthouse/index.html"
if [ -f "$REPORT_HTML" ]; then
  log "→ Beautiful report: $REPORT_HTML"
fi

log "✓ Web Lighthouse passed (all routes)"

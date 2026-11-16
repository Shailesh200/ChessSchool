#!/usr/bin/env bash
# Creates the code-signing key for our over-the-air updates. Run once, by hand, from the repo root:
#
#   bash scripts/ota-signing-key.sh
#
# It writes:
#   - OTA_SIGNING_KEY (the private key, one line, "\n" for line breaks) and OTA_ADMIN_TOKEN (a random
#     token for the rollout controls) into the secrets file OUTSIDE the repo (default
#     ~/ChessSchool-handoff/secrets.env, or $SECRETS_FILE). Set both on the API host afterwards.
#   - apps/chessschool/certs/ota-signing.crt, the public certificate the app checks updates against.
#     This file is public and must be committed.
#   - updates.codeSigningCertificate / codeSigningMetadata in apps/chessschool/app.json.
#
# The private key is never printed and never written inside the repo. Builds made before the certificate
# was added do not ask for signatures and keep working; builds made after refuse unsigned updates.
set -euo pipefail

SECRETS_FILE="${SECRETS_FILE:-$HOME/ChessSchool-handoff/secrets.env}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
APP="${APP_DIR:-$ROOT/apps/chessschool}"
CERT="$APP/certs/ota-signing.crt"

[ -f "$SECRETS_FILE" ] || { echo "No secrets file at $SECRETS_FILE" >&2; exit 1; }
case "$(cd "$(dirname "$SECRETS_FILE")" && pwd)/" in "$ROOT"/*) echo "The secrets file must live outside the repo" >&2; exit 1 ;; esac
if grep -q '^OTA_SIGNING_KEY=' "$SECRETS_FILE"; then
  echo "OTA_SIGNING_KEY is already in $SECRETS_FILE. Remove it first if you really want a new key (apps built with the old certificate will refuse updates signed with a new one)." >&2
  exit 1
fi

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
umask 077

openssl genrsa -out "$TMP/key.pem" 2048 2>/dev/null
cat > "$TMP/cert.cnf" <<'CNF'
[req]
distinguished_name = dn
x509_extensions = ext
prompt = no
[dn]
CN = ChessSchool OTA updates
[ext]
keyUsage = critical, digitalSignature
extendedKeyUsage = critical, codeSigning
CNF
openssl req -new -x509 -key "$TMP/key.pem" -sha256 -days 3650 -config "$TMP/cert.cnf" -out "$TMP/cert.pem"

mkdir -p "$(dirname "$CERT")"
(umask 022 && cp "$TMP/cert.pem" "$CERT")

{
  echo ""
  echo "# Over-the-air update signing key and admin token (scripts/ota-signing-key.sh, $(date +%Y-%m-%d))"
  printf 'OTA_SIGNING_KEY=%s\n' "$(awk 'BEGIN{ORS="\\n"} {print}' "$TMP/key.pem")"
  grep -q '^OTA_ADMIN_TOKEN=' "$SECRETS_FILE" || printf 'OTA_ADMIN_TOKEN=%s\n' "$(openssl rand -hex 32)"
} >> "$SECRETS_FILE"

node -e '
const fs = require("fs");
const file = process.argv[1] + "/app.json";
const j = JSON.parse(fs.readFileSync(file, "utf8"));
j.expo.updates = { ...j.expo.updates, codeSigningCertificate: "./certs/ota-signing.crt", codeSigningMetadata: { keyid: "main", alg: "rsa-v1_5-sha256" } };
fs.writeFileSync(file, JSON.stringify(j, null, 2) + "\n");
' "$APP"

echo "Wrote OTA_SIGNING_KEY and OTA_ADMIN_TOKEN to $SECRETS_FILE"
echo "Wrote $CERT and updated $APP/app.json: commit both."
echo "Next: set OTA_SIGNING_KEY and OTA_ADMIN_TOKEN on the API host, and OTA_ADMIN_TOKEN as a GitHub secret for the rollout guard."

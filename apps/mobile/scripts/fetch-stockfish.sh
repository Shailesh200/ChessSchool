#!/usr/bin/env bash
# Download pinned Stockfish sources and the matching NNUE nets into
# modules/stockfish/ios/engine/ for the iOS native build.
#
# EAS Build runs this via the eas-build-pre-install hook. It no-ops for
# non-iOS EAS builds (EAS_BUILD_PLATFORM is set and is not "ios"). A local
# run leaves that variable unset and still fetches, so `expo run:ios` /
# prebuild can be pointed at the same tree.
#
# The engine directory is gitignored. Nothing in this script commits sources
# or nets. Checksums are pinned; a mismatch or a failed download exits 1
# before the engine directory is replaced.

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENGINE="${ROOT}/modules/stockfish/ios/engine"

# Stockfish 18 — same major release the web app ships (stockfish-18 WASM).
# Tag: https://github.com/official-stockfish/Stockfish/releases/tag/sf_18
TAG="sf_18"
TARBALL_URL="https://github.com/official-stockfish/Stockfish/archive/refs/tags/${TAG}.tar.gz"
TARBALL_SHA256="22a195567e3493e7c9ca8bf8fa2339f4ffc876384849ac8a417ff4b919607e7b"

# Names come from src/evaluate.h (EvalFileDefaultNameBig / Small) at sf_18.
# Upstream's own check is "filename == nn-<first 12 hex chars of sha256>.nnue";
# the full digest is pinned here so a truncated or swapped file fails the build.
NNUE_BIG="nn-c288c895ea92.nnue"
NNUE_BIG_SHA256="c288c895ea924429ea9092e3f36b2b3c1f00f2a3a4c759ff7e57e79e3b43e4a7"
NNUE_SMALL="nn-37f18f62d772.nnue"
NNUE_SMALL_SHA256="37f18f62d772f3107e1d6aaca3898c130c3c86f2ab63e6555fbbca20635a899d"

STAMP_BODY="$(printf '%s\n' \
  "tag=${TAG}" \
  "tarball=${TARBALL_SHA256}" \
  "${NNUE_BIG}=${NNUE_BIG_SHA256}" \
  "${NNUE_SMALL}=${NNUE_SMALL_SHA256}")"

if [[ -n "${EAS_BUILD_PLATFORM:-}" && "${EAS_BUILD_PLATFORM}" != "ios" ]]; then
  echo "fetch-stockfish: skipping (EAS_BUILD_PLATFORM=${EAS_BUILD_PLATFORM}; iOS only)"
  exit 0
fi

die() {
  echo "fetch-stockfish: ERROR: $*" >&2
  exit 1
}

file_sha256() {
  local f="$1"
  if command -v sha256sum >/dev/null 2>&1; then
    sha256sum "$f" | awk '{print $1}'
  elif command -v shasum >/dev/null 2>&1; then
    shasum -a 256 "$f" | awk '{print $1}'
  else
    die "sha256sum or shasum is required to verify Stockfish downloads"
  fi
}

# Filename prefix must be the leading 12 hex chars of the pinned digest.
# Fail here (no network) if those constants ever drift apart.
case "${NNUE_BIG_SHA256}" in
  c288c895ea92*) ;;
  *) die "internal pin error: ${NNUE_BIG} does not match its SHA-256" ;;
esac
case "${NNUE_SMALL_SHA256}" in
  37f18f62d772*) ;;
  *) die "internal pin error: ${NNUE_SMALL} does not match its SHA-256" ;;
esac

already_installed() {
  local stamp="${ENGINE}/.stockfish-fetch-stamp"
  [[ -f "${stamp}" ]] || return 1
  [[ "$(cat "${stamp}")" == "${STAMP_BODY}" ]] || return 1
  [[ -f "${ENGINE}/main.cpp" ]] || return 1
  [[ -f "${ENGINE}/evaluate.h" ]] || return 1
  [[ -f "${ENGINE}/nnue/network.cpp" ]] || return 1
  [[ -f "${ENGINE}/incbin/incbin.h" ]] || return 1
  [[ -f "${ENGINE}/Copying.txt" ]] || return 1
  [[ -f "${ENGINE}/AUTHORS" ]] || return 1
  [[ -f "${ENGINE}/${NNUE_BIG}" && -f "${ENGINE}/${NNUE_SMALL}" ]] || return 1
  [[ "$(file_sha256 "${ENGINE}/${NNUE_BIG}")" == "${NNUE_BIG_SHA256}" ]] || return 1
  [[ "$(file_sha256 "${ENGINE}/${NNUE_SMALL}")" == "${NNUE_SMALL_SHA256}" ]] || return 1
  grep -q "${NNUE_BIG}" "${ENGINE}/evaluate.h" || return 1
  grep -q "${NNUE_SMALL}" "${ENGINE}/evaluate.h" || return 1
  return 0
}

if already_installed; then
  echo "fetch-stockfish: Stockfish ${TAG} already present in ${ENGINE} (checksums ok)"
  exit 0
fi

echo "fetch-stockfish: fetching Stockfish ${TAG} into ${ENGINE}"

STAGE="$(mktemp -d)"
cleanup() { rm -rf "${STAGE}"; }
trap cleanup EXIT

download_file() {
  local url="$1" dest="$2"
  echo "fetch-stockfish: GET ${url}"
  if ! curl -fsSL --retry 3 --retry-delay 2 -o "${dest}" "${url}"; then
    rm -f "${dest}"
    return 1
  fi
}

echo "fetch-stockfish: downloading Stockfish ${TAG} sources"
if ! download_file "${TARBALL_URL}" "${STAGE}/src.tar.gz"; then
  die "download failed: ${TARBALL_URL}"
fi
actual="$(file_sha256 "${STAGE}/src.tar.gz")"
if [[ "${actual}" != "${TARBALL_SHA256}" ]]; then
  echo "fetch-stockfish: ERROR: SHA-256 mismatch for Stockfish ${TAG} source tarball" >&2
  echo "  url:      ${TARBALL_URL}" >&2
  echo "  expected: ${TARBALL_SHA256}" >&2
  echo "  actual:   ${actual}" >&2
  die "refusing to build with untrusted engine sources"
fi
echo "fetch-stockfish: checksum ok ${TAG} source tarball"

tar -xzf "${STAGE}/src.tar.gz" -C "${STAGE}"
src_root="${STAGE}/Stockfish-${TAG}"
[[ -f "${src_root}/src/main.cpp" ]] || die "tarball missing src/main.cpp (layout changed?)"
[[ -f "${src_root}/src/evaluate.h" ]] || die "tarball missing src/evaluate.h"
[[ -f "${src_root}/Copying.txt" ]] || die "tarball missing Copying.txt"
[[ -f "${src_root}/AUTHORS" ]] || die "tarball missing AUTHORS"
grep -q "${NNUE_BIG}" "${src_root}/src/evaluate.h" || die "evaluate.h does not name ${NNUE_BIG}; the pin is stale"
grep -q "${NNUE_SMALL}" "${src_root}/src/evaluate.h" || die "evaluate.h does not name ${NNUE_SMALL}; the pin is stale"

mkdir -p "${STAGE}/engine"
# Preserve src/ layout (nnue/, incbin/, syzygy/) so relative includes resolve.
cp -R "${src_root}/src/." "${STAGE}/engine/"
# Stockfish's own licence and credits, beside the fetched sources.
cp "${src_root}/Copying.txt" "${STAGE}/engine/Copying.txt"
cp "${src_root}/AUTHORS" "${STAGE}/engine/AUTHORS"

download_nnue() {
  local name="$1" expected="$2"
  local dest="${STAGE}/engine/${name}"
  local url actual
  for url in \
    "https://tests.stockfishchess.org/api/nn/${name}" \
    "https://github.com/official-stockfish/networks/raw/master/${name}"
  do
    if ! download_file "${url}" "${dest}"; then
      echo "fetch-stockfish: download failed, trying next mirror: ${url}" >&2
      continue
    fi
    actual="$(file_sha256 "${dest}")"
    if [[ "${actual}" == "${expected}" ]]; then
      echo "fetch-stockfish: checksum ok ${name}"
      return 0
    fi
    echo "fetch-stockfish: ERROR: SHA-256 mismatch for ${name}" >&2
    echo "  url:      ${url}" >&2
    echo "  expected: ${expected}" >&2
    echo "  actual:   ${actual}" >&2
    rm -f "${dest}"
  done
  die "could not download a checksum-valid ${name}"
}

download_nnue "${NNUE_BIG}" "${NNUE_BIG_SHA256}"
download_nnue "${NNUE_SMALL}" "${NNUE_SMALL_SHA256}"

# Swap only after every checksum has passed, so a failed fetch leaves any
# previous good tree in place.
rm -rf "${ENGINE}.incoming"
mv "${STAGE}/engine" "${ENGINE}.incoming"
# The trap would otherwise delete the tree we just moved out of STAGE.
trap - EXIT
rm -rf "${STAGE}"
rm -rf "${ENGINE}"
mv "${ENGINE}.incoming" "${ENGINE}"
printf '%s\n' "${STAMP_BODY}" > "${ENGINE}/.stockfish-fetch-stamp"

echo "fetch-stockfish: installed Stockfish ${TAG}"
echo "  sources:     ${ENGINE}/ (main.cpp, nnue/, incbin/, syzygy/)"
echo "  licence:     ${ENGINE}/Copying.txt"
echo "  authors:     ${ENGINE}/AUTHORS"
echo "  big net:     ${ENGINE}/${NNUE_BIG} ($(wc -c < "${ENGINE}/${NNUE_BIG}") bytes)"
echo "  small net:   ${ENGINE}/${NNUE_SMALL} ($(wc -c < "${ENGINE}/${NNUE_SMALL}") bytes)"

#!/usr/bin/env bash
exec "$(cd "$(dirname "$0")/.." && pwd)/scripts/release/run-all.sh" "$@"

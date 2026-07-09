#!/usr/bin/env bash
# Static SEO baseline for apps/web (Next.js App Router).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WEB="$ROOT/apps/web"
fail=0

check() {
  if ! eval "$2"; then
    echo "✗ SEO: $1"
    fail=1
  else
    echo "✓ SEO: $1"
  fi
}

[ -d "$WEB/app" ] || { echo "✗ apps/web/app missing"; exit 1; }

check "root layout.tsx" "[ -f '$WEB/app/layout.tsx' ]"
check "layout metadata export" "grep -q 'export const metadata' '$WEB/app/layout.tsx'"
check "layout viewport export" "grep -q 'export const viewport' '$WEB/app/layout.tsx'"
check "html lang attribute" "grep -q 'lang=' '$WEB/app/layout.tsx'"
check "lib/seo.ts" "[ -f '$WEB/lib/seo.ts' ]"
check "robots.ts" "[ -f '$WEB/app/robots.ts' ]"
check "sitemap.ts" "[ -f '$WEB/app/sitemap.ts' ]"
check "manifest" "[ -f '$WEB/app/manifest.ts' ] || [ -f '$WEB/public/manifest.webmanifest' ]"
check "favicon / icons" "[ -f '$WEB/public/icons/icon.svg' ] || [ -f '$WEB/app/favicon.ico' ]"
check "privacy page" "[ -f '$WEB/app/privacy/page.tsx' ]"
check "SEO landing learn-chess" "[ -f '$WEB/app/learn-chess/page.tsx' ]"
check "SEO landing chess-for-beginners" "[ -f '$WEB/app/chess-for-beginners/page.tsx' ]"
check "metadataBase / siteUrl in seo" "grep -q 'siteUrl' '$WEB/lib/seo.ts'"

if [ "$fail" -ne 0 ]; then
  echo "✗ Web SEO baseline failed"
  exit 1
fi

echo "✓ Web SEO baseline passed"

#!/usr/bin/env bash
# 把前端产物 + 覆盖层塞进 Android assets，并注入 theme/mobile CSS 与 about.js
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
WEB="$ROOT/android/app/src/main/assets/web"

rm -rf "$WEB"
mkdir -p "$WEB"
cp -r "$ROOT/repo/dist/." "$WEB/"
cp "$ROOT/desktop/web-overlay/theme.css" "$ROOT/desktop/web-overlay/logo.svg" "$WEB/"
cp "$ROOT/android/mobile.css" "$ROOT/desktop/web-overlay/about.js" "$WEB/"

sed -i 's#</head>#<link rel="stylesheet" href="theme.css"><link rel="stylesheet" href="mobile.css"></head>#' "$WEB/index.html"
sed -i 's#</body>#<script src="about.js"></script></body>#' "$WEB/index.html"

echo "android assets ready: $(find "$WEB" -type f | wc -l) files"
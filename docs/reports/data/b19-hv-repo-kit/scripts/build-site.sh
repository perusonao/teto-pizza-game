#!/usr/bin/env bash
# Usage: build-site.sh <source-checkout-dir> <output-dir>
# Builds the pinned B19 source as an isolated Preview site. No Firebase values are passed (none are set in this repo).
set -euo pipefail
SRC="$1"; OUT="$2"
SOURCE_SHA="8137dc3ba61d636d777b05596b8866f5a74a9d03"
BASE="/teto-pizza-game-preview-b19/"
SAVE_KEY="teto-pizza-b19-hv-save-v1"
HERE="$(cd "$(dirname "$0")/.." && pwd)"
cd "$SRC"
[ "$(git rev-parse HEAD)" = "$SOURCE_SHA" ] || { echo "Source HEAD is not the pinned SHA"; exit 1; }
git apply --check "$HERE/patches/b19-save-key.patch"
git apply "$HERE/patches/b19-save-key.patch"
npm ci --no-audit --no-fund
env -u VITE_FIREBASE_API_KEY -u VITE_FIREBASE_AUTH_DOMAIN -u VITE_FIREBASE_PROJECT_ID -u VITE_FIREBASE_APP_ID \
  VITE_PREVIEW_MODE=1 VITE_PREVIEW_PR=783 VITE_PREVIEW_SHA="${SOURCE_SHA:0:7}" VITE_SAVE_KEY_OVERRIDE="$SAVE_KEY" \
  npx vite build --base="$BASE" --outDir "$OUT"
sed -i "s#\"start_url\": \"/teto-pizza-game/\"#\"start_url\": \"$BASE\"#; s#\"scope\": \"/teto-pizza-game/\"#\"scope\": \"$BASE\"#" "$OUT/manifest.webmanifest"
sed -i 's#<meta charset="UTF-8" />#<meta charset="UTF-8" />\n    <meta name="robots" content="noindex, nofollow" />#' "$OUT/index.html"
cat > "$OUT/preview-info.json" <<JSON
{"purpose":"Batch 19 HV (PR #783)","sourceRepo":"perusonao/teto-pizza-game","sourceSha":"$SOURCE_SHA","shortSha":"${SOURCE_SHA:0:7}","patch":"b19-save-key.patch (VITE_SAVE_KEY_OVERRIDE only)","base":"$BASE","saveKey":"$SAVE_KEY","firebase":"not configured","builtAt":"$(date -u +%Y-%m-%dT%H:%M:%SZ)"}
JSON

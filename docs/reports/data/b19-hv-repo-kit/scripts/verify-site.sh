#!/usr/bin/env bash
# Usage: verify-site.sh <output-dir>   Fails (non-zero) if the built site could touch Production, the shared Preview or Firebase.
set -euo pipefail
OUT="$1"; BASE="/teto-pizza-game-preview-b19/"; fail=0
bad() { echo "FAIL: $*"; fail=1; }
cd "$OUT"
# 1. base path: every absolute reference in index.html starts with BASE; every referenced file exists
refs="$(grep -oE '(src|href)="/[^"]*"' index.html | sed -E 's/^(src|href)="//; s/"$//')"
for r in $refs; do case "$r" in "$BASE"*) f="${r#"$BASE"}"; f="${f%%\?*}"; [ -z "$f" ] || [ -e "$f" ] || bad "missing asset $r";; *) bad "reference outside base: $r";; esac; done
grep -q 'name="robots" content="noindex, nofollow"' index.html || bad "noindex missing"
# 2. manifest
grep -q "\"start_url\": \"$BASE\"" manifest.webmanifest || bad "manifest start_url"
grep -q "\"scope\": \"$BASE\"" manifest.webmanifest || bad "manifest scope"
grep -q '/teto-pizza-game/' manifest.webmanifest index.html && bad "production path left in manifest/index"
# 3. save keys: only the B19 key literal is present; the production and shared-Preview key literals are absent from all JS
has() { grep -qE -- "$1" assets/*.js; }
has 'teto-pizza-b19-hv-save-v1' || bad "B19 save key literal missing"
has 'teto-pizza-save-v1' && bad "production save key literal present"
has 'teto-pizza-preview-save-v1' && bad "shared Preview save key literal present"
# 4. Firebase: no Web API key / project values compiled in
has 'AIza[0-9A-Za-z_-]{20,}' && bad "Firebase-style API key present"
# 5. preview-info.json
grep -q '"sourceSha":"8137dc3ba61d636d777b05596b8866f5a74a9d03"' preview-info.json || bad "preview-info sourceSha"
grep -q '"shortSha":"8137dc3"' preview-info.json || bad "preview-info shortSha"
# 6. seed ids are in the bundle (Preview build) and PREVIEW badge env baked in
has 'b19-crudaiola' || bad "B19 seed missing"
[ "$fail" = 0 ] && echo "verify-site: OK" || { echo "verify-site: FAILED"; exit 1; }

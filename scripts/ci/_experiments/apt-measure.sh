#!/usr/bin/env bash
# #643 experiment (branch-only, never merged): measures the apt .deb download/install cost of Playwright's WebKit system deps,
# with and without a restored archive cache. Usage: apt-measure.sh <label> <default|custom> [mutation]
#   default = apt's own /var/cache/apt/archives, custom = Dir::Cache::Archives=$HOME/apt-archives (what a cache would hold).
#   mutation (custom only, applied after a cache restore): corrupt-one | truncate-half | stale-name | empty
set -uo pipefail
label="${1:?label}"; mode="${2:-default}"; mutation="${3:-}"
ARCH_DIR="/var/cache/apt/archives"
[ "$mode" = "custom" ] && ARCH_DIR="$HOME/apt-archives"
now() { date +%s.%N; }
elapsed() { awk -v a="$1" -v b="$2" 'BEGIN{printf "%.1f", b-a}'; }
bytes_of() { # total bytes of *.deb in $1
  find "$1" -maxdepth 1 -name '*.deb' -printf '%s\n' 2> /dev/null | awk '{s+=$1} END{print s+0}'
}
count_of() { find "$1" -maxdepth 1 -name '*.deb' 2> /dev/null | wc -l; }

echo "::group::facts"
. /etc/os-release; echo "os: $PRETTY_NAME  arch: $(dpkg --print-architecture)  ImageOS=${ImageOS:-} ImageVersion=${ImageVersion:-}"
echo "playwright: $(node -e "console.log(require('./node_modules/playwright-core/package.json').version)")"
echo "apt keep-downloaded: $(apt-config dump | grep -i 'Keep-Downloaded\|Dir::Cache::Archives\|Install-Recommends' | tr '\n' ' ')"
echo "archives before: dir=$ARCH_DIR debs=$(count_of "$ARCH_DIR") bytes=$(bytes_of "$ARCH_DIR")"
echo "::endgroup::"

# apt config: the production tuning (scripts/ci/install-with-retry.sh --apt-tuning), plus the archive dir in custom mode
mkdir -p "$HOME/apt-archives"
conf='Acquire::Retries "3";
Acquire::http::Timeout "30";
Acquire::https::Timeout "30";
DPkg::Lock::Timeout "60";'
[ "$mode" = "custom" ] && conf="$conf
Dir::Cache::Archives \"$HOME/apt-archives\";"
printf '%s\n' "$conf" | sudo tee /etc/apt/apt.conf.d/98teto-measure > /dev/null

t0=$(now); sudo apt-get update > /tmp/apt-update.log 2>&1; t1=$(now)
echo "apt-get update: $(elapsed "$t0" "$t1") s (rc ok if index loaded: $(grep -c '^Get\|^Hit' /tmp/apt-update.log) lines)"

# mirror speed probe: one 5.8 MB package (libavcodec60), outside the measured install
probe_dir=$(mktemp -d); t0=$(now)
(cd "$probe_dir" && timeout 120 apt-get download libavcodec60 > /tmp/probe.log 2>&1); prc=$?
t1=$(now); probe_bytes=$(bytes_of "$probe_dir"); probe_s=$(elapsed "$t0" "$t1")
probe_kbps=$(awk -v b="$probe_bytes" -v s="$probe_s" 'BEGIN{ if (s>0) printf "%.0f", b/1024/s; else print 0 }')
echo "mirror probe: rc=$prc bytes=$probe_bytes seconds=$probe_s => ${probe_kbps} KB/s"
rm -rf "$probe_dir"

if [ -n "$mutation" ]; then
  echo "::group::mutation $mutation"
  echo "before: debs=$(count_of "$ARCH_DIR") bytes=$(bytes_of "$ARCH_DIR")"
  case "$mutation" in
    corrupt-one) f=$(find "$ARCH_DIR" -maxdepth 1 -name '*.deb' -printf '%s %p\n' | sort -rn | head -1 | cut -d' ' -f2-); echo "corrupting $f"; dd if=/dev/zero of="$f" bs=1024 count=4 conv=notrunc 2> /dev/null ;;
    truncate-half) i=0; for f in "$ARCH_DIR"/*.deb; do i=$((i+1)); [ $((i % 2)) -eq 0 ] && truncate -s $(( $(stat -c%s "$f") / 2 )) "$f"; done ;;
    stale-name) for f in "$ARCH_DIR"/*.deb; do b=$(basename "$f"); n=${b%%_*}; a=${b##*_}; mv "$f" "$ARCH_DIR/${n}_9.9.9-stale_${a}"; done ;;
    empty) rm -f "$ARCH_DIR"/*.deb ;;
    *) echo "unknown mutation"; exit 2 ;;
  esac
  echo "after: debs=$(count_of "$ARCH_DIR") bytes=$(bytes_of "$ARCH_DIR")"
  echo "::endgroup::"
fi

before_debs=$(count_of "$ARCH_DIR"); before_bytes=$(bytes_of "$ARCH_DIR")
log=$(mktemp)
t0=$(now)
timeout 1500 npx playwright install-deps webkit 2>&1 | tee "$log"
rc=${PIPESTATUS[0]}
t1=$(now)
install_s=$(elapsed "$t0" "$t1")
need=$(grep -m1 'Need to get' "$log" | sed 's/^ *//')
fetched=$(grep -m1 '^Fetched' "$log" | sed 's/^ *//')
echo "::group::post-install facts"
echo "dpkg libavcodec60: $(dpkg -s libavcodec60 2> /dev/null | grep '^Status' || echo 'not installed')"
echo "dpkg xvfb: $(dpkg -s xvfb 2> /dev/null | grep '^Status' || echo 'not installed')"
echo "archives after: debs=$(count_of "$ARCH_DIR") bytes=$(bytes_of "$ARCH_DIR") (default dir debs=$(count_of /var/cache/apt/archives))"
echo "archives dir listing (non-deb): $(ls -la "$ARCH_DIR" | grep -v '\.deb$' | tail -n +2 | awk '{print $1":"$3":"$NF}' | tr '\n' ' ')"
echo "::endgroup::"
printf 'APT-MEASURE {"label":"%s","mode":"%s","mutation":"%s","install_rc":%s,"install_seconds":%s,"debs_before":%s,"bytes_before":%s,"debs_after":%s,"bytes_after":%s,"mirror_probe_kbps":%s,"need_to_get":"%s","fetched":"%s"}\n' \
  "$label" "$mode" "$mutation" "$rc" "$install_s" "$before_debs" "$before_bytes" "$(count_of "$ARCH_DIR")" "$(bytes_of "$ARCH_DIR")" "$probe_kbps" "$need" "$fetched"
exit 0

#!/usr/bin/env bash
# CI/WebKit Efficiency S1: bounded timeout + limited retry for an INSTALL/setup command only
# (used by .github/workflows/e2e-webkit.yml for `npx playwright install --with-deps webkit`).
#
# Playwright tests are never run through this helper and are never retried; this exists because
# the WebKit install step occasionally stalls for 12-15 min (apt / CDN) until the job timeout.
#
#   bash scripts/ci/install-with-retry.sh --status-file F [--timeout SECS] [--attempts N] -- CMD...
#
# Each attempt is killed after --timeout (default 600 = 10 min; healthy installs take 24-45 s, a slow
# apt mirror up to ~9 min -- PR #622 run 39745814119, see docs/reports/TETO_CI_WEBKIT_INSTALL-HARDENING_Result.md).
# At most --attempts attempts are made (default 2 = one retry). Exit status is the last attempt's
# (0 = installed, 124 = timed out, else the command's own status).
#
# Package-manager lock (PR #622): `playwright install --with-deps` runs apt-get as ROOT through sudo. When an
# attempt times out, `timeout` (running as the runner user) kills npx but cannot signal that root apt-get, so
# it keeps running and holds /var/lib/dpkg/lock-frontend. The retry then failed at once with "E: Could not get
# lock ... held by process N (apt-get)" and the step failed although the install was nearly done. The helper
# therefore WAITS (bounded) for apt/dpkg to exit before the first attempt and before a retry; it never kills
# apt/dpkg (an interrupted dpkg needs repair). The retry then finds the packages installed and finishes fast.
#   INSTALL_WAIT_SECS (default 120, 0 = do not wait)   INSTALL_WAIT_POLL_SECS (default 5)
#   INSTALL_WAIT_PROCS (default "apt-get apt dpkg unattended-upgr")
#
# S2: the outcome is recorded in --status-file (key=value lines) for the shard evidence:
#   install_status=incomplete|ok|failed|timeout   (incomplete = written first; still there if this
#                                                  process was killed, e.g. by the job timeout)
#   install_attempts=<n>   install_last_exit=<code>
# `ok` after a retry is still `ok` (attempts > 1 records that a retry was needed).
set -uo pipefail

status_file=""
timeout_secs="${INSTALL_TIMEOUT_SECS:-600}"
attempts="${INSTALL_ATTEMPTS:-2}"
delay="${INSTALL_RETRY_DELAY_SECS:-5}"
wait_secs="${INSTALL_WAIT_SECS:-120}"
wait_poll="${INSTALL_WAIT_POLL_SECS:-5}"
# shellcheck disable=SC2206
wait_procs=(${INSTALL_WAIT_PROCS:-apt-get apt dpkg unattended-upgr})
while [ $# -gt 0 ]; do
  case "$1" in
    --status-file) status_file="$2"; shift 2 ;;
    --timeout) timeout_secs="$2"; shift 2 ;;
    --attempts) attempts="$2"; shift 2 ;;
    --) shift; break ;;
    *) echo "install-with-retry: unknown option '$1'" >&2; exit 2 ;;
  esac
done
if [ $# -eq 0 ] || [ -z "$status_file" ]; then
  echo "usage: install-with-retry.sh --status-file F [--timeout S] [--attempts N] -- CMD..." >&2
  exit 2
fi

write_status() { # status attempts last_exit
  mkdir -p "$(dirname "$status_file")"
  printf 'install_status=%s\ninstall_attempts=%s\ninstall_last_exit=%s\n' "$1" "$2" "$3" > "$status_file"
}

package_manager_busy() {
  local p
  for p in "${wait_procs[@]}"; do
    if pgrep -x "$p" > /dev/null 2>&1; then return 0; fi
  done
  return 1
}

# Wait (at most wait_secs) until no apt/dpkg process is running. Returns 0 when free, 1 when still busy.
wait_for_package_manager() { # label
  local waited=0
  package_manager_busy || return 0
  [ "$wait_secs" -gt 0 ] || return 1
  echo "::warning title=package manager busy::$1: apt/dpkg still running; waiting up to ${wait_secs}s for it to exit"
  while package_manager_busy && [ "$waited" -lt "$wait_secs" ]; do
    sleep "$wait_poll"
    waited=$((waited + wait_poll))
  done
  if package_manager_busy; then
    echo "::warning title=package manager busy::$1: still running after ${waited}s; continuing anyway"
    return 1
  fi
  echo "package manager released after ${waited}s ($1)"
}

write_status incomplete 0 ""
rc=1
n=0
while [ "$n" -lt "$attempts" ]; do
  n=$((n + 1))
  write_status incomplete "$n" ""
  wait_for_package_manager "before attempt $n/$attempts" || true
  echo "::group::install attempt $n/$attempts (timeout ${timeout_secs}s): $*"
  timeout --kill-after=15 "$timeout_secs" "$@"
  rc=$?
  echo "::endgroup::"
  if [ "$rc" -eq 0 ]; then
    write_status ok "$n" 0
    echo "install: ok (attempt $n/$attempts)"
    exit 0
  fi
  if [ "$rc" -eq 124 ] || [ "$rc" -eq 137 ]; then result=timeout; else result=failed; fi
  write_status "$result" "$n" "$rc"
  echo "::warning title=install $result::attempt $n/$attempts $result (exit $rc)"
  if [ "$n" -lt "$attempts" ]; then sleep "$delay"; fi
done
[ "$result" = "timeout" ] && exit 124
exit "$rc"

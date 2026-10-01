#!/usr/bin/env bash
# CI/WebKit Efficiency S1: bounded timeout + limited retry for an INSTALL/setup command only
# (used by .github/workflows/e2e-webkit.yml for `npx playwright install --with-deps webkit`).
#
# Playwright tests are never run through this helper and are never retried; this exists because
# the WebKit install step occasionally stalls for 12-15 min (apt / CDN) until the job timeout.
#
#   bash scripts/ci/install-with-retry.sh --status-file F [--timeout SECS] [--attempts N] -- CMD...
#
# Each attempt is killed after --timeout (default 360 = ~6 min; healthy installs take 30-210 s).
# At most --attempts attempts are made (default 2 = one retry). Exit status is the last attempt's
# (0 = installed, 124 = timed out, else the command's own status).
#
# S2: the outcome is recorded in --status-file (key=value lines) for the shard evidence:
#   install_status=incomplete|ok|failed|timeout   (incomplete = written first; still there if this
#                                                  process was killed, e.g. by the job timeout)
#   install_attempts=<n>   install_last_exit=<code>
# `ok` after a retry is still `ok` (attempts > 1 records that a retry was needed).
set -uo pipefail

status_file=""
timeout_secs="${INSTALL_TIMEOUT_SECS:-360}"
attempts="${INSTALL_ATTEMPTS:-2}"
delay="${INSTALL_RETRY_DELAY_SECS:-5}"
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

write_status incomplete 0 ""
rc=1
n=0
while [ "$n" -lt "$attempts" ]; do
  n=$((n + 1))
  write_status incomplete "$n" ""
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

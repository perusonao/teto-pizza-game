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
# Before every RETRY (never before the first attempt: no orphan can exist yet) it waits -- bounded,
# INSTALL_LOCK_WAIT_SECS, default 180 -- for apt/dpkg to go idle.
# Why: `timeout` stops only the command it started. `npx playwright install --with-deps` runs apt-get
# through sudo, and that root apt-get survives the kill and keeps holding the dpkg lock: the next attempt
# then failed at once with "Could not get lock /var/lib/dpkg/lock-frontend ... held by process N
# (apt-get)" (PR #615 / #622, 2026-10-22, 5 of 5 retries) -- while the orphan went on downloading and
# unpacking. Waiting lets it finish, so the retry starts from installed dependencies.
#
# #627 / run 39801547144 (360x800 shard 1/3): the orphan was a *stalled download* -- it was still holding the lock after
# the whole 180 s wait, so the retry failed on the lock anyway. So after a timeout (124/137) the helper now also stops the
# orphan it caused, before waiting: reap_orphans(). Ownership is deliberately narrow, so another job's / the OS's apt-get
# is never stopped: only `apt-get`/`apt` (never dpkg: a half-run dpkg is left to finish), that did not exist when this
# attempt started (pid snapshot), and that are orphaned (parent = the reaper, pid 1). A foreign apt-get has a live parent
# (unattended-upgrade, apt.systemd.daily, another shell) and is left alone; the wait loop still covers it.
# --apt-tuning (optional) writes an apt.conf.d drop-in so a stalled mirror fails fast instead of hanging: Acquire::Retries,
# Acquire::http(s)::Timeout, DPkg::Lock::Timeout (apt itself waits a bounded time for a lock instead of failing at once).
#
# --apt-cache-dir DIR (#643; needs --apt-tuning's drop-in, so it implies it) points apt's .deb archive (Dir::Cache::Archives) at a
# runner-writable DIR that the workflow saves/restores with actions/cache, so a slow Ubuntu mirror (117 MB at 40-110 KB/s) cannot stall
# the install. A restored cache can be damaged at an unchanged size (a zeroed block): apt does not re-download a same-size file and dpkg
# then dies with "Invalid archive signature". So before every attempt guard_apt_cache() deletes each *.deb in DIR that dpkg-deb cannot
# read (tar stream + control member; ~2.7 s for 187 files); apt re-fetches only those. A miss, an empty DIR or a missing dpkg-deb just
# means a normal (cold) install -- never a skip, a longer timeout or an extra attempt.
#
# Time budget (the workflow's install step `timeout-minutes` must cover it; scripts/ci/test-webkit-ci.sh pins it):
#   worst case = attempts x (timeout + 15 kill-after) + (attempts - 1) x (retry delay + orphan reap + lock wait)
#              = 2 x (360 + 15) + 1 x (5 + 12 + 180) = 947 s (15.8 min) with the defaults and the workflow's flags.
#   (orphan reap = INSTALL_REAP_GRACE_SECS 10 + 2 s after SIGKILL)
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
lock_wait="${INSTALL_LOCK_WAIT_SECS:-180}"
lock_procs="${INSTALL_LOCK_PROCS:-apt-get apt dpkg unattended-upgr}" # process names (pgrep -x), overridable for tests
reap_procs="${INSTALL_REAP_PROCS:-apt-get apt}" # only these may ever be stopped (never dpkg / unattended-upgr), overridable for tests
reap_grace="${INSTALL_REAP_GRACE_SECS:-10}"      # SIGTERM -> SIGKILL grace
reaper_pid="${INSTALL_REAPER_PID:-1}"            # an orphan's parent; overridable for tests (containers with a subreaper)
apt_conf="${INSTALL_APT_CONF:-/etc/apt/apt.conf.d/99teto-ci-install}"
apt_tuning=0
apt_cache_dir=""
while [ $# -gt 0 ]; do
  case "$1" in
    --status-file) status_file="$2"; shift 2 ;;
    --timeout) timeout_secs="$2"; shift 2 ;;
    --attempts) attempts="$2"; shift 2 ;;
    --apt-tuning) apt_tuning=1; shift ;;
    --apt-cache-dir) apt_cache_dir="$2"; apt_tuning=1; shift 2 ;;
    --) shift; break ;;
    *) echo "install-with-retry: unknown option '$1'" >&2; exit 2 ;;
  esac
done
if [ $# -eq 0 ] || [ -z "$status_file" ]; then
  echo "usage: install-with-retry.sh --status-file F [--timeout S] [--attempts N] [--apt-tuning] [--apt-cache-dir DIR] -- CMD..." >&2
  exit 2
fi

apt_busy() {
  local p pid st
  for p in $lock_procs; do
    for pid in $(pgrep -x "$p" 2> /dev/null); do
      st="$(ps -o stat= -p "$pid" 2> /dev/null | tr -d ' ')"
      # A zombie (exited, not yet reaped -- e.g. an orphan under a PID 1 that never reaps) holds no lock; a pid that vanished is not busy.
      case "$st" in Z* | "") ;; *) return 0 ;; esac
    done
  done
  return 1
}

# Waits until no apt/dpkg process is left (a killed attempt's orphan, or the runner's own). Bounded: after
# lock_wait seconds it gives up waiting and lets the attempt run (it then fails visibly on the lock, as before).
wait_for_apt_idle() {
  local waited=0
  while apt_busy; do
    if [ "$waited" -ge "$lock_wait" ]; then
      echo "::warning title=apt busy::apt/dpkg still running after ${lock_wait}s; starting the attempt anyway"
      return 0
    fi
    if [ $((waited % 15)) -eq 0 ]; then echo "install: waiting for apt/dpkg to go idle (${waited}s of ${lock_wait}s)"; fi
    sleep 1
    waited=$((waited + 1))
  done
  if [ "$waited" -gt 0 ]; then echo "install: apt/dpkg idle after ${waited}s"; fi
  return 0
}

# "pid" lines of every process in reap_procs (exact name, not a zombie).
apt_pids() {
  local p pid st
  for p in $reap_procs; do
    for pid in $(pgrep -x "$p" 2> /dev/null); do
      st="$(ps -o stat= -p "$pid" 2> /dev/null | tr -d ' ')"
      case "$st" in Z* | "") ;; *) echo "$pid" ;; esac
    done
  done | sort -n
}

# Stops the apt-get/apt this attempt left behind (see the header for the ownership rules). $1 = pid snapshot taken before the attempt.
reap_orphans() {
  local before="$1" mine="" pid ppid
  for pid in $(apt_pids); do
    grep -qx "$pid" <<< "$before" && continue                                  # already there before the attempt: not ours
    ppid="$(ps -o ppid= -p "$pid" 2> /dev/null | tr -d ' ')"
    [ "$ppid" = "$reaper_pid" ] || continue                                    # has a live parent: someone else's
    mine="$mine $pid"
  done
  [ -z "$mine" ] && return 0
  echo "::warning title=apt orphan::stopping apt left behind by the timed-out attempt (pid$mine)"
  signal_pids TERM $mine
  local i=0
  while [ "$i" -lt "$reap_grace" ] && [ -n "$(alive_of $mine)" ]; do sleep 1; i=$((i + 1)); done
  if [ -n "$(alive_of $mine)" ]; then signal_pids KILL $(alive_of $mine); sleep 2; fi
}
alive_of() { local pid st; for pid in "$@"; do st="$(ps -o stat= -p "$pid" 2> /dev/null | tr -d ' ')"; case "$st" in Z* | "") ;; *) echo "$pid" ;; esac; done; }
signal_pids() { # signal pids... (the orphan is root's: fall back to sudo when the plain kill is refused)
  local sig="$1"; shift
  kill "-$sig" "$@" 2> /dev/null || sudo -n kill "-$sig" "$@" 2> /dev/null || true
}

configure_apt() {
  local body='Acquire::Retries "3";
Acquire::http::Timeout "30";
Acquire::https::Timeout "30";
DPkg::Lock::Timeout "60";'
  if [ -n "$apt_cache_dir" ]; then
    mkdir -p "$apt_cache_dir" 2> /dev/null || echo "::warning title=apt cache::could not create $apt_cache_dir"
    body="$body
Dir::Cache::Archives \"$apt_cache_dir\";"
  fi
  if { mkdir -p "$(dirname "$apt_conf")" && printf '%s\n' "$body" > "$apt_conf"; } 2> /dev/null \
    || printf '%s\n' "$body" | sudo -n tee "$apt_conf" > /dev/null 2>&1; then
    echo "install: apt tuning written to $apt_conf"
  else
    echo "::warning title=apt tuning::could not write $apt_conf; continuing with apt defaults"
  fi
}

# Deletes every unreadable .deb in the cache dir (see the header). Prints what it did; never fails the install.
guard_apt_cache() {
  [ -n "$apt_cache_dir" ] || return 0
  local f total=0 bad=0
  if ! command -v dpkg-deb > /dev/null 2>&1; then echo "::warning title=apt cache::dpkg-deb not found; cache integrity not checked"; return 0; fi
  for f in "$apt_cache_dir"/*.deb; do
    [ -e "$f" ] || continue
    total=$((total + 1))
    if ! dpkg-deb --fsys-tarfile "$f" > /dev/null 2>&1 || ! dpkg-deb -I "$f" > /dev/null 2>&1; then
      echo "install: apt cache: removing unreadable $(basename "$f")"
      rm -f "$f" 2> /dev/null || sudo -n rm -f "$f" 2> /dev/null || true
      bad=$((bad + 1))
    fi
  done
  echo "install: apt cache guard: checked=$total removed=$bad"
}

write_status() { # status attempts last_exit
  mkdir -p "$(dirname "$status_file")"
  printf 'install_status=%s\ninstall_attempts=%s\ninstall_last_exit=%s\n' "$1" "$2" "$3" > "$status_file"
}

write_status incomplete 0 ""
[ "$apt_tuning" -eq 1 ] && configure_apt
rc=1
n=0
while [ "$n" -lt "$attempts" ]; do
  n=$((n + 1))
  write_status incomplete "$n" ""
  if [ "$n" -gt 1 ]; then wait_for_apt_idle; fi
  echo "::group::install attempt $n/$attempts (timeout ${timeout_secs}s): $*"
  guard_apt_cache
  apt_before="$(apt_pids)"
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
  if [ "$result" = "timeout" ]; then reap_orphans "$apt_before"; fi
  echo "::warning title=install $result::attempt $n/$attempts $result (exit $rc)"
  if [ "$n" -lt "$attempts" ]; then sleep "$delay"; fi
done
[ "$result" = "timeout" ] && exit 124
exit "$rc"

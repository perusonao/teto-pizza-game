# CI / WebKit install budget and apt-lock race — Result Report

Date: 2026-10-22. Scope: CI infrastructure only (`.github/workflows/e2e-webkit.yml`, `scripts/ci/install-with-retry.sh`,
`scripts/ci/test-webkit-ci.sh`). No product code, no e2e spec, no shard count, no test selection is changed.

## 1. What failed (PR #615 `aa8f507`, PR #622 `d0efd02`)

| Job (run attempt) | Result | Cause |
|---|---|---|
| #615 `webkit-390x844` shard 1/3 (1) | failed, 0 tests run | install attempt 1 timed out (360 s) → attempt 2 `Could not get lock … held by process 2790 (apt-get)` |
| #615 `webkit-390x844` shard 2/3 (1) | cancelled at the 20 min job cap | install OK, 615 tests listed, tests still running at the cap |
| #615 `webkit-390x844` shard 2/3 (2) | failed, 0 tests run | install timeout → lock (`held by process 2685 (apt-get)`) |
| #615 `webkit-390x844` shard 1/3 (2) | cancelled at the 20 min job cap | same as above |
| #615 `webkit-390x844` shard 2/3 (3) | **passed** (install 52 s, tests 13 m 48 s) | — |
| #615 `webkit-390x844` shard 1/3 (3) | cancelled at the 20 min job cap | install OK but slow (4 m 48 s); tests had run 14 m 30 s and were still running |
| #622 `webkit-360x800` 3/3, `webkit-390x844` 1/3, `webkit-360x800` 1/3 | failed, 0 tests run | install timeout → lock (`held by process` 2883 / 2580 / 2789, all `apt-get`) |

Two distinct failure modes: **5 install failures** (every one a timeout followed by a lock error; evidence `listed 0, executed 0`, so no test body ran)
and **3 cap cancellations** (install fine, tests running). Both PRs touch no browser, workflow or e2e code, and every WebKit shard that got
through the install in time passed on both PRs.

## 2. Root cause 1 — the retry helper creates the apt lock conflict

`install-with-retry.sh` wraps the install in `timeout --kill-after=15 360`. `timeout` stops only the command it started (`npx`). Playwright
runs `apt-get` through `sudo`, and that root `apt-get` survives the kill and keeps running (and keeps the dpkg lock). The retry starts 5 s later
and fails immediately on the lock.

Evidence in the logs of the failed jobs:
- `##[warning]attempt 1/2 timeout (exit 124)` is followed by further apt output (`Get:133 … Get:137 …`) **after** the kill, and by
  `Preparing to unpack .../000-fonts-ipafont-gothic…` after attempt 2 had already failed — the orphan was still downloading and installing.
- `E: Could not get lock … It is held by process N (apt-get)` appears in 5 of 5 retries that followed a timeout, and nowhere else.
- Healthy installs take 24–41 s (main push run 39731795493); the timeout only happens when the Ubuntu mirror is slow (single packages took 20–30 s).

So the retry can never succeed after a timeout: it always races its own predecessor's orphan.

**Fix:** before every attempt the helper waits (bounded, `INSTALL_LOCK_WAIT_SECS`, default 300 s) until no `apt-get`/`apt`/`dpkg`/
`unattended-upgr` process is left. The orphan finishes installing the system dependencies, so the retry starts from an installed state. After
the bound it stops waiting and runs the attempt (it then fails visibly on the lock, exactly as before). Tests are never retried; the install-step
cap (13 min) stays the final backstop.

## 3. Root cause 2 — the 20 min job cap is too tight for a normal slow install

Measured step durations (GitHub job/step timestamps), minutes:seconds:

| Run | Job | setup + `npm ci` | install | list | tests | total |
|---|---|---|---|---|---|---|
| main push `d70bd20` | 390 s1 | 0:57 | 0:24 | 0:04 | 9:46 | 10:55 |
| | 390 s2 | 1:01 | 0:38 | 0:07 | 14:19 | 16:06 |
| | 390 s3 | 1:11 | 0:41 | 0:07 | 12:49 | 14:47 |
| | 360 s1 | 0:44 | 0:40 | 0:07 | 12:53 | 14:31 |
| | 360 s2 | 0:53 | 0:40 | 0:07 | 12:22 | 14:17 |
| | 360 s3 | 1:00 | 0:39 | 0:06 | 10:00 | 11:47 |
| #615 `224a190` | 390 s1 | 0:43 | **2:19** | 0:06 | **15:03** | **18:19** |
| | 390 s3 | 0:42 | 2:02 | 0:04 | 8:53 | 11:43 |
| #615 `aa8f507` rerun | 390 s2 | 0:44 | 0:52 | 0:07 | 13:48 | 15:37 |
| | 390 s1 | 0:50 | **4:48** | 0:06 | ≥14:30 (cancelled) | 20:00 (cap) |

Findings:
- Tests alone take 9–15 min and vary by up to ~50% on the same code (390 s1: 9:46 vs 15:03). The workflow header's estimate (11.6 min) is below the
  observed maximum.
- The job has no room for a slow install: setup 0:50 + install 4:48 + tests 15:00 = 20:40 > 20:00. A 4.8 min install (not a failure — it
  succeeded) was enough to cancel the shard mid-test and fail WebKit Gate.

**New cap: `timeout-minutes: 30`** = setup 1 + install step cap 13 (already enforced by the step's own `timeout-minutes: 13`) + list 0.2 +
longest observed tests 15.1 = 29.3 min. The install step is bounded, so a stalled install still ends at 13 min; the tests step has no new cap, so
a hung test is still bounded by the job (30 min instead of 20). The cost is only paid in the bad case; healthy shards finish in 11–18 min
as before.

## 4. Verification

- `bash scripts/ci/test-webkit-ci.sh`: 116/116 (was 107). New cases (hermetic; a fake `apt-get`-named process stands in for the orphan):
  orphan after a timeout → the retry waits and then succeeds; **same scenario with the wait disabled fails with the lock error (negative
  control, i.e. the test bites)**; the wait is bounded (an 8 s orphan with a 1 s bound does not hang and the attempt still runs);
  the webkit job cap ≥ install step cap + 17 min (keeps the budget arithmetic from regressing).
- `bash -n` on both scripts; the workflow YAML parses (`webkit.timeout-minutes = 30`, install step `13`).
- `shellcheck` is not installed in this environment (not run).
- The runner-side behavior (a real slow mirror) cannot be reproduced locally; it is verified by the CI of this PR's own WebKit run.

## 5. Not changed

Test content, specs, shard count (3), projects, retries for Playwright tests (still 0), the install timeout (360 s) and attempts (2), the
install step cap (13 min), WebKit Gate / evidence logic.

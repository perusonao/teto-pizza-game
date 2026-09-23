# Dev CI Phase 2A: 4-way Sharded Full WebKit — Result (Issue #207)

- Issue: #207, Phase 2A only. Design SSOT: PR #208,
  `docs/reports/TETO_DEV-CI_WEBKIT-PHASE2_Fresh-Audit.md`.
- PR: #210, branch `claude/issue-207-phase-2a-webkit-shards`, based on `main` @ `66abe43`
  (merge of PR #202).
- Scope: CI workflows and CI scripts only. There is no change to specs, `playwright.config.ts`,
  runtime code, Progression 2.0 or OD-03. PR #204/#205/#206/#208 were not touched.
  - Phase 2B (affected-test selection) is not implemented.
  - Phase 2C (Vite reachability skip) is not implemented.
- Human Verification policy: not applicable. There is no UI/UX/gameplay change.

## 1. What changed

| File | Change |
|---|---|
| `.github/workflows/e2e-webkit.yml` | `webkit` becomes a static matrix `{webkit-390x844, webkit-360x800} × {--shard 1/2, 2/2}` with `fail-fast: false`. Each shard lists its project's full selection, runs its slice, and uploads evidence plus its own HTML report. New triggers: `push: main` and `workflow_dispatch`. Concurrency is per PR (cancel superseded runs) or per commit for push/dispatch (never cancelled). The gate's steps are all `if: always()`. |
| `scripts/ci/webkit-shard-evidence.mjs` | **New.** `collect` (per shard) and `verify` (in the gate), with a built-in `--self-test` of 22 cases |
| `scripts/ci/webkit-gate.sh` | **New.** The gate truth table, moved out of inline YAML so it can be tested. It adds the evidence verification and a `level=` token. |
| `scripts/ci/classify-webkit-pr.sh` | Push/dispatch events always run Full. The `webkit-full` PR label forces Full. The #203 rules are unchanged. |
| `scripts/ci/test-webkit-ci.sh` | **New.** 40 hermetic cases, run in `ci.yml` |
| `.github/workflows/ci.yml` | Adds a step that runs the test harness above; lint, Vitest and build are unchanged |
| `docs/PROJECT_HANDOFF.md` | CI/WebKit Gate section updated |

Unchanged from #203:
- There is no top-level `paths:` filter.
- Docs-only PRs skip WebKit.
- Evidence reuse still requires the same `tested_base`.
- A classifier error still falls back to Full (fail-safe).
- Each runner still uses Playwright's default 2 workers, and `retries: 0` is unchanged.

## 2. Job structure

```
pull_request / push(main) / workflow_dispatch
 ├─ classify ── webkit_required=true|false, reason, tested_base
 │     push / dispatch → true · label webkit-full → true · docs-only / reuse → false · error → true
 ├─ webkit (static matrix, runs unless classify succeeded with "false")
 │     webkit-390x844 shard 1/2 · webkit-390x844 shard 2/2
 │     webkit-360x800 shard 1/2 · webkit-360x800 shard 2/2
 │       each: --list full project selection → run --shard i/2 → evidence artifact
 └─ WebKit Gate (always) ── scripts/ci/webkit-gate.sh
       required & matrix=success & evidence verified → PASS
       required & anything else (failure/cancelled/skipped/missing evidence) → FAIL
       not required & skipped → PASS (safely skipped / reused)
```

The matrix is static on purpose: it is never built from classify outputs. A failed or garbled
classify therefore still produces a real Full run, instead of an empty or errored matrix.

### Evidence check (what makes a green shard matrix trustworthy)

Each shard runs `playwright test --list --project=P` for the **full** selection, without
`--shard`. It then runs its slice with the JSON reporter, and uploads
`webkit-evidence-<project>-shard<i>`. `WebKit Gate` FAILS unless all of the following hold:

1. The projects present are exactly `webkit-390x844` and `webkit-360x800`.
2. Each project has shards 1..N, each exactly once, with a consistent N.
3. All shards of a project listed the same selection, and that selection is non-empty with
   unique keys.
4. Both projects listed the same tests, so every spec runs at both viewports.
5. Every listed test ran in exactly one shard, and nothing unlisted ran.
6. Every executed test has status `expected`. The only exception is an intentional
   `test.skip`/`fixme` (expected status `skipped`). Failed, flaky or not-run tests fail the
   check.
7. The executed total for each project equals its listed total.

Test key: file + title path. Playwright's `spec.id` differs per project, and line numbers are
not a stable identity. Playwright rejects duplicate titles within a file, so the key is unique.

### Forced Full paths

| Path | Behaviour |
|---|---|
| Merge to `main` (`push`) | Full, post-merge. Concurrency group `…-push-<sha>`, never cancelled. It also writes the Playwright browser cache in `main`'s scope, which PR runs can then restore (§4). |
| `workflow_dispatch` | Full on any ref (Actions → E2E WebKit → Run workflow) |
| PR label `webkit-full` | Full on that PR's next push or re-run. It bypasses both the docs-only skip and evidence reuse. Labels are read live via the API, falling back to the event payload. There is deliberately **no** `labeled` trigger, because with PR-scoped `cancel-in-progress` a label event would cancel a running WebKit run. |
| classify failure / unknown output | Full (unchanged fail-safe) |

### Concurrency and cancellation cannot produce a false green

- A superseded PR run is cancelled, so its matrix result is `cancelled`. The gate runs anyway
  (`always()`, and every step is `always()` too) and FAILS. The new head gets its own run.
- One failed shard gives a matrix result of `failure`, and the gate FAILS. `fail-fast: false`
  means the other shards still finish and report.
- A missing shard or duplicated shard index fails the evidence check, even if every job that
  did run was green.
- Push/dispatch runs use per-commit groups, so a PR run can never cancel a post-merge run, and
  vice versa.

## 3. Verification

### Automated (hermetic, runs in `ci.yml`)

`bash scripts/ci/test-webkit-ci.sh` → **40/40 passed**, both locally and in CI run
35915926208 (`build` job, success). The cases:

- the #201 path classifier self-test;
- the shard evidence self-test (22 cases): missing shard, duplicated shard, test in two shards,
  test never ran, unlisted test, failed/flaky/unintended skip, empty selection, viewport
  mismatch, inconsistent totals, out-of-range index, extra project, bad schema, collect-time
  error, no evidence;
- the evidence CLI round trip on Playwright-shaped JSON;
- the Gate truth table (19 cases): every classify × webkit result × evidence combination,
  including cancelled/skipped/failed shards, classify failure (fail-safe) and garbage outputs;
- `classify-webkit-pr.sh` in a throwaway git repo: docs-only → skip, runtime → run,
  push/dispatch → Full, `webkit-full` label → Full (another label does not force), docs-only
  push without gate evidence → run, missing/unknown SHAs → fail-safe run.

Mutation check (not committed):
- making the gate skip verification → 4 cases fail;
- disabling the label rule → 1 case fails.

So the harness detects both regressions.

### Static checks

- actionlint 1.7.7 with shellcheck 0.11.0 runs clean on all four workflows.
- shellcheck runs clean on `scripts/ci/*.sh`.
- `npm run lint` (oxlint) is clean.

### Shard split, local `--list` against real Playwright 1.56.1

| Project | Full | shard 1/2 | shard 2/2 | overlap | missing |
|---|---|---|---|---|---|
| webkit-390x844 | 57 | 29 | 28 | 0 | 0 |
| webkit-360x800 | 57 | 29 | 28 | 0 | 0 |

Both projects list identical test keys.

End-to-end check against real reporter output: the same pipeline (list, run `--shard`, collect,
verify) ran on the Chromium `iphone-*` projects, because WebKit cannot be downloaded in the
sandbox. Result: 4 shards, 29/28/29/28 = **114 passed, verify OK**. Dropping one shard's
evidence and duplicating shard 1 over shard 2 both FAIL with named missing tests.

### Real GitHub Actions: PR #210, head `0d5e2f9`, E2E WebKit run 35915926205

| Job | Queued → start | Setup¹ | `install --with-deps` | Test step | Tests | Evidence |
|---|---|---|---|---|---|---|
| webkit-390x844 shard 1/2 | 3s | 55s | 36s | **2m31s** | 29 passed (2.5m) | listed 57, executed 29 |
| webkit-390x844 shard 2/2 | 4s | 68s | 48s | **1m40s** | 28 passed | listed 57, executed 28 |
| webkit-360x800 shard 1/2 | 2s | 90s | 70s | **2m21s** | 29 passed (2.3m) | listed 57, executed 29 |
| webkit-360x800 shard 2/2 | 38s² | 78s | 57s | **1m37s** | 28 passed (1.6m) | listed 57, executed 28 |

¹ Checkout through the list step.
² Runner availability: this job started ~36s after the others.

- `classify`: 14s. Reason: "6 of 6 changed file(s) are not documentation-only", so
  `webkit_required=true`.
- `WebKit Gate`: 9s. **PASS — Full WebKit required; all shards passed and coverage verified.**
  It downloaded 4/4 evidence artifacts. Notice:
  `tested_base=66abe43a6b1057e7d2ab8fcc8c51c8e76b97b167 level=full`.
- **Full total: 114 tests (57 × 2 viewports), 114 passed.** This is the same count as the
  pre-change single job on `main` (114 via `--list`; the run-89 log showed 116 only because it
  included PR #206's extra spec).
- `CI` (run 35915926208): success, including the new harness step.

## 4. Before / after wall-clock

| | Before (#203, 1 runner × 2 workers) | After (Phase 2A, 4 runners × 2 workers) |
|---|---|---|
| Workflow wall-clock (run created → gate done) | **7m25s – 8m47s** (5 runs, audit §2.1) | **4m30s** (run 35915926205) |
| WebKit test step | 5m44s – 7m07s (one job) | longest shard **2m31s** (shards: 2m31s / 1m40s / 2m21s / 1m37s) |
| Setup per job | 39 – 71s | 55 – 90s (4 concurrent apt installs on a cold cache) |
| Runner-minutes (webkit jobs) | ~7.5 – 8.5 | ~13.5 (sum of the 4 jobs) |

- Wall-clock is **−39% to −49%**. That is inside the audit's 3.3–4.3 min estimate band, but at
  its slow edge. The main reasons:
  1. The browser cache still missed. PR caches only see `main`'s entries, and `main` has none
     until the `push: main` job of this PR runs after merge.
  2. `install --with-deps` took 36–70s per shard.
  3. One shard waited ~36s for a runner.
- The shards are unbalanced: shard 1 takes about 2.4 min and shard 2 about 1.6 min, because
  Playwright splits by test count and the cold-compiling first tests plus the longer specs
  land in shard 1. Rebalancing (e.g. `--shard` over 3 per project, or ordering) is a possible
  later tweak. It is not needed for correctness.
- Expected steady state after merge: a warm `main` browser cache saves ~5–10s per shard. The
  apt step dominates setup and is not cacheable, so ~4–4.5 min remains realistic for Full.
  Phase 2B (affected-only) is where the next larger saving comes from.

A single run is a thin sample. The before figures came from 5 runs, and the after figure should
be re-measured on the next few Full runs (including the first post-merge `push: main` run).

## 5. Coverage difference

**None.**
- Same spec files and same two WebKit projects.
- Same test count (114): per project, the union of shards equals the full `--list` selection,
  with no overlap.
- Nothing is filtered by grep or tag, and no test was edited.

The gate now also *proves* this on every run. The previous single job only proved "exit 0".

## 6. Notes / follow-ups

- **Required check:** the per-shard check names changed from `webkit` to
  `webkit <project> shard i/2`. If branch protection currently requires `webkit`, switch it to
  **`WebKit Gate`**, as the #203 report already recommended. Branch protection is not visible
  from this session.
- Not demonstrated live: a real failing, cancelled or missing shard on GitHub. These paths are
  covered by the hermetic truth table. Forcing a red run on this PR would have meant pushing a
  deliberately broken commit.
- Rollback: `git revert` of the Phase 2A commit. `WebKit Gate` keeps its name.
- Phase 2B readiness: the matrix, evidence and gate are in place, and the `level=` token is
  already written for Phase 2B's reuse check. Phase 2B can start after this PR is reviewed,
  merged, and one post-merge `push: main` Full run is green.
